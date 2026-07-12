import { chromium } from 'playwright';
import fs from 'fs';

const safeModeConfig = JSON.parse(
  fs.readFileSync('./safe-mode.config.json', 'utf-8')
);

const TARGET_URL = 'https://demo.playwright.dev/todomvc';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
await page.goto(TARGET_URL);

const rawButtons = await page.$$eval('button, [role="button"]', (els) =>
  els.map((el) => el.textContent.trim())
);

const inputs = await page.$$eval('input', (els) =>
  els.map((el) => ({ type: el.type, name: el.name, id: el.id, placeholder: el.placeholder }))
);

const links = await page.$$eval('a', (els) =>
  els.map((el) => ({ text: el.textContent.trim(), href: el.href }))
);

// Safe-mode tagging: check each button's text against the blocklist.
// Case-insensitive substring match — "Delete Account Now" should still match "delete account".
function isBlocked(text) {
  const lower = text.toLowerCase();
  return safeModeConfig.blockedButtonText.some((phrase) => lower.includes(phrase));
}

const buttons = rawButtons.map((text) => ({
  text,
  safe: !isBlocked(text),
}));

const interfaceMap = {
  url: TARGET_URL,
  crawledAt: new Date().toISOString(),
  buttons,
  inputs,
  links,
};

console.log(JSON.stringify(interfaceMap, null, 2));

await browser.close();
