"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";

/**
 * Loads data from the API. `path` can be null to wait (for example until an id is known).
 * While a newer answer is loading, the previous one stays visible, so tables do not flash empty.
 */
export function useApi(path) {
  const [state, setState] = useState({ path: null, data: null, error: null, version: -1, loadedAt: null });
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!path) return;
    let cancelled = false;
    api(path)
      .then((data) => !cancelled && setState({ path, data, error: null, version: tick, loadedAt: Date.now() }))
      .catch((error) => !cancelled && setState({ path, data: null, error, version: tick, loadedAt: null }));
    return () => {
      cancelled = true;
    };
  }, [path, tick]);

  const reload = useCallback(() => setTick((t) => t + 1), []);
  const current = state.path === path;
  return {
    data: current ? state.data : null,
    error: current ? state.error : null,
    loading: !!path && !current,
    refreshing: !!path && (!current || state.version !== tick),
    loadedAt: current ? state.loadedAt : null,
    reload,
  };
}
