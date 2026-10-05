import { useEffect, useRef, useState } from 'react';
import Icon from '../components/Icon.jsx';
import Logo from '../components/Logo.jsx';
import { OFFICES } from '../workplace.js';
import '../landing.css';

const TOUR = [
  {
    key: 'day',
    label: 'Daily updates',
    icon: 'edit',
    title: 'A daily update in two minutes',
    text: 'Pick the day on the calendar, link the epic, add hours, blockers and files. No streaks, no guilt: holidays at your office never count as missed days.',
    image: '/landing/employee.png',
  },
  {
    key: 'epics',
    label: 'Epics',
    icon: 'epics',
    title: 'Every epic, on track or not',
    text: 'Progress is measured against the time used. WorkPulseLens flags an epic At risk the moment it falls behind or a blocker opens, long before the deadline.',
    image: '/landing/epic.png',
  },
  {
    key: 'blockers',
    label: 'Blockers',
    icon: 'alert',
    title: 'Blockers reach the right manager',
    text: 'A blocker in a daily update becomes an issue in the manager’s inbox. Replies, photos and files stay in one thread until it’s resolved.',
    image: '/landing/issue.png',
  },
  {
    key: 'requests',
    label: 'Weekend work',
    icon: 'calendar',
    title: 'Comp-off and overtime, fairly',
    text: 'Worked on a Saturday? Claim a comp-off day or overtime pay. Managers approve, decline or suggest an alternative, all in the app.',
    image: '/landing/requests.png',
  },
  {
    key: 'admin',
    label: 'Admin',
    icon: 'shield',
    title: 'Accounts and holidays in one place',
    text: 'Add interns to managers, reset passwords, set each person’s office and keep holiday calendars for every India office up to date.',
    image: '/landing/admin.png',
  },
];

const ROLES = [
  {
    icon: 'edit',
    tone: 'teal',
    title: 'Employees',
    lead: 'Log the day, not a timesheet.',
    points: ['Daily updates linked to epics', 'Raise a blocker in one click', 'Your office holidays built in'],
  },
  {
    icon: 'target',
    tone: 'blue',
    title: 'Managers',
    lead: 'Know how the work is really going.',
    points: ['Epic health at a glance', 'Answer blockers before they slip', 'AI summary of anyone’s week'],
  },
  {
    icon: 'shield',
    tone: 'purple',
    title: 'Admins',
    lead: 'Run the whole workspace.',
    points: ['Add, edit and deactivate accounts', 'Feature flags like comp-off', 'Holiday calendars per office'],
  },
];

const STEPS = [
  ['Post', 'Each person writes a short update for the day and links it to an epic.'],
  ['Flag', 'Blockers and deadline risks reach the manager as alerts, not lost chat messages.'],
  ['Summarize', 'AI turns a week or a month of updates into a clear digest for the manager.'],
];

const SUMMARY =
  'Priya shipped the payments retry flow and closed 3 of 4 checkout bugs this week. ' +
  'She was blocked on Tuesday by the missing sandbox keys; Arjun answered the same day. ' +
  'Epic “Checkout v2” is on track at 68% with 9 days left.';

const SECURITY = [
  ['shield', 'HTTPS everywhere', 'Certificates are issued and renewed automatically.'],
  ['settings', 'Roles that mean something', 'Employees, managers and admins each see only what they should.'],
  ['clock', 'Rate-limited sign-in', 'Repeated wrong passwords are slowed down per visitor.'],
  ['file', 'Your company, kept apart', 'Each company gets its own workspace. No one else can see your data.'],
];

function usePrefersReducedMotion() {
  const [reduced] = useState(() => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false);
  return reduced;
}

// Fades sections in as they scroll into view.
function useReveal() {
  useEffect(() => {
    const items = document.querySelectorAll('.lp [data-reveal]');
    if (!('IntersectionObserver' in window)) {
      items.forEach((el) => el.classList.add('is-visible'));
      return undefined;
    }
    const observer = new IntersectionObserver(
      (entries) =>
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-visible');
            observer.unobserve(entry.target);
          }
        }),
      { rootMargin: '0px 0px -10% 0px' },
    );
    items.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);
}

// The hero screenshot leans back and straightens as you scroll.
function useTilt(ref, reduced) {
  useEffect(() => {
    const el = ref.current;
    if (!el || reduced) return undefined;
    let frame = 0;
    const update = () => {
      frame = 0;
      const progress = Math.min(1, Math.max(0, window.scrollY / 420));
      el.style.transform = `perspective(1600px) rotateX(${(1 - progress) * 8}deg) scale(${0.97 + progress * 0.03})`;
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    update();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      cancelAnimationFrame(frame);
    };
  }, [ref, reduced]);
}

function Nav() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);
  const jump = (id) => (e) => {
    e.preventDefault();
    setOpen(false);
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
  };
  return (
    <header className={`lp-nav${scrolled ? ' is-scrolled' : ''}${open ? ' is-open' : ''}`}>
      <div className="lp-container lp-nav-inner">
        <a href="#/" className="lp-brand" aria-label="WorkPulseLens home">
          <Logo />
        </a>
        <nav className="lp-links" aria-label="Main">
          <a href="#tour" onClick={jump('tour')}>Product</a>
          <a href="#roles" onClick={jump('roles')}>Who it’s for</a>
          <a href="#ai" onClick={jump('ai')}>AI summaries</a>
          <a href="#security" onClick={jump('security')}>Security</a>
        </nav>
        <div className="lp-nav-cta">
          <a href="#/signup" className="lp-btn lp-btn-primary">Try it free</a>
        </div>
        <button type="button" className="lp-menu" aria-label="Menu" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
          <Icon name="menu" size={22} />
        </button>
      </div>
    </header>
  );
}

function Hero({ reduced }) {
  const shot = useRef(null);
  useTilt(shot, reduced);
  return (
    <section className="lp-hero">
      <div className="lp-container lp-hero-copy">
        <span className="lp-pill">
          <Icon name="spark" size={14} /> AI summaries for every team
        </span>
        <h1>
          See how your team’s work is <em>really</em> going.
        </h1>
        <p className="lp-lead">
          WorkPulseLens turns two-minute daily updates into live epic health, blocker alerts and an AI-written summary
          of everyone’s week. No status meetings. No email chains.
        </p>
        <div className="lp-hero-cta">
          <a href="#/signup" className="lp-btn lp-btn-primary lp-btn-lg">
            Try it free
          </a>
        </div>
        <ul className="lp-hero-ticks">
          <li><Icon name="check" size={14} /> Free to start</li>
          <li><Icon name="check" size={14} /> Your own company workspace</li>
          <li><Icon name="check" size={14} /> India office holidays built in</li>
        </ul>
      </div>
      <div className="lp-container lp-hero-shot-wrap">
        <div className="lp-stage">
          <div className="lp-browser" ref={shot}>
            <div className="lp-browser-bar" aria-hidden="true">
              <span /><span /><span />
              <div className="lp-browser-url">yourcompany.workpulselens.com</div>
            </div>
            <img src="/landing/manager-dashboard.png" alt="Manager dashboard with epic health, deadlines and alerts" width="1440" height="960" />
          </div>
          <div className="lp-float lp-float-a" aria-hidden="true">
            <span className="lp-dot lp-dot-green" /> Checkout v2 <b>On track</b>
          </div>
          <div className="lp-float lp-float-b" aria-hidden="true">
            <Icon name="alert" size={16} /> New blocker from Arjun
          </div>
          <div className="lp-float lp-float-c" aria-hidden="true">
            <Icon name="spark" size={16} /> Weekly summary ready
          </div>
        </div>
      </div>
    </section>
  );
}

function Offices() {
  const cities = [...OFFICES, ...OFFICES];
  return (
    <section className="lp-offices" aria-label="Offices with built-in holiday calendars">
      <p>Holiday calendars built in for teams in</p>
      <div className="lp-marquee">
        <div className="lp-marquee-track">
          {cities.map((city, i) => (
            <span key={i} aria-hidden={i >= OFFICES.length}>
              {city}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}

function Tour({ reduced }) {
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);
  useEffect(() => {
    if (reduced || paused) return undefined;
    const id = setTimeout(() => setActive((i) => (i + 1) % TOUR.length), 6000);
    return () => clearTimeout(id);
  }, [active, paused, reduced]);
  const item = TOUR[active];
  return (
    <section className="lp-section" id="tour">
      <div className="lp-container">
        <div className="lp-head" data-reveal>
          <span className="lp-eyebrow">Product tour</span>
          <h2>Everything a team needs to stay in sync</h2>
          <p>One place for daily work, epics, blockers and requests, built around how teams actually report progress.</p>
        </div>
        <div className="lp-tabs" role="tablist" data-reveal onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)}>
          {TOUR.map((t, i) => (
            <button
              key={t.key}
              type="button"
              role="tab"
              aria-selected={i === active}
              className={i === active ? 'active' : ''}
              onClick={() => {
                setActive(i);
                setPaused(true);
              }}
            >
              <Icon name={t.icon} size={16} /> {t.label}
              {i === active && !paused && !reduced && <span className="lp-tab-progress" />}
            </button>
          ))}
        </div>
        <div className="lp-tour" data-reveal>
          <div className="lp-tour-copy" key={`copy-${item.key}`}>
            <h3>{item.title}</h3>
            <p>{item.text}</p>
            <a href="#/signup" className="lp-link">
              Try it now <Icon name="chevronRight" size={14} />
            </a>
          </div>
          <div className="lp-tour-shot" key={`shot-${item.key}`}>
            <img src={item.image} alt={item.title} width="1440" height="960" loading="lazy" />
          </div>
        </div>
      </div>
    </section>
  );
}

function Roles() {
  return (
    <section className="lp-section lp-section-tint" id="roles">
      <div className="lp-container">
        <div className="lp-head" data-reveal>
          <span className="lp-eyebrow">Who it’s for</span>
          <h2>Made for every seat on the team</h2>
        </div>
        <div className="lp-roles">
          {ROLES.map((r, i) => (
            <article key={r.title} className={`lp-role lp-tone-${r.tone}`} data-reveal style={{ transitionDelay: `${i * 90}ms` }}>
              <div className="lp-role-icon"><Icon name={r.icon} size={22} /></div>
              <h3>{r.title}</h3>
              <p className="lp-role-lead">{r.lead}</p>
              <ul>
                {r.points.map((p) => (
                  <li key={p}><Icon name="check" size={16} /> {p}</li>
                ))}
              </ul>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

function Steps() {
  return (
    <section className="lp-section">
      <div className="lp-container">
        <div className="lp-head" data-reveal>
          <span className="lp-eyebrow">How it works</span>
          <h2>From a sentence a day to a clear picture</h2>
        </div>
        <ol className="lp-steps">
          {STEPS.map(([title, text], i) => (
            <li key={title} data-reveal style={{ transitionDelay: `${i * 110}ms` }}>
              <span className="lp-step-num">{i + 1}</span>
              <h3>{title}</h3>
              <p>{text}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

// Types the sample summary out once it scrolls into view.
function TypedSummary({ reduced }) {
  const ref = useRef(null);
  const [count, setCount] = useState(reduced ? SUMMARY.length : 0);
  const [started, setStarted] = useState(reduced);
  useEffect(() => {
    if (started || !ref.current || !('IntersectionObserver' in window)) {
      if (!('IntersectionObserver' in window)) setCount(SUMMARY.length);
      return undefined;
    }
    const observer = new IntersectionObserver(([entry]) => entry.isIntersecting && setStarted(true), { threshold: 0.4 });
    observer.observe(ref.current);
    return () => observer.disconnect();
  }, [started]);
  useEffect(() => {
    if (!started || count >= SUMMARY.length) return undefined;
    const id = setTimeout(() => setCount((c) => Math.min(SUMMARY.length, c + 3)), 18);
    return () => clearTimeout(id);
  }, [started, count]);
  return (
    <div className="lp-ai-card" ref={ref}>
      <div className="lp-ai-card-head">
        <span className="lp-ai-badge"><Icon name="spark" size={14} /> AI summary</span>
        <span className="lp-ai-range">Last 7 days</span>
      </div>
      <p aria-label={SUMMARY}>
        <span aria-hidden="true">{SUMMARY.slice(0, count)}</span>
        {count < SUMMARY.length && <span className="lp-caret" aria-hidden="true" />}
      </p>
      <div className="lp-ai-stats" aria-hidden="true">
        <div><b>5</b><span>updates</span></div>
        <div><b>38h</b><span>logged</span></div>
        <div><b>1</b><span>blocker resolved</span></div>
      </div>
    </div>
  );
}

function Ai({ reduced }) {
  return (
    <section className="lp-section lp-ai" id="ai">
      <div className="lp-container lp-ai-inner">
        <div className="lp-ai-copy" data-reveal>
          <span className="lp-eyebrow">AI summaries</span>
          <h2>Read a week of work in thirty seconds</h2>
          <p>
            Managers open anyone on the team and get a plain-language digest of the last 7, 14 or 30 days: what shipped,
            what got stuck, and how their epics are tracking.
          </p>
          <ul className="lp-ai-points">
            <li><Icon name="check" size={16} /> Written from the person’s own updates</li>
            <li><Icon name="check" size={16} /> Blockers and replies included</li>
            <li><Icon name="check" size={16} /> Works without a key too, with a basic summary</li>
          </ul>
        </div>
        <div data-reveal>
          <TypedSummary reduced={reduced} />
        </div>
      </div>
    </section>
  );
}

function Security() {
  return (
    <section className="lp-section" id="security">
      <div className="lp-container">
        <div className="lp-head" data-reveal>
          <span className="lp-eyebrow">Security</span>
          <h2>Secure by default</h2>
        </div>
        <div className="lp-security">
          {SECURITY.map(([icon, title, text], i) => (
            <div key={title} className="lp-sec-item" data-reveal style={{ transitionDelay: `${i * 70}ms` }}>
              <Icon name={icon} size={20} />
              <h3>{title}</h3>
              <p>{text}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Cta() {
  return (
    <section className="lp-cta-wrap">
      <div className="lp-container">
        <div className="lp-cta" data-reveal>
          <h2>
            Give your team its <em>pulse</em> back.
          </h2>
          <p>Sign your company up in a minute. Your team posts its first update today.</p>
          <div className="lp-hero-cta">
            <a href="#/signup" className="lp-btn lp-btn-white lp-btn-lg">
              Try it free
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="lp-footer">
      <div className="lp-container lp-footer-inner">
        <Logo />
        <p>Daily work updates, epic health and AI summaries for teams.</p>
        <nav aria-label="Footer">
          <a href="#/signup">Sign up your company</a>
        </nav>
        <small>© {new Date().getFullYear()} WorkPulseLens</small>
      </div>
    </footer>
  );
}

export default function Landing() {
  const reduced = usePrefersReducedMotion();
  useReveal();
  return (
    <div className="lp">
      <Nav />
      <main>
        <Hero reduced={reduced} />
        <Offices />
        <Tour reduced={reduced} />
        <Roles />
        <Steps />
        <Ai reduced={reduced} />
        <Security />
        <Cta />
      </main>
      <Footer />
    </div>
  );
}
