import { getAllCrawls, getCrawlDetail, updateTestCaseScript, deleteCrawl } from './db-operations.js';

console.log('--- READ: all crawls ---');
console.log(getAllCrawls());

console.log('\n--- READ: crawl detail for id=1 ---');
console.log(JSON.stringify(getCrawlDetail(1), null, 2));

console.log('\n--- UPDATE: test case 2 script ---');
const updateInfo = updateTestCaseScript(2, '// regenerated script placeholder');
console.log('Rows changed:', updateInfo.changes);

console.log('\n--- Verify update ---');
console.log(getCrawlDetail(1).testCases.find(tc => tc.id === 2));
