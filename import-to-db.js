import db from './db.js';
import fs from 'fs';

const siteMap = JSON.parse(fs.readFileSync('./todomvc-site-map.json', 'utf-8'));
const testResults = JSON.parse(fs.readFileSync('./test-results.json', 'utf-8'));

// CREATE: insert the crawl
const insertCrawl = db.prepare(
  'INSERT INTO crawls (url, crawled_at, raw_json) VALUES (?, ?, ?)'
);
const crawlInfo = insertCrawl.run(
  siteMap[0].url,
  new Date().toISOString(),
  JSON.stringify(siteMap[0])
);
const crawlId = crawlInfo.lastInsertRowid;
console.log(`Inserted crawl, id=${crawlId}`);

// CREATE: insert each test case + its result
const insertTestCase = db.prepare(
  'INSERT INTO test_cases (crawl_id, description, confidence, script, created_at) VALUES (?, ?, ?, ?, ?)'
);
const insertResult = db.prepare(
  'INSERT INTO test_results (test_case_id, result, failure_category, error, executed_at) VALUES (?, ?, ?, ?, ?)'
);

for (const tc of testResults) {
  const tcInfo = insertTestCase.run(
    crawlId,
    tc.description,
    tc.confidence,
    tc.script || null,
    new Date().toISOString()
  );
  const testCaseId = tcInfo.lastInsertRowid;

  insertResult.run(
    testCaseId,
    tc.executionResult,
    tc.failureCategory || null,
    tc.error || null,
    new Date().toISOString()
  );
  console.log(`  Inserted test case ${testCaseId}: ${tc.description} -> ${tc.executionResult}`);
}

console.log('\nImport complete.');
