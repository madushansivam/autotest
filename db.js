import Database from 'better-sqlite3';

const db = new Database('autotest.db');

db.exec(`
  CREATE TABLE IF NOT EXISTS crawls (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    url TEXT NOT NULL,
    crawled_at TEXT NOT NULL,
    raw_json TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS test_cases (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    crawl_id INTEGER NOT NULL,
    description TEXT NOT NULL,
    confidence TEXT NOT NULL,
    script TEXT,
    created_at TEXT NOT NULL,
    FOREIGN KEY (crawl_id) REFERENCES crawls(id)
  );

  CREATE TABLE IF NOT EXISTS test_results (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    test_case_id INTEGER NOT NULL,
    result TEXT NOT NULL,
    failure_category TEXT,
    error TEXT,
    executed_at TEXT NOT NULL,
    FOREIGN KEY (test_case_id) REFERENCES test_cases(id)
  );
`);

export default db;
