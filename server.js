import express from 'express';
import { getAllCrawls, getCrawlDetail, deleteCrawl } from './db-operations.js';
import { runFullPipeline } from './run-pipeline.js';

const app = express();
app.use(express.json());

app.get('/api/crawls', (req, res) => {
  res.json(getAllCrawls());
});

app.get('/api/crawls/:id', (req, res) => {
  res.json(getCrawlDetail(req.params.id));
});

app.delete('/api/crawls/:id', (req, res) => {
  res.json(deleteCrawl(req.params.id));
});

// NEW: run the full pipeline against a user-supplied URL
app.post('/api/crawl', async (req, res) => {
  const url = req.body.url;
  if (!url || !url.startsWith('http')) {
    return res.status(400).json({ error: 'A valid http/https URL is required.' });
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
