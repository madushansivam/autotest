import { useState, useEffect, useRef, useCallback } from 'react';
import { api } from '../lib/api';
import type { RunDetail } from '../types';

const POLL_INTERVAL_MS = 2500; // Poll faster on detail page (user is watching)

export function useRunDetail(runId: string) {
  const [run, setRun] = useState<RunDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetch = useCallback(async () => {
    try {
      const data = await api.runs.get(runId);
      setRun(data);
      setError(null);

      // Stop polling once the run reaches a terminal state
      if (data.status === 'completed' || data.status === 'failed') {
        if (pollRef.current) {
          clearInterval(pollRef.current);
          pollRef.current = null;
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load run');
    } finally {
      setIsLoading(false);
    }
  }, [runId]);

  useEffect(() => {
    fetch();
    pollRef.current = setInterval(fetch, POLL_INTERVAL_MS);

    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [fetch]);

  return { run, isLoading, error };
}
