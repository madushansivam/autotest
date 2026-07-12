import { chromium } from 'playwright';
import fs from 'fs';

const safeModeConfig = JSON.parse(
  fs.readFileSync('./safe-mode.config.json', 'utf-8')
);

const TARGET_URL = 'https://demo.playwright.dev/todomvc';

function isBlocked(text) {
  const lower = text.toLowerCase();
  return safeModeConfig.blockedButtonText.some((phrase) => lower.includes(phrase));
}

async function scanPage(page) {
  const rawButtons = await page.$$eval('button, [role="button"]', (els) =>
    els.map((el) => {
      const text = el.textContent?.trim();
      if (text) return text;
      const aria = el.getAttribute('aria-label');
      if (aria) return `[aria-label] ${aria}`;
      if (el.className) return `[class] ${el.className}`;
      return '[unlabeled]';
    })
  );

  const inputs = await page.$$eval('input', (els) =>
    els.map((el) => ({ type: el.type, name: el.name, id: el.id, placeholder: el.placeholder }))
  );

  const links = await page.$$eval('a', (els) =>
    els.map((el) => ({ text: el.textContent.trim(), href: el.href }))
  );

  const buttons = rawButtons.map((text) => ({ text, safe: !isBlocked(text) }));

  return { buttons, inputs, links };
}

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
await page.goto(TARGET_URL);

const newTodoInput = page.locator('input[placeholder="What needs to be done?"]');
await newTodoInput.fill('Buy groceries');
await newTodoInput.press('Enter');
await page.waitForTimeout(500);

const scan = await scanPage(page);

// Standardized output: always an array of page objects, even for a
// single page, so any downstream script (generate-tests.js etc.)
// can treat crawler.js and multi-crawler.js output identically.
const siteMap = [{ url: TARGET_URL, ...scan }];

fs.writeFileSync('todomvc-site-map.json', JSON.stringify(siteMap, null, 2));
console.log('Done. Output written to todomvc-site-map.json');

await browser.close();
