/**
 * config.ts — Typed environment configuration loader.
 *
 * All environment access in the backend goes through this module.
 * Never access process.env directly outside this file.
 */
import dotenv from 'dotenv';
import path from 'path';
import { z } from 'zod';

// Load .env from repo root (one level up from backend/)
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const envSchema = z.object({
  // Supabase
  SUPABASE_URL: z.string().url('SUPABASE_URL must be a valid URL'),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1, 'SUPABASE_SERVICE_ROLE_KEY is required'),

  // HuggingFace
  HUGGINGFACE_API_KEY: z.string().min(1, 'HUGGINGFACE_API_KEY is required'),

  // Server
  PORT: z.coerce.number().default(3001),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),

  // SSRF guard
  INTERNAL_DOMAIN_BLOCKLIST: z.string().default('').transform(
    (s) => s.split(',').map((d) => d.trim()).filter(Boolean)
  ),

  // Budget guardrails
  MAX_PAGES_PER_RUN: z.coerce.number().min(1).max(50).default(8),
  MAX_LLM_CALLS_PER_RUN: z.coerce.number().min(1).max(100).default(20),

  // Rate limiting
  RATE_LIMIT_MAX_RUNS: z.coerce.number().default(5),
  RATE_LIMIT_WINDOW_MS: z.coerce.number().default(3600000),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('\n❌  Invalid environment configuration:');
  console.error(parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const config = parsed.data;
