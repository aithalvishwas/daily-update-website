import { useCallback, useEffect, useState } from 'react';
import { loadSession, saveSession, setUnauthorizedHandler } from './api.js';
import { ToastProvider } from './components/Toast.jsx';
import AuthPage from './components/AuthPage.jsx';
import TopBar from './components/TopBar.jsx';
import EmployeeDashboard from './components/EmployeeDashboard.jsx';
import ManagerDashboard from './components/ManagerDashboard.jsx';

export default function App() {
  const [session, setSession] = useState(loadSession);

  const signIn = useCallback((next) => {
    saveSession(next);
    setSession(next);
  }, []);

  const signOut = useCallback(() => {
    saveSession(null);
    setSession(null);
  }, []);

  useEffect(() => setUnauthorizedHandler(signOut), [signOut]);

  return (
    <ToastProvider>
      <div className="backdrop" aria-hidden="true" />
      {!session ? (
        <AuthPage onSignedIn={signIn} />
      ) : (
        <>
          <TopBar user={session.user} onSignOut={signOut} />
          <main className="container">
            {session.user.role === 'manager' ? (
              <ManagerDashboard token={session.token} user={session.user} />
            ) : (
              <EmployeeDashboard token={session.token} user={session.user} />
            )}
          </main>
        </>
      )}
    </ToastProvider>
  );
}
