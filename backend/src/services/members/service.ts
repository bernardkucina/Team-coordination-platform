import type { Member as DbMember, Tier as DbTier } from '@prisma/client';
import { areaById, type AreaId, type UpdateMemberRequest } from '@hub-pulse/shared';
import { db } from '../../core/db';
import { badRequest, conflict, forbidden, notFound } from '../../core/errors';
import { memberIdFromEmail, tierFromName, type DbMemberWithAreas } from './mapping';

const withAreas = { areas: { select: { areaId: true }, orderBy: { createdAt: 'asc' } } } as const;

export const listMembers = (opts: { includeInactive?: boolean } = {}): Promise<DbMemberWithAreas[]> =>
  db.member.findMany({ where: opts.includeInactive ? {} : { active: true }, orderBy: { name: 'asc' }, include: withAreas });

export const findMemberByEmail = (email: string): Promise<DbMember | null> =>
  db.member.findUnique({ where: { email: email.trim().toLowerCase() } });

export const getMember = async (id: string): Promise<DbMemberWithAreas> => {
  const member = await db.member.findUnique({ where: { id }, include: withAreas });
  if (!member) throw notFound('Member');
  return member;
};

/** Throws a 400 when any id is not an active member. */
export const assertMembersExist = async (ids: (string | null | undefined)[]): Promise<void> => {
  const wanted = [...new Set(ids.filter((x): x is string => !!x))];
  if (!wanted.length) return;
  const found = await db.member.count({ where: { id: { in: wanted }, active: true } });
  if (found !== wanted.length) throw badRequest('Unknown or inactive member.');
};

export const updateMember = (id: string, patch: UpdateMemberRequest): Promise<DbMember> =>
  db.member.update({
    where: { id },
    data: { ...(patch.tier !== undefined && { tier: tierFromName(patch.tier) }) },
  });

/* ---------- areas (each member for themselves) ---------- */

/** Joins or leaves an area. Core-only areas (Strategy, Finance) are for Shapers Core. Returns the member's areas. */
export const setMemberArea = async (memberId: string, areaId: AreaId, joined: boolean): Promise<AreaId[]> => {
  const member = await getMember(memberId);
  const area = areaById(areaId);
  if (joined) {
    if (area.coreOnly && member.tier !== 'CORE') throw forbidden(`Only Shapers Core members can join ${area.name}.`);
    await db.memberArea.upsert({ where: { memberId_areaId: { memberId, areaId } }, create: { memberId, areaId }, update: {} });
  } else {
    await db.memberArea.deleteMany({ where: { memberId, areaId } });
  }
  const rows = await db.memberArea.findMany({ where: { memberId }, orderBy: { createdAt: 'asc' }, select: { areaId: true } });
  return rows.map((r) => r.areaId as AreaId);
};

/* ---------- access (used by the access service, i.e. the super admin) ---------- */

export const createMember = async (input: { name: string; email: string; tier: DbTier; isAdmin: boolean }): Promise<DbMember> => {
  const email = input.email.trim().toLowerCase();
  if (await findMemberByEmail(email)) throw conflict('Someone with that email already has access.');
  const base = memberIdFromEmail(email);
  let id = base;
  for (let n = 2; await db.member.findUnique({ where: { id }, select: { id: true } }); n++) id = `${base}-${n}`;
  return db.member.create({ data: { id, email, name: input.name.trim(), tier: input.tier, isAdmin: input.isAdmin } });
};

/**
 * Changes someone's role or switches their access off and on. Switching access off also signs them out.
 * There must always be at least one active admin, or nobody could run the hub.
 */
export const setAccess = async (id: string, patch: { isAdmin?: boolean; active?: boolean }): Promise<DbMember> => {
  const member = await getMember(id);
  const staysAdmin = (patch.isAdmin ?? member.isAdmin) && (patch.active ?? member.active);
  if (member.isAdmin && member.active && !staysAdmin) {
    const otherAdmins = await db.member.count({ where: { isAdmin: true, active: true, id: { not: id } } });
    if (otherAdmins === 0) throw badRequest('This is the last active admin. Make someone else admin first.');
  }
  const updated = await db.member.update({
    where: { id },
    data: { ...(patch.isAdmin !== undefined && { isAdmin: patch.isAdmin }), ...(patch.active !== undefined && { active: patch.active }) },
  });
  if (patch.active === false) await db.session.deleteMany({ where: { memberId: id } });
  return updated;
};

/* ---------- Slack account link (used by the slack and access services) ---------- */

export const findMemberBySlackUserId = (slackUserId: string): Promise<DbMember | null> =>
  db.member.findFirst({ where: { slackUserId, active: true } });

export const setSlackUserId = (id: string, slackUserId: string | null): Promise<DbMember> =>
  db.member.update({ where: { id }, data: { slackUserId } });

/** Changing the Slack email forgets the old Slack user, so it is looked up again. */
export const setSlackEmail = (id: string, slackEmail: string | null): Promise<DbMember> =>
  db.member.update({ where: { id }, data: { slackEmail: slackEmail?.trim().toLowerCase() || null, slackUserId: null } });
