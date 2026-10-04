import { useEffect, useRef, useState } from 'react';
import { api } from '../api.js';
import { useToast } from '../components/Toast.jsx';
import Logo from '../components/Logo.jsx';
import Icon from '../components/Icon.jsx';
import { slugify, workspaceUrl } from '../workspace.js';

const POINTS = [
  'Your company gets its own workspace, like google.workpulselens.com.',
  'Daily updates turn into live epic health and AI-written summaries.',
  'Each company’s people, updates and summaries are kept fully separate.',
  'Add managers and employees from the Accounts page whenever you’re ready.',
];

const ORG_SIZES = ['1-10', '11-50', '51-200', '201-1000', '1000+'];

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
    const f = Object.fromEntries(new FormData(e.currentTarget));
    setBusy(true);
    try {
      const { workspace } = await api('/api/companies', {
        method: 'POST',
        body: {
          companyName: company,
          slug,
          name: `${f.firstName.trim()} ${f.lastName.trim()}`.trim(),
          email: f.email,
          password: f.password,
          orgSize: f.orgSize,
          phone: f.phone,
        },
      });
      toast(`${workspace.name} is ready. Taking you to your workspace…`, 'success');
      const email = encodeURIComponent(f.email);
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
    <div className="cs">
      <header className="cs-header">
        <a href="#/" className="cs-brand" aria-label="WorkPulseLens home">
          <Logo />
        </a>
      </header>

      <main className="cs-main">
        <section className="cs-intro">
          <h1>Sign up your company. It’s free to start.</h1>
          <ul className="cs-points">
            {POINTS.map((p) => (
              <li key={p}>
                <span className="cs-tick" aria-hidden="true">
                  <Icon name="check" size={12} />
                </span>
                {p}
              </li>
            ))}
          </ul>

          <form className="cs-find" onSubmit={go}>
            <h2>Already have a workspace?</h2>
            <p>Log in on your company’s own address.</p>
            <div className="cs-find-row">
              <div className="address-field">
                <input ref={findRef} name="workspace" placeholder="yourcompany" aria-label="Your workspace address" required />
                <span>.{rootDomain}</span>
              </div>
              <button className="cs-btn cs-btn-outline" type="submit">Go</button>
            </div>
          </form>
        </section>

        <section className="cs-card">
          <h2 className="cs-title">
            <em>Try</em> <strong>WorkPulseLens</strong>
          </h2>
          <p className="cs-sub">No credit card required. You’ll be your workspace’s admin.</p>

          <form className="cs-form" onSubmit={submit}>
            <label>
              <span><b>*</b>First name</span>
              <input name="firstName" placeholder="Enter your first name" maxLength={50} autoComplete="given-name" required />
            </label>
            <label>
              <span><b>*</b>Last name</span>
              <input name="lastName" placeholder="Enter your last name" maxLength={49} autoComplete="family-name" required />
            </label>
            <label>
              <span><b>*</b>Work email</span>
              <input name="email" type="email" placeholder="you@company.com" autoComplete="email" required />
            </label>
            <label>
              <span><b>*</b>Company name</span>
              <input
                name="companyName"
                value={company}
                onChange={onCompany}
                placeholder="Enter your company"
                maxLength={100}
                autoComplete="organization"
                required
              />
            </label>
            <label className="cs-span">
              <span><b>*</b>Workspace address</span>
              <div className="address-field">
                <input
                  name="slug"
                  value={slug}
                  placeholder="yourcompany"
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
              <small id="slug-help" className={`field-help ${taken ? 'field-error' : check?.available ? 'field-ok' : ''}`}>
                {taken
                  ? check.reason || 'That address is taken'
                  : check?.available
                    ? `${slug}.${rootDomain} is available`
                    : 'Your team logs in here. Letters, numbers and dashes.'}
              </small>
            </label>
            <label>
              <span><b>*</b>Organization size</span>
              <select name="orgSize" defaultValue="" required>
                <option value="" disabled>
                  Please select
                </option>
                {ORG_SIZES.map((s) => (
                  <option key={s} value={s}>
                    {s} employees
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>Phone</span>
              <input name="phone" type="tel" placeholder="Enter your phone number" maxLength={20} autoComplete="tel" />
            </label>
            <label className="cs-span">
              <span><b>*</b>Password</span>
              <input
                name="password"
                type="password"
                placeholder="At least 8 characters"
                minLength={8}
                maxLength={128}
                autoComplete="new-password"
                required
              />
            </label>
            <div className="cs-span cs-actions">
              <button className="cs-btn" type="submit" disabled={busy || taken}>
                {busy ? 'Creating your workspace…' : 'Try it free'}
              </button>
            </div>
          </form>
        </section>
      </main>
    </div>
  );
}
