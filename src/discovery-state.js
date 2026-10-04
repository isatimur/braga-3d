// DOM-free helpers: one daily pick per Lisbon calendar day, local bookmarks.
export function dailyPlace(places, date = new Date(), timezone = 'Europe/Lisbon') {
  if (!places.length) return null;
  const day = new Intl.DateTimeFormat('en-CA', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);
  let hash = 0;
  for (const c of day) hash = (hash * 31 + c.charCodeAt(0)) >>> 0;
  return places[hash % places.length];
}

export function readSaved(storage, key, validIds) {
  try {
    const value = JSON.parse(storage.getItem(key) || '[]');
    return new Set(Array.isArray(value) ? value.filter(id => validIds.has(id)) : []);
  } catch { return new Set(); }
}

export function osmLink(poi) {
  const m = /^([nwr])(\d+)$/.exec(poi.id);
  return m ? `https://www.openstreetmap.org/${{ n: 'node', w: 'way', r: 'relation' }[m[1]]}/${m[2]}` : 'https://www.openstreetmap.org/';
}

export function walkingLink(place) {
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(`${place.lat},${place.lon}`)}&travelmode=walking`;
}
