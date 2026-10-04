import { useMemo, useState } from 'react';
import { api } from '../api.js';
import { daysBetween, localToday } from '../format.js';
import { announceChange, useLoad } from '../hooks.js';
import { navigate } from '../router.js';
import { DueText, PriorityBadge, TaskModal, TaskStatusBadge } from '../components/Tasks.jsx';
import { useToast } from '../components/Toast.jsx';
import { Empty, Skeleton, Stat } from '../components/ui.jsx';
import Icon from '../components/Icon.jsx';

const GROUPS = [
  ['overdue', 'Overdue'],
  ['today', 'Today'],
  ['week', 'Next 7 days'],
  ['later', 'Later'],
  ['nodate', 'No due date'],
  ['done', 'Finished in the last 14 days'],
];

function groupOf(task, today) {
  if (task.status === 'done') return 'done';
  if (!task.dueDate) return 'nodate';
  const days = daysBetween(today, task.dueDate);
  if (days < 0) return 'overdue';
  if (days === 0) return 'today';
  if (days <= 7) return 'week';
  return 'later';
}

/** Every task given to me, across epics, grouped by when it is due. */
export default function MyTasks({ token, user, id }) {
  const toast = useToast();
  const [tasks, reload] = useLoad(() => api('/api/tasks/mine', { token }).then((d) => d.tasks), [token]);
  const [showDone, setShowDone] = useState(false);
  const today = localToday();

  const groups = useMemo(() => {
    const map = Object.fromEntries(GROUPS.map(([key]) => [key, []]));
    for (const t of tasks ?? []) map[groupOf(t, today)].push(t);
    return map;
  }, [tasks, today]);

  async function toggleDone(task) {
    try {
      await api(`/api/tasks/${task.id}`, { method: 'PATCH', token, body: { status: task.status === 'done' ? 'in_progress' : 'done' } });
      if (task.status !== 'done') toast(`Nice, "${task.title}" is done`, 'success');
      announceChange();
      reload();
    } catch (err) {
      toast(err.message, 'error');
    }
  }

  const open = (tasks ?? []).filter((t) => t.status !== 'done');

  return (
    <div className="stack">
      <div className="page-head">
        <div>
          <h1>My tasks</h1>
          <p className="muted">Everything assigned to you, across all your epics. Tick a task when it's done.</p>
        </div>
      </div>

      {tasks === null ? (
        <Skeleton height={240} />
      ) : (
        <>
          <div className="stats-row">
            <Stat label="Open tasks" value={open.length} icon={<Icon name="check" />} />
            <Stat label="Overdue" value={groups.overdue.length} tone={groups.overdue.length ? 'red' : 'green'} icon={<Icon name="alert" />} />
            <Stat label="Due in the next 7 days" value={groups.today.length + groups.week.length} tone="amber" icon={<Icon name="clock" />} />
            <Stat label="Done in the last 14 days" value={groups.done.length} tone="green" icon={<Icon name="target" />} />
          </div>

          {tasks.length === 0 ? (
            <div className="card">
              <Empty title="No tasks yet">Tasks you're given on an epic's board show up here.</Empty>
            </div>
          ) : (
            GROUPS.filter(([key]) => groups[key].length > 0 && (key !== 'done' || showDone)).map(([key, label]) => (
              <section key={key} className="card card-flush">
                <div className="card-head padded">
                  <h2 className={key === 'overdue' ? 'text-red' : ''}>
                    {label} <span className="tab-count">{groups[key].length}</span>
                  </h2>
                </div>
                <ul className="task-list">
                  {groups[key].map((t) => (
                    <li key={t.id} className={t.status === 'done' ? 'done' : ''}>
                      <input type="checkbox" checked={t.status === 'done'} onChange={() => toggleDone(t)} aria-label={`Mark ${t.title} done`} />
                      <button type="button" className="task-list-main" onClick={() => navigate(`/tasks/${t.id}`)}>
                        <strong>{t.title}</strong>
                        <span className="muted small">{t.epicName}</span>
                      </button>
                      <span className="task-list-meta">
                        <PriorityBadge priority={t.priority} />
                        <TaskStatusBadge status={t.status} />
                        <DueText task={t} />
                      </span>
                    </li>
                  ))}
                </ul>
              </section>
            ))
          )}
          {groups.done.length > 0 && (
            <button type="button" className="link-btn" onClick={() => setShowDone((s) => !s)}>
              {showDone ? 'Hide finished tasks' : `Show ${groups.done.length} finished task${groups.done.length === 1 ? '' : 's'}`}
            </button>
          )}
        </>
      )}

      {id && (
        <TaskModal
          key={id}
          token={token}
          user={user}
          taskId={Number(id)}
          onClose={() => navigate('/tasks')}
          onChanged={reload}
        />
      )}
    </div>
  );
}
