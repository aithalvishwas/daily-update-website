import { useState } from 'react';
import { api } from '../api.js';
import { isManager, timeAgo } from '../format.js';
import { announceChange, useLoad } from '../hooks.js';
import { navigate } from '../router.js';
import { AttachmentList, AttachmentPicker } from '../components/Attachments.jsx';
import Avatar from '../components/Avatar.jsx';
import Icon from '../components/Icon.jsx';
import { useToast } from '../components/Toast.jsx';
import { Badge, Empty, IssueType, Modal, Skeleton } from '../components/ui.jsx';

const TYPES = [
  ['blocker', 'Blocker', 'Something stops me from working'],
  ['deadline', 'Deadline at risk', 'I may miss a deadline and need help'],
  ['other', 'Question', 'Anything else for my manager'],
];

export function RaiseIssue({ token, onClose, onSaved, defaultType = 'blocker', defaultEpicId }) {
  const toast = useToast();
  const [epics] = useLoad(() => api('/api/epics', { token }).then((d) => d.epics), [token]);
  const [type, setType] = useState(defaultType);
  const [files, setFiles] = useState([]);
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    const form = Object.fromEntries(new FormData(e.currentTarget));
    setBusy(true);
    try {
      const data = await api('/api/issues', {
        method: 'POST',
        token,
        body: {
          type,
          title: form.title,
          description: form.description,
          epicId: form.epicId ? Number(form.epicId) : null,
          attachmentIds: files.map((f) => f.id),
        },
      });
      toast('Sent to your manager', 'success');
      announceChange();
      onSaved(data.issue);
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal title="Raise an issue" onClose={onClose} wide>
      <form className="form" onSubmit={submit}>
        <div className="choice-grid" role="radiogroup" aria-label="Type">
          {TYPES.map(([key, label, hint]) => (
            <button key={key} type="button" role="radio" aria-checked={type === key} className={`choice ${type === key ? 'active' : ''}`} onClick={() => setType(key)}>
              <IssueType type={key} />
              <strong>{label}</strong>
              <span className="muted small">{hint}</span>
            </button>
          ))}
        </div>
        <label>
          Short title
          <input name="title" maxLength={200} required placeholder={type === 'deadline' ? 'e.g. Cart page may slip by 2 days' : 'e.g. Waiting on API keys'} />
        </label>
        <label>
          <span>
            Epic <span className="optional">optional</span>
          </span>
          <select name="epicId" defaultValue={defaultEpicId ?? ''}>
            <option value="">Not about a specific epic</option>
            {(epics ?? []).map((e) => (
              <option key={e.id} value={e.id}>
                {e.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          What's happening and what help do you need?
          <textarea name="description" rows={4} maxLength={5000} />
        </label>
        <AttachmentPicker token={token} value={files} onChange={setFiles} />
        <div className="form-actions">
          <button type="button" className="btn btn-light" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary" disabled={busy}>
            {busy ? 'Sending…' : 'Send to manager'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function IssueDetail({ token, user, id, onChanged }) {
  const toast = useToast();
  const [data, reload] = useLoad(() => api(`/api/issues/${id}`, { token }), [id, token]);
  const [text, setText] = useState('');
  const [files, setFiles] = useState([]);
  const [busy, setBusy] = useState(false);

  async function reply(e) {
    e.preventDefault();
    setBusy(true);
    try {
      await api(`/api/issues/${id}/replies`, { method: 'POST', token, body: { body: text, attachmentIds: files.map((f) => f.id) } });
      setText('');
      setFiles([]);
      await reload();
      onChanged();
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setBusy(false);
    }
  }

  async function setStatus(status) {
    try {
      await api(`/api/issues/${id}`, { method: 'PATCH', token, body: { status } });
      toast(status === 'resolved' ? 'Marked as resolved' : 'Reopened', 'success');
      await reload();
      onChanged();
      announceChange();
    } catch (err) {
      toast(err.message, 'error');
    }
  }

  if (!data) return <Skeleton height={320} />;
  const { issue, attachments, replies } = data;
  const open = issue.status === 'open';

  return (
    <article className="card issue-detail">
      <div className="issue-head">
        <div>
          <div className="title-row">
            <IssueType type={issue.type} />
            {open ? <Badge tone="amber">Open</Badge> : <Badge tone="green">Resolved</Badge>}
            {issue.source === 'daily_log' && <Badge>From daily update</Badge>}
          </div>
          <h2>{issue.title}</h2>
          <p className="muted small">
            Raised by {issue.raisedByName} · {timeAgo(issue.createdAt)}
            {issue.epicId && (
              <>
                {' · '}
                <a href={`#/epics/${issue.epicId}`}>{issue.epicName}</a>
              </>
            )}
          </p>
        </div>
        <button type="button" className={`btn ${open ? 'btn-success' : 'btn-light'} btn-sm`} onClick={() => setStatus(open ? 'resolved' : 'open')}>
          {open ? (
            <>
              <Icon name="check" size={16} /> Mark resolved
            </>
          ) : (
            'Reopen'
          )}
        </button>
      </div>
      {issue.description && <p className="pre issue-description">{issue.description}</p>}
      <AttachmentList token={token} items={attachments} />

      <div className="thread">
        {replies.map(({ reply: r, attachments: a }) => (
          <div key={r.id} className={`bubble-row ${r.authorId === user.id ? 'mine' : ''}`}>
            <Avatar name={r.authorName} size={30} />
            <div className={`bubble ${r.authorRole !== 'employee' ? 'bubble-manager' : ''}`}>
              <div className="bubble-head">
                <strong>{r.authorName}</strong>
                {r.authorRole !== 'employee' && <span className="muted small">{r.authorRole === 'admin' ? 'Admin' : 'Manager'}</span>}
                <span className="muted small">{timeAgo(r.createdAt)}</span>
              </div>
              <p className="pre">{r.body}</p>
              <AttachmentList token={token} items={a} />
            </div>
          </div>
        ))}
        {replies.length === 0 && <p className="muted small">No replies yet.</p>}
      </div>

      <form className="reply-box" onSubmit={reply}>
        <textarea
          rows={3}
          value={text}
          onChange={(e) => setText(e.target.value)}
          maxLength={5000}
          placeholder={isManager(user) ? `Reply to ${issue.raisedByName.split(' ')[0]}…` : 'Add more detail or reply…'}
          required
          aria-label="Reply"
        />
        <div className="reply-actions">
          <AttachmentPicker token={token} value={files} onChange={setFiles} />
          <button type="submit" className="btn btn-primary" disabled={busy || !text.trim()}>
            <Icon name="send" size={16} /> {busy ? 'Sending…' : 'Reply'}
          </button>
        </div>
      </form>
    </article>
  );
}

export default function Issues({ token, user, id }) {
  const manager = isManager(user);
  const [status, setStatus] = useState('open');
  const [issues, reload] = useLoad(
    () => api(`/api/issues${status === 'all' ? '' : `?status=${status}`}`, { token }).then((d) => d.issues),
    [token, status],
  );
  const [raising, setRaising] = useState(false);

  return (
    <div className="stack">
      <div className="page-head">
        <div>
          <h1>{manager ? 'Blockers & issues' : 'My issues'}</h1>
          <p className="muted">
            {manager ? 'Blockers and deadline problems your team raised. Reply to help them out.' : 'Stuck or worried about a deadline? Tell your manager here.'}
          </p>
        </div>
        {!manager && (
          <button type="button" className="btn btn-primary" onClick={() => setRaising(true)}>
            <Icon name="plus" size={16} /> Raise an issue
          </button>
        )}
      </div>

      <div className="grid-list-detail">
        <section className="card card-flush">
          <div className="card-head padded">
            <div className="tabs" role="tablist">
              {[
                ['open', 'Open'],
                ['resolved', 'Resolved'],
                ['all', 'All'],
              ].map(([key, label]) => (
                <button key={key} type="button" role="tab" aria-selected={status === key} className={status === key ? 'active' : ''} onClick={() => setStatus(key)}>
                  {label}
                </button>
              ))}
            </div>
          </div>
          {issues === null ? (
            <Skeleton />
          ) : issues.length === 0 ? (
            <Empty title={status === 'open' ? 'No open issues' : 'Nothing here'}>{status === 'open' ? 'Nice. Nobody is blocked right now.' : null}</Empty>
          ) : (
            <ul className="inbox">
              {issues.map((i) => (
                <li key={i.id}>
                  <a href={`#/issues/${i.id}`} className={`inbox-item ${String(i.id) === id ? 'active' : ''}`}>
                    <Avatar name={i.raisedByName} size={34} />
                    <span className="inbox-text">
                      <span className="inbox-top">
                        <strong>{manager ? i.raisedByName : i.title}</strong>
                        <span className="muted small">{timeAgo(i.lastReplyAt ?? i.createdAt)}</span>
                      </span>
                      {manager && <span className="inbox-title">{i.title}</span>}
                      <span className="inbox-meta">
                        <IssueType type={i.type} />
                        {i.epicName && <span className="muted small">{i.epicName}</span>}
                        {i.replyCount > 0 && <span className="muted small">· {i.replyCount} repl{i.replyCount === 1 ? 'y' : 'ies'}</span>}
                        {i.status === 'resolved' && <Badge tone="green">Resolved</Badge>}
                      </span>
                    </span>
                  </a>
                </li>
              ))}
            </ul>
          )}
        </section>

        {id ? (
          <IssueDetail key={id} token={token} user={user} id={id} onChanged={reload} />
        ) : (
          <div className="card placeholder">
            <Icon name="alert" size={32} />
            <h2>Pick an issue</h2>
            <p className="muted">The conversation shows up here.</p>
          </div>
        )}
      </div>

      {raising && (
        <RaiseIssue
          token={token}
          onClose={() => setRaising(false)}
          onSaved={(issue) => {
            setRaising(false);
            setStatus('open');
            reload();
            navigate(`/issues/${issue.id}`);
          }}
        />
      )}
    </div>
  );
}
