const TOKEN_KEY = 'dailyUpdate.token';
const USER_KEY = 'dailyUpdate.user';

let onUnauthorized = () => {};

export function setUnauthorizedHandler(fn) {
  onUnauthorized = fn;
}

export function loadSession() {
  try {
    const token = sessionStorage.getItem(TOKEN_KEY);
    const user = JSON.parse(sessionStorage.getItem(USER_KEY) || 'null');
    return token && user ? { token, user } : null;
  } catch {
    return null;
  }
}

export function saveSession(session) {
  try {
    if (session) {
      sessionStorage.setItem(TOKEN_KEY, session.token);
      sessionStorage.setItem(USER_KEY, JSON.stringify(session.user));
    } else {
      sessionStorage.removeItem(TOKEN_KEY);
      sessionStorage.removeItem(USER_KEY);
    }
  } catch {
    // Storage can be unavailable (private mode); the session then lasts until reload.
  }
}

export async function api(path, { method = 'GET', body, token } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(path, { method, headers, body: body ? JSON.stringify(body) : undefined });
  if (res.status === 401 && token) {
    onUnauthorized();
    throw new Error('Your session expired, please log in again');
  }
  if (res.status === 204) return null;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}

/** Uploads one file and returns its attachment info. */
export async function upload(file, token) {
  const data = new FormData();
  data.append('file', file);
  const res = await fetch('/api/attachments', { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: data });
  if (res.status === 401) {
    onUnauthorized();
    throw new Error('Your session expired, please log in again');
  }
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error || `Upload failed (${res.status})`);
  return json.attachment;
}

/** Downloads a protected file as a Blob (images can't send the login token by themselves). */
export async function fetchBlob(path, token) {
  const res = await fetch(path, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) throw new Error('Could not load the file');
  return res.blob();
}
