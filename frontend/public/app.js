'use strict';

// All user-provided text is rendered with textContent, never innerHTML, to prevent XSS.

const TOKEN_KEY = 'dailyUpdate.token';
const USER_KEY = 'dailyUpdate.user';

const state = {
  token: sessionStorage.getItem(TOKEN_KEY),
  user: JSON.parse(sessionStorage.getItem(USER_KEY) || 'null'),
  employees: [],
  overview: new Map(),
  selectedId: null,
};

const $ = (sel, root = document) => root.querySelector(sel);

function el(tag, props = {}, children = []) {
  const node = document.createElement(tag);
  Object.entries(props).forEach(([k, v]) => {
    if (k === 'text') node.textContent = v;
    else if (k === 'className') node.className = v;
    else node.setAttribute(k, v);
  });
  children.forEach((c) => node.append(c));
  return node;
}

function toast(message, isError = false) {
  const t = $('#toast');
  t.textContent = message;
  t.classList.toggle('error', isError);
  t.hidden = false;
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => { t.hidden = true; }, 4000);
}

async function api(path, { method = 'GET', body } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (state.token) headers.Authorization = `Bearer ${state.token}`;
  const res = await fetch(path, { method, headers, body: body ? JSON.stringify(body) : undefined });
  if (res.status === 401 && state.token) {
    logout();
    throw new Error('Your session expired, please log in again');
  }
  if (res.status === 204) return null;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}

function localToday() {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 10);
}

function formatDate(iso) {
  return new Date(`${iso}T00:00:00`).toLocaleDateString(undefined, {
    weekday: 'short', year: 'numeric', month: 'short', day: 'numeric',
  });
}

/* ---------- Session ---------- */

function saveSession(token, user) {
  state.token = token;
  state.user = user;
  sessionStorage.setItem(TOKEN_KEY, token);
  sessionStorage.setItem(USER_KEY, JSON.stringify(user));
}

function logout() {
  state.token = null;
  state.user = null;
  state.selectedId = null;
  $('#employee-detail').replaceChildren(
    el('p', { className: 'empty', text: 'Select an employee to see their AI summary and daily updates.' })
  );
  sessionStorage.removeItem(TOKEN_KEY);
  sessionStorage.removeItem(USER_KEY);
  render();
}

function showView(id) {
  document.querySelectorAll('.view').forEach((v) => { v.hidden = v.id !== id; });
}

function render() {
  const session = $('#session');
  if (!state.user) {
    session.hidden = true;
    selectAuthTab('login');
    showView('view-auth');
    return;
  }
  session.hidden = false;
  $('#session-name').textContent = state.user.name;
  $('#session-role').textContent = state.user.role;
  if (state.user.role === 'manager') {
    showView('view-manager');
    loadEmployees();
  } else {
    showView('view-employee');
    $('#log-form').workDate.value = localToday();
    $('#log-form').workDate.max = localToday();
    loadMyLogs();
  }
}

/* ---------- Auth view ---------- */

function selectAuthTab(name) {
  document.querySelectorAll('.tab').forEach((t) => t.classList.toggle('active', t.dataset.tab === name));
  $('#login-form').hidden = name !== 'login';
  $('#register-form').hidden = name !== 'register';
}

function setupAuth() {
  document.querySelectorAll('.tab').forEach((tab) => {
    tab.addEventListener('click', () => selectAuthTab(tab.dataset.tab));
  });

  $('#login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const f = e.target;
    try {
      const data = await api('/api/auth/login', {
        method: 'POST', body: { email: f.email.value, password: f.password.value },
      });
      f.reset();
      saveSession(data.token, data.user);
      render();
    } catch (err) { toast(err.message, true); }
  });

  $('#register-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const f = e.target;
    try {
      const data = await api('/api/auth/register', {
        method: 'POST',
        body: { name: f.name.value, email: f.email.value, team: f.team.value, password: f.password.value },
      });
      f.reset();
      saveSession(data.token, data.user);
      render();
      toast('Welcome! Your account is ready.');
    } catch (err) { toast(err.message, true); }
  });

  $('#logout').addEventListener('click', logout);
}

/* ---------- Employee view ---------- */

function logItem(log, { deletable = false } = {}) {
  const head = el('div', { className: 'log-head' }, [
    el('strong', { text: formatDate(log.workDate) }),
    el('span', { className: 'muted', text: log.hours !== null ? `${log.hours} h` : '' }),
  ]);
  const item = el('li', { className: 'log-item' }, [head, el('p', { className: 'pre', text: log.tasks })]);
  if (log.blockers) {
    item.append(el('p', { className: 'blockers pre', text: `Blockers: ${log.blockers}` }));
  }
  if (deletable) {
    const del = el('button', { className: 'btn btn-ghost btn-small', type: 'button', text: 'Delete' });
    del.addEventListener('click', async () => {
      if (!confirm(`Delete your update for ${log.workDate}?`)) return;
      try {
        await api(`/api/logs/${log.id}`, { method: 'DELETE' });
        loadMyLogs();
      } catch (err) { toast(err.message, true); }
    });
    head.append(del);
  }
  return item;
}

function renderLogs(list, logs, opts) {
  list.replaceChildren();
  if (!logs.length) {
    list.append(el('li', { className: 'empty', text: 'No updates yet.' }));
    return;
  }
  logs.forEach((log) => list.append(logItem(log, opts)));
}

async function loadMyLogs() {
  try {
    const { logs } = await api('/api/logs/me');
    renderLogs($('#my-logs'), logs, { deletable: true });
  } catch (err) { toast(err.message, true); }
}

function setupEmployee() {
  $('#log-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const f = e.target;
    try {
      await api('/api/logs', {
        method: 'POST',
        body: {
          workDate: f.workDate.value,
          tasks: f.tasks.value,
          hours: f.hours.value === '' ? null : Number(f.hours.value),
          blockers: f.blockers.value,
        },
      });
      f.tasks.value = '';
      f.hours.value = '';
      f.blockers.value = '';
      toast('Update saved');
      loadMyLogs();
    } catch (err) { toast(err.message, true); }
  });
}

/* ---------- Manager view ---------- */

async function loadEmployees() {
  try {
    const [{ users }, { overview }] = await Promise.all([
      api('/api/users'),
      api('/api/logs/overview'),
    ]);
    state.employees = users;
    state.overview = new Map(overview.map((o) => [o.userId, o]));
    renderEmployeeList();
  } catch (err) { toast(err.message, true); }
}

function renderEmployeeList() {
  const q = $('#employee-search').value.trim().toLowerCase();
  const list = $('#employee-list');
  list.replaceChildren();
  const filtered = state.employees.filter((u) =>
    [u.name, u.email, u.team || ''].some((v) => v.toLowerCase().includes(q)));
  if (!filtered.length) {
    list.append(el('li', { className: 'empty', text: q ? 'No matches.' : 'No employees yet.' }));
    return;
  }
  filtered.forEach((u) => {
    const ov = state.overview.get(u.id);
    const meta = ov ? `Last update ${ov.lastLogDate} · ${ov.logsLast7Days}/7 days` : 'No updates yet';
    const btn = el('button', { className: 'employee', type: 'button' }, [
      el('span', { className: 'employee-name', text: u.name }),
      el('span', { className: 'muted small', text: u.team ? `${u.team} · ${meta}` : meta }),
    ]);
    btn.classList.toggle('active', u.id === state.selectedId);
    btn.addEventListener('click', () => selectEmployee(u.id));
    list.append(el('li', {}, [btn]));
  });
}

function renderSummary(container, summary) {
  const meta = $('.summary-meta', container);
  const text = $('.summary-text', container);
  if (!summary) {
    meta.textContent = 'No summary yet. Generate one to see what this employee has been working on.';
    text.textContent = '';
    return;
  }
  const by = summary.source === 'ai' ? 'AI summary' : 'Basic summary (AI not configured)';
  meta.textContent = `${by} of ${summary.logCount} update(s), ${summary.periodFrom} to ${summary.periodTo}` +
    ` · generated ${new Date(summary.createdAt).toLocaleString()}`;
  text.textContent = summary.summary;
}

async function selectEmployee(id) {
  state.selectedId = id;
  renderEmployeeList();
  const user = state.employees.find((u) => u.id === id);
  const detail = $('#employee-detail');
  detail.replaceChildren($('#employee-detail-template').content.cloneNode(true));
  $('.detail-name', detail).textContent = user.name;
  $('.detail-meta', detail).textContent = [user.email, user.team].filter(Boolean).join(' · ');

  const generate = $('.generate', detail);
  generate.addEventListener('click', async () => {
    generate.disabled = true;
    generate.textContent = 'Summarizing…';
    try {
      const days = Number($('.summary-days', detail).value);
      const { summary } = await api(`/api/summaries/${id}`, { method: 'POST', body: { days } });
      if (state.selectedId === id) renderSummary(detail, summary);
    } catch (err) {
      toast(err.message, true);
    } finally {
      generate.disabled = false;
      generate.textContent = 'Generate summary';
    }
  });

  try {
    const [{ summary }, { logs }] = await Promise.all([
      api(`/api/summaries/${id}`),
      api(`/api/logs/user/${id}`),
    ]);
    if (state.selectedId !== id) return;
    renderSummary(detail, summary);
    renderLogs($('.detail-logs', detail), logs);
  } catch (err) { toast(err.message, true); }
}

function setupManager() {
  $('#employee-search').addEventListener('input', renderEmployeeList);
  $('#toggle-add-user').addEventListener('click', () => {
    const form = $('#add-user-form');
    form.hidden = !form.hidden;
  });
  $('#add-user-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const f = e.target;
    try {
      await api('/api/users', {
        method: 'POST',
        body: {
          name: f.name.value, email: f.email.value, team: f.team.value,
          password: f.password.value, role: f.role.value,
        },
      });
      toast(`Account created for ${f.name.value}`);
      f.reset();
      f.hidden = true;
      loadEmployees();
    } catch (err) { toast(err.message, true); }
  });
}

setupAuth();
setupEmployee();
setupManager();
render();
