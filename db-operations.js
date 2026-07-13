import db from './db.js';

// READ: get all crawls with their test case counts and pass/fail summary
export function getAllCrawls() {
  return db.prepare(`
    SELECT c.id, c.url, c.crawled_at,
           COUNT(tc.id) as test_count,
           SUM(CASE WHEN tr.result = 'pass' THEN 1 ELSE 0 END) as passed,
           SUM(CASE WHEN tr.result = 'fail' THEN 1 ELSE 0 END) as failed,
           SUM(CASE WHEN tr.result = 'crash' THEN 1 ELSE 0 END) as crashed
    FROM crawls c
    LEFT JOIN test_cases tc ON tc.crawl_id = c.id
    LEFT JOIN test_results tr ON tr.test_case_id = tc.id
    GROUP BY c.id
    ORDER BY c.crawled_at DESC
  `).all();
}

// READ: get full detail for one crawl (test cases + results)
export function getCrawlDetail(crawlId) {
  const crawl = db.prepare('SELECT * FROM crawls WHERE id = ?').get(crawlId);
  const testCases = db.prepare(`
    SELECT tc.*, tr.result, tr.failure_category, tr.error
    FROM test_cases tc
    LEFT JOIN test_results tr ON tr.test_case_id = tc.id
    WHERE tc.crawl_id = ?
  `).all(crawlId);
  return { crawl, testCases };
}

// UPDATE: mark a test case's script as regenerated (used after a retry)
export function updateTestCaseScript(testCaseId, newScript) {
  return db.prepare('UPDATE test_cases SET script = ? WHERE id = ?').run(newScript, testCaseId);
}

// DELETE: remove a crawl and everything tied to it
export function deleteCrawl(crawlId) {
  const testCaseIds = db.prepare('SELECT id FROM test_cases WHERE crawl_id = ?').all(crawlId).map(r => r.id);
  const deleteResults = db.prepare('DELETE FROM test_results WHERE test_case_id = ?');
  for (const id of testCaseIds) deleteResults.run(id);
  db.prepare('DELETE FROM test_cases WHERE crawl_id = ?').run(crawlId);
  db.prepare('DELETE FROM crawls WHERE id = ?').run(crawlId);
  return { deletedCrawlId: crawlId, deletedTestCases: testCaseIds.length };
}
