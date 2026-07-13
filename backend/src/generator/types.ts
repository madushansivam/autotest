/**
 * generator/types.ts — Type definitions for test-case and script generation.
 *
 * IMPORTANT ORACLE LIMITATION (stated here for code reviewers):
 * The generator uses Llama-3.1-8B-Instruct via HuggingFace Inference.
 * LLM-generated tests without a ground-truth oracle can only reliably
 * catch structural breakage (element missing, page crashes, JS errors)
 * and surface-level behavioral failures (element not visible, navigation
 * did not occur). They cannot verify business-logic correctness — e.g.,
 * whether a form submission actually persisted data to a database, or
 * whether a calculation produced the right answer. This is a known,
 * accepted limitation of the approach, not a bug.
 *
 * Future improvement: swap the HuggingFace inference client for a
 * more capable model (e.g., Llama-3.1-70B or a GPT-4-class model)
 * to improve script quality. The interface is unchanged; only the
 * model identifier in generator/index.ts needs updating.
 */

export type ConfidenceTag = 'structural' | 'behavioral' | 'unvalidated';

export interface TestCase {
  id?: string; // populated after DB write
  description: string;
  confidence: ConfidenceTag;
}

export interface GeneratedScript {
  testCaseIndex: number;
  script: string;
  /** true if all generation attempts failed; the test will be skipped */
  generationFailed: boolean;
  failureReason?: string;
}
