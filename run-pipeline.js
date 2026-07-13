import 'dotenv/config';
process.on('unhandledRejection', function (err) { console.error('Caught stray unhandled rejection, continuing:', err.message); });
import { chromium } from 'playwright';
import fs from 'fs';
import { InferenceClient } from '@huggingface/inference';
import db from './db.js';

const client = new InferenceClient(process.env.API_KEY);
const safeModeConfig = JSON.parse(fs.readFileSync('./safe-mode.config.json', 'utf-8'));

function isBlocked(text) {
  const lower = text.toLowerCase();
  return safeModeConfig.blockedButtonText.some((phrase) => lower.includes(phrase));
}

async function scanPage(page) {
  const rawButtons = await page.$$eval('button, [role="button"]', (els) =>
    els.map((el) => {
      const text = el.textContent?.trim();
      if (text) return text;
      const aria = el.getAttribute('aria-label');
      if (aria) return '[aria-label] ' + aria;
      if (el.className) return '[class] ' + el.className;
      return '[unlabeled]';
    })
  );
  const inputs = await page.$$eval('input', (els) =>
    els.map((el) => ({ type: el.type, name: el.name, id: el.id, placeholder: el.placeholder }))
  );
  const links = await page.$$eval('a', (els) =>
    els.map((el) => ({ text: el.textContent.trim(), href: el.href }))
  );
  const buttons = rawButtons.map((text) => ({ text: text, safe: !isBlocked(text) }));
  return { buttons: buttons, inputs: inputs, links: links };
}

function buildTestGenPrompt(pageData) {
  return 'You are a QA engineer. Given this structured map of a web page interactive elements, generate 3-5 test cases a human tester would perform.\n\n'
    + 'For each test case, respond with a JSON array where each object has:\n'
    + '- "description": plain-language description of the user action and expected result\n'
    + '- "confidence": either "structural" or "behavioral"\n\n'
    + 'Only test elements marked safe true. Never generate a test for anything marked safe false.\n\n'
    + 'Page data:\n' + JSON.stringify(pageData, null, 2) + '\n\n'
    + 'CRITICAL: Respond with ONLY a valid JSON array. No markdown code fences, no commentary, no trailing commas, all strings properly closed.';
}

function buildScriptGenPrompt(testCase, pageData) {
  return 'You are a Playwright test engineer. Convert this test case description into a single, complete, runnable Playwright test function body.\n\n'
    + 'Test case: "' + testCase.description + '"\n'
    + 'Confidence level: ' + testCase.confidence + '\n\n'
    + 'Here is the ACTUAL crawled DOM data for this page. You MUST use the exact id, name, placeholder, or class values shown here:\n\n'
    + JSON.stringify(pageData, null, 2) + '\n\n'
    + 'Rules:\n'
    + "- Assume 'page' is already an initialized Playwright Page object, already navigated to the URL.\n"
    + '- Use page.locator() with EXACT attribute values from the DOM data above.\n'
    + '- Wrap the core action in a try/catch. On success, return { passed: true }. On failure, return { passed: false, error: err.message }.\n'
    + '- Do NOT include imports, browser launch code, or function wrapper syntax.\n'
    + '- Do NOT use Python-style snake_case methods.\n'
    + '- Do NOT invent methods that do not exist on Playwright Page or Locator objects.\n'
    + '- Respond with ONLY the raw JavaScript statements, no markdown fences, no commentary.';
}

async function generateTestCases(pageData) {
  const MAX_RETRIES = 3;
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    const response = await client.chatCompletion({
      model: 'meta-llama/Llama-3.1-8B-Instruct',
      messages: [{ role: 'user', content: buildTestGenPrompt(pageData) }],
      max_tokens: 800,
    });
    try {
      const parsed = JSON.parse(response.choices[0].message.content);
      return parsed.map((tc) => ({
        description: tc.description,
        confidence: ['structural', 'behavioral'].includes((tc.confidence || '').toLowerCase().trim())
          ? tc.confidence.toLowerCase().trim()
          : 'unvalidated',
      }));
    } catch (err) {
      if (attempt === MAX_RETRIES) throw new Error('Test generation failed: ' + err.message);
    }
  }
}

async function generateScript(testCase, pageData) {
  const MAX_RETRIES = 3;
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    const response = await client.chatCompletion({
      model: 'meta-llama/Llama-3.1-8B-Instruct',
      messages: [{ role: 'user', content: buildScriptGenPrompt(testCase, pageData) }],
      max_tokens: 500,
    });
    let code = response.choices[0].message.content.trim();
    code = code.replace(/^```(javascript|js)?\n?/, '').replace(/```$/, '').trim();
    if (code.length >= 10 && code.indexOf('<html') === -1) return code;
  }
  return null;
}

const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;

async function executeTest(page, script, targetUrl) {
  if (!script) return { executionResult: 'skipped', reason: 'no script generated' };
  let testFn;
  try {
    testFn = new AsyncFunction('page', script);
  } catch (err) {
    return { executionResult: 'crash', failureCategory: 'syntax_error', error: err.message };
  }
  await page.goto(targetUrl).catch(function () {});
  const result = await testFn(page).catch(function (err) {
    return { passed: false, error: err.message, harnessCaught: true };
  });
  if (result && result.passed === true) return { executionResult: 'pass' };
  return {
    executionResult: result && result.harnessCaught ? 'crash' : 'fail',
    failureCategory: result && result.harnessCaught ? 'runtime_error' : 'assertion_failed',
    error: (result && result.error) || 'unknown',
  };
}

export async function runFullPipeline(targetUrl) {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  page.setDefaultTimeout(5000);

  await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 15000 });
  const pageData = await scanPage(page);
  pageData.url = targetUrl;

  const testCases = await generateTestCases(pageData);

  const insertCrawl = db.prepare('INSERT INTO crawls (url, crawled_at, raw_json) VALUES (?, ?, ?)');
  const crawlInfo = insertCrawl.run(targetUrl, new Date().toISOString(), JSON.stringify(pageData));
  const crawlId = crawlInfo.lastInsertRowid;

  const insertTestCase = db.prepare('INSERT INTO test_cases (crawl_id, description, confidence, script, created_at) VALUES (?, ?, ?, ?, ?)');
  const insertResult = db.prepare('INSERT INTO test_results (test_case_id, result, failure_category, error, executed_at) VALUES (?, ?, ?, ?, ?)');

  for (let i = 0; i < testCases.length; i++) {
    const tc = testCases[i];
    const script = await generateScript(tc, pageData);
    const result = await executeTest(page, script, targetUrl);

    const tcInfo = insertTestCase.run(crawlId, tc.description, tc.confidence, script, new Date().toISOString());
    insertResult.run(
      tcInfo.lastInsertRowid,
      result.executionResult,
      result.failureCategory || null,
      result.error || null,
      new Date().toISOString()
    );
  }

  await browser.close();
  return crawlId;
}
