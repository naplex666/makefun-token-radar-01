// Playwright screenshot script for token radar dashboard
import { chromium } from '/home/hatch/workspace/tools/shot/node_modules/playwright/index.mjs';
import { statSync } from 'node:fs';

const [url, out] = process.argv.slice(2);
if (!url || !out) {
  console.error('usage: node shot.mjs <url> <out.png>');
  process.exit(2);
}

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
// Wait a moment for rendering
await page.waitForTimeout(1000);
await page.screenshot({ path: out, type: 'png', fullPage: false });
await browser.close();
const size = statSync(out).size;
console.log(JSON.stringify({ out, bytes: size }));
