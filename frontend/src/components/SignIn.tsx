'use client';

import { useState, type FormEvent } from 'react';
import { Icon } from './ui';

/**
 * Sandbox sign-in: a member types their roster email. There is no password yet; this form only works while the
 * backend runs with DEMO_MODE=true, and Google sign-in replaces it for real use.
 */
export function SignIn({ onSignIn }: { onSignIn: (email: string) => Promise<void> }) {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!email.trim()) {
      setError('Enter your email.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      await onSignIn(email.trim());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not sign in.');
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
            id="signin-email" className="field" type="email" autoComplete="email" autoFocus
            placeholder="name.surname@sandbox.example" value={email}
            onChange={(e) => { setEmail(e.target.value); setError(''); }}
            aria-invalid={!!error} aria-describedby={error ? 'signin-error' : 'signin-hint'}
          />
          {error
            ? <span id="signin-error" className="small" role="alert" style={{ color: 'var(--bad)' }}>{error}</span>
            : <span id="signin-hint" className="tiny muted">Demo: use a roster email, e.g. ana.kovac@sandbox.example (admin) or ziga.krajnc@sandbox.example.</span>}
        </div>
        <button type="submit" className="btn btn-primary" disabled={busy} style={{ minHeight: 44 }}>
          {busy ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
    </div>
  );
}
