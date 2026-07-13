/**
 * api.ts — Typed fetch wrapper for the AutoTest backend REST API.
 *
 * All calls include the Supabase session JWT as a Bearer token so
 * the backend can identify and scope the request to the calling user.
 */
import { supabase } from './supabase';
import type { Application, Run, RunDetail } from '../types';

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? '';

async function authHeaders(): Promise<Record<string, string>> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error('Not authenticated');
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  };
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = await authHeaders();
  const res = await fetch(`${API_BASE}${path}`, { ...init, headers: { ...headers, ...init?.headers } });
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText })) as { error?: string };
    throw new Error(body.error ?? `Request failed: ${res.status}`);
  }
  return res.json() as Promise<T>;
}

// ── Applications ──────────────────────────────────────────────────────────────

export const api = {
  applications: {
    list: () => request<Application[]>('/api/applications'),
    create: (url: string, label?: string) =>
      request<Application>('/api/applications', {
        method: 'POST',
        body: JSON.stringify({ url, label }),
      }),
  },

  // ── Runs ─────────────────────────────────────────────────────────────────
  runs: {
    list: () => request<Run[]>('/api/runs'),
    get: (id: string) => request<RunDetail>(`/api/runs/${id}`),
    create: (applicationId: string) =>
      request<Run>('/api/runs', {
        method: 'POST',
        body: JSON.stringify({ applicationId }),
      }),
    delete: (id: string) =>
      request<{ success: boolean }>(`/api/runs/${id}`, { method: 'DELETE' }),
  },
};
