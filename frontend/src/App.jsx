import { useCallback, useEffect, useState } from 'react';
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

// Sidebar badges: what is waiting for this person.
function useCounts(session, path) {
  const [counts, setCounts] = useState({});
  const load = useCallback(async () => {
    if (!session) return;
    const { token, user } = session;
    try {
      const [issues, requests] = await Promise.all([
        api('/api/issues?status=open', { token }),
        api('/api/weekend-requests', { token }),
      ]);
      const waiting = user.role === 'manager' ? 'pending' : 'alternative';
      setCounts({
        issues: user.role === 'manager' ? issues.issues.length : 0,
        requests: requests.requests.filter((r) => r.status === waiting).length,
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

function Page({ session, path }) {
  const { token, user } = session;
  const manager = user.role === 'manager';
  const [section, id] = path;
  switch (section) {
    case 'epics':
      return <Epics token={token} user={user} id={id} />;
    case 'people':
      return manager ? <People token={token} id={id} /> : <EmployeeHome token={token} user={user} />;
    case 'issues':
      return <Issues token={token} user={user} id={id} />;
    case 'requests':
      return <Requests token={token} user={user} id={id} />;
    default:
      return manager ? <ManagerHome token={token} user={user} /> : <EmployeeHome token={token} user={user} />;
  }
}

export default function App() {
  const [session, setSession] = useState(loadSession);
  const path = useRoute();
  const counts = useCounts(session, path.join('/'));

  const signIn = useCallback((next) => {
    saveSession(next);
    setSession(next);
    window.location.hash = '/';
  }, []);

  const signOut = useCallback(() => {
    saveSession(null);
    setSession(null);
  }, []);

  useEffect(() => setUnauthorizedHandler(signOut), [signOut]);

  return (
    <ToastProvider>
      {!session ? (
        <AuthPage onSignedIn={signIn} />
      ) : (
        <Shell user={session.user} token={session.token} section={path[0] ?? ''} counts={counts} onSignOut={signOut}>
          <Page session={session} path={path} />
        </Shell>
      )}
    </ToastProvider>
  );
}
