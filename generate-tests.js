import 'dotenv/config';
import fs from 'fs';
import { InferenceClient } from '@huggingface/inference';

const client = new InferenceClient(process.env.HUGGINGFACE_API_KEY);
const siteMap = JSON.parse(fs.readFileSync('./todomvc-site-map.json', 'utf-8'));
const targetPage = siteMap[0];

const VALID_CONFIDENCE = ['structural', 'behavioral'];
const MAX_RETRIES = 3;

function buildPrompt(pageData) {
  return `You are a QA engineer. Given this structured map of a web page's interactive elements, generate 3-5 test cases a human tester would perform.

For each test case, respond with a JSON array where each object has:
- "description": plain-language description of the user action and expected result
- "confidence": either "structural" (just checks the element exists and doesn't crash) or "behavioral" (asserts a specific expected outcome, like a form submitting correctly)

Only test elements marked "safe": true. Never generate a test for anything marked "safe": false.

Page data:
${JSON.stringify(pageData, null, 2)}

CRITICAL: Respond with ONLY a valid JSON array. No markdown code fences, no commentary, no trailing commas, all strings properly closed with matching quotes. Double-check your JSON is syntactically valid before responding.`;
}

async function generateWithRetry(pageData) {
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    console.log(`Attempt ${attempt}/${MAX_RETRIES}...`);

    const response = await client.chatCompletion({
      model: 'meta-llama/Llama-3.1-8B-Instruct',
      messages: [{ role: 'user', content: buildPrompt(pageData) }],
      max_tokens: 800,
    });

    const raw = response.choices[0].message.content;

    try {
      const parsed = JSON.parse(raw);
      console.log(`Attempt ${attempt} produced valid JSON.`);
      return { success: true, testCases: parsed, attempts: attempt };
    } catch (err) {
      console.log(`Attempt ${attempt} failed to parse: ${err.message}`);
      if (attempt === MAX_RETRIES) {
        return { success: false, rawFailures: raw, attempts: attempt };
      }
    }
  }
}

const result = await generateWithRetry(targetPage);

if (!result.success) {
  console.error(`\nAll ${result.attempts} attempts failed to produce valid JSON. Logging failure.`);
  fs.writeFileSync('generation-failures.json', JSON.stringify({
    page: targetPage.url,
    timestamp: new Date().toISOString(),
    rawOutput: result.rawFailures,
  }, null, 2));
  process.exit(1);
}

// Validate confidence values even on successfully-parsed JSON
const validated = result.testCases.map((tc) => {
  const conf = tc.confidence?.toLowerCase().trim();
  const isValidConf = VALID_CONFIDENCE.includes(conf);
  return {
    ...tc,
    confidence: isValidConf ? conf : 'unvalidated',
    validationWarning: isValidConf ? null : `Model returned invalid confidence value: "${tc.confidence}"`,
  };
});

console.log(`\n--- SUCCESS after ${result.attempts} attempt(s) ---`);
console.log(JSON.stringify(validated, null, 2));

const warnings = validated.filter((tc) => tc.validationWarning);
console.log(`\n${warnings.length} of ${validated.length} test cases had validation issues.`);

fs.writeFileSync('generated-tests.json', JSON.stringify(validated, null, 2));
console.log('Written to generated-tests.json');
