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
    // Ensure we have a dummy authenticated user and active region in localStorage to render Dashboard
    await context.addInitScript(() => {
      try {
        const user = {
          Id: 1,
          Username: 'dev',
          FirstName: 'Dev',
          LastName: 'Tester',
          Roles: ['SUPER ADMIN'],
          ProfilePicture: '',
        };
        localStorage.setItem('currentUser', JSON.stringify(user));
        localStorage.setItem('activeRegion', JSON.stringify({ id: '1', name: 'Default Region' }));
      } catch (e) { }
    });
    await page.goto(url, { waitUntil: 'load', timeout: 120000 });
    try {
      // Open app tray and click the Calculator icon
      await page.waitForSelector('.tray-handle', { timeout: 4000 });
      await page.click('.tray-handle');
      await page.waitForSelector('[role="menu"]', { timeout: 4000 });
      const calc = await page.$('[aria-label="Calculator"]');
      if (calc) {
        await calc.click();
      } else {
        // attempt to click by tooltip element if aria-label not found
        const items = await page.$$('[role="menuitem"]');
        await items[0]?.click();
      }
      console.log('Clicked calculator icon.');
      await page.waitForTimeout(600);

      // Press Alt+C to toggle calculator
      console.log('Pressing Alt+C');
      await page.keyboard.down('Alt');
      await page.keyboard.press('c');
      await page.keyboard.up('Alt');
      await page.waitForTimeout(600);

      // Check localStorage for open apps
      const openAppsStr = await page.evaluate(() => localStorage.getItem('fmis_open_apps_v1'));
      console.log('LocalStorage openApps:', openAppsStr);
      // Check DOM for floating dialog with title Calculator
      const calcDialog = await page.$('div[role="dialog"][aria-label="Calculator"]');
      console.log('Calculator dialog present?', !!calcDialog);
    } catch (e) { console.error('Tray automation failed', e); }
    // Wait to capture console logs after initial load
    await page.waitForTimeout(5000);
  } catch (err) {
    console.error('Error loading page:', err);
  }

  await browser.close();
  process.exit(0);
})();
