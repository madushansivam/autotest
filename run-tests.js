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

  await page.goto('https://demo.playwright.dev/todomvc').catch(() => {});

  const result = await testFn(page).catch((err) => ({
    passed: false,
    error: err.message,
    __harnessCaught: true,
  }));

  if (result && result.passed === true) {
    return { ...testCase, executionResult: 'pass' };
  } else {
    return {
      ...testCase,
      executionResult: result?.__harnessCaught ? 'crash' : 'fail',
      failureCategory: result?.__harnessCaught ? 'runtime_error' : 'assertion_failed',
      error: result?.error || 'unknown',
    };
  }
}

// Also install a process-level safety net so nothing can ever kill the whole run
process.on('unhandledRejection', (err) => {
  console.log('  (caught stray unhandled rejection, continuing):', err.message);
});

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
page.setDefaultTimeout(5000);

const results = [];
for (const testCase of scripts) {
  console.log(`Running: ${testCase.description}`);
  const result = await runOneTest(page, testCase);
  console.log(`  -> ${result.executionResult}${result.failureCategory ? ' (' + result.failureCategory + ')' : ''}`);
  results.push(result);
}

await browser.close();
fs.writeFileSync('test-results.json', JSON.stringify(results, null, 2));
console.log('\nDone. Results written to test-results.json');
