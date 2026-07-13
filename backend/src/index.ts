/**
 * index.ts — Express application entry point.
 *
 * Bootstraps the server with:
 *  - CORS for the frontend origin
 *  - JSON body parsing
 *  - API routes (applications, runs)
 *  - Global error handler
 */

import express from 'express';
import cors from 'cors';
import { config } from './config';
import applicationsRouter from './api/routes/applications';
import runsRouter from './api/routes/runs';

const app = express();

// ── CORS ──────────────────────────────────────────────────────────────────
const allowedOrigins = [
  'http://localhost:5173',
  'http://localhost:4173',
  // Add your production frontend URL here when deploying
];

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (e.g. curl, Postman) in development
    if (!origin || config.NODE_ENV === 'development') return callback(null, true);
    if (allowedOrigins.includes(origin)) return callback(null, true);
    callback(new Error(`CORS: origin ${origin} not allowed`));
  },
  credentials: true,
}));

// ── Body parsing ──────────────────────────────────────────────────────────
app.use(express.json({ limit: '1mb' }));

// ── Health check ──────────────────────────────────────────────────────────
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ── API routes ────────────────────────────────────────────────────────────
app.use('/api/applications', applicationsRouter);
app.use('/api/runs', runsRouter);

// ── 404 handler ───────────────────────────────────────────────────────────
app.use((_req, res) => {
  res.status(404).json({ error: 'Route not found.' });
});

// ── Global error handler ──────────────────────────────────────────────────
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('[server] Unhandled error:', err.message);
  res.status(500).json({ error: 'Internal server error.' });
});

// ── Start ─────────────────────────────────────────────────────────────────
app.listen(config.PORT, () => {
  console.log(`\n🚀 AutoTest backend running on http://localhost:${config.PORT}`);
  console.log(`   Environment: ${config.NODE_ENV}`);
  console.log(`   Max pages per run: ${config.MAX_PAGES_PER_RUN}`);
  console.log(`   Max LLM calls per run: ${config.MAX_LLM_CALLS_PER_RUN}\n`);
});

export default app;
