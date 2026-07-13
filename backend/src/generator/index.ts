/**
 * generator/index.ts — Test-case description and Playwright script generation.
 *
 * Uses Llama-3.1-8B-Instruct via the @huggingface/inference SDK.
 *
 * ORACLE LIMITATION: LLM-generated tests cannot verify business-logic
 * correctness. They can reliably detect structural issues (missing
 * elements, crashes, JS errors) and surface-level behavioral failures,
 * but not whether back-end state was mutated correctly. See types.ts
 * for a full explanation. This limitation is by design, not a bug.
 *
 * FUTURE IMPROVEMENT: To improve test quality, swap MODEL_ID for a
 * larger model (e.g., meta-llama/Llama-3.1-70B-Instruct or a
 * GPT-4-class model). The rest of this module is model-agnostic.
 */

import { InferenceClient } from '@huggingface/inference';
import { config } from '../config';
import { retryUntilValidJson, retryUntilValid, stripCodeFences } from '../lib/retry';
import { buildTestCasePrompt, buildScriptPrompt } from './prompts';
import type { InterfaceMap } from '../crawler/types';
import type { TestCase, GeneratedScript, ConfidenceTag } from './types';

const MODEL_ID = 'meta-llama/Llama-3.1-8B-Instruct';
const MAX_TEST_CASE_TOKENS = 800;
const MAX_SCRIPT_TOKENS = 600;
const MAX_RETRIES = 3;

let _client: InferenceClient | null = null;

function getClient(): InferenceClient {
  if (!_client) {
    _client = new InferenceClient(config.HUGGINGFACE_API_KEY);
  }
  return _client;
}

/** Type guard for the test-case JSON array the LLM should return */
function isTestCaseArray(parsed: unknown): parsed is Array<{ description: string; confidence: string }> {
  return (
    Array.isArray(parsed) &&
    parsed.length > 0 &&
    parsed.every(
      (item) =>
        typeof item === 'object' &&
        item !== null &&
        typeof (item as Record<string, unknown>).description === 'string' &&
        typeof (item as Record<string, unknown>).confidence === 'string'
    )
  );
}

const VALID_CONFIDENCE_TAGS = new Set<string>(['structural', 'behavioral', 'unvalidated']);

function normaliseConfidence(raw: string): ConfidenceTag {
  const lower = raw.toLowerCase().trim();
  if (VALID_CONFIDENCE_TAGS.has(lower)) return lower as ConfidenceTag;
  return 'unvalidated';
}

/**
 * Calls the LLM to generate 3–5 test-case descriptions for the given
 * interface map. Uses the shared retry helper — no duplicate retry logic.
 *
 * Counts as 1 LLM call toward the per-run budget.
 */
export async function generateTestCases(
  interfaceMap: InterfaceMap
): Promise<{ testCases: TestCase[]; llmCallsUsed: number }> {
  const client = getClient();
  const prompt = buildTestCasePrompt(interfaceMap.pages);

  const { value: rawCases, attempts } = await retryUntilValidJson(
    async (_attempt) => {
      const response = await client.textGeneration({
        model: MODEL_ID,
        inputs: prompt,
        parameters: {
          max_new_tokens: MAX_TEST_CASE_TOKENS,
          temperature: 0.3,
          return_full_text: false,
        },
      });
      return response.generated_text;
    },
    isTestCaseArray,
    MAX_RETRIES
  );

  const testCases: TestCase[] = rawCases.map((raw) => ({
    description: raw.description.trim(),
    confidence: normaliseConfidence(raw.confidence),
  }));

  return { testCases, llmCallsUsed: attempts };
}

/**
 * Calls the LLM to generate a Playwright script body for a single test case.
 * Uses the shared retry helper.
 *
 * Counts as 1 LLM call toward the per-run budget.
 */
export async function generateScript(
  testCase: TestCase,
  interfaceMap: InterfaceMap
): Promise<GeneratedScript & { llmCallsUsed: number }> {
  const client = getClient();
  const prompt = buildScriptPrompt(testCase, interfaceMap.pages);

  const isValidScript = (s: string): boolean =>
    s.length >= 10 &&
    !s.includes('<html') &&
    !s.includes('<!DOCTYPE') &&
    (s.includes('page.') || s.includes('return'));

  try {
    const { value: script, attempts } = await retryUntilValid(
      async (_attempt) => {
        const response = await client.textGeneration({
          model: MODEL_ID,
          inputs: prompt,
          parameters: {
            max_new_tokens: MAX_SCRIPT_TOKENS,
            temperature: 0.2,
            return_full_text: false,
          },
        });
        return stripCodeFences(response.generated_text);
      },
      isValidScript,
      MAX_RETRIES
    );

    return {
      testCaseIndex: 0,
      script,
      generationFailed: false,
      llmCallsUsed: attempts,
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return {
      testCaseIndex: 0,
      script: '',
      generationFailed: true,
      failureReason: msg,
      llmCallsUsed: MAX_RETRIES,
    };
  }
}
