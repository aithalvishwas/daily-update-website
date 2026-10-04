import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '../api.js';
import { timeAgo } from '../format.js';
import { navigate } from '../router.js';
import Icon from './Icon.jsx';

const TONE = {
  issue_blocker: 'red',
  issue_deadline: 'amber',
  weekend_request: 'blue',
  weekend_decision: 'green',
  epic_assigned: 'blue',
  epic_done: 'green',
};

/** The bell in the header: alerts for blockers, replies, requests and decisions. */
export default function NotificationBell({ token, onChange }) {
  const [open, setOpen] = useState(false);
  const [data, setData] = useState({ notifications: [], unread: 0 });
  const ref = useRef();

  const load = useCallback(async () => {
    try {
      setData(await api('/api/notifications', { token }));
    } catch {
      // The bell stays quiet if the service is briefly unavailable.
    }
  }, [token]);

  useEffect(() => {
    load();
    const timer = setInterval(load, 30000);
    const onFocus = () => load();
    window.addEventListener('focus', onFocus);
    window.addEventListener('dailyupdate:refresh', onFocus);
    return () => {
      clearInterval(timer);
      window.removeEventListener('focus', onFocus);
      window.removeEventListener('dailyupdate:refresh', onFocus);
    };
  }, [load]);

  useEffect(() => onChange?.(data.unread), [data.unread, onChange]);

  useEffect(() => {
    if (!open) return undefined;
    const close = (e) => !ref.current?.contains(e.target) && setOpen(false);
    const esc = (e) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', esc);
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('keydown', esc);
    };
  }, [open]);

  async function openItem(n) {
    setOpen(false);
    if (!n.readAt) {
      await api(`/api/notifications/${n.id}/read`, { method: 'POST', token }).catch(() => {});
      load();
    }
    if (n.link) navigate(n.link);
  }

  async function readAll() {
    await api('/api/notifications/read-all', { method: 'POST', token }).catch(() => {});
    load();
  }

  return (
    <div className="bell" ref={ref}>
      <button
        type="button"
        className="icon-btn bell-button"
        onClick={() => {
          setOpen((o) => !o);
          if (!open) load();
        }}
        aria-label={`Notifications${data.unread ? `, ${data.unread} unread` : ''}`}
        aria-expanded={open}
      >
        <Icon name="bell" size={20} />
        {data.unread > 0 && <span className="bell-count">{data.unread > 9 ? '9+' : data.unread}</span>}
      </button>
      {open && (
        <div className="bell-panel" role="dialog" aria-label="Notifications">
          <div className="bell-head">
            <strong>Notifications</strong>
            {data.unread > 0 && (
              <button type="button" className="link-btn" onClick={readAll}>
                Mark all read
              </button>
            )}
          </div>
          {data.notifications.length === 0 ? (
            <p className="bell-empty muted">You're all caught up.</p>
          ) : (
            <ul className="bell-list">
              {data.notifications.map((n) => (
                <li key={n.id}>
                  <button type="button" className={`bell-item ${n.readAt ? '' : 'unread'}`} onClick={() => openItem(n)}>
                    <span className={`bell-dot dot-${TONE[n.type] ?? 'gray'}`} aria-hidden="true" />
                    <span className="bell-text">
                      <strong>{n.title}</strong>
                      {n.body && <span className="bell-body">{n.body}</span>}
                      <span className="muted small">{timeAgo(n.createdAt)}</span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
