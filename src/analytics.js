// The analytics provider behind the product events (events.js).
//
// One provider today: Vercel Web Analytics. It sets no cookie and stores no
// identifier on the device. It is attached only when the city config says so
// (cities/<id>.json: "analytics": "vercel") and the page is not on a local
// host, so tests and previews send nothing.
//
// attachAnalytics() is safe to call once at boot. It forwards every
// 'p3d:event' as a custom event with the same name and the non-null keys of
// its detail. Page views are counted by the provider's own script.
import { EVENT } from './events.js';

const LOCAL = /^(localhost|127\.0\.0\.1|\[::1\])$|\.localhost$|\.test$/;

export function analyticsOn(provider, hostname) {
  return provider === 'vercel' && !LOCAL.test(String(hostname || ''));
}

// Keys with a value only: the provider rejects nested objects and null adds nothing.
export function eventData(detail) {
  const out = {};
  for (const [k, v] of Object.entries(detail || {})) {
    if (k !== 'name' && v != null) out[k] = v;
  }
  return out;
}

export function attachAnalytics(provider, win = window) {
  if (!analyticsOn(provider, win.location.hostname)) return false;
  // the provider's documented queue: calls made before its script loads are kept
  win.va = win.va || function va(...args) {
    (win.vaq = win.vaq || []).push(args);
  };
  const script = win.document.createElement('script');
  script.defer = true;
  script.src = '/_vercel/insights/script.js';
  win.document.head.append(script);
  win.addEventListener(EVENT, (e) => win.va('event', { name: e.detail.name, data: eventData(e.detail) }));
  return true;
}
