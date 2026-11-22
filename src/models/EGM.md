# models

## Overview

Procedural 3D landmark models. Each landmark module draws one landmark into a
`Kit` instance. `kit.js` holds the geometry vocabulary and merges all parts
into one `BufferGeometry`. `geom.js`, `metric.js`, `drape.js` and `parts.js`
are shared helpers. No file here touches the DOM, the network or storage.

The registry lives one level up in [`../models.js`](../models.js). It imports
every landmark module, calls the builder, and calls `k.build()`.
[`../fit.js`](../fit.js) places the result on the map at 1:1 scale.

## Interface

### Geometry kit (`kit.js`)

- `Kit(seed = 1)` - class. State: `parts`, `glassParts`, `rnd`, `stack`.
  Every drawing method returns `this`.
  - Transform stack: `push(o)`, `pop()`, `top()`.
  - Primitives: `add(geo, color, o)`, `box`, `cyl`, `cone`, `sphere`, `dome`,
    `ico`, `lathe`, `extrude`, `plane`, `frustum`, `prism(pts, y0, h, color, o)`,
    `segment(p0, p1, w, h, color, o)`, `wallLine(a, b, h, t, color, y0, o)`.
  - Building parts: `hipRoof`, `gableRoof`, `stairs`, `wall`, `arcade`, `gate`,
    `surround`, `cornice`, `corniceRing`, `balustrade`, `crenels`, `pinnacle`,
    `urn`, `statue`, `column`, `tree`, `lamp`.
  - Groups and metadata: `begin(name)`, `end(name)`, `piece(name, data)`,
    `endPiece()`, `marker(name, x, y, z, data)`.
  - `build(targetH)` - merges the parts and returns one `BufferGeometry`.
    `userData` carries `groups`, `glass`, `scale`, `pieces`, `markers` and
    `groundLine` (when the builder set `k.groundLine`).
- `PALETTE` - named linear albedo colours.
- `MAT` - surface ids `flat 0, ashlar 1, tile 2, render 3, azulejo 4, leaf 5,
  slate 6, water 7, smooth 8, metal 9, crown 10`.
- `PROFILES` - named lathe profiles as `[radius, y]` pairs.
- `mulberry32(seed)` - seeded random generator.
- `archPath`, `segArchPath`, `pointedPath`, `rectPath` - opening outlines.
- `triangleCount(geo)`, `corniceProfile(kind, s = 1)`.

### Plan geometry (`geom.js`)

- `TAU`, `bbox(pts)`, `area(pts)`, `centroid(pts)`, `inside(pts, x, z)`,
  `clean(pts, eps = 0.05)`, `edges(pts)`, `offset(pts, d)`,
  `rect(cx, cz, w, d, a = 0)`, `obb(pts, a = null)`, `mainAngle(pts)`,
  `along(line, t)`, `polyLength(line)`.

### Facades on real plans (`metric.js`)

- `onEdge(k, e, y = 0, out = 0)`, `polyCornice(k, pts, y, prof, color, o)`,
  `polyBand(k, pts, y, h, out, color)`, `polyWindows(k, pts, o)`,
  `roofOver(k, pts, y, rise, color, kind, o)`, `plainBuilding(k, pts, h, o)`.

### Draped ground and planting (`drape.js`)

- `clipRect(poly, x0, z0, x1, z1)`, `drapePoly(k, poly, ground, lift, color, o)`,
  `ribbon(k, line, w, ground, lift, color, o)`, `lowTree(k, x, y, z, h, o)`,
  `lowConifer(k, x, y, z, h, o)`.

### Architectural parts (`parts.js`)

- `win`, `pediment`, `segPediment`, `scrollCrest`, `cartouche`,
  `slopedParapet`, `volute`, `lobedFrame`, `shell`, `flutedColumn`, `flameUrn`,
  `tablet`, `bell`, `bellTower(k, o)`, `wallFountain`, `chapel`, `flatWindow`,
  `punchedWindows(k, pts, y0, o)`, `ribbonWindows(k, pts, y0, o)`.

### Landmark builders

Each module has one default export: `{ '<landmark-id>': builder }`. The builder
signature is `builder(k, { footprint, dims })`. It returns nothing; it draws
into `k`. Each builder function also carries `builder.metric = true` and
`builder.rule` (fit hints such as `base`, `pad`, `extent`, `frame`, `view`,
`front`, `snap`, `snapTo`, `heightRel`, `note`).

| File | Landmark id | Reads `dims` |
| --- | --- | --- |
| `arco.js` | `arco-porta-nova` | yes |
| `avenida.js` | `avenida-central` | yes |
| `biscainhos.js` | `biscainhos` | yes |
| `bomjesus.js` | `bom-jesus` | yes |
| `coimbras.js` | `coimbras` | no |
| `congregados.js` | `congregados` | no |
| `diogosousa.js` | `diogo-sousa` | no |
| `dmaria.js` | `dmaria-ii` | no |
| `estadio.js` | `estadio-braga` | yes |
| `fonteidolo.js` | `fonte-idolo` | yes |
| `forum.js` | `forum-braga` | yes |
| `frutuoso.js` | `sao-frutuoso` | no |
| `leonardo.js` | `leonardo-da-vinci` | yes |
| `maio.js` | `estadio-1-maio` | yes |
| `nogueira.js` | `nogueira-silva` | no |
| `parque.js` | `parque-ponte` | no |
| `populo.js` | `populo` | no |
| `praca.js` | `praca-republica` | yes |
| `raio.js` | `palacio-raio` | yes |
| `sameiro.js` | `sameiro` | yes |
| `santabarbara.js` | `santa-barbara` | yes |
| `santacruz.js` | `santa-cruz` | yes |
| `saomarcos.js` | `sao-marcos` | no |
| `se.js` | `se-braga` | yes |
| `termas.js` | `termas-romanas` | yes |
| `theatro.js` | `theatro-circo` | yes |
| `tibaes.js` | `tibaes` | yes |
| `torre.js` | `torre-menagem` | yes |
| `ucp.js` | `ucp-braga` | yes |
| `uminho.js` | `uminho-gualtar` | no |

- `leonardo.js` also has a named export: `buildLeonardo(k, { footprint, dims })`.
- `footprint` fields the builders read: `outline`, `box` (`w`, `d`, `z1`),
  `ground(x, z)`, `rawGround`, `parts`, `part(matcher)`, `partsOf(matcher)`.
- `dims` fields the builders read: `height_m.*` and `elements.*`.

### Other cities (`index.guimaraes.js`)

- `builders = {}` and `specs = {}` - empty registry for Guimarães.
  `../models.js:loadCityModels` imports `index.<cityId>.js` and registers both.

## Invariants

- `[kit.js:header]` Positions and normals are model space. `y = 0` is the
  ground line. The front faces `+z`.
- `[geom.js:header]` Plan points are `[x, z]` in metres. The origin is the
  centre of the outline box.
- `[kit.js:MAT]` Surface ids 0 to 10 are read by the detail shader in
  `../landmarks.js`. Do not renumber them.
- `[kit.js:mulberry32]` All jitter, tree choice and statue pose come from
  `Kit.rnd`. `[kit.js:Kit#add]` advances `rnd` once per opaque part, so call
  order changes the output. The same seed and the same call order give the
  same model.
- `[kit.js:Kit#build]` Without `targetH`, the geometry keeps authored units
  (metres for metric builders). With `targetH`, it scales so the top is at
  `targetH`.
- `[kit.js:Kit#add]` Glass parts (`o.glass`) keep only position and normal and
  go to `glassParts`.
- `[kit.js:Kit#piece]` Parts between `piece()` and `endPiece()` do not merge
  into the main geometry.
- `[metric.js:onEdge]` `onEdge` pushes a transform. The caller must call
  `k.pop()`.
- `[geom.js:area]` A positive area means counter-clockwise in the `(x, z)`
  plane. `[geom.js:edges]` normals point outward; edges shorter than 1e-6 are
  skipped.
- `[drape.js:header]` `ground(x, z)` returns metres relative to the base.
  `[drape.js:drapePoly]` default cell is 8 m; triangles wind with the normal up.
- `[parts.js:scrollCrest]` Mirror in shape space, never with a negative scale,
  so faces stay outward.
- `[<landmark>.js:<builder>.metric]` Every landmark builder sets
  `.metric = true`: 1:1 metres, `+z` is the front.
  `[index.guimaraes.js:header]` asks the same of new city builders.
- Builders give a default for each `dims` value they read, for example
  `[santacruz.js:santaCruz]` towers 25 m, `[sameiro.js:sameiro]` total 42 m,
  `[torre.js:torre]` total 31.3 m, `[theatro.js:theatro]` fly tower 28 m.
- Builders skip a piece when its OSM part is absent, for example
  `[se.js:seBraga]` cloister and chapels, `[frutuoso.js:frutuoso]` church and
  convent, `[saomarcos.js:saoMarcos]` hospital and wings,
  `[parque.js:parque]` lake, chapel, bandstand and amphitheatre.
- Builders match some parts by OSM id: `[uminho.js:uminho]` `w448580564`,
  `[saomarcos.js:saoMarcos]` `r17978905`, `r8340055`, `w146343003`,
  `[diogosousa.js:diogo]` `w108351556` and others. A change in the footprint
  data can drop these parts.
- `[torre.js:torre.rule]` The keep model is about 14 % over the OSM plan. The
  fit check fails at 15 %.
- `[parque.js:parque]` Caps: 235 trees, 70 lamps, 60 benches.

## Side Effects

- No network, storage, DOM, timer or listener code in this directory.
- Every builder writes into the `Kit` instance it receives: parts, the
  transform stack, named groups (`'main'`, `'mask'`, `'height'`, `'church'`)
  and the state of `k.rnd`.
- `[kit.js:Kit#add]` Mutates the geometry passed in and disposes it when it
  was indexed. `[kit.js:Kit#build]` disposes every source part geometry.
- `[kit.js:bakeSurface]` Rewrites the colour attribute and sets `aUv` on the
  merged geometry.
- `k.groundLine` is set by `[bomjesus.js:bomJesus]`,
  `[leonardo.js:buildLeonardo]`, `[parque.js:parque]`, `[ucp.js:ucp]` and
  `[uminho.js:uminho]`.
- `k.marker('fountain', ...)` is called by `[parts.js:wallFountain]`,
  `[avenida.js:avenida]`, `[biscainhos.js:biscainhos]`,
  `[bomjesus.js:stairFountain]`, `[praca.js:praca]`, `[se.js:seBraga]` and
  `[tibaes.js:fountain]`.
- `[parque.js:parque]` Sets `k.treeCount`.
- `[populo.js:populo]` Calls `console.warn` when garden details throw.
- Each landmark module sets `.metric` and `.rule` on its builder function at
  import time.

## Verification

- Run: `npm test`
- Run: `npm run verify`
- Model checks in `package.json`: `npm run check:models`, `npm run check:fit`,
  `npm run check:dimensions`
