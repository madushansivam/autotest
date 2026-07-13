import express from 'express';
import { getAllCrawls, getCrawlDetail, deleteCrawl } from './db-operations.js';

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

// DELETE: remove a crawl
app.delete('/api/crawls/:id', (req, res) => {
  res.json(deleteCrawl(req.params.id));
});

// Serve the dashboard HTML
app.use(express.static('public'));

const PORT = 3000;
app.listen(PORT, () => console.log(`AutoTest dashboard running at http://localhost:${PORT}`));
