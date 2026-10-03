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

/** Monday to Friday of the week that contains {@code iso}. */
export function workWeek(iso) {
  const d = new Date(`${iso}T00:00:00`);
  const offset = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - offset);
  return Array.from({ length: 5 }, (_, i) => {
    const day = new Date(d);
    day.setDate(d.getDate() + i);
    return toIso(day);
  });
}

/** Mon–Fri days after {@code fromIso} and before {@code untilIso}: workdays with no update. */
export function workdaysMissed(fromIso, untilIso) {
  let count = 0;
  const d = new Date(`${fromIso}T00:00:00`);
  d.setDate(d.getDate() + 1);
  while (toIso(d) < untilIso) {
    if (!isWeekend(toIso(d))) count += 1;
    d.setDate(d.getDate() + 1);
  }
  return count;
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
