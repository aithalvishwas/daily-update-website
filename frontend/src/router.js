import { useEffect, useState } from 'react';

// Tiny hash router: #/epics/3 -> { path: ['epics', '3'] }. No server config needed.
function current() {
  return window.location.hash.replace(/^#\/?/, '').split('?')[0].split('/').filter(Boolean);
}

export function navigate(to) {
  window.location.hash = to.startsWith('/') ? to : `/${to}`;
}

export function useRoute() {
  const [path, setPath] = useState(current);
  useEffect(() => {
    const onChange = () => {
      setPath(current());
      window.scrollTo(0, 0);
    };
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);
  return path;
}
