import Avatar from './Avatar.jsx';
import Logo from './Logo.jsx';

export default function TopBar({ user, onSignOut }) {
  return (
    <header className="topbar">
      <div className="container topbar-inner">
        <Logo />
        <div className="topbar-user">
          <Avatar name={user.name} size={34} />
          <div className="topbar-name">
            <strong>{user.name}</strong>
            <span className="role-pill">{user.role}</span>
          </div>
          <button type="button" className="btn btn-ghost" onClick={onSignOut}>
            Log out
          </button>
        </div>
      </div>
    </header>
  );
}
