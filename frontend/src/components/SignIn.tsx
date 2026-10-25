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

  const pickDemo = (demo: string) => {
    setEmail(demo);
    setError('');
    setNeedsPassword(false);
    setPassword('');
  };

  return (
    <div className="signin">
      <form className="card signin-card" aria-label="Sign in" onSubmit={(e) => void submit(e)} noValidate>
        <div className="signin-brand">
          <span className="brand-mark">{Icon.hub}</span>
          <strong>Shapers Hub</strong>
        </div>
        <div className="stack" style={{ gap: 8 }}>
          <label className="signin-label" htmlFor="signin-email">Email</label>
          <input
            id="signin-email" className="field signin-field" type="email" autoComplete="username" autoFocus
            placeholder="name.surname@sandbox.example" value={email}
            onChange={(e) => { setEmail(e.target.value); setError(''); setNeedsPassword(false); setPassword(''); }}
            aria-invalid={!!error && !needsPassword} aria-describedby={error ? 'signin-error' : 'signin-hint'}
          />
        </div>
        {needsPassword ? (
          <div className="stack" style={{ gap: 8 }}>
            <label className="signin-label" htmlFor="signin-password">Password</label>
            <input
              id="signin-password" ref={passwordRef} className="field signin-field" type="password" autoComplete="current-password"
              value={password} onChange={(e) => { setPassword(e.target.value); setError(''); }}
              aria-invalid={!!error} aria-describedby={error ? 'signin-error' : undefined}
            />
          </div>
        ) : null}
        {error ? <span id="signin-error" className="small" role="alert" style={{ color: 'var(--bad)' }}>{error}</span> : null}
        <button type="submit" className="btn btn-primary signin-btn" disabled={busy}>
          {busy ? 'Signing in…' : 'Sign in'}
        </button>
        <div id="signin-hint" className="signin-demo">
          <span className="signin-demo-title">Demo accounts</span>
          <div className="inline" style={{ gap: 6 }}>
            <button type="button" className="signin-chip" onClick={() => pickDemo('ana.kovac@sandbox.example')}>Ana Kovač · admin</button>
            <button type="button" className="signin-chip" onClick={() => pickDemo('ziga.krajnc@sandbox.example')}>Žiga Krajnc · member</button>
          </div>
          <span className="tiny muted">Or type any roster email.</span>
        </div>
      </form>
    </div>
  );
}
