// "Fix the map": a visitor reports a fault at a place, from the map or from
// walk mode (docs/specs/public-reports.md). A native <dialog>, so while it is
// open main.js's global keydown skips every key and Escape closes the dialog
// only (the walk goes on). The report goes to POST /api/report (the owner's
// private Telegram chat); data faults also offer an OpenStreetMap note; when
// delivery is off or fails the dialog keeps the text and shows the OSM note
// and a public GitHub issue link, marked as public.
//
// Gate: only with ?report=1 in the URL (until the owner names the privacy
// controller, owner decision 1); without it installReport() returns null and
// mounts nothing.
import { t } from './i18n.js';
import { mountTool } from './ui.js';
import { CATEGORIES, OSM_CATEGORIES, LIMITS, cleanReportText, osmNoteUrl, githubIssueUrl } from '../api/_report-core.js';
import './report.css';

const LABELS = {
  'missing-building': 'Нет здания (например, моего дома)',
  road: 'Неверная дорога или дорожка',
  name: 'Неверное название или сведения',
  walk: 'Не могу пройти или застрял',
  'looks-wrong': 'В 3D выглядит не так',
  idea: 'Идея или другое',
};
const TIMEOUT_MS = 8000;
const THANKS_MS = 3000;
const round5 = (n) => Math.round(n * 1e5) / 1e5;
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

// cityId: CITY.id; proj: createProjection() (unproject); getTarget(): the
// map camera's target (the ground under the view centre); getWalk(): the
// walk mode or null; language: 'ru' | 'pt' | 'en'.
// -> { open(opener?), dialog } or null when the gate is off.
export function installReport({ cityId, proj, getTarget, getWalk, language }) {
  if (new URLSearchParams(location.search).get('report') !== '1') return null;

  const dialog = document.createElement('dialog');
  dialog.className = 'report';
  dialog.setAttribute('aria-labelledby', 'report-title');
  dialog.innerHTML = `
    <form class="report-form" novalidate>
      <header class="report-head">
        <span class="report-cross" aria-hidden="true"></span>
        <div>
          <h2 id="report-title">${esc(t('Исправить карту'))}</h2>
          <p class="report-place"></p>
        </div>
      </header>
      <fieldset class="report-cats">
        <legend>${esc(t('Что не так?'))}</legend>
        ${CATEGORIES.map((id) => `<label class="report-cat"><input type="radio" name="category" value="${id}"><span>${esc(t(LABELS[id]))}</span></label>`).join('')}
      </fieldset>
      <p class="report-hint" hidden>${esc(t('Если это название улицы или магазина'))}</p>
      <label class="report-field"><span>${esc(t('Опишите, что исправить'))}</span>
        <textarea name="text" rows="4" maxlength="${LIMITS.text[1]}" aria-describedby="report-text-err"></textarea></label>
      <p class="report-err" id="report-text-err" hidden>${esc(t('Не меньше 10 знаков'))}</p>
      <label class="report-field"><span>${esc(t('E-mail, если хотите ответ (не обязательно)'))}</span>
        <input type="email" name="email" maxlength="${LIMITS.email}" autocomplete="email" inputmode="email" aria-describedby="report-email-err"></label>
      <p class="report-err" id="report-email-err" hidden>${esc(t('Проверьте e-mail'))}</p>
      <input class="report-hp" type="text" name="x_note" tabindex="-1" autocomplete="off" aria-hidden="true">
      <div class="report-osm" hidden>
        <a class="report-osm-link" target="_blank" rel="noopener">${esc(t('Исправить в OpenStreetMap'))}</a>
        <small>${esc(t('OpenStreetMap — общая открытая карта; заметка там будет видна всем.'))}</small>
      </div>
      <p class="report-status" role="status" aria-live="polite"></p>
      <div class="report-fallback" hidden>
        <p class="report-fallback-lead">${esc(t('Не удалось отправить. Можно так:'))}</p>
        <a class="report-osm-link report-fallback-osm" target="_blank" rel="noopener">${esc(t('Исправить в OpenStreetMap'))}</a>
        <a class="report-gh" target="_blank" rel="noopener">${esc(t('Открыть публичное сообщение на GitHub'))}</a>
        <small>${esc(t('Это сообщение будет видно всем.'))}</small>
      </div>
      <p class="report-privacy">${esc(t('Мы храним место, категорию, ваш текст и e-mail, если вы его дали. Их читает только автор карты в личном чате и использует только для исправления карты.'))}</p>
      <div class="report-actions">
        <button type="button" class="report-cancel">${esc(t('Отмена'))}</button>
        <button type="submit" class="report-send">${esc(t('Отправить'))}</button>
      </div>
    </form>`;
  document.body.append(dialog);

  const $ = (s) => dialog.querySelector(s);
  const form = $('.report-form');
  const textEl = form.elements.text;
  const emailEl = form.elements.email;
  const sendBtn = $('.report-send');
  const status = $('.report-status');
  const osmBox = $('.report-osm');
  const fallback = $('.report-fallback');
  let place = null; // { lat, lon, mode }, read once in open()
  let opener = null;
  let openedAt = 0;
  let thanksTimer = 0;
  let pending = null;
  let sent = false;

  const category = () => form.elements.category.value || '';
  const value = () => ({ city: cityId, category: category(), text: cleanReportText(textEl.value), lat: place.lat, lon: place.lon, mode: place.mode, lang: language });

  function setInvalid(el, errId, on) {
    if (on) el.setAttribute('aria-invalid', 'true');
    else el.removeAttribute('aria-invalid');
    $(`#${errId}`).hidden = !on;
  }
  function clearState() {
    status.textContent = '';
    fallback.hidden = true;
    setInvalid(textEl, 'report-text-err', false);
    setInvalid(emailEl, 'report-email-err', false);
    $('.report-cats').removeAttribute('aria-invalid');
  }
  // the category decides the OSM offer and the name hint
  function syncCategory() {
    const c = category();
    osmBox.hidden = !OSM_CATEGORIES.includes(c);
    $('.report-hint').hidden = c !== 'name';
  }
  function showFallback(lead) {
    $('.report-fallback-lead').hidden = !lead;
    $('.report-gh').href = githubIssueUrl(value());
    fallback.hidden = false;
  }

  form.addEventListener('change', (e) => {
    if (e.target.name === 'category') {
      $('.report-cats').removeAttribute('aria-invalid');
      syncCategory();
    }
  });
  textEl.addEventListener('input', () => setInvalid(textEl, 'report-text-err', false));
  emailEl.addEventListener('input', () => setInvalid(emailEl, 'report-email-err', false));
  // the OSM note opens in a new tab; the visitor's text goes to the
  // clipboard first (no await before the navigation; a failure is ignored)
  for (const a of dialog.querySelectorAll('.report-osm-link')) {
    a.addEventListener('click', () => {
      try {
        navigator.clipboard?.writeText(textEl.value).catch(() => {});
      } catch { /* no clipboard */ }
    });
  }
  $('.report-cancel').addEventListener('click', () => dialog.close());
  dialog.addEventListener('close', () => {
    clearTimeout(thanksTimer);
    if (sent) {
      // delivered: the next report starts empty (a failed one keeps its text)
      sent = false;
      form.reset();
    }
    pending?.abort();
    pending = null;
    // back to the button that opened it; the menu button sits in the tools
    // sheet, which closed on the click and takes no focus: then the menu toggle
    opener?.focus?.({ preventScroll: true });
    if (opener && document.activeElement !== opener) document.getElementById('tools-toggle')?.focus({ preventScroll: true });
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (pending || sent || !place) return;
    clearState();
    const elapsed = Math.round(performance.now() - openedAt);
    if (!category()) {
      $('.report-cats').setAttribute('aria-invalid', 'true');
      form.querySelector('input[name="category"]').focus();
      return;
    }
    const v = value();
    if ([...v.text].length < LIMITS.text[0]) {
      setInvalid(textEl, 'report-text-err', true);
      textEl.focus();
      return;
    }
    const body = { ...v, email: emailEl.value.trim(), x_note: form.elements.x_note.value, elapsed };
    const ctl = new AbortController();
    pending = ctl;
    const timer = setTimeout(() => ctl.abort(), TIMEOUT_MS);
    sendBtn.disabled = true;
    let code = 0;
    let reply = null;
    try {
      const r = await fetch('/api/report', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body), signal: ctl.signal });
      code = r.status;
      reply = await r.json().catch(() => null);
    } catch {
      code = 0; // network error, timeout or the dialog was closed
    } finally {
      clearTimeout(timer);
      sendBtn.disabled = false;
    }
    if (pending !== ctl) return; // closed meanwhile
    pending = null;
    if (code === 200 || code === 202) {
      status.textContent = t('Спасибо! Мы получили ваше сообщение.');
      sendBtn.disabled = true;
      sent = true;
      thanksTimer = setTimeout(() => dialog.close(), THANKS_MS);
      return;
    }
    if (code === 400 && reply?.field === 'text') {
      setInvalid(textEl, 'report-text-err', true);
      textEl.focus();
      return;
    }
    if (code === 400 && reply?.field === 'email') {
      setInvalid(emailEl, 'report-email-err', true);
      emailEl.focus();
      return;
    }
    if (code === 429) {
      status.textContent = t('Слишком много сообщений отсюда. Попробуйте через несколько минут.');
      showFallback(false);
      return;
    }
    showFallback(true); // 400 on a field the visitor cannot see, 403, 413, 5xx, network, timeout
  });

  function open(from) {
    if (dialog.open) return;
    opener = from || document.activeElement;
    const walk = getWalk();
    const mode = walk?.active ? 'walk' : 'map';
    const p = mode === 'walk' ? walk.position : getTarget();
    const ll = proj.unproject(p.x, p.z);
    // read once: the request, the OSM link and the GitHub link use this place
    place = { lat: round5(ll.lat), lon: round5(ll.lon), mode };
    for (const a of dialog.querySelectorAll('.report-osm-link')) a.href = osmNoteUrl(place.lat, place.lon);
    $('.report-place').textContent = t(mode === 'walk' ? 'Место: где стоит герой' : 'Место: центр экрана');
    $('.report-cross').hidden = mode === 'walk';
    clearState();
    sendBtn.disabled = false;
    syncCategory();
    // defensive: walk steers by pointer drag and uses no pointer lock today
    if (mode === 'walk') document.exitPointerLock?.();
    dialog.showModal();
    openedAt = performance.now();
  }

  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'tool';
  btn.id = 'report-open';
  btn.textContent = t('Исправить карту');
  mountTool(btn, 'share', { closes: true });
  btn.addEventListener('click', () => open(btn));

  return { open, dialog };
}
