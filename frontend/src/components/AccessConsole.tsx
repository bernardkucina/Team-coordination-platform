'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { TIER_HOURS, type AccessMember, type Role, type Tier } from '@hub-pulse/shared';
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
          {/* The super admin has one screen, so a bar with the brand and sign-out replaces the app menu. */}
          <div className="access-bar">
            <span className="brand">
              <span className="brand-mark">{Icon.hub}</span>
              <span><strong>Shapers Hub</strong><small>Access management</small></span>
            </span>
            <span className="inline" style={{ gap: 10, flexWrap: 'nowrap' }}>
              <Avatar small initials="SA" />
              <span className="small strong">super admin</span>
              <button type="button" className="btn btn-outline btn-sm" onClick={() => void onSignOut()}>Sign out</button>
            </span>
          </div>

          <header className="stack" style={{ gap: 10 }}>
            <h1>Access</h1>
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
