'use client';

import { useRef, useState, type FormEvent } from 'react';
import { ApiFailure } from '@/lib/api';
import { Icon } from './ui';

/**
 * One sign-in form. Roster members type their email (demo: no password while the backend runs with DEMO_MODE=true;
 * Google sign-in replaces that for real use). The super admin's email makes the server ask for a password,
 * and a password field appears.
 */
export function SignIn({ onSignIn }: { onSignIn: (email: string, password?: string) => Promise<void> }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [needsPassword, setNeedsPassword] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const passwordRef = useRef<HTMLInputElement>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!email.trim()) {
      setError('Enter your email.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      await onSignIn(email.trim(), needsPassword ? password : undefined);
    } catch (err) {
      const asksPassword = err instanceof ApiFailure && (err.details as { needsPassword?: boolean } | undefined)?.needsPassword;
      if (asksPassword && !needsPassword) {
        setNeedsPassword(true);
        setTimeout(() => passwordRef.current?.focus(), 0);
      } else {
        setError(err instanceof Error ? err.message : 'Could not sign in.');
      }
      setBusy(false);
    }
  };

  return (
    <div className="signin">
      <form className="card" style={{ width: 'min(420px, 100%)' }} aria-labelledby="signin-h" onSubmit={(e) => void submit(e)} noValidate>
        <div className="brand" style={{ color: 'var(--ink)' }}>
          <span className="brand-mark">{Icon.pulse}</span>
          <span><strong>Hub Pulse</strong></span>
        </div>
        <h1 id="signin-h" style={{ fontSize: 24 }}>Sign in</h1>
        <div className="stack" style={{ gap: 6 }}>
          <label className="label" htmlFor="signin-email">Email</label>
          <input
            id="signin-email" className="field" type="email" autoComplete="username" autoFocus
            placeholder="name.surname@sandbox.example" value={email}
            onChange={(e) => { setEmail(e.target.value); setError(''); setNeedsPassword(false); setPassword(''); }}
            aria-invalid={!!error && !needsPassword} aria-describedby={error ? 'signin-error' : 'signin-hint'}
          />
        </div>
        {needsPassword ? (
          <div className="stack" style={{ gap: 6 }}>
            <label className="label" htmlFor="signin-password">Password</label>
            <input
              id="signin-password" ref={passwordRef} className="field" type="password" autoComplete="current-password"
              value={password} onChange={(e) => { setPassword(e.target.value); setError(''); }}
              aria-invalid={!!error} aria-describedby={error ? 'signin-error' : undefined}
            />
          </div>
        ) : null}
        {error
          ? <span id="signin-error" className="small" role="alert" style={{ color: 'var(--bad)' }}>{error}</span>
          : <span id="signin-hint" className="tiny muted">Demo: use a roster email, e.g. ana.kovac@sandbox.example (admin) or ziga.krajnc@sandbox.example.</span>}
        <button type="submit" className="btn btn-primary" disabled={busy} style={{ minHeight: 44 }}>
          {busy ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
    </div>
  );
}
