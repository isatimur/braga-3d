// Run against an open local Playwright CLI session:
// playwright-cli run-code "$(cat scripts/check-interface.browser.js)"
// Screenshots go to output/playwright/ (create that directory first).
async (page) => {
  const check = (ok, message) => { if (!ok) throw new Error(message); };
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  const base = new URL(page.url()).origin;
  const results = [];
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: width === 390 ? 844 : 900 });
    await page.goto(`${base}/?lang=en&intro=0&quality=low`);
    await page.waitForFunction(() => window.__braga?.ready, null, { timeout: 120000 });
    const search = page.getByRole('combobox', { name: 'Search', exact: true });
    await search.fill('cathedral');
    await page.keyboard.press('Enter');
    await page.waitForFunction(() => new URLSearchParams(location.hash.slice(1)).get('place') === 'se-braga');
    await page.locator('#callout-more').click();
    check(await page.locator('#detail').isVisible(), 'Landmark detail did not open');
    await page.locator('#detail-close').click();

    await page.getByRole('button', { name: 'Menu', exact: true }).click();
    await page.getByRole('combobox', { name: 'Language', exact: true }).focus();
    const selected = page.url();
    await page.keyboard.press('ArrowRight');
    check(page.url() === selected, 'Language arrow changed selected landmark');
    await page.keyboard.press('Escape');
    check(await page.locator('#tools-toggle').getAttribute('aria-expanded') === 'false', 'Escape did not close menu');

    await page.getByRole('button', { name: 'Atmosphere', exact: true }).click();
    await page.keyboard.down('w');
    check(await page.evaluate(() => !window.__braga.flyKeys?.length), 'Atmosphere started map flight');
    await page.keyboard.up('w');
    await page.locator('[data-atmo="time:day"]').click();
    check(await page.locator('[data-atmo="time:day"]').getAttribute('aria-pressed') === 'true', 'Time preset not applied');
    await page.keyboard.press('Escape');
    check(await page.locator('#atmo-btn').evaluate(el => el === document.activeElement), 'Atmosphere did not return focus');

    await page.locator('#compass').focus();
    await page.keyboard.down('w');
    check(await page.evaluate(() => window.__braga.flyKeys?.includes('KeyW')), 'Map flight no longer works');
    await search.focus();
    check(await page.evaluate(() => !window.__braga.flyKeys?.length), 'Flight remained held after focusing search');
    await page.keyboard.up('w');
    await search.fill('bom');
    await page.screenshot({ path: `output/playwright/search-${width}.png` });
    check(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'Horizontal overflow');
    await page.keyboard.press('Escape');
    await page.keyboard.press('Escape');
    check(await search.getAttribute('aria-expanded') === 'false', 'Search did not close');

    await page.getByRole('button', { name: 'Menu', exact: true }).click();
    await page.locator('#routes-open').click();
    check(await page.locator('#view-routes').isVisible(), 'Routes did not open');
    await page.locator('#route-list button').first().click();
    check(new URL(page.url()).hash.includes('route='), 'Route selection not shared in URL');
    await page.keyboard.press('Escape');
    await page.getByRole('button', { name: 'Menu', exact: true }).click();
    await page.locator('#game-toggle').click();
    await page.waitForFunction(() => window.__braga.game.active);
    await page.keyboard.press('/');
    check(await page.locator('#search-input').getAttribute('aria-expanded') === 'false', 'Search opened behind game');
    if (await page.locator('.game-help-close').isVisible()) await page.locator('.game-help-close').click();
    await page.locator('.game-exit').click();
    check(await page.evaluate(() => !window.__braga.game.active), 'Game did not exit');
    await page.screenshot({ path: `output/playwright/map-${width}.png` });
    results.push({ width, passed: true });
  }
  check(errors.length === 0, `Browser errors: ${errors.join('; ')}`);
  return { results, errors };
}
