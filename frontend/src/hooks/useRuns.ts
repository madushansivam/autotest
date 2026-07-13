import { useState, useEffect, useRef, useCallback } from 'react';
import { api } from '../lib/api';
import type { Run } from '../types';

const POLL_INTERVAL_MS = 3000;

export function useRuns() {
  const [runs, setRuns] = useState<Run[] | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchRuns = useCallback(async () => {
    try {
      const data = await api.runs.list();
      setRuns(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load runs');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRuns();

    // Poll while there are active runs
    pollRef.current = setInterval(() => {
      fetchRuns();
    }, POLL_INTERVAL_MS);

    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [fetchRuns]);

  return { runs, isLoading, error, mutate: fetchRuns };
}
