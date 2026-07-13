/**
 * similarity.ts — Similarity heuristic for matching AI-generated test
 * cases against human-authored ground-truth cases.
 *
 * HEURISTIC DOCUMENTED:
 * Two test cases are considered "matching" if their similarity score
 * exceeds SIMILARITY_THRESHOLD. The score is computed as a weighted
 * combination of:
 *   - Word overlap in the description (Jaccard similarity)
 *   - Action type match (exact match or compatible category)
 *   - Target element overlap (word-level)
 *
 * This is explicitly a heuristic, not an oracle. Borderline cases
 * (score between SIMILARITY_THRESHOLD and REVIEW_THRESHOLD) are
 * logged separately for manual review rather than auto-classified.
 */

import type { GroundTruthCase } from './fixtures/index';

export const SIMILARITY_THRESHOLD = 0.40;  // min score to count as a match
export const REVIEW_THRESHOLD = 0.30;       // score range [0.30, 0.40) = borderline → manual review

export interface SimilarityScore {
  score: number;
  descriptionOverlap: number;
  actionTypeMatch: boolean;
  elementOverlap: number;
  needsManualReview: boolean;
}

/**
 * Tokenises a string into a set of lowercase words, stripping
 * punctuation and common stop words.
 */
function tokenise(text: string): Set<string> {
  const stopWords = new Set([
    'a', 'an', 'the', 'is', 'are', 'on', 'in', 'at', 'to', 'of',
    'and', 'or', 'for', 'with', 'that', 'this', 'it', 'be', 'by',
    'as', 'has', 'have', 'not', 'no', 'from', 'into', 'after',
  ]);
  return new Set(
    text
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter((w) => w.length > 2 && !stopWords.has(w))
  );
}

function jaccard(setA: Set<string>, setB: Set<string>): number {
  if (setA.size === 0 && setB.size === 0) return 1;
  const intersection = new Set([...setA].filter((x) => setB.has(x)));
  const union = new Set([...setA, ...setB]);
  return intersection.size / union.size;
}

const ACTION_CATEGORIES: Record<string, string> = {
  existence: 'presence',
  existence_conditional: 'presence',
  click: 'interaction',
  double_click: 'interaction',
  input_and_submit: 'interaction',
  navigation: 'interaction',
};

function actionTypesCompatible(
  aiActionHint: string | undefined,
  gtAction: GroundTruthCase['actionType']
): boolean {
  if (!aiActionHint) return false;
  // Direct match
  if (aiActionHint.includes(gtAction)) return true;
  // Category-level match: both are presence-type or interaction-type
  const gtCategory = ACTION_CATEGORIES[gtAction];
  const aiLower = aiActionHint.toLowerCase();
  if (gtCategory === 'presence' && (aiLower.includes('exist') || aiLower.includes('visible') || aiLower.includes('present'))) return true;
  if (gtCategory === 'interaction' && (aiLower.includes('click') || aiLower.includes('type') || aiLower.includes('submit') || aiLower.includes('interact'))) return true;
  return false;
}

/**
 * Computes the similarity score between an AI-generated test case
 * description and a ground-truth case.
 *
 * @param aiDescription - Description from the AI-generated test case
 * @param aiActionHint  - Inferred action type from AI description (optional)
 * @param groundTruth   - The human-authored ground-truth case to compare against
 */
export function computeSimilarity(
  aiDescription: string,
  aiActionHint: string | undefined,
  groundTruth: GroundTruthCase
): SimilarityScore {
  const aiTokens = tokenise(aiDescription);
  const gtTokens = tokenise(groundTruth.description + ' ' + groundTruth.expectedOutcome);
  const elemTokens = tokenise(groundTruth.targetElement);
  const allAiTokens = tokenise(aiDescription);

  const descriptionOverlap = jaccard(aiTokens, gtTokens);
  const elementOverlap = [...elemTokens].some((t) => allAiTokens.has(t)) ? 0.3 : 0;
  const actionTypeMatch = actionTypesCompatible(aiActionHint, groundTruth.actionType);

  // Weighted combination
  const score =
    descriptionOverlap * 0.55 +
    (actionTypeMatch ? 0.25 : 0) +
    elementOverlap * 0.20;

  return {
    score,
    descriptionOverlap,
    actionTypeMatch,
    elementOverlap,
    needsManualReview: score >= REVIEW_THRESHOLD && score < SIMILARITY_THRESHOLD,
  };
}

/**
 * For a given AI description, find the best-matching ground-truth case
 * from a list. Returns null if no case exceeds REVIEW_THRESHOLD.
 */
export function findBestMatch(
  aiDescription: string,
  aiActionHint: string | undefined,
  groundTruthCases: GroundTruthCase[]
): { groundTruth: GroundTruthCase; score: SimilarityScore } | null {
  let best: { groundTruth: GroundTruthCase; score: SimilarityScore } | null = null;

  for (const gt of groundTruthCases) {
    const score = computeSimilarity(aiDescription, aiActionHint, gt);
    if (!best || score.score > best.score.score) {
      best = { groundTruth: gt, score };
    }
  }

  if (best && best.score.score < REVIEW_THRESHOLD) return null;
  return best;
}
