# AutoTest — Autonomous Web Application Testing Agent

AutoTest accepts a URL, crawls the target site with Playwright, generates test cases
using **Llama-3.1-8B-Instruct** (via HuggingFace Inference API), converts them into
executable Playwright scripts, runs them headlessly, and shows the results in a
dashboard — without the user writing a single line of test code.

Built as a final-year university project. The pipeline runs today.

---

## Quick Start

### Prerequisites

- Node.js ≥ 18
- A HuggingFace account (free) — get an API token at [huggingface.co/settings/tokens](https://huggingface.co/settings/tokens)
- Playwright's Chromium browser:

```bash
npx playwright install chromium
```

### Install and run

```bash
git clone https://github.com/madushansivam/autotest.git
cd autotest
npm install

cp .env.example .env
# Open .env and set:  HUGGINGFACE_API_KEY=hf_your_token_here

node server.js
```

Open **http://localhost:3000** — paste any public URL, click Run.

### What you'll see

The dashboard shows each generated test case, its result (pass / fail / crash /
skipped), the failure category if it failed, and the generated Playwright script
that was executed.

---

## How it works

```
POST /api/crawl  →  run-pipeline.js
                      │
                      ├─ Playwright BFS crawl
                      │    Extracts buttons, inputs, links, headings.
                      │    Safe-mode filter skips anything matching the
                      │    blocklist in safe-mode.config.json (payment
                      │    buttons, account-deletion flows, etc.)
                      │
                      ├─ Llama-3.1-8B-Instruct  (test-case generation)
                      │    Prompt: here is the DOM map — generate 3-5
                      │    test cases a human QA engineer would perform.
                      │    Confidence tagged: structural vs behavioural.
                      │
                      ├─ Llama-3.1-8B-Instruct  (script generation)
                      │    Converts each description into a runnable
                      │    Playwright script body using the exact
                      │    selectors from the crawled DOM.
                      │
                      └─ Playwright executor
                           Runs each script in a real browser.
                           Verdict: pass / fail / crash / skipped.
                           Results written to SQLite (autotest.db).
```

Results are stored in a local SQLite database (`autotest.db`, git-ignored)
and displayed immediately in the dashboard.

---

## Project structure — working system

```
autotest/
├── server.js                      Express API + static file server
├── run-pipeline.js                Single-function pipeline (crawl → generate → execute)
├── db.js                          SQLite schema setup (better-sqlite3)
├── db-operations.js               CRUD helpers: list, detail, delete crawls
├── safe-mode.config.json          Blocklist: buttons/fields/routes never tested
├── public/index.html              Vanilla JS dashboard (no build step)
│
├── crawler.js                     Standalone dev script: single-page crawl
├── multi-crawler.js               Standalone dev script: BFS multi-page crawl
├── generate-tests.js              Standalone dev script: LLM test-case generation
├── generate-playwright-scripts.js Standalone dev script: LLM script generation
├── run-tests.js                   Standalone dev script: execute a script batch
├── import-to-db.js                Utility: import a completed run from JSON files
└── test-hf-api.js                 Utility: smoke-test your HuggingFace API key
```

The standalone scripts in the root were the development stepping stones — each one
was used independently to build and verify a stage of the pipeline before everything
was integrated into `run-pipeline.js`.

---

## The honest project story

### What was actually built and debugged

This project was built incrementally over a focused working session, with every
decision committed and explained in the git log. A few moments worth reading:

**Finding and fixing the "vacuous pass" bug.**
Early in the execution engine, a generated test for a TodoMVC `<tbody>` row was
returning `{ passed: true }` even though the selector it was using (`tbody > tr`)
matched nothing — Playwright's auto-waiting silently succeeded on an empty result.
The fix was tightening the script-generation prompt to force the model to use only
selectors it had actually seen in the crawled DOM data, and to wrap core actions in
try/catch so a no-op returns `{ passed: false }` rather than vacuously succeeding.

**Discovering the safe-mode gap mid-test.**
During a live crawl of `books.toscrape.com`, the crawler was following "Add to
basket" links — phrases that are obvious dangerous actions but weren't in the
initial blocklist. Found via a real run, not a code review. Added
`add to basket / add to cart / add to bag` to `safe-mode.config.json` and
verified the next crawl skipped them.

**The malformed JSON retry problem.**
Llama-3.1-8B-Instruct occasionally emits malformed JSON (unclosed strings,
trailing commas) despite being explicitly instructed not to. Discovered this when
a test-generation run silently produced zero test cases. The fix was a retry loop
(up to 3 attempts) with stricter prompt wording, and a `validationWarning` flag
on any test case where the model returned an unexpected `confidence` value outside
`["structural", "behavioral"]`. The retry logic later became its own reusable module
in the architectural exploration (`backend/src/lib/retry.ts`).

**The provider pivot.**
Development started with the Anthropic Claude API as the LLM. After hitting the
free-tier budget limit mid-session, the project pivoted to HuggingFace's free
Inference API with Llama-3.1-8B-Instruct. This required rewriting the prompt
structure because Llama's instruction-following is less reliable than Claude's —
which is ultimately what drove the retry logic and stricter JSON-only prompts.

### What this can and cannot test

LLM-generated tests without a ground-truth oracle can only reliably catch
**structural breakage**: missing elements, navigation crashes, uncaught JS errors,
HTTP 4xx/5xx responses. "Behavioural" tests (e.g. "submit the login form and check
the user is redirected") can detect surface-level failures but cannot verify
server-side correctness — whether data was actually persisted, whether an email was
sent, whether a calculation produced the right number. This is a known, accepted
limitation of the approach, documented in the code comments.

---

## Architectural Exploration (Not Deployed)

The `backend/`, `frontend/`, `eval/`, and `supabase/` folders contain a TypeScript
rebuild of the same concept, designed after the working prototype was complete.

**What it was meant to add:**
- **SSRF hardening** (`backend/src/lib/ssrf-guard.ts`) — DNS-resolving URL validator
  checking all resolved IPs against private/reserved CIDR ranges, applied twice per
  request (at entry and again before each browser navigation) to close the
  DNS-rebinding window
- **Auth + data isolation** — Supabase JWT verification on every API route; Postgres
  Row-Level Security policies ensuring users can only access their own data
- **Oracle signals** (`backend/src/executor/oracle.ts`) — HTTP status capture,
  console error capture, and perceptual screenshot diffing (dHash algorithm) stored
  alongside each test result, independent of the LLM verdict
- **Automated evaluation harness** (`eval/`) — recall and behavioural precision
  metrics computed by running the pipeline against 4 fixed fixture sites and
  comparing output against human-authored ground-truth test cases
- **React dashboard** (`frontend/`) — typed API client, live run-status polling,
  oracle signal display per test result

**What it actually is:**
The backend compiles cleanly and its 57 unit tests pass (`npm test`). The frontend
compiles cleanly. But the backend crashes on startup without a configured Supabase
project, the database migrations have never been applied to a live instance, the
screenshot storage bucket was never created, and the eval harness has never been run
against real fixture sites. The RLS policies and the screenshot diffing in particular
are untested against real infrastructure.

**Read it as a design document, not working code.** The architecture is sound and
the code is correct at a static level — but it has never been run end-to-end.

---

## Security notes — working system

- **URL validation**: `server.js` rejects non-http(s) schemes, `localhost`, and the
  most common private/reserved IP ranges (127.x, 10.x, 192.168.x, 172.16–31.x,
  169.254.x). It does **not** DNS-resolve hostnames — a public hostname that resolves
  to a private IP would pass. The full SSRF guard with DNS resolution lives in
  `backend/src/lib/ssrf-guard.ts`.
- **Safe mode**: `safe-mode.config.json` blocklists buttons, input fields, and form
  routes associated with destructive or financial actions. This is a best-effort
  heuristic, not a guarantee. Run against staging environments, not production sites.
- **No auth**: the working system (`server.js`) has no authentication — it is
  designed as a local developer tool, not a multi-user hosted service.

---

## Running the standalone dev scripts

These scripts were used during development to test individual pipeline stages:

```bash
# Smoke-test your API key
node test-hf-api.js

# Crawl a single page (hardcoded to TodoMVC — edit TARGET_URL to change)
node crawler.js

# BFS crawl up to 8 pages (hardcoded to books.toscrape.com — edit START_URL)
node multi-crawler.js

# Generate test cases from a crawl output
node generate-tests.js

# Generate Playwright scripts from test cases
node generate-playwright-scripts.js

# Execute a batch of generated scripts
node run-tests.js
```

Note: `crawler.js` and `run-tests.js` have hardcoded URLs. They are dev tools, not
general-purpose utilities. `run-pipeline.js` is the integrated version that handles
any URL.

---

## Running Codebase B's unit tests

The architectural exploration includes 57 unit tests that pass independently of
Supabase:

```bash
npm test
# ssrf-guard: 30 tests
# retry logic: 14 tests
# safety filter: 13 tests
```

---

## License

MIT
