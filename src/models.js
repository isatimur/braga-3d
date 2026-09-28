// Procedural landmark models. DOM-free: node can import this file.
//
// buildModel(type, landmarkId, site) returns one merged, non-indexed
// BufferGeometry per landmark (attributes: position, normal, color, aEmit,
// aMat, aUv) plus userData.glass for transparent panes.
//
// Metric builders (builder.metric = true) draw at 1:1 in metres:
//   origin = centre of the OSM outline's box, y = 0 = the base (terrain
//   level at the site, see fit.js), local +z = the main front (the façade
//   faces +z), +x to the right of a viewer looking at that front.
// site = { footprint, dims }:
//   footprint: the OSM outline and parts already in this frame (fit.js
//     siteFrame()), with ground(x, z) = the visible terrain in metres
//     relative to the base, for sites that climb a slope;
//   dims: the record of data/dimensions.json for this landmark.
// A builder without .metric would be scaled uniformly by fit.js (legacy
// path, reported as LEGACY by scripts/check-fit.mjs); all 16 are metric.
import { Kit, PALETTE, MAT, triangleCount } from './models/kit.js';
// one file per landmark: { [id]: builder }, builder.metric = true
import bomJesus from './models/bomjesus.js';
import sameiro from './models/sameiro.js';
import se from './models/se.js';
import santaCruz from './models/santacruz.js';
import tibaes from './models/tibaes.js';
import arco from './models/arco.js';
import torre from './models/torre.js';
import raio from './models/raio.js';
import theatro from './models/theatro.js';
import biscainhos from './models/biscainhos.js';
import praca from './models/praca.js';
import avenida from './models/avenida.js';
import santaBarbara from './models/santabarbara.js';
import estadio from './models/estadio.js';
import termas from './models/termas.js';
import fonteIdolo from './models/fonteidolo.js';

const METRIC = { ...bomJesus, ...sameiro, ...se, ...santaCruz, ...tibaes, ...arco, ...torre, ...raio, ...theatro, ...biscainhos, ...praca, ...avenida, ...santaBarbara, ...estadio, ...termas, ...fonteIdolo };

export { PALETTE, MAT, triangleCount };

// Per landmark: model type, legacy target height (world units, used by the
// legacy path only), yaw (radians, legacy) and optional view: the bearing
// offset (radians, relative to the front) the camera prefers.
export const LANDMARK_SPECS = {
  'bom-jesus': { type: 'stairs-hill', h: 120, yaw: -Math.PI / 2 },
  sameiro: { type: 'basilica', h: 160, yaw: -1.2 },
  'se-braga': { type: 'cathedral', h: 68, yaw: -1.35 },
  'arco-porta-nova': { type: 'arch', h: 56, yaw: Math.PI / 2 },
  'santa-barbara': { type: 'garden', h: 44, yaw: Math.PI / 2 },
  'praca-republica': { type: 'plaza', h: 50, yaw: Math.PI / 2 },
  'theatro-circo': { type: 'theatre', h: 42, yaw: 1.35 },
  'palacio-raio': { type: 'palace', h: 36, yaw: 0.35 },
  'torre-menagem': { type: 'tower', h: 72, yaw: 0.2 },
  'santa-cruz': { type: 'church', h: 64, yaw: -1.25 },
  'estadio-braga': { type: 'stadium', h: 48, yaw: 0 },
  'termas-romanas': { type: 'ruins', h: 31, yaw: 0.3 },
  'fonte-idolo': { type: 'fountain', h: 10, yaw: 0.35 },
  tibaes: { type: 'monastery', h: 112, yaw: 0 },
  biscainhos: { type: 'museum', h: 40, yaw: 1.06 },
  'avenida-central': { type: 'avenue', h: 44, yaw: Math.PI / 2 },
};

const BUILDERS = METRIC;

// Model type -> the landmark whose builder stands in for that type.
const TYPE_DEFAULT = Object.fromEntries(Object.entries(LANDMARK_SPECS).map(([id, s]) => [s.type, id]));

export const MODEL_TYPES = Object.keys(TYPE_DEFAULT);

function resolve(type, landmarkId) {
  if (landmarkId && BUILDERS[landmarkId]) return landmarkId;
  if (TYPE_DEFAULT[type]) return TYPE_DEFAULT[type];
  return 'santa-cruz';
}

export function specFor(landmarkId, type) {
  return LANDMARK_SPECS[landmarkId] ?? LANDMARK_SPECS[resolve(type, landmarkId)] ?? { h: 50, yaw: 0 };
}

export function isMetric(type, landmarkId) {
  return !!BUILDERS[resolve(type, landmarkId)].metric;
}

// Fit rules a builder carries with it (builder.rule, see fit.js FIT_RULES).
export function builderRule(type, landmarkId) {
  return BUILDERS[resolve(type, landmarkId)].rule || {};
}

function hash(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

// site: { footprint, dims } (metric builders); legacy builders ignore it.
export function buildModel(type, landmarkId, site = null) {
  const id = resolve(type, landmarkId);
  const spec = LANDMARK_SPECS[id];
  const fn = BUILDERS[id];
  const k = new Kit(hash(id));
  let g;
  if (fn.metric) {
    fn(k, site);
    g = k.build();
    g.userData.metric = true;
  } else {
    fn(k);
    g = k.build(spec.h);
  }
  g.userData.type = spec.type;
  g.userData.builder = id;
  return g;
}
