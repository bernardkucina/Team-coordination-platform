'use client';

import { useEffect, useRef, useState, type FormEvent } from 'react';
import { TIER_HOURS, type HubWifiResponse, type AccessMember, type Role, type Tier } from '@hub-pulse/shared';
import { api } from '@/lib/api';
import { Avatar, Icon, Toggle } from './ui';

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

  const change = async (m: AccessMember, patch: { role?: Role; active?: boolean; slackEmail?: string }, done: string) => {
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
  const withSlack = (members ?? []).filter((m) => m.slackEmail).length;

  return (
    <div className="shell">
      <main className="main access">
        <div className="container">
          {/* The super admin has one screen; the same burger menu as the app holds the page and sign-out. */}
          <AccessMenu onSignOut={onSignOut} />

          <header className="stack" style={{ gap: 10 }}>
            <h1 id="access-h">Access</h1>
            <p className="small muted" style={{ margin: 0 }}>Who can sign in, who is an admin, and which Slack account gets their reminders.</p>
            <dl className="stat-strip" aria-label="Access summary" style={{ margin: '4px 0 0' }}>
              <div><dt>People</dt><dd>{members ? members.length : '…'}</dd></div>
              <div><dt>Active admins</dt><dd>{members ? admins : '…'}</dd></div>
              <div><dt>Without access</dt><dd>{members ? inactive : '…'}</dd></div>
              <div><dt>Slack email set</dt><dd>{members ? `${withSlack} of ${members.length}` : '…'}</dd></div>
            </dl>
          </header>

          {message ? (
            <p role="status" className={`pill ${message.bad ? 'bad' : 'good'}`} style={{ alignSelf: 'flex-start', margin: 0, fontSize: 14, padding: '6px 14px' }}>{message.text}</p>
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
              <div className="field-group" style={{ flex: '1 1 170px' }}>
                <span className="label">Role</span>
                <Toggle<Role>
                  label="Admin" value={draft.role} left={{ value: 'member', label: 'Member' }} right={{ value: 'admin', label: 'Admin' }}
                  onChange={(role) => setDraft({ ...draft, role })}
                />
              </div>
              <button type="submit" className="btn btn-primary" disabled={adding} style={{ minHeight: 40 }}>{adding ? 'Adding…' : 'Give access'}</button>
            </div>
          </form>

          <HubWifi />

          <section className="card" aria-labelledby="people-h">
            <div className="between">
              <h2 id="people-h">People</h2>
              <label className="sr-only" htmlFor="a-filter">Search people</label>
              <input id="a-filter" className="field" placeholder="Search name or email" value={filter} onChange={(e) => setFilter(e.target.value)} style={{ width: 240 }} />
            </div>
            <div className="scroll-x">
              <table className="table" style={{ minWidth: 860 }}>
                <thead>
                  <tr><th>Person</th><th>Tier</th><th>Role</th><th>Slack</th><th>Access</th></tr>
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
                        <fieldset disabled={busyId === m.id || !m.active} style={{ border: 0, margin: 0, padding: 0 }}>
                          <Toggle<Role>
                            label={`${m.name} is an admin`} value={m.role} left={{ value: 'member', label: 'Member' }} right={{ value: 'admin', label: 'Admin' }}
                            onChange={(role) => { if (role !== m.role) void change(m, { role }, `${m.name} is now ${role === 'admin' ? 'an admin' : 'a member'}.`); }}
                          />
                        </fieldset>
                      </td>
                      <td>
                        <SlackEmail member={m} disabled={busyId === m.id} onSave={(email) => void change(m, { slackEmail: email }, email ? `${m.name}'s Slack email saved.` : `${m.name}'s Slack email removed.`)} />
                      </td>
                      <td>
                        <span className="place-toggle">
                          <button
                            type="button" role="switch" className="switch" aria-checked={m.active} aria-label={`${m.name} can sign in`} disabled={busyId === m.id}
                            onClick={() => void change(m, { active: !m.active }, m.active ? `${m.name} can no longer sign in.` : `${m.name} can sign in again.`)}
                          ><span /></button>
                          <span className={`pill ${m.active ? 'good' : 'neutral'}`}>{m.active ? 'Can sign in' : 'No access'}</span>
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

/**
 * The email of someone's Slack account (the roster emails are made up). Saved on Enter or when leaving the field.
 * "Linked" appears once Slack has found the account, which happens when the first message is sent.
 */
function SlackEmail({ member, disabled, onSave }: { member: AccessMember; disabled: boolean; onSave: (email: string) => void }) {
  const [value, setValue] = useState(member.slackEmail ?? '');
  useEffect(() => setValue(member.slackEmail ?? ''), [member.slackEmail]);
  const save = () => {
    if (value.trim() !== (member.slackEmail ?? '')) onSave(value.trim());
  };
  return (
    <span className="inline" style={{ gap: 6, flexWrap: 'nowrap' }}>
      <label className="sr-only" htmlFor={`slack-${member.id}`}>Slack email of {member.name}</label>
      <input
        id={`slack-${member.id}`} className="field" type="email" style={{ width: 210, fontSize: 13 }} placeholder="Slack email" value={value}
        disabled={disabled} onChange={(e) => setValue(e.target.value)} onBlur={save} onKeyDown={(e) => e.key === 'Enter' && save()}
      />
      {member.slackLinked ? <span className="pill good">Linked</span> : null}
    </span>
  );
}

/** Burger menu for the super admin, styled like the app menu: Access (this page) and Log out. */
function AccessMenu({ onSignOut }: { onSignOut: () => Promise<void> }) {
  const [pinned, setPinned] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!pinned) return;
    const close = (e: MouseEvent) => { if (wrap.current && !wrap.current.contains(e.target as Node)) setPinned(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setPinned(false); };
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('mousedown', close); document.removeEventListener('keydown', esc); };
  }, [pinned]);

  return (
    <div className={pinned ? 'menu-hover pinned' : 'menu-hover'} ref={wrap} onMouseLeave={() => setPinned(false)}>
      <button type="button" className="menu-toggle" aria-label="Menu" aria-expanded={pinned} onClick={() => setPinned(!pinned)}>
        <span /><span /><span />
      </button>
      <div className="menu-peek" role="menu" aria-label="Go to">
        <a href="#access-h" role="menuitem" aria-current="page" onClick={() => setPinned(false)}>
          {Icon.lock}
          Access
        </a>
        <button type="button" role="menuitem" className="menu-logout" onClick={() => { setPinned(false); void onSignOut(); }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3" /><polyline points="10 8 6 12 10 16" /><line x1="6" y1="12" x2="16" y2="12" />
          </svg>
          Log out
        </button>
        <div className="menu-peek-foot">
          <span className="tiny">super admin</span>
          <span className="tiny">Access management</span>
        </div>
      </div>
    </div>
  );
}

/** Where members may log time "in the hub": the Impact Hub wifi's public addresses. Off until one is saved. */
function HubWifi() {
  const [wifi, setWifi] = useState<HubWifiResponse | null>(null);
  const [error, setError] = useState('');
  const run = (call: Promise<HubWifiResponse>) => call.then((w) => { setWifi(w); setError(''); }).catch((e: unknown) => setError(e instanceof Error ? e.message : 'Could not save.'));
  useEffect(() => { void run(api.hubWifi()); }, []);
  if (!wifi) return null;
  const all = [...wifi.fromConfig, ...wifi.addresses.map((a) => a.ip)];
  const here = all.includes(wifi.current);

  return (
    <section className="card" aria-labelledby="wifi-h">
      <div className="between" style={{ alignItems: 'center' }}>
        <h2 id="wifi-h">Hub wifi</h2>
        <span className={all.length ? 'pill good' : 'pill neutral'}>{all.length ? 'Check on' : 'Check off'}</span>
      </div>
      <p className="small muted" style={{ margin: 0 }}>
        Members can log time &quot;in the hub&quot; only from these internet addresses; anywhere else it is remote only.
        {all.length ? '' : ' None is saved yet, so everyone can choose "in the hub". Save the address while you are on the Impact Hub wifi.'}
      </p>
      <div className="between" style={{ alignItems: 'center', gap: 12 }}>
        <span className="small">You are on <strong>{wifi.current}</strong>{here ? ' (the hub wifi)' : ''}</span>
        {here ? null : <button type="button" className="btn btn-primary btn-sm" onClick={() => void run(api.addHubWifi())}>Save as hub wifi</button>}
      </div>
      {all.length ? (
        <ul className="stack" style={{ gap: 6, listStyle: 'none', margin: 0, padding: 0 }}>
          {wifi.fromConfig.map((ip) => <li key={ip} className="small">{ip} <span className="tiny muted">· set in HUB_IPS</span></li>)}
          {wifi.addresses.map((a) => (
            <li key={a.ip} className="between small" style={{ alignItems: 'center' }}>
              <span>{a.ip}</span>
              <button type="button" className="btn btn-quiet btn-sm" onClick={() => void run(api.removeHubWifi(a.ip))}>Remove</button>
            </li>
          ))}
        </ul>
      ) : null}
      {error ? <span className="small" role="alert" style={{ color: 'var(--bad)' }}>{error}</span> : null}
    </section>
  );
}
