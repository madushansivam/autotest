import { chromium } from 'playwright';
import { createServer } from 'http';
import { readFileSync, existsSync, mkdirSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Start the Express server in-process
const { default: app } = await import('./server.js').catch(async () => {
  // server.js may call listen itself; try importing and using the express app
  // If server.js self-executes, we connect to it externally
  return { default: null };
});

const SHOTS = '/home/madushan/Project/autotest/report_assets';
if (!existsSync(SHOTS)) mkdirSync(SHOTS, { recursive: true });

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();

async function shot(name, msg) {
  await page.screenshot({ path: `${SHOTS}/${name}`, fullPage: true });
  console.log(`✓ ${msg}: ${SHOTS}/${name}`);
}

// ── Figure 3: home view + expanded history ──────────────────────
await page.setViewportSize({ width: 1280, height: 900 });
await page.goto('http://localhost:3000', { waitUntil: 'networkidle' });
await page.waitForTimeout(1000);
// Expand all URL groups
for (const h of await page.locator('[data-action="toggle-group"]').all()) {
  const expanded = await h.evaluate(el =>
    el.closest('.url-group')?.classList.contains('expanded') ?? false);
  if (!expanded) { await h.click(); await page.waitForTimeout(200); }
}
await shot('figure3_dashboard_home.png', 'Figure 3 (dashboard home)');

// ── Figure 4: detail panel open ─────────────────────────────────
const rows = await page.locator('.crawl-row').all();
console.log(`  Found ${rows.length} crawl row(s)`);
if (rows.length > 0) {
  await rows[0].click();
  await page.waitForTimeout(1200);
  await page.evaluate(() => window.scrollTo(0, 0));
  await shot('figure4_detail_panel.png', 'Figure 4 (detail panel)');
}

// ── Appendix A-1: 1440px full view ─────────────────────────────
await page.setViewportSize({ width: 1440, height: 1000 });
await page.reload({ waitUntil: 'networkidle' });
await page.waitForTimeout(800);
for (const h of await page.locator('[data-action="toggle-group"]').all()) {
  const expanded = await h.evaluate(el =>
    el.closest('.url-group')?.classList.contains('expanded') ?? false);
  if (!expanded) { await h.click(); await page.waitForTimeout(200); }
}
const rows2 = await page.locator('.crawl-row').all();
if (rows2.length > 0) {
  await rows2[0].click();
  await page.waitForTimeout(1000);
}
await shot('appendix_a1_full_view.png', 'Appendix A-1 (full view)');

// ── Appendix A-2: viewport-only close-up of detail area ────────
const detail = page.locator('.detail.visible').first();
if (await detail.count() > 0) {
  await detail.scrollIntoViewIfNeeded();
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${SHOTS}/appendix_a2_test_cards.png`, fullPage: false });
  console.log(`✓ Appendix A-2 (test cards): ${SHOTS}/appendix_a2_test_cards.png`);
}

await browser.close();
console.log('\nDone. Files:');
