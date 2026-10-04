import { language, locale } from './i18n.js';
import { CITY } from './city.js';
import { assetUrl } from './data.js';
import { dailyPlace, readSaved, osmLink, walkingLink } from './discovery-state.js';

const COPY = {
  en: {
    discover: 'Discover', daily: 'A different place every day', explore: 'Explore in 3D', save: 'Save place', saved: 'Saved', remove: 'Remove', walk: 'Walk here ↗',
    intro: 'Make the city part of your day.', places: 'Your places', empty: 'Save a place to build your own city shortlist.', local: 'Saved on this device. No account needed.',
    storage: 'Storage is unavailable. Your list will last for this visit.', nearby: 'Around', cafes: 'Coffee & food', useful: 'Useful stops', loading: 'Loading…',
    noPois: 'No mapped stops within 1 km. Try another landmark.', poiError: 'Nearby places are unavailable right now.', osm: 'OpenStreetMap contributors', updated: 'Data collected',
    hours: 'Listed hours', unknown: 'Hours not listed', hoursNote: 'Hours are community data. Confirm with the venue before visiting.', map: 'Show on map',
    news: 'Braga in the news', newsNote: 'Original Portuguese headlines · O MINHO', newsEmpty: 'No recent Braga headlines in this feed.', newsError: 'News is temporarily unavailable.',
    checked: 'Feed checked', read: 'Read at source ↗', mentioned: 'Place mentioned', retry: 'Try again', source: 'Visit O MINHO ↗',
    agenda: 'Plan a night out', agendaText: 'Concerts, theatre and family events at Theatro Circo.', programme: 'Official programme ↗',
    share: 'Share place', copied: 'Place link copied', copy: 'Copy this place link', close: 'Close', details: 'OSM details ↗',
  },
  pt: {
    discover: 'Descobrir', daily: 'Um lugar diferente todos os dias', explore: 'Explorar em 3D', save: 'Guardar local', saved: 'Guardados', remove: 'Remover', walk: 'Ir a pé ↗',
    intro: 'Faça da cidade parte do seu dia.', places: 'Os seus locais', empty: 'Guarde locais para criar a sua lista pessoal da cidade.', local: 'Guardado neste dispositivo. Sem conta.',
    storage: 'Armazenamento indisponível. A lista dura apenas esta visita.', nearby: 'Perto de', cafes: 'Comer e beber', useful: 'Serviços úteis', loading: 'A carregar…',
    noPois: 'Sem locais mapeados a menos de 1 km. Experimente outro monumento.', poiError: 'Os locais próximos estão indisponíveis.', osm: 'Colaboradores do OpenStreetMap', updated: 'Dados recolhidos',
    hours: 'Horário indicado', unknown: 'Horário não indicado', hoursNote: 'Os horários são dados comunitários. Confirme com o local antes de visitar.', map: 'Ver no mapa',
    news: 'Braga nas notícias', newsNote: 'Títulos originais em português · O MINHO', newsEmpty: 'Sem notícias recentes de Braga neste feed.', newsError: 'Notícias temporariamente indisponíveis.',
    checked: 'Feed consultado', read: 'Ler na fonte ↗', mentioned: 'Local mencionado', retry: 'Tentar novamente', source: 'Visitar O MINHO ↗',
    agenda: 'Planeie uma saída', agendaText: 'Concertos, teatro e eventos para famílias no Theatro Circo.', programme: 'Programa oficial ↗',
    share: 'Partilhar local', copied: 'Ligação copiada', copy: 'Copie a ligação do local', close: 'Fechar', details: 'Detalhes no OSM ↗',
  },
  ru: {
    discover: 'Открытия', daily: 'Новое место каждый день', explore: 'Посмотреть в 3D', save: 'Сохранить', saved: 'Сохранено', remove: 'Удалить', walk: 'Дойти пешком ↗',
    intro: 'Пусть город станет частью вашего дня.', places: 'Ваши места', empty: 'Сохраняйте места, чтобы составить свой список прогулок.', local: 'Сохранено на этом устройстве. Без регистрации.',
    storage: 'Хранилище недоступно. Список останется до конца посещения.', nearby: 'Рядом с', cafes: 'Еда и кофе', useful: 'Полезные места', loading: 'Загрузка…',
    noPois: 'В пределах 1 км нет отмеченных мест. Выберите другой ориентир.', poiError: 'Ближайшие места сейчас недоступны.', osm: 'Участники OpenStreetMap', updated: 'Данные собраны',
    hours: 'Указанные часы', unknown: 'Часы не указаны', hoursNote: 'Часы указаны сообществом. Уточните их перед посещением.', map: 'На карте',
    news: 'Брага в новостях', newsNote: 'Оригинальные заголовки на португальском · O MINHO', newsEmpty: 'В ленте нет свежих новостей Браги.', newsError: 'Новости временно недоступны.',
    checked: 'Лента проверена', read: 'Читать источник ↗', mentioned: 'Упомянутое место', retry: 'Попробовать снова', source: 'Открыть O MINHO ↗',
    agenda: 'Планы на вечер', agendaText: 'Концерты, театр и семейные события в Theatro Circo.', programme: 'Официальная афиша ↗',
    share: 'Поделиться', copied: 'Ссылка скопирована', copy: 'Скопируйте ссылку на место', close: 'Закрыть', details: 'Подробнее в OSM ↗',
  },
};
const KINDS = {
  cafe: ['Café', 'Café', 'Кафе'], restaurant: ['Restaurant', 'Restaurante', 'Ресторан'], bakery: ['Bakery', 'Padaria', 'Пекарня'],
  pastry: ['Pastry shop', 'Pastelaria', 'Кондитерская'], pharmacy: ['Pharmacy', 'Farmácia', 'Аптека'],
  toilets: ['Toilets', 'WC', 'Туалет'], atm: ['ATM', 'Multibanco', 'Банкомат'], information: ['Tourist information', 'Informação turística', 'Туристическая информация'],
  supermarket: ['Supermarket', 'Supermercado', 'Супермаркет'],
};
const kindName = kind => KINDS[kind]?.[{ en: 0, pt: 1, ru: 2 }[language]] || kind;
const el = (tag, className, text) => {
  const node = document.createElement(tag);
  node.className = className;
  if (text) node.textContent = text;
  return node;
};
const button = (text, action, className = 'discover-button') => {
  const b = el('button', className, text);
  b.type = 'button'; b.addEventListener('click', action); return b;
};
const link = (text, url) => {
  const a = el('a', 'discover-link', text);
  a.href = url; a.target = '_blank'; a.rel = 'noopener noreferrer'; return a;
};

export function createDiscovery({ landmarks, pois, onPlace, onPoi, toast }) {
  const root = document.getElementById('view-discover');
  const tab = document.getElementById('tab-discover');
  const c = COPY[language];
  tab.textContent = c.discover;
  const byId = new Map(landmarks.map((p, i) => [p.id, { ...p, index: i }]));
  const key = `${CITY.id}-saved-places-v1`;
  let storage = null;
  try { storage = localStorage; } catch { /* private browser */ }
  let saved = readSaved(storage, key, new Set(byId.keys()));
  let canPersist = !!storage;
  let selected = null;
  let category = 'cafes';
  let newsAt = 0;
  let loadingNews = false;
  const daily = dailyPlace([...byId.values()], new Date(), CITY.timezone);
  if (!daily) { tab.hidden = true; return { select() {} }; }
  root.classList.add('discover');
  root.append(el('p', 'discover-intro', c.intro));
  const hero = el('section', 'discover-hero');
  if (daily.image) {
    const img = el('img', 'discover-photo'); img.src = assetUrl(daily.image); img.alt = ''; img.loading = 'lazy';
    img.addEventListener('error', () => { img.hidden = true; }); hero.append(img);
  }
  const heroBody = el('div', 'discover-hero-body');
  heroBody.append(el('p', 'discover-eyebrow', c.daily), el('h2', 'discover-title', daily.name), el('p', 'discover-description', daily.short));
  const heroActions = el('div', 'discover-actions');
  const saveButtons = [];
  function saveButton(place) {
    const b = button('', () => toggleSaved(place.id));
    saveButtons.push({ b, id: place.id }); return b;
  }
  heroActions.append(button(c.explore, () => onPlace(daily.index), 'discover-button is-primary'), saveButton(daily));
  heroBody.append(heroActions, link(c.walk, walkingLink(daily)));
  if (daily.image_credit?.source_url) {
    const credit = el('p', 'discover-credit');
    credit.append(link(`${daily.image_credit.author} · ${daily.image_credit.license}`, daily.image_credit.source_url));
    heroBody.append(credit);
  }
  hero.append(heroBody); root.append(hero);

  const savedSection = el('section', 'discover-section');
  savedSection.append(el('h2', 'discover-heading', c.places));
  const savedList = el('ul', 'discover-saved');
  const storageNote = el('p', 'discover-note');
  savedSection.append(savedList, storageNote); root.append(savedSection);
  function renderSaved() {
    savedList.replaceChildren();
    if (!saved.size) savedList.append(el('li', 'discover-note', c.empty));
    for (const id of saved) {
      const p = byId.get(id);
      const row = el('li', 'discover-saved-row');
      const remove = button('×', () => { toggleSaved(id); document.getElementById('tab-discover').focus(); }, 'discover-remove');
      remove.setAttribute('aria-label', `${c.remove}: ${p.name}`);
      row.append(button(p.name, () => onPlace(p.index), 'discover-text-button'), remove); savedList.append(row);
    }
    storageNote.textContent = canPersist ? c.local : c.storage;
    for (const { b, id } of saveButtons) {
      b.textContent = saved.has(id) ? `★ ${c.saved}` : `☆ ${c.save}`;
      b.setAttribute('aria-pressed', String(saved.has(id)));
    }
    updateCardButtons();
  }
  function toggleSaved(id) {
    if (saved.has(id)) saved.delete(id); else saved.add(id);
    try { storage.setItem(key, JSON.stringify([...saved])); canPersist = true; } catch { canPersist = false; }
    renderSaved();
  }
  const cardButtons = ['#callout .callout-acts', '#detail .detail-head'].map(selector => {
    const group = el('div', 'discover-card-actions');
    const b = button('', () => selected && toggleSaved(selected.id));
    group.append(b, button(c.share, () => selected && sharePlace(selected)));
    document.querySelector(selector)?.append(group);
    return b;
  });
  function updateCardButtons() {
    for (const b of cardButtons) {
      b.textContent = selected && saved.has(selected.id) ? `★ ${c.saved}` : `☆ ${c.save}`;
      b.setAttribute('aria-pressed', String(!!selected && saved.has(selected.id)));
      b.disabled = !selected;
    }
  }
  async function sharePlace(p) {
    const url = new URL(CITY.domain || location.origin);
    url.searchParams.set('lang', language); url.hash = `place=${p.id}`;
    try {
      if (navigator.share) { await navigator.share({ title: p.name, url: url.href }); return; }
      await navigator.clipboard.writeText(url.href); toast(c.copied);
    } catch (err) {
      if (err.name === 'AbortError') return;
      const dialog = el('dialog', 'discover-share-dialog');
      dialog.setAttribute('aria-label', c.copy);
      const input = el('input', 'discover-share-url'); input.value = url.href; input.readOnly = true; input.setAttribute('aria-label', c.copy);
      dialog.append(el('p', '', c.copy), input, button(c.close, () => dialog.close()));
      dialog.addEventListener('close', () => dialog.remove()); document.body.append(dialog); dialog.showModal(); input.select();
    }
  }

  const nearby = el('section', 'discover-section');
  const nearTitle = el('h2', 'discover-heading');
  const filters = el('div', 'discover-filters');
  for (const value of ['cafes', 'useful']) {
    const b = button(c[value], () => { category = value; renderNearby(); }, 'discover-filter');
    b.dataset.kind = value; filters.append(b);
  }
  const nearList = el('ul', 'discover-nearby');
  const provenance = el('p', 'discover-note');
  nearby.append(nearTitle, filters, nearList, el('p', 'discover-note', c.hoursNote), provenance);
  root.append(nearby);
  function renderNearby() {
    const anchor = selected || daily;
    nearTitle.textContent = `${c.nearby} ${anchor.name}`;
    for (const b of filters.children) b.setAttribute('aria-pressed', String(b.dataset.kind === category));
    nearList.replaceChildren();
    if (!pois.loaded) { nearList.append(el('li', 'discover-note', c.loading)); return; }
    if (pois.error) { nearList.append(el('li', 'discover-note', c.poiError)); return; }
    const kinds = category === 'cafes' ? ['cafe', 'restaurant', 'bakery', 'pastry'] : ['pharmacy', 'toilets', 'atm', 'information', 'supermarket'];
    const list = pois.near(anchor.lat, anchor.lon, 1000, { kind: kinds, limit: 4 });
    if (!list.length) nearList.append(el('li', 'discover-note', c.noPois));
    for (const p of list) {
      const row = el('li', 'discover-poi');
      const name = p.name || kindName(p.kind);
      row.append(el('h3', 'discover-poi-name', name), el('p', 'discover-note', kindName(p.kind)));
      row.append(el('p', 'discover-hours', p.opening_hours ? `${c.hours}: ${p.opening_hours}` : c.unknown));
      const actions = el('div', 'discover-actions');
      actions.append(button(c.map, () => onPoi(p)), link(c.walk, walkingLink(p)), link(c.details, osmLink(p)));
      row.append(actions); nearList.append(row);
    }
    provenance.replaceChildren(link(`© ${c.osm}`, 'https://www.openstreetmap.org/copyright'));
    if (pois.fetched) provenance.append(document.createTextNode(` · ${c.updated} ${new Date(pois.fetched).toLocaleDateString(locale)}`));
  }
  pois.ready.then(renderNearby);

  const newsSection = el('section', 'discover-section');
  const newsList = el('ul', 'discover-news');
  const newsStatus = el('p', 'discover-note', c.loading); newsStatus.setAttribute('role', 'status');
  const retry = button(c.retry, () => loadHeadlines(true)); retry.hidden = true;
  if (CITY.id === 'braga') {
    const agenda = el('section', 'discover-section discover-agenda');
    agenda.append(el('h2', 'discover-heading', c.agenda), el('p', 'discover-description', c.agendaText), link(c.programme, 'https://theatrocirco.com/programa/'));
    root.append(agenda);
    newsSection.append(el('h2', 'discover-heading', c.news), el('p', 'discover-note', c.newsNote), newsList, newsStatus, retry, link(c.source, 'https://ominho.pt/'));
    root.append(newsSection);
  }
  async function loadHeadlines(force = false) {
    if (CITY.id !== 'braga' || loadingNews || (!force && Date.now() - newsAt < 900000)) return;
    loadingNews = true; newsStatus.textContent = c.loading; retry.hidden = true;
    try {
      const res = await fetch(`${import.meta.env.BASE_URL}api/news?city=braga`, { signal: AbortSignal.timeout(10000) });
      if (!res.ok) throw new Error('unavailable');
      const data = await res.json();
      const checked = Date.parse(data.checkedAt);
      if (!Array.isArray(data.items) || !Number.isFinite(checked) || Date.now() - checked > 3600000) throw new Error('stale');
      newsList.replaceChildren();
      for (const item of data.items) {
        const url = new URL(item.url);
        if (url.protocol !== 'https:' || url.hostname !== 'ominho.pt') continue;
        const row = el('li', 'discover-news-item');
        const title = link(item.title, url.href); title.lang = 'pt';
        const date = el('time', 'discover-note', new Date(item.publishedAt).toLocaleDateString(locale, { day: 'numeric', month: 'short' }));
        date.dateTime = item.publishedAt;
        row.append(date, title);
        if (byId.has(item.placeId)) {
          const place = byId.get(item.placeId);
          row.append(button(`${c.mentioned}: ${place.name}`, () => onPlace(place.index), 'discover-text-button'));
        }
        newsList.append(row);
      }
      newsStatus.textContent = data.items.length ? `${c.checked} ${new Date(checked).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })}` : c.newsEmpty;
      newsAt = Date.now();
    } catch {
      newsList.replaceChildren(); newsStatus.textContent = c.newsError; retry.hidden = false;
    } finally { loadingNews = false; }
  }
  window.addEventListener('braga:view', e => {
    if (e.detail === 'discover') { renderNearby(); loadHeadlines(); }
  });
  window.addEventListener('storage', e => {
    if (e.key === key || e.key === null) { saved = readSaved(storage, key, new Set(byId.keys())); renderSaved(); }
  });
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden && !root.hidden) { renderNearby(); loadHeadlines(); }
  });
  renderSaved(); renderNearby();
  return {
    select(index) { selected = byId.get(landmarks[index]?.id) || null; updateCardButtons(); renderNearby(); },
  };
}
