import { useEffect, useState } from 'react';

// Each company has its own address: google.workpulselens.com. The root domain is the public site,
// where companies sign up; logging in only happens on a company's own address.

/** Asks the server which workspace this address belongs to. */
export function useWorkspaceInfo() {
  const [info, setInfo] = useState(null);
  const [error, setError] = useState(false);
  useEffect(() => {
    let cancelled = false;
    const load = () =>
      fetch('/api/companies/current')
        .then((res) => (res.ok ? res.json() : Promise.reject(new Error(String(res.status)))))
        .then((data) => !cancelled && setInfo(data))
        .catch(() => !cancelled && setError(true));
    load();
    return () => {
      cancelled = true;
    };
  }, []);
  return { info, error };
}

/** Full address of a workspace, keeping this page's scheme and port (google.localhost:8080 locally). */
export function workspaceUrl(slug, rootDomain, path = '/') {
  const { protocol, port } = window.location;
  return `${protocol}//${slug}.${rootDomain}${port ? `:${port}` : ''}${path}`;
}

/** The public site's address. */
export function rootUrl(rootDomain, path = '/') {
  const { protocol, port } = window.location;
  return `${protocol}//${rootDomain}${port ? `:${port}` : ''}${path}`;
}

/** Turns "Acme Labs Pvt. Ltd." into "acme-labs-pvt-ltd" for the address field. */
export function slugify(name) {
  return name
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)
    .replace(/-+$/, '');
}

/** Reads ?key=value from the part of the hash after the route, e.g. #/login?email=a@b.com. */
export function hashParam(key) {
  const query = window.location.hash.split('?')[1] ?? '';
  return new URLSearchParams(query).get(key) ?? '';
}
