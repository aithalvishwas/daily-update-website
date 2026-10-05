import { lazy, Suspense, useEffect, useState } from 'react';
import { api } from '../api.js';
import { useToast } from './Toast.jsx';
import Logo from './Logo.jsx';
import { hashParam } from '../workspace.js';

// three.js is large, so the 3D scene loads in its own chunk after the form is usable.
const Scene3D = lazy(() => import('./Scene3D.jsx'));

const FEATURES = [
  ['Epics and deadlines', 'See every epic, who is on it, and whether it is on track.'],
  ['Blockers reach the manager', 'Raise an issue, get a reply, attach photos and files.'],
  ['AI writes the summary', 'Managers get a clear digest of each person’s week.'],
];

// Log in on a company's own address (google.workpulselens.com). There is no sign-up here: the
// company's admin adds people from the Accounts page.
export default function AuthPage({ workspace, rootDomain, onSignedIn }) {
  const [busy, setBusy] = useState(false);
  const [email] = useState(() => hashParam('email'));
  const toast = useToast();

  // Just signed the company up on the public site.
  useEffect(() => {
    if (hashParam('welcome')) toast(`Your ${workspace.name} workspace is ready. Log in to get started.`, 'success');
  }, [toast, workspace.name]);

  async function submit(e) {
    e.preventDefault();
    const form = Object.fromEntries(new FormData(e.currentTarget));
    setBusy(true);
    try {
      const data = await api('/api/auth/login', { method: 'POST', body: form });
      onSignedIn({ token: data.token, user: data.user });
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
          <a href="#/" className="auth-home" aria-label="WorkPulseLens home">
            <Logo />
          </a>
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
        <div className="card auth-card">
          <span className="auth-workspace">
            {workspace.slug}.{rootDomain}
          </span>
          <h2>Log in to {workspace.name}</h2>
          <p className="muted">Post your update or review your team.</p>

          <form className="form" onSubmit={submit}>
            <label>
              Email
              <input name="email" type="email" autoComplete="email" defaultValue={email} required />
            </label>
            <label>
              Password
              <input name="password" type="password" maxLength={128} autoComplete="current-password" required />
            </label>
            <button className="btn btn-primary btn-block" type="submit" disabled={busy}>
              {busy ? 'Please wait…' : 'Log in'}
            </button>
            <p className="hint">New here? Ask your admin to add you from the Accounts page.</p>
          </form>
        </div>
      </section>
    </div>
  );
}
