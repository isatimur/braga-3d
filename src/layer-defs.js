// The optional map layers: what each one is, which files it fetches, and
// which device classes get it by default. No DOM here: the unit tests and
// scripts/layers-manifest.mjs import this file in Node. Ported from
// lisboa-3d (feat/layers-and-loading and its later fixes).
//
// The core (terrain, streets, the OSM buildings of the centre, landmarks,
// parks and the rivers, and the cafés and shops of pois.json, which the
// Discovery panel and the search read on every visit) always loads. Every
// layer below can be switched off: then its files are never requested.
// Sizes are not written here; they are measured from the built files by
// scripts/layers-manifest.mjs into <data_dir>/layers.json, which the Layers
// panel reads at run time.
//
//   files     paths under dist/ (a trailing /** means every file below)
//   chunks    hashed bundle chunks in dist/static, matched by name prefix
//   streamed  the bytes depend on where the camera goes: the size shown is
//             the most it can fetch (every tile)
//   liveExtra live updates from /api come on top and have no fixed size
//   fullOnly  only the Full preset has it (lisboa-3d: the photo textures).
//             Braga has no such layer, so its Standard is the same as Full
//             and the panel shows two presets (PRESET_ORDER below).

export const LAYERS = [
  {
    id: 'ring',
    name: 'Город вокруг центра',
    hint: 'Кварталы, улицы и вода за пределами центра, по мере движения камеры',
    files: ['data/tiles/**'],
    chunks: ['tile-worker'],
    streamed: true,
  },
  {
    id: 'ms',
    name: 'Дополнительные здания',
    hint: 'Дома из Microsoft Building Footprints там, где в OSM пусто',
    files: ['data/buildings-ms.json', 'data/tiles-ms/**'],
    streamed: true,
  },
  {
    id: 'street',
    name: 'Уровень улицы',
    hint: 'Калсада на площадях, фонари, люди, террасы кафе и вывески',
    // pois.json is core in Braga (Discovery and the search use it)
    files: ['data/streetscape.json'],
  },
  {
    id: 'live',
    name: 'Самолёты и автобусы',
    hint: 'Самолёты в реальном времени и автобусы TUB по расписанию',
    files: ['data/gtfs/**'],
    chunks: ['liveair', 'livebus'],
    liveExtra: true,
  },
];

export const LAYER_IDS = LAYERS.map((l) => l.id);

// Full is what the map loaded before layers existed: every layer. Standard
// is every layer but the fullOnly ones.
export const PRESETS = {
  light: [],
  standard: LAYERS.filter((l) => !l.fullOnly).map((l) => l.id),
  full: [...LAYER_IDS],
};
const samePreset = (a, b) => a.length === b.length && a.every((id) => b.includes(id));
// the presets the panel offers: one that equals Full is left out (it would
// be a second button for the same layers, and presetOf could never name Full)
export const PRESET_ORDER = ['light', 'standard', 'full'].filter((p) => p === 'full' || !samePreset(PRESETS[p], PRESETS.full));

// device class (perf-classes.js) -> default preset (the lisboa-3d rule)
export const CLASS_PRESET = { XL: 'full', L: 'full', M: 'standard', S: 'light', P: 'light' };

const fromList = (list) => Object.fromEntries(LAYER_IDS.map((id) => [id, list.includes(id)]));

export function presetLayers(preset) {
  return fromList(PRESETS[preset] || PRESETS.standard);
}

export function defaultsFor(cls) {
  return presetLayers(CLASS_PRESET[cls] || 'standard');
}

// 'light' | 'standard' | 'full' | 'custom' (only the presets of PRESET_ORDER)
export function presetOf(layers) {
  for (const p of PRESET_ORDER) {
    const want = PRESETS[p];
    if (LAYER_IDS.every((id) => !!layers?.[id] === want.includes(id))) return p;
  }
  return 'custom';
}

// The saved record (localStorage) is { v: 1, layers: { id: bool } }. It is
// merged over the class defaults: a layer added later gets its default.
export function resolveSelection(savedText, cls) {
  const layers = defaultsFor(cls);
  let saved = null;
  try {
    saved = savedText ? JSON.parse(savedText) : null;
  } catch {
    saved = null;
  }
  const rec = saved && typeof saved === 'object' && !Array.isArray(saved) && saved.layers && typeof saved.layers === 'object' ? saved.layers : null;
  let used = false;
  if (rec) {
    for (const id of LAYER_IDS) {
      if (typeof rec[id] === 'boolean') {
        layers[id] = rec[id];
        used = true;
      }
    }
  }
  return { layers, source: used ? 'saved' : 'default' };
}

export const serializeSelection = (layers) => JSON.stringify({ v: 1, layers: fromList(LAYER_IDS.filter((id) => layers[id])) });

// ?layers=light|standard|full or ?layers=ring,street (tests, measurements)
export function urlSelection(search) {
  const v = new URLSearchParams(search || '').get('layers');
  if (v == null) return null;
  if (PRESETS[v]) return presetLayers(v);
  const list = v.split(',').map((s) => s.trim());
  if (v !== 'none' && !list.some((id) => LAYER_IDS.includes(id))) return null;
  return fromList(list);
}

// The measured bytes of a selection. A switched-on layer the manifest does
// not list makes the total unknown (shown as such, never as 0).
export function selectionBytes(layers, manifest) {
  let bytes = 0;
  let unknown = false;
  for (const id of LAYER_IDS) {
    if (!layers?.[id]) continue;
    const b = manifest?.layers?.[id]?.bytes;
    if (Number.isFinite(b)) bytes += b;
    else unknown = true;
  }
  return { bytes, unknown };
}

// 8.4 MB / 8,4 MB / 8,4 МБ; under 1 MB in whole KB. Decimal units (1 MB =
// 1,000,000 bytes), as browsers and phone settings show download sizes.
export function formatMB(bytes, lang = 'en') {
  if (!Number.isFinite(bytes)) return '?';
  const ru = lang === 'ru';
  const comma = lang === 'pt' || ru;
  if (bytes < 1e6) return `${Math.round(bytes / 1e3)} ${ru ? 'КБ' : 'KB'}`;
  const n = (bytes / 1e6).toFixed(1);
  return `${comma ? n.replace('.', ',') : n} ${ru ? 'МБ' : 'MB'}`;
}
