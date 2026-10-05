import { useState } from 'react';
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

// The public site only signs companies up. The workspace address is made from the company name,
// and people log in there.
export default function CompanySignup({ rootDomain }) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [company, setCompany] = useState('');
  const preview = slugify(company);

  async function submit(e) {
    e.preventDefault();
    const f = Object.fromEntries(new FormData(e.currentTarget));
    setBusy(true);
    try {
      const { workspace } = await api('/api/companies', {
        method: 'POST',
        body: {
          companyName: company,
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
                onChange={(e) => setCompany(e.target.value)}
                placeholder="Enter your company"
                maxLength={100}
                autoComplete="organization"
                required
              />
            </label>
            {preview.length >= 2 && (
              <p className="cs-span cs-preview">
                Your team will log in at <strong>{preview}.{rootDomain}</strong>
              </p>
            )}
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
              <button className="cs-btn" type="submit" disabled={busy}>
                {busy ? 'Creating your workspace…' : 'Try it free'}
              </button>
            </div>
          </form>
        </section>
      </main>
    </div>
  );
}
