// Historical eras for the place list (ui.js) and the map pins (landmarks.js).
//
// An era here is a span of dates and nothing more: no style, no judgement.
// erasOf() reads the dates a place already states in its `year` field
// (data/landmarks.json, the Russian source text: years in digits, centuries
// in Roman numerals) and returns every era that span touches. A place built
// over several centuries is in several eras. A text with no date gives [].
//
// The names are plain date ranges on purpose. "Baroque" or "Renaissance" are
// claims about style and need a source per place; a century does not.
export const ERAS = [
  { id: 'roman', from: -Infinity, to: 500, name: 'Римская эпоха' },
  { id: 'medieval', from: 501, to: 1500, name: 'Средние века' },
  { id: 'early-modern', from: 1501, to: 1800, name: 'XVI–XVIII века' },
  { id: 'modern', from: 1801, to: Infinity, name: 'XIX век и позже' },
];

const ROMAN = { I: 1, V: 5, X: 10 };

// 'XIV' -> 14; 0 for a token that is not a well-formed numeral up to XXX
function century(token) {
  let n = 0;
  for (let i = 0; i < token.length; i++) {
    const v = ROMAN[token[i]];
    const next = ROMAN[token[i + 1]] || 0;
    n += v < next ? -v : v;
  }
  return n >= 1 && n <= 30 ? n : 0;
}

// The first and last year the text names, or null: 'XIV–XVIII века' ->
// [1301, 1800], '1918, 2007' -> [1918, 2007], 'I век н. э.' -> [1, 100].
export function yearSpan(text) {
  let lo = Infinity;
  let hi = -Infinity;
  const str = String(text ?? '');
  for (const m of str.matchAll(/\d{3,4}/g)) {
    const y = Number(m[0]);
    lo = Math.min(lo, y);
    hi = Math.max(hi, y);
  }
  for (const m of str.matchAll(/(?<![A-Za-z])[IVX]+(?![A-Za-z])/g)) {
    const c = century(m[0]);
    if (!c) continue;
    lo = Math.min(lo, (c - 1) * 100 + 1);
    hi = Math.max(hi, c * 100);
  }
  return lo <= hi ? [lo, hi] : null;
}

// Era ids in ERAS order.
export function erasOf(text) {
  const span = yearSpan(text);
  if (!span) return [];
  return ERAS.filter((e) => span[0] <= e.to && span[1] >= e.from).map((e) => e.id);
}
