import { useMemo, useState } from 'react';
import { api } from '../api.js';
import { PRIORITY, TASK_STATUS, TASK_STATUS_LABEL, isManager, taskDue, timeAgo } from '../format.js';
import { announceChange, useLoad } from '../hooks.js';
import Avatar from './Avatar.jsx';
import { DatePicker } from './Calendar.jsx';
import Icon from './Icon.jsx';
import { useToast } from './Toast.jsx';
import { Badge, Modal, Skeleton } from './ui.jsx';

export function PriorityBadge({ priority }) {
  const p = PRIORITY[priority] ?? PRIORITY.medium;
  return <Badge tone={p.tone}>{p.label}</Badge>;
}

export function TaskStatusBadge({ status }) {
  const tone = { todo: 'gray', in_progress: 'blue', review: 'purple', done: 'green' }[status] ?? 'gray';
  return <Badge tone={tone}>{TASK_STATUS_LABEL[status] ?? status}</Badge>;
}

export function DueText({ task }) {
  const due = taskDue(task);
  if (!due) return null;
  return <span className={`small ${due.late ? 'text-red' : due.soon ? 'text-amber' : 'muted'}`}>{due.text}</span>;
}

/** Add a task (no {@code taskId}) or open one: edit its fields and talk about it in comments. */
export function TaskModal({ token, user, taskId, epic: givenEpic, initialStatus = 'todo', onClose, onChanged }) {
  const toast = useToast();
  const [data, reload] = useLoad(
    () => (taskId ? api(`/api/tasks/${taskId}`, { token }) : Promise.resolve({ task: null, comments: [] })),
    [taskId, token],
  );
  const task = data?.task;
  const epicId = givenEpic?.id ?? task?.epicId;
  // The epic gives the list of people a task can go to. Someone removed from the epic can still open their task.
  const [epic] = useLoad(
    () => (givenEpic ? Promise.resolve(givenEpic) : epicId ? api(`/api/epics/${epicId}`, { token }).then((d) => d.epic).catch(() => ({ members: [] })) : Promise.resolve(null)),
    [epicId, token],
  );

  if (taskId && !data) {
    return (
      <Modal title="Task" onClose={onClose} wide>
        <Skeleton height={260} />
      </Modal>
    );
  }
  return (
    <Modal title={task ? task.epicName : `New task${givenEpic ? ` in ${givenEpic.name}` : ''}`} onClose={onClose} wide>
      <TaskForm
        key={task?.updatedAt ?? 'new'}
        token={token}
        user={user}
        task={task}
        epicId={epicId}
        members={epic?.members ?? []}
        initialStatus={initialStatus}
        onSaved={(saved, close) => {
          onChanged?.(saved);
          announceChange();
          if (close) onClose();
          else reload();
        }}
        onDeleted={() => {
          toast('Task deleted', 'success');
          onChanged?.(null);
          onClose();
        }}
      />
      {task && <TaskComments token={token} user={user} task={task} comments={data.comments} onAdded={reload} />}
    </Modal>
  );
}

function TaskForm({ token, user, task, epicId, members, initialStatus, onSaved, onDeleted }) {
  const toast = useToast();
  const [form, setForm] = useState({
    title: task?.title ?? '',
    description: task?.description ?? '',
    status: task?.status ?? initialStatus,
    priority: task?.priority ?? 'medium',
    assigneeId: task?.assigneeId ?? '',
    dueDate: task?.dueDate ?? '',
    estimateHours: task?.estimateHours ?? '',
  });
  const [busy, setBusy] = useState(false);
  const set = (field) => (e) => setForm((f) => ({ ...f, [field]: e?.target ? e.target.value : e }));
  const people = useMemo(() => {
    const list = [...members];
    if (task?.assigneeId && !list.some((m) => m.userId === task.assigneeId)) {
      list.push({ userId: task.assigneeId, userName: task.assigneeName });
    }
    return list;
  }, [members, task]);

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    const body = {
      title: form.title,
      description: form.description,
      status: form.status,
      priority: form.priority,
      assigneeId: form.assigneeId === '' ? null : Number(form.assigneeId),
      unassign: form.assigneeId === '',
      dueDate: form.dueDate || null,
      clearDueDate: !form.dueDate,
      estimateHours: form.estimateHours === '' ? null : Number(form.estimateHours),
    };
    try {
      const saved = task
        ? await api(`/api/tasks/${task.id}`, { method: 'PATCH', token, body })
        : await api('/api/tasks', { method: 'POST', token, body: { ...body, epicId } });
      toast(task ? 'Task saved' : 'Task added', 'success');
      onSaved(saved.task, !task);
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!window.confirm(`Delete the task "${task.title}"?`)) return;
    try {
      await api(`/api/tasks/${task.id}`, { method: 'DELETE', token });
      announceChange();
      onDeleted();
    } catch (err) {
      toast(err.message, 'error');
    }
  }

  const canDelete = task && (isManager(user) || task.createdBy === user.id);

  return (
    <form className="form" onSubmit={submit}>
      <label>
        Task
        <input value={form.title} onChange={set('title')} maxLength={200} required placeholder="e.g. Build the payment page" autoFocus={!task} />
      </label>
      <div className="form-grid">
        <label>
          Status
          <select value={form.status} onChange={set('status')}>
            {TASK_STATUS.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label>
          Priority
          <select value={form.priority} onChange={set('priority')}>
            {Object.entries(PRIORITY).map(([value, p]) => (
              <option key={value} value={value}>
                {p.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          Assigned to
          <select value={form.assigneeId} onChange={set('assigneeId')}>
            <option value="">No one yet</option>
            {people.map((m) => (
              <option key={m.userId} value={m.userId}>
                {m.userName}
                {m.userId === user.id ? ' (me)' : ''}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="form-grid">
        <div>
          <DatePicker label="Due date" value={form.dueDate} onChange={set('dueDate')} />
          {form.dueDate && (
            <button type="button" className="link-btn small" onClick={() => setForm((f) => ({ ...f, dueDate: '' }))}>
              Clear date
            </button>
          )}
        </div>
        <label>
          <span>
            Estimate <span className="optional">hours</span>
          </span>
          <input type="number" min="0" max="999" step="0.5" value={form.estimateHours} onChange={set('estimateHours')} placeholder="e.g. 6" />
        </label>
      </div>
      <label>
        <span>
          Details <span className="optional">optional</span>
        </span>
        <textarea rows={3} value={form.description} onChange={set('description')} maxLength={5000} placeholder="What does done look like?" />
      </label>
      {task && (
        <p className="muted small">
          Added by {task.createdByName} {timeAgo(task.createdAt)}
          {task.completedAt ? ` · finished ${timeAgo(task.completedAt)}` : ''}
        </p>
      )}
      <div className="form-actions">
        {canDelete && (
          <button type="button" className="btn btn-light" onClick={remove}>
            Delete
          </button>
        )}
        <button type="submit" className="btn btn-primary" disabled={busy}>
          {busy ? 'Saving…' : task ? 'Save task' : 'Add task'}
        </button>
      </div>
    </form>
  );
}

function TaskComments({ token, user, task, comments, onAdded }) {
  const toast = useToast();
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  async function send(e) {
    e.preventDefault();
    setBusy(true);
    try {
      await api(`/api/tasks/${task.id}/comments`, { method: 'POST', token, body: { body: text } });
      setText('');
      onAdded();
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="task-comments">
      <h3>Comments ({comments.length})</h3>
      <div className="thread">
        {comments.map((c) => (
          <div key={c.id} className={`bubble-row ${c.authorId === user.id ? 'mine' : ''}`}>
            <Avatar name={c.authorName} size={30} />
            <div className="bubble">
              <div className="bubble-head">
                <strong>{c.authorName}</strong>
                <span className="muted small">{timeAgo(c.createdAt)}</span>
              </div>
              <p className="pre">{c.body}</p>
            </div>
          </div>
        ))}
        {comments.length === 0 && <p className="muted small">No comments yet. Ask a question or share an update.</p>}
      </div>
      <form className="reply-box" onSubmit={send}>
        <textarea rows={2} value={text} onChange={(e) => setText(e.target.value)} maxLength={5000} placeholder="Write a comment…" required aria-label="Comment" />
        <div className="reply-actions">
          <span />
          <button type="submit" className="btn btn-primary btn-sm" disabled={busy || !text.trim()}>
            <Icon name="send" size={14} /> {busy ? 'Sending…' : 'Comment'}
          </button>
        </div>
      </form>
    </section>
  );
}

function TaskCard({ task, onOpen, draggable, onDragStart }) {
  return (
    <button
      type="button"
      className={`task-card priority-${task.priority}`}
      onClick={onOpen}
      draggable={draggable}
      onDragStart={onDragStart}
    >
      <span className="task-card-title">{task.title}</span>
      <span className="task-card-meta">
        <PriorityBadge priority={task.priority} />
        <DueText task={task} />
        {task.commentCount > 0 && (
          <span className="muted small task-comments-count" title={`${task.commentCount} comments`}>
            💬 {task.commentCount}
          </span>
        )}
      </span>
      <span className="task-card-foot">
        {task.assigneeName ? (
          <span className="task-assignee">
            <Avatar name={task.assigneeName} size={22} />
            <span className="small">{task.assigneeName}</span>
          </span>
        ) : (
          <span className="muted small">Unassigned</span>
        )}
        {task.estimateHours != null && <span className="muted small">{Number(task.estimateHours)} h</span>}
      </span>
    </button>
  );
}

/** Teamwork-style board for one epic: drag cards between columns, or open one to edit it. */
export function TaskBoard({ token, user, epic }) {
  const toast = useToast();
  const canEdit = isManager(user) || epic.members.some((m) => m.userId === user.id);
  const [tasks, reload, setTasks] = useLoadWithSet(() => api(`/api/tasks?epicId=${epic.id}`, { token }).then((d) => d.tasks), [epic.id, token]);
  const [who, setWho] = useState('all');
  const [open, setOpen] = useState(null); // { id } or { status } for a new task
  const [dragOver, setDragOver] = useState(null);

  const shown = (tasks ?? []).filter((t) => who === 'all' || (who === 'me' ? t.assigneeId === user.id : t.assigneeId == null));

  async function move(id, status) {
    const task = tasks.find((t) => t.id === id);
    if (!task || task.status === status) return;
    setTasks((list) => list.map((t) => (t.id === id ? { ...t, status } : t)));
    try {
      await api(`/api/tasks/${id}`, { method: 'PATCH', token, body: { status } });
      announceChange();
      reload();
    } catch (err) {
      toast(err.message, 'error');
      reload();
    }
  }

  return (
    <section className="card">
      <div className="card-head">
        <h2>Tasks</h2>
        <div className="head-actions">
          <div className="tabs small" role="tablist" aria-label="Show tasks for">
            {[
              ['all', 'Everyone'],
              ['me', 'Mine'],
              ['none', 'Unassigned'],
            ].map(([key, label]) => (
              <button key={key} type="button" role="tab" aria-selected={who === key} className={who === key ? 'active' : ''} onClick={() => setWho(key)}>
                {label}
              </button>
            ))}
          </div>
          {canEdit && (
            <button type="button" className="btn btn-primary btn-sm" onClick={() => setOpen({ status: 'todo' })}>
              <Icon name="plus" size={14} /> Add task
            </button>
          )}
        </div>
      </div>
      {tasks === null ? (
        <Skeleton height={180} />
      ) : (
        <div className="board">
          {TASK_STATUS.map(([status, label]) => {
            const column = shown.filter((t) => t.status === status);
            return (
              <div
                key={status}
                className={`board-col ${dragOver === status ? 'drag-over' : ''}`}
                onDragOver={(e) => {
                  if (!canEdit) return;
                  e.preventDefault();
                  setDragOver(status);
                }}
                onDragLeave={() => setDragOver((s) => (s === status ? null : s))}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragOver(null);
                  move(Number(e.dataTransfer.getData('text/task')), status);
                }}
              >
                <div className="board-col-head">
                  <span className={`board-dot dot-${status}`} />
                  <strong>{label}</strong>
                  <span className="tab-count">{column.length}</span>
                </div>
                <div className="board-cards">
                  {column.map((t) => (
                    <TaskCard
                      key={t.id}
                      task={t}
                      draggable={canEdit}
                      onDragStart={(e) => e.dataTransfer.setData('text/task', String(t.id))}
                      onOpen={() => setOpen({ id: t.id })}
                    />
                  ))}
                  {column.length === 0 && <p className="muted small board-empty">{canEdit ? 'Drop a task here' : 'Nothing here'}</p>}
                </div>
                {canEdit && status !== 'done' && (
                  <button type="button" className="board-add" onClick={() => setOpen({ status })}>
                    <Icon name="plus" size={14} /> Add task
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
      {open && (
        <TaskModal
          token={token}
          user={user}
          taskId={open.id}
          epic={epic}
          initialStatus={open.status}
          onClose={() => setOpen(null)}
          onChanged={reload}
        />
      )}
    </section>
  );
}

// useLoad plus a setter, so the board can move a card before the server answers.
function useLoadWithSet(fetcher, deps) {
  const [loaded, reload] = useLoad(fetcher, deps);
  const [local, setLocal] = useState({ source: null, value: null });
  const value = local.source === loaded && local.value !== null ? local.value : loaded;
  const set = (fn) => setLocal({ source: loaded, value: typeof fn === 'function' ? fn(value) : fn });
  return [value, reload, set];
}

/** Home-page card: my next open tasks. */
export function MyTasksCard({ token }) {
  const [tasks] = useLoad(() => api('/api/tasks/mine', { token }).then((d) => d.tasks.filter((t) => t.status !== 'done')), [token]);
  if (tasks === null) return null;
  return (
    <section className="card">
      <div className="card-head">
        <h2>My tasks</h2>
        <a href="#/tasks" className="small">
          {tasks.length ? `All ${tasks.length}` : 'Open'}
        </a>
      </div>
      {tasks.length === 0 ? (
        <p className="muted small">No open tasks. Tasks you're given on an epic's board show up here.</p>
      ) : (
        <ul className="mini-tasks">
          {tasks.slice(0, 5).map((t) => (
            <li key={t.id}>
              <a href={`#/tasks/${t.id}`}>
                <strong>{t.title}</strong>
                <span className="mini-task-meta">
                  <PriorityBadge priority={t.priority} />
                  <DueText task={t} />
                </span>
              </a>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
