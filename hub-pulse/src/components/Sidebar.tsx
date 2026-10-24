'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useStore } from '@/lib/store';
import { TIER_HOURS } from '@/lib/types';
import { Avatar, Icon } from './ui';

const MEMBER_NAV = [
  { href: '/today', label: 'Today', icon: Icon.sun },
  { href: '/projects', label: 'Projects', icon: Icon.board },
  { href: '/analytics', label: 'Analytics', icon: Icon.chart },
];

const ADMIN_NAV = [
  { href: '/today', label: 'Today', icon: Icon.sun },
  { href: '/projects', label: 'Projects', icon: Icon.board },
  { href: '/team', label: 'Team', icon: Icon.team },
  { href: '/analytics', label: 'Analytics', icon: Icon.chart },
];

export function Sidebar() {
  const { state, dispatch, me, isAdmin } = useStore();
  const pathname = usePathname();
  const nav = isAdmin ? ADMIN_NAV : MEMBER_NAV;

  return (
    <nav className="sidebar" aria-label="Main">
      <div className="brand">
        <span className="brand-mark">{Icon.pulse}</span>
        <span><strong>Hub Pulse</strong><small>Ljubljana Hub</small></span>
      </div>

      <div className="stack" style={{ gap: 6 }}>
        <span className="eyebrow">Demo: view as</span>
        <div className="role-switch" role="group" aria-label="View as">
          <button type="button" aria-pressed={state.role === 'member'} onClick={() => dispatch({ type: 'setRole', role: 'member' })}>Member</button>
          <button type="button" aria-pressed={state.role === 'admin'} onClick={() => dispatch({ type: 'setRole', role: 'admin' })}>Admin</button>
        </div>
      </div>

      <div className="nav">
        {nav.map((item) => (
          <Link key={item.href} href={item.href} aria-current={pathname.startsWith(item.href) ? 'page' : undefined}>
            {item.icon}
            {item.label}
          </Link>
        ))}
      </div>

      <div className="me">
        <Avatar initials={me.initials} />
        <span>
          <span className="strong" style={{ fontSize: 14 }}>{me.name}{isAdmin ? ' · admin' : ''}</span>
          <small>{me.tier} · {TIER_HOURS[me.tier]} h / week</small>
        </span>
      </div>
    </nav>
  );
}
