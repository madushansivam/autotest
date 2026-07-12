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
    els.map((el) => el.textContent.trim())
  );

  const inputs = await page.$$eval('input', (els) =>
    els.map((el) => ({ type: el.type, name: el.name, id: el.id, placeholder: el.placeholder }))
  );

  const links = await page.$$eval('a', (els) =>
    els.map((el) => ({ text: el.textContent.trim(), href: el.href }))
  );

  const buttons = rawButtons.map((text) => ({
    text,
    safe: !isBlocked(text),
  }));

  return { buttons, inputs, links };
}

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
await page.goto(TARGET_URL);

console.log('--- SCAN 1: before interaction ---');
const before = await scanPage(page);
console.log(JSON.stringify(before, null, 2));

// Interact: type a todo and press Enter to reveal conditional elements
const newTodoInput = page.locator('input[placeholder="What needs to be done?"]');
await newTodoInput.fill('Buy groceries');
await newTodoInput.press('Enter');
await page.waitForTimeout(500); // let the UI settle

console.log('--- SCAN 2: after adding one todo ---');
const after = await scanPage(page);
console.log(JSON.stringify(after, null, 2));

await browser.close();
