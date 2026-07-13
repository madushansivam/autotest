#!/usr/bin/env ts-node
/**
 * run-eval.ts — AutoTest evaluation harness.
 *
 * Runs the full AutoTest pipeline against each fixture site,
 * computes precision/recall/FP metrics against human-authored
 * ground truth, and writes a Markdown + JSON report.
 *
 * Usage:
 *   cd eval && npx ts-node run-eval.ts
 *   # or from repo root:
 *   npm run eval:run
 *
 * Output: eval/reports/<timestamp>.md and eval/reports/<timestamp>.json
 *
 * NOTE: This script requires HUGGINGFACE_API_KEY and SUPABASE_* env vars
 * to be set (same as the backend). It calls the same runPipeline() function
 * used by the live product — there is no separate eval-only pipeline.
 */

import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

// Load .env from repo root
dotenv.config({ path: path.resolve(__dirname, '../.env') });

import { EVAL_SITES, type EvalSite } from './fixtures/index';
import { computeSiteMetrics, computeAggregateMetrics, type AiTestCase } from './metrics';

// Import the canonical pipeline from the backend
// eval/ is a sibling of backend/ in the workspace, so we import directly
import { runPipeline } from '../backend/src/pipeline/index';

const REPORTS_DIR = path.join(__dirname, 'reports');

async function runEvalSite(site: EvalSite): Promise<{ siteId: string; aiCases: AiTestCase[] }> {
  console.log(`\n▶ Running pipeline for: ${site.name} (${site.url})`);

  // Use a synthetic run ID for eval runs (not persisted to Supabase)
  const EVAL_USER_ID = 'eval-harness';

  const pipelineResult = await runPipeline({
    url: site.url,
    userId: EVAL_USER_ID,
    // Eval runs use a synthetic runId; persistence is optional
    persistToDb: false,
  });

  const aiCases: AiTestCase[] = pipelineResult.testResults.map((r, i) => ({
    id: `ai-${site.id}-${i}`,
    description: r.testCase.description,
    confidence: r.testCase.confidence,
    result: r.result,
    actionHint: inferActionHint(r.testCase.description),
  }));

  console.log(`  ✓ Generated ${aiCases.length} test cases`);
  return { siteId: site.id, aiCases };
}

/**
 * Infers a rough action type from an AI-generated description.
 * Used to improve similarity matching. Not expected to be perfect.
 */
function inferActionHint(description: string): string {
  const lower = description.toLowerCase();
  if (lower.includes('click') || lower.includes('press') || lower.includes('tap')) return 'click';
  if (lower.includes('type') || lower.includes('input') || lower.includes('fill') || lower.includes('enter')) return 'input_and_submit';
  if (lower.includes('navigat') || lower.includes('redirect') || lower.includes('go to')) return 'navigation';
  if (lower.includes('exist') || lower.includes('visible') || lower.includes('present') || lower.includes('contain')) return 'existence';
  return 'existence';
}

function generateMarkdownReport(
  siteMetricsArr: ReturnType<typeof computeSiteMetrics>[],
  aggregate: NonNullable<ReturnType<typeof computeAggregateMetrics>>,
  timestamp: string
): string {
  const lines: string[] = [
    '# AutoTest Evaluation Report',
    '',
    `**Generated:** ${timestamp}`,
    `**Fixture sites:** ${siteMetricsArr.length}`,
    '',
    '## Summary',
    '',
    '| Metric | Value |',
    '|--------|-------|',
    `| Average Recall | ${(aggregate.avgRecall * 100).toFixed(1)}% |`,
    `| Average Behavioral Precision | ${(aggregate.avgBehavioralPrecision * 100).toFixed(1)}% |`,
    `| Total FP Candidates (manual review needed) | ${aggregate.totalFpCandidates} |`,
    `| Total Borderline Matches (manual review needed) | ${aggregate.totalBorderline} |`,
    '',
    '> **False-positive rate** cannot be computed automatically — it requires manual',
    '> verification of the AI cases flagged as fail/crash (listed per site below).',
    '> Review each candidate and determine whether the site behavior is actually',
    '> correct and the AI test expectation was wrong.',
    '',
    '---',
  ];

  for (const m of siteMetricsArr) {
    lines.push(
      '',
      `## ${m.siteName}`,
      '',
      '| Metric | Value |',
      '|--------|-------|',
      `| Ground-truth cases | ${m.totalGroundTruth} |`,
      `| Matched by AI | ${m.matched} |`,
      `| Borderline (manual review) | ${m.borderline} |`,
      `| Missed | ${m.missed} |`,
      `| Recall | ${(m.recall * 100).toFixed(1)}% |`,
      `| Behavioral AI cases | ${m.totalAiBehavioral} |`,
      `| Behavioral passed | ${m.behavioralPassed} |`,
      `| Behavioral precision | ${(m.behavioralPrecision * 100).toFixed(1)}% |`,
      '',
      '### Matched Cases',
      '',
      ...m.matchRecords
        .filter((r) => r.matchType === 'matched')
        .map((r) => `- ✅ **[${r.groundTruthId}]** "${r.groundTruthDescription}" → AI: "${r.matchedAiDescription}" (score: ${r.score.toFixed(2)})`),
      '',
      '### Missed Cases',
      '',
      ...m.matchRecords
        .filter((r) => r.matchType === 'missed')
        .map((r) => `- ❌ **[${r.groundTruthId}]** "${r.groundTruthDescription}"`),
      '',
      '### Borderline Cases (Manual Review Required)',
      '',
      ...m.borderlineRecords.map(
        (r) =>
          `- ⚠️ **[${r.groundTruthId}]** "${r.groundTruthDescription}" → AI: "${r.matchedAiDescription}" (score: ${r.score.toFixed(2)} — below threshold, needs human judgment)`
      ),
      '',
      '### FP Candidates (fail/crash results — manual review required)',
      '',
      m.failCrashCandidates.length === 0
        ? '_(none)_'
        : m.failCrashCandidates
            .map(
              (c) =>
                `- 🔍 [${c.confidence}] "${c.description}" → **${c.result.toUpperCase()}** — verify whether this is a real failure or a misclassification`
            )
            .join('\n'),
      '',
      '---'
    );
  }

  return lines.join('\n');
}

async function main(): Promise<void> {
  console.log('═══════════════════════════════════════════════');
  console.log('  AutoTest Evaluation Harness');
  console.log('═══════════════════════════════════════════════');

  if (!fs.existsSync(REPORTS_DIR)) {
    fs.mkdirSync(REPORTS_DIR, { recursive: true });
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const allSiteMetrics = [];

  for (const site of EVAL_SITES) {
    try {
      const { siteId, aiCases } = await runEvalSite(site);
      const metrics = computeSiteMetrics(
        siteId,
        site.name,
        site.groundTruth,
        aiCases
      );
      allSiteMetrics.push(metrics);

      console.log(`  Recall: ${(metrics.recall * 100).toFixed(1)}% | Behavioral precision: ${(metrics.behavioralPrecision * 100).toFixed(1)}%`);
    } catch (err) {
      console.error(`  ✗ Failed for ${site.name}: ${err instanceof Error ? err.message : err}`);
    }
  }

  const aggregate = computeAggregateMetrics(allSiteMetrics);
  if (!aggregate) {
    console.error('No metrics computed — exiting.');
    process.exit(1);
  }

  console.log('\n═══════════════════════════════════════════════');
  console.log('  Aggregate Results');
  console.log('═══════════════════════════════════════════════');
  console.log(`  Avg Recall:               ${(aggregate.avgRecall * 100).toFixed(1)}%`);
  console.log(`  Avg Behavioral Precision: ${(aggregate.avgBehavioralPrecision * 100).toFixed(1)}%`);
  console.log(`  FP Candidates:            ${aggregate.totalFpCandidates} (manual review required)`);
  console.log(`  Borderline Matches:       ${aggregate.totalBorderline} (manual review required)`);

  // Write reports
  const mdPath = path.join(REPORTS_DIR, `eval-${timestamp}.md`);
  const jsonPath = path.join(REPORTS_DIR, `eval-${timestamp}.json`);

  const markdownReport = generateMarkdownReport(allSiteMetrics, aggregate, timestamp);
  fs.writeFileSync(mdPath, markdownReport, 'utf-8');
  fs.writeFileSync(jsonPath, JSON.stringify({ aggregate, sites: allSiteMetrics }, null, 2), 'utf-8');

  console.log(`\n  Report written to:`);
  console.log(`    ${mdPath}`);
  console.log(`    ${jsonPath}`);
}

main().catch((err) => {
  console.error('Eval harness crashed:', err);
  process.exit(1);
});
