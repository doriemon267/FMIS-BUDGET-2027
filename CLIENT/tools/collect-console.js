const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const context = await browser.newContext();
  const page = await context.newPage();

  page.on('console', (msg) => {
    console.log('[BROWSER]', msg.type(), msg.text());
  });

  page.on('pageerror', (err) => {
    console.error('[PAGE ERROR]', err);
  });

  const url = process.env.URL || 'http://localhost:3006/';
  console.log('Loading', url);
  try {
    await page.goto(url, { waitUntil: 'load', timeout: 120000 });
    // Wait to capture console logs after initial load
    await page.waitForTimeout(5000);
  } catch (err) {
    console.error('Error loading page:', err);
  }

  await browser.close();
  process.exit(0);
})();
