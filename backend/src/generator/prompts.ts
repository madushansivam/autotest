/**
 * generator/prompts.ts — All LLM prompt templates in one place.
 *
 * Keeping prompts here (rather than inline in index.ts) makes them
 * easy to iterate on without touching the inference logic.
 *
 * Model: meta-llama/Llama-3.1-8B-Instruct (small model — prompts must
 * be concise and provide strong structural constraints to get reliable
 * JSON output).
 */

import type { PageSnapshot } from '../crawler/types';
import type { TestCase } from './types';

/** Maximum elements to include per page in prompts (token budget) */
const MAX_ELEMENTS_IN_PROMPT = 30;

/**
 * Builds the test-case generation prompt for a set of page snapshots.
 * Instructs the model to return a JSON array of test cases.
 */
export function buildTestCasePrompt(pages: PageSnapshot[]): string {
  // Summarise pages, capping element count to keep prompts short
  const pageSummaries = pages.map((p) => ({
    url: p.url,
    title: p.title,
    elements: p.elements
      .filter((e) => e.safe) // only include safe elements
      .slice(0, MAX_ELEMENTS_IN_PROMPT)
      .map((e) => ({
        type: e.type,
        text: e.text,
        placeholder: e.placeholder,
        id: e.id,
        name: e.name,
        ariaLabel: e.ariaLabel,
        inputType: e.inputType,
        formAction: e.formAction,
        formMethod: e.formMethod,
      })),
  }));

  return `<s>[INST] You are a software QA engineer generating test cases for a web application.

Given the following interface map of a web application, generate 3 to 5 meaningful test cases.

INTERFACE MAP:
${JSON.stringify(pageSummaries, null, 2)}

Rules:
1. Each test case must have exactly two fields: "description" (string) and "confidence" (string).
2. "confidence" must be exactly "structural" or "behavioral".
   - "structural": tests that an element exists or that an interaction does not crash the page.
   - "behavioral": tests that assert a specific visible outcome (e.g., text appears, URL changes).
3. Only generate tests for SAFE elements. Avoid payment forms, account deletion, or checkout.
4. Output ONLY a valid JSON array. No markdown, no code fences, no explanation.

Example output:
[{"description":"The navigation bar contains a Home link","confidence":"structural"},{"description":"Clicking the Login button navigates to the login page","confidence":"behavioral"}]

Output: [INST]`;
}

/**
 * Builds the script generation prompt for a single test case.
 * Instructs the model to return raw Playwright JavaScript statements.
 */
export function buildScriptPrompt(
  testCase: TestCase,
  pages: PageSnapshot[]
): string {
  // Provide the most relevant page elements as selector hints
  const elementHints = pages
    .flatMap((p) => p.elements.filter((e) => e.safe))
    .slice(0, MAX_ELEMENTS_IN_PROMPT)
    .map((e) => {
      const selector = e.id
        ? `#${e.id}`
        : e.name
        ? `[name="${e.name}"]`
        : e.ariaLabel
        ? `[aria-label="${e.ariaLabel}"]`
        : e.text
        ? `text="${e.text.slice(0, 50)}"`
        : e.type;
      return `${e.type}: ${selector}${e.text ? ` ("${e.text.slice(0, 40)}")` : ''}`;
    });

  return `<s>[INST] You are a Playwright test script generator. Generate a Playwright script for the following test case.

Test description: ${testCase.description}
Test type: ${testCase.confidence}

Available elements and selectors:
${elementHints.join('\n')}

Rules:
1. Output ONLY raw JavaScript statements. No imports, no function wrapper, no async keyword.
2. Use page.locator() with selectors from the available elements list above.
3. The script has access to a "page" variable (Playwright Page object) already navigated to the target URL.
4. Wrap the entire script in a try/catch block.
5. On success: use the last statement "return { passed: true };"
6. On failure: catch the error and use "return { passed: false, error: err.message };"
7. Use page.waitForTimeout(1000) after clicks if needed.
8. Keep the script under 25 lines.
9. Do NOT navigate away from the current page.
10. Do NOT output markdown fences or any text other than the JavaScript.

Example:
try {
  await page.locator('a:has-text("Home")').waitFor({ state: 'visible', timeout: 5000 });
  return { passed: true };
} catch (err) {
  return { passed: false, error: err.message };
}

Output: [INST]`;
}
