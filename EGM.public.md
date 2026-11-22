# public

## Overview

`public/` holds the static files that ship at the site root. Its only source
file is `sw.js`, the Braga 3D service worker. The service worker lets the app
open offline after one visit. It serves pages and data network first, so a
fresh deploy wins. It serves hashed bundles, photos, models, and icons cache
first. It handles same-origin requests only.

The other entries (`icons/`, `og/`, `p/`, `route/`, `404.html`,
`manifest.webmanifest`, `robots.txt`, `sitemap.xml`, `favicon.ico`) are images,
generated HTML, and static metadata. They carry no code contract.

## Interface

`sw.js` exports no symbols. Its contract is the set of events it handles and
the constants that steer them.

- `sw.js:VERSION` - the cache name, now `'braga-v3'`. One cache holds all
  entries.
- `sw.js:SHELL` - the URLs cached at install: `./`, `./manifest.webmanifest`,
  `./icons/icon-192.png`, `./icons/icon-512.png`.
- `sw.js:CACHE_FIRST` - the pattern `/^\/(static|assets|icons)\//`. A path that
  matches is served cache first.
- `sw.js:install` listener - caches each `SHELL` URL with `cache: 'reload'`,
  then calls `self.skipWaiting()`.
- `sw.js:activate` listener - deletes every cache whose name is not `VERSION`,
  then calls `self.clients.claim()`.
- `sw.js:fetch` listener - routes each request:
  - `request.mode === 'navigate'` goes to `networkFirst(request, './')`.
  - A path that matches `CACHE_FIRST` goes to `cacheFirst(request)`.
  - Any other same-origin GET goes to `networkFirst(request)`.
- `sw.js:networkFirst(request, fallbackUrl)` - fetches from the network. On a
  network error it returns the cached match, then the match that ignores the
  query string, then the cached `fallbackUrl`. If none exists, it rethrows the
  error.
- `sw.js:cacheFirst(request)` - returns the cached match. On a miss it fetches
  from the network.

The registration lives outside this directory, in `src/share.js`
(`navigator.serviceWorker.register('./sw.js')`, production builds only).

## Invariants

- The `fetch` listener leaves a request to the browser when the method is not
  `GET` or the request has a `range` header (`sw.js:fetch`).
- The `fetch` listener leaves every cross-origin request to the browser
  (`url.origin !== self.location.origin`).
- The `fetch` listener never answers or caches a path that starts with `/api/`.
- `networkFirst` and `cacheFirst` store a response only when `res.ok` is true
  and `res.type === 'basic'`.
- One missing `SHELL` file does not stop the install: the `install` listener
  uses `Promise.allSettled`.
- Only the cache named `VERSION` survives activation. To drop all cached
  entries on the next deploy, change `VERSION`.
- `/og/` paths do not match `CACHE_FIRST`, so they stay network first.

## Side Effects

- Cache Storage: opens the cache `VERSION`, writes the `SHELL` entries at
  install, and writes each successful same-origin response at fetch time
  (`cache.put`).
- Cache Storage: deletes all caches with another name at activation
  (`caches.delete`).
- Network: fetches the `SHELL` URLs at install and forwards the handled
  requests with `fetch`.
- Worker lifecycle: `self.skipWaiting()` activates a new worker at once, and
  `self.clients.claim()` takes control of open pages.

## Verification

- Run: `npm test`
- Run: `npm run verify`

No unit test in `scripts/*.test.mjs` names `sw.js`. Treat these commands as the
repository gate, not as proof of the service worker's behaviour.
