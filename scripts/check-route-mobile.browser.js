// History routes on a phone: touch targets, text size, the find-on-map
// markers and the verdict after an answer. Run against an open local
// Playwright CLI session on the built site (vite preview):
// playwright-cli run-code "$(cat scripts/check-route-mobile.browser.js)"
// Screenshots go to output/playwright/ (create that directory first).
async (page) => {
  const check = (ok, message) => { if (!ok) throw new Error(message); };
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  const base = new URL(page.url()).origin;
  const results = [];
  const landed = () => page.waitForFunction(() => {
    const q = window.__braga.quest;
    return q?.active && !q.state.flying && !window.__braga.rig?.touring;
  }, null, { timeout: 60000 }).then(() => page.waitForTimeout(1200));
  // every control in the card: at least 44 px each way (links inside a
  // sentence excepted); every text: at least 12 px; nothing wider than the card
  const card = () => page.evaluate(() => {
    const shown = (n) => n.getClientRects().length && getComputedStyle(n).visibility !== 'hidden';
    const box = document.querySelector('.quest-card').getBoundingClientRect();
    const small = [...document.querySelectorAll('.quest button, .quest a')]
      .filter((n) => shown(n) && !n.disabled && !n.closest('.quest-sources, .quest-credit'))
      .map((n) => ({ n, r: n.getBoundingClientRect() }))
      .filter(({ r }) => r.width < 44 || r.height < 44)
      .map(({ n, r }) => `${n.className} ${Math.round(r.width)}x${Math.round(r.height)}`);
    const tiny = [];
    const walk = document.createTreeWalker(document.querySelector('.quest'), NodeFilter.SHOW_TEXT);
    for (let t = walk.nextNode(); t; t = walk.nextNode()) {
      const e = t.parentElement;
      if (!t.textContent.trim() || !shown(e) || e.closest('.quest-sr')) continue;
      if (parseFloat(getComputedStyle(e).fontSize) < 12) tiny.push(e.className || e.tagName);
    }
    const wide = [...document.querySelectorAll('.quest-card *')].filter((n) => shown(n) && n.getBoundingClientRect().right > box.right + 1).length;
    return { small, tiny: [...new Set(tiny)], wide, bottom: box.bottom, right: box.right };
  });
  const sizes = [[320, 568], [390, 844], [844, 390]];
  for (const [width, height] of sizes) {
    await page.setViewportSize({ width, height });
    await page.evaluate(() => localStorage.removeItem('braga-quests-braga')); // each size starts the route afresh
    // the size in the query: a new document each time, not a hash change
    await page.goto(`${base}/?lang=ru&intro=0&quality=low&w=${width}#quest=old-town-on-foot`);
    await page.waitForFunction(() => window.__braga?.ready && window.__braga.quest?.state?.screen === 'intro', null, { timeout: 120000 });
    await landed();
    let c = await card();
    check(c.bottom <= height + 1 && c.right <= width + 1, `${width}x${height}: the card runs off the screen`);
    check(!c.small.length, `${width}x${height}: small targets on the intro: ${c.small.join(', ')}`);
    check(!c.tiny.length, `${width}x${height}: text under 12 px: ${c.tiny.join(', ')}`);
    check(!c.wide, `${width}x${height}: content wider than the card`);

    // find on the map (stop 3): every candidate marker shows, takes a tap
    // and is at least 44 px; the free map above or beside the card holds them
    await page.evaluate(() => window.__braga.quest.goStop(2));
    await landed();
    const find = await page.evaluate(() => {
      const card = document.querySelector('.quest-card').getBoundingClientRect();
      return [...document.querySelectorAll('#labels .map-label.is-quest-candidate')].map((el) => {
        const r = el.getBoundingClientRect();
        const x = r.left + r.width / 2;
        const y = r.top + r.height / 2;
        const hit = document.elementFromPoint(x, y);
        const underCard = x > card.left && x < card.right && y > card.top && y < card.bottom;
        return { name: el.textContent, shown: !el.classList.contains('is-muted') && +getComputedStyle(el).opacity > 0.3, top: !!hit && el.contains(hit), w: r.width, h: r.height, underCard };
      });
    });
    check(find.length >= 5, `${width}x${height}: find-on-map markers missing (${find.length})`);
    const hidden = find.filter((m) => !m.shown || !m.top || m.underCard).map((m) => m.name);
    check(!hidden.length, `${width}x${height}: find-on-map markers hidden or not tappable: ${hidden.join(', ')}`);
    const tinyMarks = find.filter((m) => m.w < 43.5 || m.h < 43.5).map((m) => `${m.name} ${m.w}x${m.h}`);
    check(!tinyMarks.length, `${width}x${height}: find-on-map markers under 44 px: ${tinyMarks.join(', ')}`);
    c = await card();
    check(!c.small.length, `${width}x${height}: small targets on the find task: ${c.small.join(', ')}`);
    await page.screenshot({ path: `output/playwright/route-find-${width}x${height}.png` });

    // a solved sequence (stop 4): the verdict is in view in the card
    await page.evaluate(() => window.__braga.quest.goStop(3));
    await landed();
    // the right order, from the route data the page loaded
    if (!(await page.evaluate(() => !!document.querySelector('.quest-verdict.is-right')))) {
      const order = await page.evaluate(async () => {
        const url = performance.getEntriesByType('resource').map((e) => e.name).find((u) => u.includes('quest.json'));
        const data = await (await fetch(url)).json();
        return data.routes.find((r) => r.id === 'old-town-on-foot').stops[3].task.items.map((it) => it.id);
      });
      for (let k = 0; k < order.length; k++) {
        for (let guard = 0; guard < order.length; guard++) {
          const cur = await page.evaluate(() => [...document.querySelectorAll('.quest-seq-item')].map((li) => li.dataset.item));
          if (cur[k] === order[k]) break;
          await page.locator(`.quest-seq-item[data-item="${order[k]}"] .is-up`).click();
        }
      }
      await page.locator('.quest-seq-check').click();
    }
    await page.waitForSelector('.quest-verdict.is-right');
    await page.waitForTimeout(900);
    const seen = await page.evaluate(() => {
      const v = document.querySelector('.quest-verdict.is-right').getBoundingClientRect();
      const b = document.querySelector('.quest-body').getBoundingClientRect();
      // only the text scrolls: the card keeps its head (title, stamps, close)
      const card = document.querySelector('.quest-card');
      const head = document.querySelector('.quest-head').getBoundingClientRect();
      return v.top >= b.top - 1 && v.bottom <= b.bottom + 1 && card.scrollTop === 0 && head.top >= card.getBoundingClientRect().top - 1;
    });
    check(seen, `${width}x${height}: the verdict of a solved sequence is out of view, or the card head scrolled away`);
    await page.screenshot({ path: `output/playwright/route-sequence-${width}x${height}.png` });
    results.push({ width, height, passed: true });
  }
  check(errors.length === 0, `Browser errors: ${errors.join('; ')}`);
  return { results, errors };
}
