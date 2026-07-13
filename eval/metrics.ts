/**
 * metrics.ts — Precision, recall, and false-positive rate computation.
 *
 * Terminology used here:
 *   - Ground-truth set: human-authored test cases for a given site
 *   - AI-generated set: test cases produced by AutoTest's pipeline
 *
 *   Recall = ground-truth cases matched by ≥1 AI case / total ground-truth cases
 *     ("How many expected tests did AutoTest find?")
 *
 *   Precision (behavioral) = behavioral AI cases with passing assertions /
 *     total behavioral AI cases
 *     ("Of the behavioral tests AutoTest generated, how many were correct?")
 *
 *   False-positive rate = AI cases flagged as fail/crash that are actually
 *     passing behavior / total AI cases flagged as fail/crash
 *     ("How often does AutoTest incorrectly report failures?")
 *     This requires manual verification of a sample — the harness logs candidates
 *     rather than auto-judging them.
 */

import type { GroundTruthCase } from './fixtures/index';
import {
  findBestMatch,
  SIMILARITY_THRESHOLD,
  type SimilarityScore,
} from './similarity';

export interface AiTestCase {
  id: string;
  description: string;
  confidence: 'structural' | 'behavioral' | 'unvalidated';
  result: 'pass' | 'fail' | 'crash' | 'skipped';
  /** Inferred from description — used for action-type matching in similarity */
  actionHint?: string;
}

export interface MatchRecord {
  groundTruthId: string;
  groundTruthDescription: string;
  matchedAiId: string | null;
  matchedAiDescription: string | null;
  score: number;
  matchType: 'matched' | 'borderline' | 'missed';
}

export interface SiteMetrics {
  siteId: string;
  siteName: string;
  totalGroundTruth: number;
  matched: number;
  borderline: number;
  missed: number;
  recall: number;
  totalAiBehavioral: number;
  behavioralPassed: number;
  behavioralPrecision: number;
  failCrashCandidates: AiTestCase[];  // for manual FP review
  matchRecords: MatchRecord[];
  borderlineRecords: MatchRecord[];
}

export function computeSiteMetrics(
  siteId: string,
  siteName: string,
  groundTruth: GroundTruthCase[],
  aiCases: AiTestCase[]
): SiteMetrics {
  const matchRecords: MatchRecord[] = [];
  const borderlineRecords: MatchRecord[] = [];

  for (const gt of groundTruth) {
    let bestAi: { case: AiTestCase; score: SimilarityScore } | null = null;

    for (const ai of aiCases) {
      const match = findBestMatch(ai.description, ai.actionHint, [gt]);
      if (match && (!bestAi || match.score.score > bestAi.score.score)) {
        bestAi = { case: ai, score: match.score };
      }
    }

    if (!bestAi) {
      matchRecords.push({
        groundTruthId: gt.id,
        groundTruthDescription: gt.description,
        matchedAiId: null,
        matchedAiDescription: null,
        score: 0,
        matchType: 'missed',
      });
      continue;
    }

    const { case: ai, score } = bestAi;

    if (score.score >= SIMILARITY_THRESHOLD) {
      matchRecords.push({
        groundTruthId: gt.id,
        groundTruthDescription: gt.description,
        matchedAiId: ai.id,
        matchedAiDescription: ai.description,
        score: score.score,
        matchType: 'matched',
      });
    } else {
      borderlineRecords.push({
        groundTruthId: gt.id,
        groundTruthDescription: gt.description,
        matchedAiId: ai.id,
        matchedAiDescription: ai.description,
        score: score.score,
        matchType: 'borderline',
      });
    }
  }

  const matched = matchRecords.filter((r) => r.matchType === 'matched').length;
  const borderline = borderlineRecords.length;
  const missed = groundTruth.length - matched - borderline;
  const recall = groundTruth.length > 0 ? matched / groundTruth.length : 0;

  // Behavioral precision
  const behavioralCases = aiCases.filter((c) => c.confidence === 'behavioral');
  const behavioralPassed = behavioralCases.filter((c) => c.result === 'pass').length;
  const behavioralPrecision = behavioralCases.length > 0
    ? behavioralPassed / behavioralCases.length
    : 0;

  // False-positive candidates: AI says fail/crash — these need manual review
  const failCrashCandidates = aiCases.filter(
    (c) => c.result === 'fail' || c.result === 'crash'
  );

  return {
    siteId,
    siteName,
    totalGroundTruth: groundTruth.length,
    matched,
    borderline,
    missed,
    recall,
    totalAiBehavioral: behavioralCases.length,
    behavioralPassed,
    behavioralPrecision,
    failCrashCandidates,
    matchRecords,
    borderlineRecords,
  };
}

export function computeAggregateMetrics(siteMetrics: SiteMetrics[]) {
  const total = siteMetrics.length;
  if (total === 0) return null;
  return {
    avgRecall: siteMetrics.reduce((s, m) => s + m.recall, 0) / total,
    avgBehavioralPrecision:
      siteMetrics.reduce((s, m) => s + m.behavioralPrecision, 0) / total,
    totalFpCandidates: siteMetrics.reduce(
      (s, m) => s + m.failCrashCandidates.length,
      0
    ),
    totalBorderline: siteMetrics.reduce((s, m) => s + m.borderline, 0),
  };
}
