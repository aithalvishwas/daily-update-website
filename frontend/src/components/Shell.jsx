import { useState } from 'react';
import { ROLE_LABEL } from '../format.js';
import Avatar from './Avatar.jsx';
import Icon from './Icon.jsx';
import NotificationBell from './NotificationBell.jsx';
import { useWorkplace } from '../workplace.js';

const NAV = {
  manager: [
    ['', 'Dashboard', 'home'],
    ['epics', 'Epics', 'epics'],
    ['people', 'People', 'people'],
    ['issues', 'Blockers & issues', 'alert'],
    ['requests', 'Weekend requests', 'calendar'],
  ],
  employee: [
    ['', 'My day', 'home'],
    ['epics', 'My epics', 'epics'],
    ['issues', 'My issues', 'alert'],
    ['requests', 'Weekend work', 'calendar'],
  ],
};

/** Work-app layout: navy sidebar on the left, header with alerts on top. */
export default function Shell({ user, token, section, counts = {}, onSignOut, children }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const { weekendRequests } = useWorkplace();
  const nav = (
    user.role === 'admin'
      ? [...NAV.manager, ['admin', 'Accounts', 'shield'], ['workplace', 'Holidays & settings', 'flag']]
      : NAV[user.role] ?? NAV.employee
  ).filter(([path]) => path !== 'requests' || weekendRequests || counts.requests > 0);

  return (
    <div className={`shell ${menuOpen ? 'menu-open' : ''}`}>
      <aside className="sidebar">
        <a className="sidebar-brand" href="#/">
          <img src="/favicon.svg" alt="" width="30" height="30" />
          <span>Daily Update</span>
        </a>
        <nav className="sidebar-nav" aria-label="Main">
          {nav.map(([path, label, icon]) => (
            <a
              key={label}
              href={`#/${path}`}
              className={`nav-item ${section === path ? 'active' : ''}`}
              aria-current={section === path ? 'page' : undefined}
              onClick={() => setMenuOpen(false)}
            >
              <Icon name={icon} />
              <span>{label}</span>
              {counts[path] > 0 && <span className="nav-count">{counts[path]}</span>}
            </a>
          ))}
        </nav>
        <div className="sidebar-foot">
          <span className="muted-inverse small">{weekendRequests ? 'Mon–Fri work week' : '7-day work week'}</span>
        </div>
      </aside>
      <div className="shell-scrim" onClick={() => setMenuOpen(false)} aria-hidden="true" />

      <div className="shell-main">
        <header className="header">
          <button type="button" className="icon-btn menu-btn" onClick={() => setMenuOpen((o) => !o)} aria-label="Menu">
            <Icon name="menu" size={20} />
          </button>
          <div className="header-spacer" />
          <NotificationBell token={token} />
          <div className="header-user">
            <a href="#/settings" className="header-user-button" title="My settings">
              <Avatar name={user.name} size={34} />
              <span className="header-name">
                <strong>{user.name}</strong>
                <span className="muted small">{[user.position || ROLE_LABEL[user.role], user.office].filter(Boolean).join(' · ')}</span>
              </span>
            </a>
          </div>
          <button type="button" className="icon-btn" onClick={onSignOut} aria-label="Log out" title="Log out">
            <Icon name="logout" size={20} />
          </button>
        </header>
        <main className="page">{children}</main>
      </div>
    </div>
  );
}
