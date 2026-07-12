import { chromium } from 'playwright';
import fs from 'fs';

const safeModeConfig = JSON.parse(
  fs.readFileSync('./safe-mode.config.json', 'utf-8')
);

const START_URL = 'https://books.toscrape.com/';
const MAX_PAGES = 8;

function isBlocked(text) {
  const lower = text.toLowerCase();
  return safeModeConfig.blockedButtonText.some((phrase) => lower.includes(phrase));
}

function sameOrigin(url, originUrl) {
  try {
    return new URL(url).origin === new URL(originUrl).origin;
  } catch {
    return false; // malformed URLs (mailto:, javascript:, etc.) are never followed
  }
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

  const links = await page.$$eval('a[href]', (els) =>
    els.map((el) => ({ text: el.textContent.trim(), href: el.href }))
  );

  const buttons = rawButtons.map((text) => ({ text, safe: !isBlocked(text) }));

  return { buttons, inputs, links };
}

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();

const visited = new Set();
const queue = [START_URL];
const siteMap = [];

while (queue.length > 0 && visited.size < MAX_PAGES) {
  const url = queue.shift();
  if (visited.has(url)) continue;
  visited.add(url);

  console.log(`Crawling [${visited.size}/${MAX_PAGES}]: ${url}`);
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  const scan = await scanPage(page);
  siteMap.push({ url, ...scan });

  for (const link of scan.links) {
    const clean = link.href.split('#')[0]; // ignore hash fragments for queueing
    if (
      sameOrigin(clean, START_URL) &&
      !visited.has(clean) &&
      !queue.includes(clean) &&
      !isBlocked(link.text)
    ) {
      queue.push(clean);
    }
  }
}

fs.writeFileSync('site-map.json', JSON.stringify(siteMap, null, 2));
console.log(`\nDone. Crawled ${siteMap.length} pages. Output written to site-map.json`);

await browser.close();
