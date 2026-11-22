# locales

## Overview

Translation data for the app. The source language of the app is Russian.
`ui.js` maps each Russian UI string to its Portuguese and English text.
`en.js` and `pt.js` hold the English and Portuguese landmark and route texts
for the Braga edition. All three files are data modules.
In `src/`, [`../i18n.js`](../i18n.js) is the only reader of `ui.js` and loads
`en.js` and `pt.js` on demand. [`../search.js`](../search.js) also imports
`en.js` and `pt.js` to search names in other languages. Node scripts in
`scripts/` import these files too (`make-og.mjs`, `route-pages.mjs`,
`quest.test.mjs`, `layers.test.mjs`), so the files must stay free of browser
APIs.

## Interface

- `ui.js` exports `messages`.
  - Key: the Russian source string.
  - Value: a two-element array `[pt, en]`.
  - 404 unique keys.
  - Placeholders in some strings: `{n}`, `{city}`, `{city_gen}`, `{city_prep}`,
    `{city_ins}`, `{op}`, `{size}`.
- `en.js` and `pt.js` each export `landmarks` and `routes`.
  - `landmarks[id] = { name, short, long, history, facts[], tip, gallery[],
    year?, panorama? }`. 30 ids, the same set in both files.
    - `year` is on all 30 entries in `pt.js` and on 19 of 30 in `en.js`.
    - `panorama = { caption }` is on 6 entries: `bom-jesus`, `se-braga`,
      `arco-porta-nova`, `praca-republica`, `estadio-braga`, `biscainhos`.
    - `facts` and `gallery` are arrays of strings.
  - `routes[id] = { name, subtitle, duration, description,
    stops[{ time, note }], legs[{ note }] }`. 3 ids in both files:
    `classic-day` (9 stops, 8 legs), `sacred` (6, 5), `two-days` (18, 17).
- File naming for other cities: `en.<city>.js` and `pt.<city>.js`.
  `[i18n.js:LOCALES]` matches them with `import.meta.glob('./locales/{en,pt}*.js')`.

## Invariants

- `[ui.js:messages]` Index 0 is Portuguese and index 1 is English.
  `[i18n.js:t]` reads them by index. Russian returns the key unchanged. A
  missing key returns the Russian source text.
- `[ui.js:messages]` The key must equal the Russian string in the code or in
  `index.html`, character for character. `[i18n.js:initLanguage]` matches
  trimmed DOM text against the keys.
- `[ui.js:messages]` This file does not fill placeholders. The caller does:
  `[city.js:cityT]` fills `{city}`, `{city_gen}`, `{city_prep}`, `{city_ins}`.
- `[ui.js:messages]` Five keys appear twice in the object literal: `Выйти`,
  `Выйти (Esc)`, `Обзор`, `м`, `км/ч`. JavaScript keeps the last entry. For
  `Обзор` the last entry changes the Portuguese text from `Vista` to
  `Visão geral`.
- `[en.js:landmarks]`, `[pt.js:landmarks]` Landmark ids must match the ids in
  the landmark data. `[i18n.js:localizeLandmarkFields]` lets a translation
  field win over the source field; a missing field falls back to the Russian
  `*_ru` source field.
- `[en.js:landmarks]`, `[pt.js:landmarks]` Values hold no Cyrillic text.
  `[i18n.js:localizeLandmark]` sets `textFallback` when a non-Russian language
  shows Cyrillic text, so Cyrillic in these files would raise that flag.
- `[en.js:routes]`, `[pt.js:routes]` `stops[i]` and `legs[i]` pair with the
  route data by index. `[i18n.js:localizeRoute]` reads `tr.stops[i]` and
  `tr.legs[i]`. Keep the order and the count equal to the route data.
- `[en.js:landmarks]` `gallery[i]` pairs with the gallery data by index.
- Values hold plain text, no HTML tags. `history` separates paragraphs with a
  blank line (`\n\n`).
- `[i18n.js:loadTranslations]` Only `en` and `pt` files load. Russian needs no
  file. Braga loads `<lang>.js`; another city loads `<lang>.<city>.js`.

## Side Effects

- `ui.js` and `pt.js`: None.
- `[en.js:landmarks]` Line 249 runs `delete landmarks[' theatro-circo']` at
  import. The key has a leading space and does not exist, so the statement
  removes nothing.

## Verification

- Run: `npm test`
- Run: `npm run verify`
