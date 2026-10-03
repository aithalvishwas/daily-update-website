import { lazy, Suspense, useState } from 'react';
import { api } from '../api.js';
import { useToast } from './Toast.jsx';
import Logo from './Logo.jsx';

// three.js is large, so the 3D scene loads in its own chunk after the form is usable.
const Scene3D = lazy(() => import('./Scene3D.jsx'));

const FEATURES = [
  ['Log your day in a minute', 'What you did, hours and blockers.'],
  ['AI writes the summary', 'Managers get a clear digest per person.'],
  ['Private by role', 'Employees see their own work, managers see the team.'],
];

export default function AuthPage({ onSignedIn }) {
  const [tab, setTab] = useState('login');
  const [busy, setBusy] = useState(false);
  const toast = useToast();

  async function submit(e) {
    e.preventDefault();
    const form = Object.fromEntries(new FormData(e.currentTarget));
    setBusy(true);
    try {
      const path = tab === 'login' ? '/api/auth/login' : '/api/auth/register';
      const data = await api(path, { method: 'POST', body: form });
      onSignedIn({ token: data.token, user: data.user });
      if (tab === 'register') toast('Welcome! Your account is ready.', 'success');
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="auth-layout">
      <section className="auth-hero">
        <div className="auth-scene">
          <Suspense fallback={<div className="scene-fallback" />}>
            <Scene3D />
          </Suspense>
        </div>
        <div className="auth-copy">
          <Logo />
          <h1>
            Your team's day,
            <br />
            <span className="gradient-text">summarized.</span>
          </h1>
          <ul className="feature-list">
            {FEATURES.map(([title, text]) => (
              <li key={title}>
                <strong>{title}</strong>
                <span>{text}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="auth-panel">
        <div className="glass auth-card">
          <h2>{tab === 'login' ? 'Welcome back' : 'Create your account'}</h2>
          <p className="muted">
            {tab === 'login' ? 'Log in to post your update or review your team.' : 'Sign up as an employee to start logging.'}
          </p>

          <div className="segmented" role="tablist">
            {['login', 'register'].map((t) => (
              <button
                key={t}
                type="button"
                role="tab"
                aria-selected={tab === t}
                className={tab === t ? 'active' : ''}
                onClick={() => setTab(t)}
              >
                {t === 'login' ? 'Log in' : 'Sign up'}
              </button>
            ))}
          </div>

          <form key={tab} className="form" onSubmit={submit}>
            {tab === 'register' && (
              <label>
                Full name
                <input name="name" maxLength={100} autoComplete="name" required />
              </label>
            )}
            <label>
              Email
              <input name="email" type="email" autoComplete="email" required />
            </label>
            {tab === 'register' && (
              <label>
                <span>Team <span className="optional">optional</span></span>
                <input name="team" maxLength={100} />
              </label>
            )}
            <label>
              Password
              <input
                name="password"
                type="password"
                minLength={tab === 'register' ? 8 : undefined}
                maxLength={128}
                autoComplete={tab === 'login' ? 'current-password' : 'new-password'}
                required
              />
            </label>
            <button className="btn btn-primary btn-block" type="submit" disabled={busy}>
              {busy ? 'Please wait…' : tab === 'login' ? 'Log in' : 'Create employee account'}
            </button>
            {tab === 'register' && <p className="hint">Manager accounts are created by an existing manager.</p>}
          </form>
        </div>
      </section>
    </div>
  );
}
