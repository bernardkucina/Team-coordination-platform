'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { TIER_HOURS, type AccessMember, type Role, type Tier } from '@hub-pulse/shared';
import { api } from '@/lib/api';
import { Avatar, Icon } from './ui';

const TIERS = Object.keys(TIER_HOURS) as Tier[];

const initials = (name: string) => {
  const words = name.trim().split(/\s+/);
  return (words.length > 1 ? words[0][0] + words[words.length - 1][0] : words[0].slice(0, 2)).toLocaleUpperCase('sl');
};

/**
 * What the super admin sees: who has access and who is an admin. Nothing about tasks, hours or meetings.
 * The super admin is not a member and is not in this list.
 */
export function AccessConsole({ onSignOut }: { onSignOut: () => Promise<void> }) {
  const [members, setMembers] = useState<AccessMember[] | null>(null);
  const [message, setMessage] = useState<{ text: string; bad?: boolean } | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [filter, setFilter] = useState('');
  const [draft, setDraft] = useState({ name: '', email: '', tier: 'ShapersGO' as Tier, role: 'member' as Role });
  const [adding, setAdding] = useState(false);

  const load = () =>
    api.accessMembers()
      .then(setMembers)
      .catch((err: unknown) => setMessage({ text: err instanceof Error ? err.message : 'Could not load members.', bad: true }));

  useEffect(() => {
    void load();
  }, []);

  const change = async (m: AccessMember, patch: { role?: Role; active?: boolean }, done: string) => {
    setBusyId(m.id);
    setMessage(null);
    try {
      const updated = await api.updateAccess(m.id, patch);
      setMembers((list) => list?.map((x) => (x.id === m.id ? updated : x)) ?? null);
      setMessage({ text: done });
    } catch (err) {
      setMessage({ text: err instanceof Error ? err.message : 'Could not save.', bad: true });
    } finally {
      setBusyId(null);
    }
  };

  const add = async (e: FormEvent) => {
    e.preventDefault();
    if (!draft.name.trim() || !draft.email.trim()) {
      setMessage({ text: 'Enter a name and an email.', bad: true });
      return;
    }
    setAdding(true);
    setMessage(null);
    try {
      const created = await api.addAccessMember({ ...draft, name: draft.name.trim(), email: draft.email.trim() });
      setMembers((list) => [...(list ?? []), created].sort((a, b) => a.name.localeCompare(b.name, 'sl')));
      setMessage({ text: `${created.name} can now sign in${created.role === 'admin' ? ' as an admin' : ''}.` });
      setDraft({ name: '', email: '', tier: 'ShapersGO', role: 'member' });
    } catch (err) {
      setMessage({ text: err instanceof Error ? err.message : 'Could not add the person.', bad: true });
    } finally {
      setAdding(false);
    }
  };

  const q = filter.trim().toLowerCase();
  const shown = (members ?? []).filter((m) => !q || m.name.toLowerCase().includes(q) || m.email.includes(q));
  const admins = (members ?? []).filter((m) => m.role === 'admin' && m.active).length;
  const inactive = (members ?? []).filter((m) => !m.active).length;

  return (
    <div className="shell">
      <nav className="sidebar" aria-label="Main">
        <div className="brand">
          <span className="brand-mark">{Icon.pulse}</span>
          <span><strong>Hub Pulse</strong><small>Access management</small></span>
        </div>
        <div className="me">
          <Avatar initials="SA" />
          <span>
            <span className="strong" style={{ fontSize: 14 }}>super admin</span>
            <small>Manages access only</small>
            <button type="button" className="signout" onClick={() => void onSignOut()}>Sign out</button>
          </span>
        </div>
      </nav>

      <main className="main">
        <div className="container">
          <header className="page-head">
            <div>
              <span className="kicker">{members ? `${members.length} people · ${admins} active admins · ${inactive} without access` : 'Loading…'}</span>
              <h1>Access</h1>
            </div>
          </header>

          {message ? (
            <p role="status" className="small" style={{ margin: 0, color: message.bad ? 'var(--bad)' : 'var(--good)', fontWeight: 600 }}>{message.text}</p>
          ) : null}

          <form className="card" aria-labelledby="add-h" onSubmit={(e) => void add(e)} noValidate>
            <h2 id="add-h">Give someone access</h2>
            <div className="inline" style={{ alignItems: 'flex-end', gap: 12 }}>
              <div className="field-group" style={{ flex: '2 1 180px' }}>
                <label className="label" htmlFor="a-name">Name</label>
                <input id="a-name" className="field" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
              </div>
              <div className="field-group" style={{ flex: '2 1 220px' }}>
                <label className="label" htmlFor="a-email">Email</label>
                <input id="a-email" className="field" type="email" value={draft.email} onChange={(e) => setDraft({ ...draft, email: e.target.value })} />
              </div>
              <div className="field-group" style={{ flex: '1 1 150px' }}>
                <label className="label" htmlFor="a-tier">Tier</label>
                <select id="a-tier" className="field" value={draft.tier} onChange={(e) => setDraft({ ...draft, tier: e.target.value as Tier })}>
                  {TIERS.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div className="field-group" style={{ flex: '1 1 120px' }}>
                <label className="label" htmlFor="a-role">Role</label>
                <select id="a-role" className="field" value={draft.role} onChange={(e) => setDraft({ ...draft, role: e.target.value as Role })}>
                  <option value="member">Member</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
              <button type="submit" className="btn btn-primary" disabled={adding} style={{ minHeight: 40 }}>{adding ? 'Adding…' : 'Add'}</button>
            </div>
          </form>

          <section className="card" aria-labelledby="people-h">
            <div className="between">
              <h2 id="people-h">People</h2>
              <label className="sr-only" htmlFor="a-filter">Search people</label>
              <input id="a-filter" className="field" placeholder="Search name or email" value={filter} onChange={(e) => setFilter(e.target.value)} style={{ width: 240 }} />
            </div>
            <div className="scroll-x">
              <table className="table" style={{ minWidth: 640 }}>
                <thead>
                  <tr><th>Person</th><th>Tier</th><th>Role</th><th>Access</th></tr>
                </thead>
                <tbody>
                  {shown.map((m) => (
                    <tr key={m.id} style={{ opacity: m.active ? 1 : 0.6 }}>
                      <td>
                        <span className="inline" style={{ gap: 10, flexWrap: 'nowrap' }}>
                          <Avatar small initials={initials(m.name)} />
                          <span className="stack" style={{ gap: 0 }}>
                            <span style={{ fontWeight: 600 }}>{m.name}</span>
                            <span className="tiny muted">{m.email}</span>
                          </span>
                        </span>
                      </td>
                      <td className="small">{m.tier}</td>
                      <td>
                        <label className="sr-only" htmlFor={`role-${m.id}`}>Role of {m.name}</label>
                        <select
                          id={`role-${m.id}`} className="field" value={m.role} disabled={busyId === m.id || !m.active}
                          onChange={(e) => void change(m, { role: e.target.value as Role }, `${m.name} is now ${e.target.value === 'admin' ? 'an admin' : 'a member'}.`)}
                        >
                          <option value="member">Member</option>
                          <option value="admin">Admin</option>
                        </select>
                      </td>
                      <td>
                        <span className="inline" style={{ gap: 10, flexWrap: 'nowrap' }}>
                          <span className={`pill ${m.active ? 'good' : 'neutral'}`}>{m.active ? 'Can sign in' : 'No access'}</span>
                          <button
                            type="button" className="btn btn-outline btn-sm" disabled={busyId === m.id}
                            onClick={() => void change(m, { active: !m.active }, m.active ? `${m.name} can no longer sign in.` : `${m.name} can sign in again.`)}
                          >
                            {m.active ? 'Remove access' : 'Restore access'}
                          </button>
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
