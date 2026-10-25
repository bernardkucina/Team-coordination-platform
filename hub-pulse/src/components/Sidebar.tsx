'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import { useStore } from '@/lib/store';
import { TIER_HOURS } from '@/lib/types';
import { Avatar, Icon } from './ui';

const MEMBER_NAV = [
  { href: '/today', label: 'Today', icon: Icon.sun },
  { href: '/projects', label: 'Projects', icon: Icon.board },
  { href: '/analytics', label: 'Pulse', icon: Icon.chart },
];

const ADMIN_NAV = [
  { href: '/today', label: 'Today', icon: Icon.sun },
  { href: '/projects', label: 'Projects', icon: Icon.board },
  { href: '/team', label: 'Team', icon: Icon.team },
  { href: '/analytics', label: 'Pulse', icon: Icon.chart },
];

export function Sidebar() {
  const { state, dispatch, me, isAdmin, flash } = useStore();
  const pathname = usePathname();
  const nav = isAdmin ? ADMIN_NAV : MEMBER_NAV;

  // Navigation lives behind the burger: hover to peek, click to keep it open. The page always gets the full width.
  const [pinned, setPinned] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);
  useEffect(() => { document.body.classList.add('menu-closed'); }, []);
  useEffect(() => { setPinned(false); }, [pathname]);
  useEffect(() => {
    if (!pinned) return;
    const close = (e: MouseEvent) => { if (wrap.current && !wrap.current.contains(e.target as Node)) setPinned(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setPinned(false); };
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('mousedown', close); document.removeEventListener('keydown', esc); };
  }, [pinned]);

  return (
    <>
    <div className={pinned ? 'menu-hover pinned' : 'menu-hover'} ref={wrap} onMouseLeave={() => setPinned(false)}>
      <button type="button" className="menu-toggle" aria-label="Menu" aria-expanded={pinned} onClick={() => setPinned(!pinned)}>
        <span /><span /><span />
      </button>
      <div className="menu-peek" role="menu" aria-label="Go to">
        {nav.map((item) => (
          <Link key={item.href} href={item.href} role="menuitem" aria-current={pathname.startsWith(item.href) ? 'page' : undefined}>
            {item.icon}
            {item.label}
          </Link>
        ))}
        <button type="button" role="menuitem" className="menu-logout" onClick={() => { setPinned(false); flash('Signed out. In the real app this ends your Google session.'); }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3" /><polyline points="10 8 6 12 10 16" /><line x1="6" y1="12" x2="16" y2="12" />
          </svg>
          Log out
        </button>
        <div className="menu-peek-foot">
          <span className="tiny">Demo: view as</span>
          <div className="role-switch" role="group" aria-label="View as">
            <button type="button" aria-pressed={state.role === 'member'} onClick={() => dispatch({ type: 'setRole', role: 'member' })}>Member</button>
            <button type="button" aria-pressed={state.role === 'admin'} onClick={() => dispatch({ type: 'setRole', role: 'admin' })}>Admin</button>
          </div>
          <span className="tiny">{me.name}{isAdmin ? ' · admin' : ''}</span>
        </div>
      </div>
    </div>
    <nav className="sidebar" aria-label="Main" hidden>
      <div className="brand">
        <span className="brand-mark">{Icon.hub}</span>
        <span><strong>Shapers Hub</strong><small>Ljubljana</small></span>
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
    </>
  );
}
