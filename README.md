# AutoTest

> Autonomous web application testing agent — final-year university project.

AutoTest accepts a single URL and, without the user writing any code, autonomously crawls the target site, generates test cases using **Llama-3.1-8B-Instruct**, converts them to executable Playwright scripts, runs them headlessly, and displays results in a React dashboard.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│  Browser (React + TypeScript + Tailwind)                        │
│  Supabase Auth → Dashboard → Run Detail                        │
└────────────────────────┬────────────────────────────────────────┘
                         │ REST (Bearer JWT)
┌────────────────────────▼────────────────────────────────────────┐
│  Express API  (backend/src/index.ts)                            │
│  ├── POST /api/applications   (SSRF-validated URL storage)     │
│  └── POST /api/runs           (triggers pipeline async)        │
└────────────────────────┬────────────────────────────────────────┘
                         │
┌────────────────────────▼────────────────────────────────────────┐
│  pipeline/index.ts  — ONE canonical flow, no duplicates        │
│  ┌──────────┐  ┌───────────────┐  ┌──────────────────────────┐ │
│  │ crawler/ │→ │  generator/   │→ │      executor/           │ │
│  │Playwright│  │Llama-3.1-8B   │  │Playwright + oracle.ts    │ │
│  │  BFS     │  │via HF Infer.  │  │HTTP/console/diff signals │ │
│  └──────────┘  └───────────────┘  └──────────────────────────┘ │
└────────────────────────┬────────────────────────────────────────┘
                         │
┌────────────────────────▼────────────────────────────────────────┐
│  Supabase (Postgres + Storage + Auth)                           │
│  applications / runs / test_cases / test_results               │
│  Row-Level Security: users can only access their own data      │
└─────────────────────────────────────────────────────────────────┘
```

---

## Quick Start (local dev)

### Prerequisites

- Node.js ≥ 18
- A [Supabase](https://supabase.com) project (free tier is fine)
- A [HuggingFace](https://huggingface.co/settings/tokens) API key (free)
- Playwright Chromium: `npx playwright install chromium`

### 1. Clone and install

```bash
git clone <repo-url>
cd AutoTest
npm install          # installs all workspaces (backend, frontend, eval)
```

### 2. Configure environment

```bash
cp .env.example .env
# Edit .env and fill in:
#   SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY
#   HUGGINGFACE_API_KEY
#   VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY, VITE_API_BASE_URL
```

### 3. Apply Supabase migrations

```bash
# Option A: Supabase CLI (recommended)
npx supabase db push

# Option B: paste migration files manually in the Supabase SQL editor
# supabase/migrations/20240001_initial_schema.sql
# supabase/migrations/20240002_rls_policies.sql
```

Create the screenshots storage bucket:
```bash
npx supabase storage buckets create screenshots --public
```

### 4. Run

```bash
# Terminal 1 — backend API (port 3001)
npm run dev:backend

# Terminal 2 — frontend dashboard (port 5173)
npm run dev:frontend
```

Open http://localhost:5173, sign up, and submit a URL.

### 5. CLI (no frontend needed)

```bash
cd backend
npx ts-node src/cli.ts https://todomvc.com/examples/react/dist/
# or without Supabase persistence:
npx ts-node src/cli.ts https://example.com --no-persist
```

### 6. Run unit tests

```bash
npm test   # runs backend Jest suite (ssrf-guard, retry, safety-filter)
```

---

## What Safe Mode Does and Doesn't Guarantee

AutoTest implements a **two-layer safety filter** to reduce the risk of accidental side effects when running against public websites:

**Layer 1 — Text blocklist** (`executor/safety-filter.ts`)
Blocks any test case whose description contains phrases like "delete account", "checkout", "pay now", etc. This list is sourced from `safe-mode.config.json` in the legacy prototype.

**Layer 2 — Form mutation heuristic**
Before executing any generated script, inspects the script source for form `action` URLs matching patterns like `/payment`, `/delete-account`, `/send-email`. Scripts targeting these routes are skipped with a `safety-filter-layer-2` failure category.

**What this does NOT guarantee:**
- Layer 1 is bypassed by any phrasing the blocklist doesn't anticipate.
- Layer 2 is a regex heuristic — it cannot catch all mutation paths.
- Neither layer prevents all state changes on every possible website.

**True isolation requires running AutoTest against a staging or sandboxed environment, not a production site.** The README and code comments are explicit about this.

---

## Known Limitation: The Oracle Problem

> **LLM-generated tests without a ground-truth oracle can only reliably catch structural breakage and crashes — not business-logic correctness.**

This is a known, accepted limitation of the approach, not a bug.

**What AutoTest CAN reliably detect:**
- Missing elements (buttons, inputs, headings disappeared)
- Navigation crashes (page throws an uncaught exception)
- HTTP 4xx/5xx responses during a test
- Console JS errors independent of test assertions
- Visual regressions via perceptual hash screenshot diffing

**What AutoTest CANNOT reliably verify:**
- Whether a form submission actually persisted data to the database
- Whether a calculation produced the correct numeric result
- Whether an email was actually sent
- Any business rule that requires inspecting server state

Behavioral-tagged tests assert *visible* outcomes (URL changed, element appeared) which can be observed in the browser DOM. They still cannot verify *server-side correctness*.

---

## Evaluation Harness

```bash
cd eval
npx ts-node run-eval.ts
# Report written to eval/reports/eval-<timestamp>.md and .json
```

The harness runs the full pipeline against 4 fixture sites (TodoMVC, The Internet, Quotes to Scrape, DemoQA) and computes:

- **Recall** — of human-authored ground-truth cases, how many did AutoTest generate an equivalent test for
- **Behavioral precision** — of behavioral-tagged AI tests, how many passed
- **False-positive candidates** — AI tests that reported fail/crash, listed for manual verification

Borderline similarity matches are logged for human review, not auto-classified.

---

## Project Structure

```
AutoTest/
├── backend/          # Node.js + Express + TypeScript
│   └── src/
│       ├── lib/      # ssrf-guard, retry, rate-limiter, supabase-server
│       ├── crawler/  # Playwright BFS crawler
│       ├── generator/# Llama-3.1-8B test-case + script generation
│       ├── executor/ # Playwright executor + oracle signals
│       ├── pipeline/ # Single canonical crawl→generate→execute flow
│       └── api/      # Express routes + middleware
├── frontend/         # React + TypeScript + Tailwind (Vite)
│   └── src/
│       ├── pages/    # Login, Dashboard, RunDetail
│       ├── components/
│       └── hooks/
├── eval/             # Evaluation harness (not part of the live product)
│   └── fixtures/     # Human-authored ground-truth test cases
└── supabase/
    └── migrations/   # Applied via Supabase CLI
```

---

## Security Notes

- **SSRF protection**: all user-submitted URLs are validated by `lib/ssrf-guard.ts` which DNS-resolves the hostname and checks it against all private/loopback/link-local CIDR ranges. The check runs twice: at request-validation time and immediately before each `page.goto()` call (anti-DNS-rebinding).
- **Auth**: all API routes are gated by Supabase JWT verification. Row-Level Security is enforced at the Postgres level.
- **Rate limiting**: per-user sliding-window limit on `POST /api/runs` (default: 5 runs/hour).
- **Budget caps**: hard limit on pages crawled per run (default: 8) and LLM calls per run (default: 20).
