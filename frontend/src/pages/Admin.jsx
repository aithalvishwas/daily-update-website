import { useMemo, useState } from 'react';
import { api } from '../api.js';
import { ROLE_LABEL } from '../format.js';
import { useLoad } from '../hooks.js';
import Avatar from '../components/Avatar.jsx';
import Icon from '../components/Icon.jsx';
import { useToast } from '../components/Toast.jsx';
import { Badge, Empty, Modal, Skeleton, Stat } from '../components/ui.jsx';
import { useWorkplace } from '../workplace.js';

const POSITIONS = ['Intern', 'Junior Engineer', 'Engineer', 'Senior Engineer', 'Lead Engineer', 'Designer', 'QA Engineer', 'Product Manager', 'Manager', 'Director'];
const ROLE_TONE = { admin: 'red', manager: 'purple', employee: 'gray' };

function AccountForm({ token, account, teams, onClose, onSaved, onInvited }) {
  const toast = useToast();
  const { offices } = useWorkplace();
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    const body = Object.fromEntries(new FormData(e.currentTarget));
    setBusy(true);
    try {
      if (account) {
        await api(`/api/admin/users/${account.id}`, { method: 'PATCH', token, body });
        toast(`Saved ${body.name}`, 'success');
      } else {
        const data = await api('/api/admin/users', { method: 'POST', token, body });
        onInvited({ account: data.user, link: data.link, emailed: data.emailed, invite: true });
        return;
      }
      onSaved();
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal title={account ? `Edit ${account.name}` : 'Invite someone'} onClose={onClose}>
      <form className="form" onSubmit={submit}>
        <label>
          Full name
          <input name="name" defaultValue={account?.name ?? ''} maxLength={100} required />
        </label>
        <label>
          Login email
          <input name="email" type="email" defaultValue={account?.email ?? ''} maxLength={255} required />
        </label>
        <div className="form-grid">
          <label>
            Position
            <input name="position" list="admin-positions" defaultValue={account?.position ?? ''} maxLength={100} placeholder="e.g. Intern" />
            <datalist id="admin-positions">
              {POSITIONS.map((p) => (
                <option key={p} value={p} />
              ))}
            </datalist>
          </label>
          <label>
            Team
            <input name="team" list="admin-teams" defaultValue={account?.team ?? ''} maxLength={100} placeholder="e.g. Infinity" />
            <datalist id="admin-teams">
              {teams.map((t) => (
                <option key={t.id} value={t.name} />
              ))}
            </datalist>
          </label>
        </div>
        <label>
          <span>
            Office <span className="optional">sets their holidays</span>
          </span>
          <select name="office" defaultValue={account?.office ?? ''}>
            <option value="">Not set</option>
            {offices.map((o) => (
              <option key={o}>{o}</option>
            ))}
          </select>
        </label>
        <label>
          Access
          <select name="role" defaultValue={account?.role ?? 'employee'}>
            <option value="employee">Employee: logs their own work (interns too)</option>
            <option value="manager">Manager: sees and manages the team</option>
            <option value="admin">Admin: manager access plus account management</option>
          </select>
        </label>
        {!account && <p className="muted small">They get an email with a link to choose their own password.</p>}
        {account && <p className="muted small">Changing the email changes how they log in. A new access level applies the next time they log in.</p>}
        <div className="form-actions">
          <button type="button" className="btn btn-light" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary" disabled={busy}>
            {busy ? 'Saving…' : account ? 'Save' : 'Send invite'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

// Shows where a "choose your password" link went, with the link to copy in case email isn't set up.
function LinkSent({ account, link, emailed, invite, onClose }) {
  const toast = useToast();
  const first = account.name.split(' ')[0];
  async function copy() {
    try {
      await navigator.clipboard.writeText(link);
      toast('Link copied', 'success');
    } catch {
      toast('Select the link and copy it', 'error');
    }
  }
  return (
    <Modal title={emailed ? (invite ? 'Invite sent' : 'Password link sent') : 'Share this link'} onClose={onClose}>
      <div className="form">
        <p>
          {emailed
            ? `We emailed ${account.email} a link to ${invite ? 'set their' : 'choose a new'} password. You can also share the link yourself:`
            : `We couldn't send the email, so send this link to ${first} yourself (WhatsApp, Slack or email). It lets them choose their password:`}
        </p>
        <span className="input-with-button">
          <input value={link} readOnly onFocus={(e) => e.target.select()} aria-label="Password link" />
          <button type="button" className="btn btn-light btn-sm" onClick={copy}>
            Copy
          </button>
        </span>
        <p className="muted small">The link works once and expires in 7 days.</p>
        <div className="form-actions">
          <button type="button" className="btn btn-primary" onClick={onClose}>
            Done
          </button>
        </div>
      </div>
    </Modal>
  );
}

function Deactivate({ token, account, onClose, onSaved }) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  async function confirm() {
    setBusy(true);
    try {
      await api(`/api/admin/users/${account.id}`, { method: 'DELETE', token });
      toast(`${account.name} can no longer log in`, 'success');
      onSaved();
    } catch (err) {
      toast(err.message, 'error');
      setBusy(false);
    }
  }
  return (
    <Modal title={`Remove ${account.name}?`} onClose={onClose}>
      <div className="form">
        <p>
          {account.name.split(' ')[0]} won't be able to log in and disappears from team lists, epic pickers and alerts. Their daily updates, issues and requests stay in the history, and you can
          reactivate the account at any time.
        </p>
        <div className="form-actions">
          <button type="button" className="btn btn-light" onClick={onClose}>
            Cancel
          </button>
          <button type="button" className="btn btn-danger" onClick={confirm} disabled={busy}>
            {busy ? 'Removing…' : 'Deactivate account'}
          </button>
        </div>
      </div>
    </Modal>
  );
}

export default function Admin({ token, user }) {
  const toast = useToast();
  const [accounts, reload] = useLoad(() => api('/api/admin/users', { token }).then((d) => d.users), [token]);
  const [teams] = useLoad(() => api('/api/teams', { token }).then((d) => d.teams), [token]);
  const [query, setQuery] = useState('');
  const [role, setRole] = useState('');
  const [status, setStatus] = useState('active');
  const [modal, setModal] = useState(null);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (accounts ?? []).filter(
      (a) =>
        (!role || a.role === role) &&
        (status === 'all' || (status === 'active') === a.active) &&
        [a.name, a.email, a.team ?? '', a.position ?? '', a.office ?? ''].some((v) => v.toLowerCase().includes(q)),
    );
  }, [accounts, query, role, status]);

  const active = (accounts ?? []).filter((a) => a.active);
  const count = (r) => active.filter((a) => a.role === r).length;

  async function sendLink(a) {
    try {
      const data = await api(`/api/admin/users/${a.id}/password-link`, { method: 'POST', token });
      setModal({ type: 'link', account: a, link: data.link, emailed: data.emailed, invite: a.invitePending });
    } catch (err) {
      toast(err.message, 'error');
    }
  }

  async function reactivate(a) {
    try {
      await api(`/api/admin/users/${a.id}/activate`, { method: 'POST', token });
      toast(`${a.name} can log in again`, 'success');
      reload();
    } catch (err) {
      toast(err.message, 'error');
    }
  }

  const done = () => {
    setModal(null);
    reload();
  };

  return (
    <div className="stack">
      <div className="page-head">
        <div>
          <h1>Accounts</h1>
          <p className="muted">Add, edit and remove everyone who can log in, from interns to managers and admins.</p>
        </div>
        <button type="button" className="btn btn-primary" onClick={() => setModal({ type: 'edit' })}>
          <Icon name="plus" size={16} /> Invite someone
        </button>
      </div>

      <div className="stats-row">
        <Stat label="Active accounts" value={accounts ? active.length : '–'} tone="blue" icon={<Icon name="people" />} />
        <Stat label="Employees and interns" value={accounts ? count('employee') : '–'} tone="green" icon={<Icon name="home" />} />
        <Stat label="Managers" value={accounts ? count('manager') : '–'} tone="purple" icon={<Icon name="epics" />} />
        <Stat label="Admins" value={accounts ? count('admin') : '–'} hint={accounts ? `${accounts.length - active.length} deactivated` : undefined} tone="red" icon={<Icon name="shield" />} />
      </div>

      <section className="card card-flush">
        <div className="card-head padded toolbar">
          <input type="search" placeholder="Search name, email, position or team" value={query} onChange={(e) => setQuery(e.target.value)} aria-label="Search accounts" />
          <select value={role} onChange={(e) => setRole(e.target.value)} aria-label="Filter by access">
            <option value="">All access levels</option>
            <option value="employee">Employees</option>
            <option value="manager">Managers</option>
            <option value="admin">Admins</option>
          </select>
          <div className="tabs" role="tablist">
            {[
              ['active', 'Active'],
              ['inactive', 'Deactivated'],
              ['all', 'All'],
            ].map(([key, label]) => (
              <button key={key} type="button" role="tab" aria-selected={status === key} className={status === key ? 'active' : ''} onClick={() => setStatus(key)}>
                {label}
              </button>
            ))}
          </div>
        </div>
        {accounts === null ? (
          <Skeleton />
        ) : shown.length === 0 ? (
          <Empty title="No accounts match" />
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Access</th>
                  <th>Position</th>
                  <th>Team</th>
                  <th>Office</th>
                  <th>Status</th>
                  <th aria-label="Actions" />
                </tr>
              </thead>
              <tbody>
                {shown.map((a) => (
                  <tr key={a.id} className={a.active ? '' : 'row-muted'}>
                    <td>
                      <span className="person-cell">
                        <Avatar name={a.name} size={34} />
                        <span>
                          <span className="cell-title">
                            {a.name}
                            {a.id === user.id && <span className="muted small"> (you)</span>}
                          </span>
                          <span className="cell-sub">{a.email}</span>
                        </span>
                      </span>
                    </td>
                    <td>
                      <Badge tone={ROLE_TONE[a.role]}>{ROLE_LABEL[a.role]}</Badge>
                    </td>
                    <td>{a.position || <span className="muted">—</span>}</td>
                    <td>{a.team ? <Badge tone="blue">{a.team}</Badge> : <span className="muted">—</span>}</td>
                    <td>{a.office || <span className="muted">—</span>}</td>
                    <td>
                      {!a.active ? (
                        <span className="dot-label dot-gray">Deactivated</span>
                      ) : a.invitePending ? (
                        <span className="dot-label dot-amber">Invite sent</span>
                      ) : (
                        <span className="dot-label dot-green">Active</span>
                      )}
                    </td>
                    <td>
                      <span className="row-actions">
                        {a.active ? (
                          <>
                            <button type="button" className="btn btn-light btn-xs" onClick={() => setModal({ type: 'edit', account: a })}>
                              Edit
                            </button>
                            <button type="button" className="btn btn-light btn-xs" onClick={() => sendLink(a)}>
                              {a.invitePending ? 'Resend invite' : 'Reset password'}
                            </button>
                            {a.id !== user.id && (
                              <button type="button" className="btn btn-danger-light btn-xs" onClick={() => setModal({ type: 'remove', account: a })}>
                                Deactivate
                              </button>
                            )}
                          </>
                        ) : (
                          <button type="button" className="btn btn-light btn-xs" onClick={() => reactivate(a)}>
                            Reactivate
                          </button>
                        )}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {modal?.type === 'edit' && (
        <AccountForm
          token={token}
          account={modal.account}
          teams={teams ?? []}
          onClose={() => setModal(null)}
          onSaved={done}
          onInvited={(sent) => {
            setModal({ type: 'link', ...sent });
            reload();
          }}
        />
      )}
      {modal?.type === 'link' && <LinkSent {...modal} onClose={() => setModal(null)} />}
      {modal?.type === 'remove' && <Deactivate token={token} account={modal.account} onClose={() => setModal(null)} onSaved={done} />}
    </div>
  );
}
