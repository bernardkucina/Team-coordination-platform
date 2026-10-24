import type { Member as DbMember, Tier as DbTier } from '@prisma/client';
import { TIER_HOURS, type Member, type Tier } from '@hub-pulse/shared';
import { fromDbDate } from '../../core/clock';

const TIER_NAMES: Record<DbTier, Tier> = { GO: 'ShapersGO', IMPACT: 'Shapers Impact', CORE: 'Shapers Core' };

export const tierName = (tier: DbTier): Tier => TIER_NAMES[tier];

export const tierFromName = (name: Tier): DbTier =>
  (Object.keys(TIER_NAMES) as DbTier[]).find((k) => TIER_NAMES[k] === name)!;

/** The roster sheet says "GO!", "Impact" and "Core". */
export const tierFromRoster = (value: string): DbTier => {
  const v = value.trim().toLowerCase();
  if (v.startsWith('go')) return 'GO';
  if (v === 'impact') return 'IMPACT';
  if (v === 'core') return 'CORE';
  throw new Error(`Unknown tier "${value}"`);
};

export const commitmentOf = (tier: DbTier): number => TIER_HOURS[tierName(tier)];

export const initialsOf = (name: string): string => {
  const words = name.trim().split(/\s+/);
  const letters = words.length > 1 ? words[0][0] + words[words.length - 1][0] : words[0].slice(0, 2);
  return letters.toLocaleUpperCase('sl');
};

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** Member id from an email: "ana.kovac@…" → "ana-kovac". */
export const memberIdFromEmail = (email: string): string => email.split('@')[0].toLowerCase().replace(/[^a-z0-9]+/g, '-');

export interface MemberStats {
  picked: number;
  ideas: number;
  pastWeeks: number[];
}

export const toMember = (m: DbMember, stats: MemberStats = { picked: 0, ideas: 0, pastWeeks: [] }): Member => {
  const joined = m.joinedOn ? fromDbDate(m.joinedOn) : null;
  return {
    id: m.id,
    name: m.name,
    initials: initialsOf(m.name),
    tier: tierName(m.tier),
    isAdmin: m.isAdmin,
    since: joined ? `${MONTHS[Number(joined.slice(5, 7)) - 1]} ${joined.slice(0, 4)}` : '',
    picked: stats.picked,
    ideas: stats.ideas,
    pastWeeks: stats.pastWeeks,
    email: m.email,
    active: m.active,
  };
};
