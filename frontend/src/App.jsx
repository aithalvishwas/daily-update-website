import { useCallback, useEffect, useMemo, useState } from 'react';
import { isManager, localToday } from './format.js';
import { api, loadSession, saveSession, setUnauthorizedHandler } from './api.js';
import { useRoute } from './router.js';
import { ToastProvider } from './components/Toast.jsx';
import AuthPage from './components/AuthPage.jsx';
import Shell from './components/Shell.jsx';
import ManagerHome from './pages/ManagerHome.jsx';
import EmployeeHome from './pages/EmployeeHome.jsx';
import Epics from './pages/Epics.jsx';
import People from './pages/People.jsx';
import Issues from './pages/Issues.jsx';
import Requests from './pages/Requests.jsx';
import Admin from './pages/Admin.jsx';
import WorkplaceSettings from './pages/WorkplaceSettings.jsx';
import MySettings from './pages/MySettings.jsx';
import Landing from './pages/Landing.jsx';
import MyTasks from './pages/MyTasks.jsx';
import Workload from './pages/Workload.jsx';
import { OFFICES, WorkplaceContext } from './workplace.js';

// Sidebar badges: what is waiting for this person.
function useCounts(session, path) {
  const [counts, setCounts] = useState({});
  const load = useCallback(async () => {
    if (!session) return;
    const { token, user } = session;
    try {
      const [issues, requests, tasks] = await Promise.all([
        api('/api/issues?status=open', { token }),
        api('/api/weekend-requests', { token }),
        api('/api/tasks/mine', { token }),
      ]);
      const today = localToday();
      const waiting = isManager(user) ? 'pending' : 'alternative';
      setCounts({
        issues: isManager(user) ? issues.issues.length : 0,
        requests: requests.requests.filter((r) => r.status === waiting).length,
        // Tasks due today or already late.
        tasks: tasks.tasks.filter((t) => t.status !== 'done' && t.dueDate && t.dueDate <= today).length,
      });
    } catch {
      // Counters are a convenience; pages show their own errors.
    }
  }, [session]);
  useEffect(() => {
    load();
  }, [load, path]);
  useEffect(() => {
    window.addEventListener('dailyupdate:refresh', load);
    return () => window.removeEventListener('dailyupdate:refresh', load);
  }, [load]);
  return counts;
}

function Page({ session, path, onUserChanged }) {
  const { token, user } = session;
  const manager = isManager(user);
  const [section, id] = path;
  switch (section) {
    case 'epics':
      return <Epics token={token} user={user} id={id} />;
    case 'people':
      return manager ? <People token={token} id={id} /> : <EmployeeHome token={token} user={user} />;
    case 'tasks':
      return <MyTasks token={token} user={user} id={id} />;
    case 'workload':
      return manager ? <Workload token={token} /> : <EmployeeHome token={token} user={user} />;
    case 'issues':
      return <Issues token={token} user={user} id={id} />;
    case 'requests':
      return <Requests token={token} user={user} id={id} />;
    case 'admin':
      return user.role === 'admin' ? <Admin token={token} user={user} /> : <ManagerHome token={token} user={user} />;
    case 'settings':
      return <MySettings token={token} user={user} onUserChanged={onUserChanged} />;
    case 'workplace':
      return user.role === 'admin' ? <WorkplaceSettings token={token} /> : <ManagerHome token={token} user={user} />;
    default:
      return manager ? <ManagerHome token={token} user={user} /> : <EmployeeHome token={token} user={user} />;
  }
}

// Feature flags and office holidays, shared by every page through WorkplaceContext.
function useWorkplaceData(token) {
  const [data, setData] = useState(null);
  const reload = useCallback(() => {
    if (!token) return Promise.resolve();
    return api('/api/workplace', { token })
      .then(setData)
      // Without it the app still works: a 7-day week with no holidays shown.
      .catch(() => setData((current) => current ?? { weekendRequests: false, offices: OFFICES, holidays: [] }));
  }, [token]);
  useEffect(() => {
    setData(null);
    reload();
    window.addEventListener('focus', reload);
    return () => window.removeEventListener('focus', reload);
  }, [reload]);
  return [data, reload];
}

export default function App() {
  const [session, setSession] = useState(loadSession);
  const path = useRoute();
  const counts = useCounts(session, path.join('/'));
  const [workplaceData, reloadWorkplace] = useWorkplaceData(session?.token);
  const office = session?.user.office ?? null;
  const workplace = useMemo(
    () => (workplaceData ? { ...workplaceData, office, reload: reloadWorkplace } : null),
    [workplaceData, office, reloadWorkplace],
  );

  const signIn = useCallback((next) => {
    saveSession(next);
    setSession(next);
    window.location.hash = '/';
  }, []);

  const signOut = useCallback(() => {
    saveSession(null);
    setSession(null);
    window.location.hash = '/login';
  }, []);

  useEffect(() => setUnauthorizedHandler(signOut), [signOut]);

  const updateUser = useCallback((user) => {
    setSession((current) => {
      if (!current) return current;
      const next = { ...current, user };
      saveSession(next);
      return next;
    });
  }, []);

  // Re-read the account on load and when the tab regains focus: picks up a new team or position,
  // and signs out an account whose role changed or that an admin deactivated (the API answers 401).
  const token = session?.token;
  useEffect(() => {
    if (!token) return undefined;
    const refresh = () =>
      api('/api/auth/me', { token })
        .then(({ user }) =>
          setSession((current) => {
            if (!current || current.token !== token) return current;
            // A new role needs a new login token; ask the person to log in again.
            if (current.user.role !== user.role) {
              saveSession(null);
              return null;
            }
            const next = { ...current, user };
            saveSession(next);
            return next;
          }),
        )
        .catch(() => {});
    refresh();
    window.addEventListener('focus', refresh);
    return () => window.removeEventListener('focus', refresh);
  }, [token]);

  return (
    <ToastProvider>
      {!session ? (
        path[0] === 'login' || path[0] === 'signup' ? (
          <AuthPage key={path[0]} initialTab={path[0] === 'signup' ? 'register' : 'login'} onSignedIn={signIn} />
        ) : (
          <Landing />
        )
      ) : !workplace ? (
        <div className="boot" aria-busy="true" />
      ) : (
        <WorkplaceContext.Provider value={workplace}>
          <Shell user={session.user} token={session.token} section={path[0] ?? ''} counts={counts} onSignOut={signOut}>
            <Page session={session} path={path} onUserChanged={updateUser} />
          </Shell>
        </WorkplaceContext.Provider>
      )}
    </ToastProvider>
  );
}
