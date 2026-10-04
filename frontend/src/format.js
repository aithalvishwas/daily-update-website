export function localToday() {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 10);
}

export function formatDate(iso, opts = { weekday: 'short', month: 'short', day: 'numeric' }) {
  return new Date(`${iso}T00:00:00`).toLocaleDateString(undefined, opts);
}

export function initials(name = '') {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0].toUpperCase())
    .join('');
}

// A stable hue per person so avatars keep their colour.
export function hueFor(text = '') {
  let h = 0;
  for (const ch of text) h = (h * 31 + ch.charCodeAt(0)) % 360;
  return h;
}

export function daysBetween(fromIso, toIso) {
  return Math.round((new Date(`${toIso}T00:00:00`) - new Date(`${fromIso}T00:00:00`)) / 86400000);
}

export function toIso(date) {
  const d = new Date(date);
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 10);
}

export function isWeekend(iso) {
  const day = new Date(`${iso}T00:00:00`).getDay();
  return day === 0 || day === 6;
}

export function timeAgo(timestamp) {
  const seconds = Math.round((Date.now() - new Date(timestamp).getTime()) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(timestamp).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export function fileSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export const HEALTH = {
  on_track: { label: 'On track', tone: 'green' },
  at_risk: { label: 'At risk', tone: 'amber' },
  overdue: { label: 'Overdue', tone: 'red' },
  done: { label: 'Done', tone: 'blue' },
};

/** Admins can do everything managers can. */
export function isManager(user) {
  return user?.role === 'manager' || user?.role === 'admin';
}

export const ROLE_LABEL = { admin: 'Admin', manager: 'Manager', employee: 'Employee' };

export const TASK_STATUS = [
  ['todo', 'To do'],
  ['in_progress', 'In progress'],
  ['review', 'In review'],
  ['done', 'Done'],
];
export const TASK_STATUS_LABEL = Object.fromEntries(TASK_STATUS);

export const PRIORITY = {
  urgent: { label: 'Urgent', tone: 'red' },
  high: { label: 'High', tone: 'amber' },
  medium: { label: 'Medium', tone: 'blue' },
  low: { label: 'Low', tone: 'gray' },
};

/** "Due today", "2 days overdue", "Due Mar 4" for an open task; null when it has no date or is done. */
export function taskDue(task, today = localToday()) {
  if (!task.dueDate || task.status === 'done') return null;
  const days = daysBetween(today, task.dueDate);
  if (days < 0) return { text: `${-days} day${days === -1 ? '' : 's'} overdue`, late: true };
  if (days === 0) return { text: 'Due today', soon: true };
  if (days === 1) return { text: 'Due tomorrow', soon: true };
  return { text: `Due ${formatDate(task.dueDate, { month: 'short', day: 'numeric' })}` };
}
