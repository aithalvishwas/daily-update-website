import { useCallback, useEffect, useState } from 'react';
import { useToast } from './components/Toast.jsx';

/** Loads data with {@code fetcher}; returns [data, reload]. Errors show as a toast. */
export function useLoad(fetcher, deps) {
  const toast = useToast();
  const [data, setData] = useState(null);
  const run = useCallback(fetcher, deps);
  const reload = useCallback(async () => {
    try {
      setData(await run());
    } catch (err) {
      toast(err.message, 'error');
    }
  }, [run, toast]);
  useEffect(() => {
    reload();
  }, [reload]);
  return [data, reload];
}

/** Tells the bell and sidebar counters that something changed. */
export function announceChange() {
  window.dispatchEvent(new Event('dailyupdate:refresh'));
}
