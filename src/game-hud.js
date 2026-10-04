// Azulejo game HUD (src/game.js). A DOM overlay in the blue-and-gold tile
// palette: score, level and combo, the mural panel filling up, the current
// clue with a compass arrow, the scan meter, the flight readout (speed,
// altitude, low-fly bonus) and the ability buttons. The scene keeps drawing
// underneath; this file only reads state and paints.
import { t } from './i18n.js';

export function createGameHud({ onExit, onGo, onAction }) {
  const root = document.createElement('div');
  root.className = 'game';
  root.id = 'game';
  root.hidden = true;
  root.innerHTML = `
    <div class="game-top">
      <div class="game-score" aria-live="polite">
        <span class="game-score-num">0</span>
        <span class="game-score-label">${t('очки')}</span>
      </div>
      <div class="game-level">
        <span class="game-level-num">${t('Ур.')} 1</span>
        <span class="game-level-track"><span class="game-level-fill"></span></span>
        <span class="game-discovery">0%</span>
        <span class="game-best"></span>
      </div>
      <div class="game-combo" data-empty="true">
        <span class="game-combo-x">x1</span>
        <span class="game-combo-word">${t('серия')}</span>
        <span class="game-combo-track"><span class="game-combo-fill"></span></span>
      </div>
      <div class="game-panel">
        <div class="game-tiles"></div>
        <span class="game-count">0 / 0</span>
      </div>
    </div>
    <div class="game-mission">
      <span class="game-arrow" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M12 2.5 19 20l-7-4.2L5 20z" /></svg></span>
      <div class="game-mission-text">
        <p class="game-clue-label">${t('Подсказка')}</p>
        <p class="game-clue"></p>
        <p class="game-distance"></p>
      </div>
      <button type="button" class="game-go">${t('К осколку')}</button>
    </div>
    <div class="game-scan" hidden>
      <span class="game-scan-track"><span class="game-scan-fill"></span></span>
      <span class="game-scan-text">${t('Сканируем осколок…')}</span>
    </div>
    <div class="game-flight">
      <span class="game-speed">0</span> <span class="game-unit">${t('км/ч')}</span>
      <span class="game-sep">·</span>
      <span class="game-alt">0</span> <span class="game-unit">${t('м')}</span>
      <span class="game-rasante" hidden>${t('РАСАНТЕ')}</span>
      <span class="game-rings" hidden></span>
      <span class="game-frags" hidden></span>
    </div>
    <div class="game-actions">
      <button type="button" class="game-act" data-act="orbit" title="${t('Облёт цели (C)')}">${t('Облёт')}<kbd>C</kbd></button>
      <button type="button" class="game-act" data-act="overview" title="${t('Весь город (V)')}">${t('Обзор')}<kbd>V</kbd></button>
      <button type="button" class="game-act" data-act="echo" title="${t('Эхо (X)')}">${t('Эхо')}<kbd>X</kbd><span class="game-act-cd"></span></button>
      <button type="button" class="game-act game-act-mute" data-act="mute" title="${t('Звук (M)')}">♪</button>
      <button type="button" class="game-act game-act-help" data-act="help" title="${t('Управление (H)')}">?</button>
    </div>
    <div class="game-help" hidden>
      <div class="game-help-card" role="dialog" aria-label="${t('Управление')}">
        <p class="game-help-title">${t('Как играть')}</p>
        <ul class="game-help-list">
          <li><b>W A S D</b> <span>${t('лететь')}</span></li>
          <li><b>R / F</b> <span>${t('вверх / вниз')}</span></li>
          <li><b>Shift</b> <span>${t('ускорение')}</span></li>
          <li><b>${t('мышь')}</b> <span>${t('повернуть взглядом (тяни)')}</span></li>
          <li><b>C</b> <span>${t('облёт цели')}</span></li>
          <li><b>V</b> <span>${t('весь город')}</span></li>
          <li><b>X</b> <span>${t('эхо: открыть район')}</span></li>
        </ul>
        <p class="game-help-note">${t('Лети по подсказке к осколку, собирай искры по пути. Панно из шести плиток — цель.')}</p>
        <button type="button" class="game-help-close">${t('Понятно')}</button>
      </div>
    </div>
    <div class="game-bursts" aria-hidden="true"></div>
    <div class="game-banner" hidden aria-live="polite"></div>
    <div class="game-finale" hidden>
      <figure class="game-finale-frame">
        <img class="game-finale-img" alt="" />
        <figcaption class="game-finale-text">
          <p>${t('Панно собрано!')}</p>
          <span class="game-finale-score"></span>
        </figcaption>
      </figure>
    </div>
    <button type="button" class="game-exit" title="${t('Выйти (Esc)')}">${t('Выйти')}</button>
  `;
  document.body.append(root);

  const el = (sel) => root.querySelector(sel);
  const scoreNum = el('.game-score-num');
  const levelNum = el('.game-level-num');
  const levelFill = el('.game-level-fill');
  const discoveryEl = el('.game-discovery');
  const comboBox = el('.game-combo');
  const comboX = el('.game-combo-x');
  const comboFill = el('.game-combo-fill');
  const countEl = el('.game-count');
  const tilesBox = el('.game-tiles');
  const clueEl = el('.game-clue');
  const clueLabel = el('.game-clue-label');
  const distEl = el('.game-distance');
  const arrowEl = el('.game-arrow');
  const scanBox = el('.game-scan');
  const scanFill = el('.game-scan-fill');
  const speedEl = el('.game-speed');
  const altEl = el('.game-alt');
  const rasanteEl = el('.game-rasante');
  const ringsEl = el('.game-rings');
  const fragsEl = el('.game-frags');
  const bestEl = el('.game-best');
  const helpEl = el('.game-help');
  const bursts = el('.game-bursts');
  const banner = el('.game-banner');
  const finale = el('.game-finale');
  const finaleImg = el('.game-finale-img');
  const finaleScore = el('.game-finale-score');
  const echoBtn = el('.game-act[data-act="echo"]');
  const echoCd = el('.game-act[data-act="echo"] .game-act-cd');

  let tiles = [];

  function setShards(shards) {
    tilesBox.textContent = '';
    tiles = shards.map((s) => {
      const slot = document.createElement('span');
      slot.className = 'game-tile';
      slot.style.backgroundImage = `url('${s.tile}')`;
      slot.dataset.id = s.id;
      tilesBox.append(slot);
      return slot;
    });
    countEl.textContent = `0 / ${tiles.length}`;
  }

  el('.game-exit').addEventListener('click', () => onExit?.());
  el('.game-go').addEventListener('click', () => onGo?.());
  for (const b of root.querySelectorAll('.game-act')) {
    b.addEventListener('click', () => onAction?.(b.dataset.act));
  }
  const helpClose = root.querySelector('.game-help-close');
  const hideHelp = () => {
    helpEl.hidden = true;
    helpEl.classList.remove('is-on');
  };
  helpClose.addEventListener('click', hideHelp);
  helpEl.addEventListener('click', (e) => {
    if (e.target === helpEl) hideHelp();
  });

  let score = 0;
  let shownScore = 0;
  let bannerTimer = 0;
  let lastMult = 1;
  let bumpTimer = 0;

  return {
    root,
    setShards,
    show() {
      root.hidden = false;
    },
    hide() {
      root.hidden = true;
      finale.hidden = true;
      finale.classList.remove('is-on');
      helpEl.hidden = true;
      helpEl.classList.remove('is-on');
    },
    get visible() {
      return !root.hidden;
    },
    setScore(v, delta = 0, label = '') {
      score = v;
      if (delta) {
        const pop = document.createElement('span');
        pop.className = 'game-points';
        pop.innerHTML = `+${delta}${label ? `<em>${label}</em>` : ''}`;
        bursts.append(pop);
        setTimeout(() => pop.remove(), 1200);
      }
    },
    tickScore() {
      if (shownScore === score) return;
      shownScore += Math.sign(score - shownScore) * Math.max(1, Math.ceil(Math.abs(score - shownScore) * 0.18));
      if (Math.abs(score - shownScore) < 2) shownScore = score;
      scoreNum.textContent = shownScore;
    },
    setLevel(level, ratio) {
      levelNum.textContent = `${t('Ур.')} ${level}`;
      levelFill.style.transform = `scaleX(${Math.max(0, Math.min(1, ratio))})`;
    },
    setDiscovery(pct) {
      discoveryEl.textContent = `${Math.round(pct)}%`;
    },
    setCombo(mult, ratio) {
      comboBox.dataset.empty = String(mult <= 1);
      comboX.textContent = `x${mult}`;
      comboFill.style.transform = `scaleX(${Math.max(0, Math.min(1, ratio))})`;
      if (mult > lastMult) {
        comboBox.classList.remove('is-bump');
        void comboBox.offsetWidth; // restart the animation
        comboBox.classList.add('is-bump');
        clearTimeout(bumpTimer);
        bumpTimer = setTimeout(() => comboBox.classList.remove('is-bump'), 420);
      }
      lastMult = mult;
    },
    setFlight(kmh, altm, rasante) {
      speedEl.textContent = Math.round(kmh);
      altEl.textContent = Math.round(altm);
      rasanteEl.hidden = !rasante;
    },
    setRings(done, total) {
      ringsEl.hidden = !total;
      if (total) ringsEl.textContent = `${t('Кольца')} ${done}/${total}`;
    },
    setFragments(n) {
      fragsEl.hidden = !n;
      if (n) fragsEl.textContent = `${t('Искры')} ${n}`;
    },
    setBest(best) {
      bestEl.textContent = best ? `${t('Лучший')} ${best}` : '';
    },
    showHelp() {
      helpEl.hidden = false;
      requestAnimationFrame(() => helpEl.classList.add('is-on'));
    },
    hideHelp() {
      helpEl.hidden = true;
      helpEl.classList.remove('is-on');
    },
    get helpOpen() {
      return !helpEl.hidden;
    },
    setEcho(ratio) {
      echoBtn.dataset.ready = String(ratio == null);
      echoCd.style.transform = ratio == null ? 'scaleX(0)' : `scaleX(${Math.max(0, Math.min(1, ratio))})`;
    },
    setAbility(act, on) {
      root.querySelector(`.game-act[data-act="${act}"]`)?.classList.toggle('is-on', !!on);
    },
    setMuted(on) {
      root.querySelector('.game-act[data-act="mute"]')?.classList.toggle('is-on', !!on);
    },
    found(index) {
      tiles[index]?.classList.add('is-found');
      const n = tiles.filter((s) => s.classList.contains('is-found')).length;
      countEl.textContent = `${n} / ${tiles.length}`;
    },
    setClue({ clue, name, distanceM, bearing, step }) {
      clueEl.textContent = clue;
      if (step) clueLabel.textContent = `${t('Подсказка')} · ${step}`;
      distEl.textContent = name ? `${name} · ${Math.round(distanceM)} ${t('м')}` : '';
      if (bearing != null) arrowEl.style.transform = `rotate(${(bearing * 180) / Math.PI}deg)`;
    },
    setScan(ratio) {
      if (ratio == null) {
        scanBox.hidden = true;
        return;
      }
      scanBox.hidden = false;
      scanFill.style.transform = `scaleX(${Math.max(0, Math.min(1, ratio))})`;
    },
    banner(text) {
      banner.textContent = text;
      banner.hidden = false;
      banner.classList.add('is-on');
      clearTimeout(bannerTimer);
      bannerTimer = setTimeout(() => {
        banner.classList.remove('is-on');
        setTimeout(() => (banner.hidden = true), 400);
      }, 2600);
    },
    // the restored azulejo panel, shown when every shard is found
    finale(src, score) {
      finaleImg.src = src;
      finaleScore.textContent = `${score} ${t('очки')}`;
      finale.hidden = false;
      requestAnimationFrame(() => finale.classList.add('is-on'));
      const hide = () => {
        finale.classList.remove('is-on');
        setTimeout(() => (finale.hidden = true), 500);
      };
      clearTimeout(bannerTimer);
      bannerTimer = setTimeout(hide, 7000);
      finale.addEventListener('click', hide, { once: true });
    },
    hideFinale() {
      finale.hidden = true;
      finale.classList.remove('is-on');
    },
  };
}
