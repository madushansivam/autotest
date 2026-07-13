import 'dotenv/config';
import express from 'express';
import { getAllCrawls, getCrawlDetail, deleteCrawl } from './db-operations.js';
import { runFullPipeline } from './run-pipeline.js';

const app = express();
app.use(express.json());

// READ: list all crawls
app.get('/api/crawls', (req, res) => {
  res.json(getAllCrawls());
});

// READ: one crawl's full detail
app.get('/api/crawls/:id', (req, res) => {
  res.json(getCrawlDetail(req.params.id));
});

// CREATE: run the full pipeline (crawl -> generate tests -> generate scripts -> execute -> persist)
app.post('/api/crawls/run', async (req, res) => {
  const { url } = req.body;

  if (!url || typeof url !== 'string') {
    return res.status(400).json({ error: 'A "url" string is required in the request body.' });
  }

  let targetUrl;
  try {
    targetUrl = new URL(url).toString();
  } catch {
    return res.status(400).json({ error: `"${url}" is not a valid URL.` });
  }

  try {
    const crawlId = await runFullPipeline(targetUrl);
    res.json({ crawlId });
  } catch (err) {
    console.error('Pipeline run failed:', err);
    res.status(500).json({ error: err.message || 'Pipeline run failed.' });
  }
});

// DELETE: remove a crawl
app.delete('/api/crawls/:id', (req, res) => {
  res.json(deleteCrawl(req.params.id));
});

// Serve the dashboard HTML
app.use(express.static('public'));

const PORT = 3000;
app.listen(PORT, () => console.log(`AutoTest dashboard running at http://localhost:${PORT}`));