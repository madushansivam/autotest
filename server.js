import express from 'express';
import { getAllCrawls, getCrawlDetail, deleteCrawl } from './db-operations.js';
import { runFullPipeline } from './run-pipeline.js';

const app = express();
app.use(express.json());

// Lightweight URL safety check: rejects non-http(s) schemes, localhost, and
// the most common private/reserved IP ranges. This is a sane minimum for a
// local tool — it does not DNS-resolve hostnames, so a public hostname that
// points to a private IP would still pass. For full SSRF protection see
// backend/src/lib/ssrf-guard.ts in the architectural exploration folder.
function isUnsafeUrl(raw) {
  let parsed;
  try { parsed = new URL(raw); } catch { return true; } // unparseable = reject
  if (!['http:', 'https:'].includes(parsed.protocol)) return true;
  const host = parsed.hostname.toLowerCase();
  if (host === 'localhost') return true;
  // Reject 127.x.x.x, 10.x.x.x, 192.168.x.x, 172.16-31.x.x, 169.254.x.x
  if (/^127\./.test(host)) return true;
  if (/^10\./.test(host)) return true;
  if (/^192\.168\./.test(host)) return true;
  if (/^172\.(1[6-9]|2\d|3[01])\./.test(host)) return true;
  if (/^169\.254\./.test(host)) return true;
  return false;
}

app.get('/api/crawls', (req, res) => {
  res.json(getAllCrawls());
});

app.get('/api/crawls/:id', (req, res) => {
  res.json(getCrawlDetail(req.params.id));
});

app.delete('/api/crawls/:id', (req, res) => {
  res.json(deleteCrawl(req.params.id));
});

// Run the full pipeline against a user-supplied URL
app.post('/api/crawl', async (req, res) => {
  const url = req.body.url;
  if (!url || isUnsafeUrl(url)) {
    return res.status(400).json({ error: 'A valid public http/https URL is required. localhost and private IP ranges are not allowed.' });
  }
  try {
    const crawlId = await runFullPipeline(url);
    res.json({ success: true, crawlId: crawlId });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.use(express.static('public'));

const PORT = 3000;
app.listen(PORT, function () {
  console.log('AutoTest dashboard running at http://localhost:' + PORT);
});
