/**
 * supabase-server.ts — Supabase admin client for backend use.
 *
 * Uses the service role key, which bypasses Row-Level Security.
 * This client must NEVER be sent to or accessible from the browser.
 * All user-scoped writes include user_id explicitly to preserve
 * data isolation even though RLS is bypassed server-side.
 */
import { createClient } from '@supabase/supabase-js';
import { config } from '../config';

export const supabaseAdmin = createClient(
  config.SUPABASE_URL,
  config.SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
);
