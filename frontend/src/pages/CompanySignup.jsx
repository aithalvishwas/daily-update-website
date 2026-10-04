import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { api } from '../api.js';
import { useToast } from '../components/Toast.jsx';
import Logo from '../components/Logo.jsx';
import { slugify, workspaceUrl } from '../workspace.js';

const Scene3D = lazy(() => import('../components/Scene3D.jsx'));

const FEATURES = [
  ['Your own workspace', 'Your company gets its own address, like google.workpulselens.com.'],
  ['Your data stays yours', 'Each company’s people, updates and summaries are kept fully separate.'],
  ['Invite your team', 'Add managers and employees from the Accounts page, or let them join.'],
];

// The public site only signs companies up. People log in on their company's own address,
// so "Sign in" here just takes them there.
export default function CompanySignup({ rootDomain, mode = 'signup' }) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [company, setCompany] = useState('');
  const [slug, setSlug] = useState('');
  const [slugEdited, setSlugEdited] = useState(false);
  const [check, setCheck] = useState(null);
  const findRef = useRef(null);

  useEffect(() => {
    if (mode === 'find') findRef.current?.focus();
  }, [mode]);

  // Live check of the address as it's typed.
  useEffect(() => {
    if (!slug) {
      setCheck(null);
      return undefined;
    }
    const timer = setTimeout(() => {
      api(`/api/companies/check?slug=${encodeURIComponent(slug)}`)
        .then(setCheck)
        .catch(() => setCheck(null));
    }, 300);
    return () => clearTimeout(timer);
  }, [slug]);

  function onCompany(e) {
    setCompany(e.target.value);
    if (!slugEdited) setSlug(slugify(e.target.value));
  }

  async function submit(e) {
    e.preventDefault();
    const form = Object.fromEntries(new FormData(e.currentTarget));
    setBusy(true);
    try {
      const { workspace } = await api('/api/companies', { method: 'POST', body: { ...form, companyName: company, slug } });
      toast(`${workspace.name} is ready. Taking you to your workspace…`, 'success');
      const email = encodeURIComponent(form.email);
      setTimeout(() => {
        window.location.href = workspaceUrl(workspace.slug, rootDomain, `/#/login?welcome=1&email=${email}`);
      }, 900);
    } catch (err) {
      toast(err.message, 'error');
      setBusy(false);
    }
  }

  function go(e) {
    e.preventDefault();
    const target = slugify(new FormData(e.currentTarget).get('workspace') || '');
    if (target) window.location.href = workspaceUrl(target, rootDomain, '/#/login');
  }

  const taken = check && check.slug === slug && !check.available;

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
            Set up your
            <br />
            <span className="gradient-text">company workspace.</span>
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
        <div className="auth-stack">
          <div className="card auth-card">
            <h2>Sign up your company</h2>
            <p className="muted">You’ll be the admin of your company’s workspace.</p>
            <form className="form" onSubmit={submit}>
              <label>
                Company name
                <input name="companyName" value={company} onChange={onCompany} maxLength={100} autoComplete="organization" required />
              </label>
              <label>
                Workspace address
                <div className="address-field">
                  <input
                    name="slug"
                    value={slug}
                    onChange={(e) => {
                      setSlugEdited(true);
                      setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '').slice(0, 40));
                    }}
                    aria-describedby="slug-help"
                    aria-invalid={taken || undefined}
                    required
                  />
                  <span>.{rootDomain}</span>
                </div>
                <span id="slug-help" className={`field-help ${taken ? 'field-error' : ''}`}>
                  {taken ? check.reason || 'That address is taken' : check?.available ? 'Available' : 'Letters, numbers and dashes'}
                </span>
              </label>
              <label>
                Your full name
                <input name="name" maxLength={100} autoComplete="name" required />
              </label>
              <label>
                Work email
                <input name="email" type="email" autoComplete="email" required />
              </label>
              <label>
                Password
                <input name="password" type="password" minLength={8} maxLength={128} autoComplete="new-password" required />
              </label>
              <button className="btn btn-primary btn-block" type="submit" disabled={busy || taken}>
                {busy ? 'Creating your workspace…' : 'Create workspace'}
              </button>
            </form>
          </div>

          <form className="card auth-card auth-find" onSubmit={go}>
            <h3>Already have a workspace?</h3>
            <p className="muted small">Log in on your company’s own address.</p>
            <div className="address-field">
              <input ref={findRef} name="workspace" placeholder="yourcompany" aria-label="Your workspace address" required />
              <span>.{rootDomain}</span>
            </div>
            <button className="btn btn-block" type="submit">Go to my workspace</button>
          </form>
        </div>
      </section>
    </div>
  );
}
