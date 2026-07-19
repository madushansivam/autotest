import 'dotenv/config';
import fs from 'fs';
import { InferenceClient } from '@huggingface/inference';

const client = new InferenceClient(process.env.HUGGINGFACE_API_KEY);
const testCases = JSON.parse(fs.readFileSync('./generated-tests.json', 'utf-8'));
const siteMap = JSON.parse(fs.readFileSync('./todomvc-site-map.json', 'utf-8'));
const pageData = siteMap[0];

const MAX_RETRIES = 3;

function buildPrompt(testCase) {
  return `You are a Playwright test engineer. Convert this test case description into a single, complete, runnable Playwright test function body.

Test case: "${testCase.description}"
Confidence level: ${testCase.confidence}

Here is the ACTUAL crawled DOM data for this page. You MUST use the exact
id, name, placeholder, or class values shown here to build selectors —
do not guess or assume standard HTML structures like <tbody> that are not
shown in this data:

${JSON.stringify(pageData, null, 2)}

Rules:
- Assume 'page' is already an initialized Playwright Page object, already navigated to the URL.
- Use page.locator() with EXACT attribute values from the DOM data above (e.g. if an input has "id": "toggle-all", use page.locator('#toggle-all'), not a class selector, unless a class is what's shown).
- For text-based links, use page.getByText('exact text') instead of a text= locator string.
- Wrap the core action in a try/catch. On success, return { passed: true }. On failure, return { passed: false, error: err.message }.
- Do NOT include imports, browser launch code, or function wrapper syntax.
- Do NOT use Python-style snake_case methods (no wait_for, use waitFor if needed — but prefer Playwright's auto-waiting locators instead).
- Do NOT invent methods that don't exist on Playwright's Page or Locator objects.
- Respond with ONLY the raw JavaScript statements, no markdown fences, no commentary.`;
}

async function generateScriptWithRetry(testCase) {
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    const response = await client.chatCompletion({
      model: 'meta-llama/Llama-3.1-8B-Instruct',
      messages: [{ role: 'user', content: buildPrompt(testCase) }],
      max_tokens: 500,
    });

    let code = response.choices[0].message.content.trim();
    code = code.replace(/^```(javascript|js)?\n?/, '').replace(/```$/, '').trim();

    if (code.length < 10 || code.includes('<html')) {
      console.log(`Attempt ${attempt} for "${testCase.description}": suspicious output, retrying.`);
      continue;
    }

    return { success: true, code, attempts: attempt };
  }
  return { success: false, attempts: MAX_RETRIES };
}

const results = [];
for (const tc of testCases) {
  console.log(`Generating script for: ${tc.description}`);
  const result = await generateScriptWithRetry(tc);
  results.push({ ...tc, script: result.success ? result.code : null, generationFailed: !result.success });
}

fs.writeFileSync('playwright-scripts.json', JSON.stringify(results, null, 2));
console.log(`\nDone. ${results.filter(r => !r.generationFailed).length}/${results.length} scripts generated successfully.`);
