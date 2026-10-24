import type { Member as DbMember } from '@prisma/client';
import type { UpdateMemberRequest } from '@hub-pulse/shared';
import { db } from '../../core/db';
import { badRequest, notFound } from '../../core/errors';
import { tierFromName } from './mapping';

export const listMembers = (opts: { includeInactive?: boolean } = {}): Promise<DbMember[]> =>
  db.member.findMany({ where: opts.includeInactive ? {} : { active: true }, orderBy: { name: 'asc' } });

export const findMemberByEmail = (email: string): Promise<DbMember | null> =>
  db.member.findUnique({ where: { email: email.trim().toLowerCase() } });

export const getMember = async (id: string): Promise<DbMember> => {
  const member = await db.member.findUnique({ where: { id } });
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
    data: {
      ...(patch.tier !== undefined && { tier: tierFromName(patch.tier) }),
      ...(patch.isAdmin !== undefined && { isAdmin: patch.isAdmin }),
      ...(patch.active !== undefined && { active: patch.active }),
    },
  });
