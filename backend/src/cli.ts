#!/usr/bin/env ts-node
/**
 * cli.ts — Command-line entry point for AutoTest.
 *
 * Runs the full pipeline against a user-supplied URL and prints
 * a summary to stdout. Shares the exact same runPipeline() function
 * used by the API — no separate implementation.
 *
 * Usage:
 *   cd backend && npx ts-node src/cli.ts <url> [--no-persist]
 *
 * Options:
 *   --no-persist   Run the pipeline without writing to Supabase
 *                  (useful for quick local testing)
 *
 * Examples:
 *   npx ts-node src/cli.ts https://todomvc.com/examples/react/dist/
 *   npx ts-node src/cli.ts https://example.com --no-persist
 */

import { runPipeline } from './pipeline/index';

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const url = args.find((a) => !a.startsWith('--'));
  const persist = !args.includes('--no-persist');

  if (!url) {
    console.error('Usage: npx ts-node src/cli.ts <url> [--no-persist]');
    process.exit(1);
  }

  console.log(`\n══════════════════════════════════════════════════`);
  console.log(`  AutoTest CLI`);
  console.log(`══════════════════════════════════════════════════`);
  console.log(`  Target URL : ${url}`);
  console.log(`  Persist DB : ${persist}`);
  console.log(`══════════════════════════════════════════════════\n`);

  const result = await runPipeline({
    url,
    userId: 'cli-user',
    persistToDb: persist,
  });

  console.log('\n══════════════════════════════════════════════════');
  console.log('  Results');
  console.log('══════════════════════════════════════════════════');
  console.log(`  Status       : ${result.status}`);
  console.log(`  Pages crawled: ${result.interfaceMap.pages.length}`);
  console.log(`  LLM calls    : ${result.llmCallsUsed}`);
  console.log(`  Test results : ${result.testResults.length}`);

  if (result.testResults.length > 0) {
    const counts = result.testResults.reduce(
      (acc, r) => { acc[r.result] = (acc[r.result] ?? 0) + 1; return acc; },
      {} as Record<string, number>
    );
    console.log(`    ✅ pass   : ${counts.pass ?? 0}`);
    console.log(`    ❌ fail   : ${counts.fail ?? 0}`);
    console.log(`    💥 crash  : ${counts.crash ?? 0}`);
    console.log(`    ⏭  skipped: ${counts.skipped ?? 0}`);
    console.log('');

    for (const r of result.testResults) {
      const icon = { pass: '✅', fail: '❌', crash: '💥', skipped: '⏭' }[r.result] ?? '?';
      console.log(`  ${icon} [${r.testCase.confidence}] ${r.testCase.description}`);
      if (r.errorMessage) console.log(`       ↳ ${r.errorMessage}`);
    }
  }

  if (result.error) {
    console.error(`\n  Pipeline error: ${result.error}`);
  }

  if (result.runId) {
    console.log(`\n  Run ID: ${result.runId}`);
  }

  console.log('══════════════════════════════════════════════════\n');
  process.exit(result.status === 'completed' ? 0 : 1);
}

main().catch((err) => {
  console.error('CLI crashed:', err);
  process.exit(1);
});
