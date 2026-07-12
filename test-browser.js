import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: false });
const page = await browser.newPage();
await page.goto('https://demo.playwright.dev/todomvc');

console.log('Page title:', await page.title());

await page.waitForTimeout(3000);
await browser.close();
