import { chromium } from 'playwright';
import fs from 'fs';

const scripts = JSON.parse(fs.readFileSync('./playwright-scripts.json', 'utf-8'));

const AsyncFunction = Object.getPrototypeOf(async function(){}).constructor;

async function runOneTest(page, testCase) {
  if (!testCase.script) {
    return { ...testCase, executionResult: 'skipped', reason: 'no script was generated' };
  }

  let testFn;
  try {
    testFn = new AsyncFunction('page', testCase.script);
  } catch (err) {
    return { ...testCase, executionResult: 'crash', failureCategory: 'syntax_error', error: err.message };
  }

  try {
    await page.goto('https://demo.playwright.dev/todomvc');
    const result = await testFn(page); // no external race now; Playwright's own 5s timeout below governs

    if (result && result.passed === true) {
      return { ...testCase, executionResult: 'pass' };
    } else {
      return { ...testCase, executionResult: 'fail', failureCategory: 'assertion_failed', error: result?.error || 'unknown' };
    }
  } catch (err) {
    return { ...testCase, executionResult: 'crash', failureCategory: 'runtime_error', error: err.message };
  }
}

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
page.setDefaultTimeout(5000); // Playwright locator actions now fail fast with a real error message

const results = [];
for (const testCase of scripts) {
  console.log(`Running: ${testCase.description}`);
  const result = await runOneTest(page, testCase);
  console.log(`  -> ${result.executionResult}${result.failureCategory ? ' (' + result.failureCategory + ')' : ''}`);
  if (result.error) console.log(`     error: ${result.error}`);
  results.push(result);
}

await browser.close();
fs.writeFileSync('test-results.json', JSON.stringify(results, null, 2));

const summary = {
  total: results.length,
  pass: results.filter(r => r.executionResult === 'pass').length,
  fail: results.filter(r => r.executionResult === 'fail').length,
  crash: results.filter(r => r.executionResult === 'crash').length,
  skipped: results.filter(r => r.executionResult === 'skipped').length,
};
console.log('\n--- SUMMARY ---');
console.log(summary);
