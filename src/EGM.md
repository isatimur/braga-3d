# src

## Overview

Browser source of the Braga 3D city map: a Vite app on Three.js, written as ES
modules. `main.js` is the entry point. It loads the city config and data,
builds the scene in stages, wires the UI and the guided modes, and runs the
render loop. Each other module builds one layer or one feature and returns a
plain object API. Most layers have an `update(dt, ...)` method that `main.js`
calls each frame; they own no timer of their own.

Modules marked "pure" below run in Node too. The unit tests and check scripts
in `scripts/` import them.

## Interface

### Subdirectories

- [models](./models/EGM.md) - procedural landmark builders, the `Kit` geometry
  class and plan helpers. `models.js` is the registry for them.
- [locales](./locales/EGM.md) - UI string table and English and Portuguese
  landmark and route texts. `i18n.js` reads them.

### Entry point and boot

- `main.js` - no exports. Boot order: `initLanguage()`, `initPerf()`,
  `window.__braga` debug object, `loadCity()`, `applyCityShell()`,
  `loadCityModels(city.id)`, then `start()`. `start()` runs: loader, WebGL 2
  check, `createLayers`, `installPois`, `loadData`, `setLifeData`,
  `setTrafficAxes`, `createProjection`, `installAtmosphereFog`,
  `createRenderer`, `createAtmosphere`, `createGround`, boot view and intro,
  the `fitLandmark` loop, terrain pads, `buildRoads`, `buildBuildings`,
  `buildLandmarks`, `createRouteLayer`, `createEffects`, `createCameraRig`,
  `createUI`, `createSearch`, `createDiscovery`, `createPanorama`,
  `createSkyline`, `createCinema`, `createFlyKeys`, `createInstruments`,
  `createLayersUI`, first frame, then deferred layers (nature, life, seasons,
  `perf.start`), `applyHash()`, `installShare`.
  - URL query it reads: `?reduced`, `?intro=1|hold|0`, `?fx=1|0`, `?guide=1`.
  - URL hash it reads: `#quest`, `#quest=<id>`, `#route=<id>`, `#place=<id>`,
    `#cinema`, `#story`, `#game`, `#walk`, `#time=<name>`, `#weather=`,
    `#live=`, `#season=`.
  - Lazy chunks: `quest.js`, `story.js`, `game.js`, `walk.js`, `guide.js`.
- `city.js` - `resolveCityId`, `CITY_ID`, `CITY`, `loadCity(id)`,
  `dataPath(file)`, `cityName`, `cityT`, `cityQuery`, `applyCityShell`.
- `data.js` - `assetUrl(path)`, `loadStory()`, `loadData(onStep)` returns
  `{ landmarks, roads, routes, status, life, trafficAxes, terrain, footprints,
  buildings, nature }`.
- `i18n.js` - `supportedLanguages`, `resolveLanguage`, `language`, `locale`,
  `t(source)`, `initLanguage()`, `loadTranslations(lang, city)`,
  `localizeLandmark`, `localizeRoute`, `localizeRecord`.
- `placeholder-data.js` (pure data) - `PLACEHOLDER_LANDMARKS`,
  `PLACEHOLDER_ENRICH`, `PLACEHOLDER_ROUTES`, `PLACEHOLDER_ROADS`.
- `back-to-globe.js` - `backLink(search, cityId, lang)`,
  `mountBackToGlobe(doc, search, cityId)`.

### Coordinates, terrain and scene

- `geo.js` (pure) - `METRES_PER_UNIT = 4`, `S = 1 / 4`, `FIT_HALF_EXTENT`,
  `createProjection(origin, bbox, landmarks, terrainData)` returns
  `{ toMetres, project, terrain, heightAt, ... }`.
- `terrain.js` (pure) - `VERTICAL_EXAGGERATION`,
  `createTerrain(data, toMetres, S, opts)` returns `{ heightAt, groundMeshAt,
  addPad, pads, bounds, datum, ... }`.
- `scene.js` - `FOG_UNIFORMS`, `WEATHER_UNIFORMS`, `SHROUD_UNIFORMS`,
  `SEASON_GLSL`, `CLOUD_GLSL`, `installAtmosphereFog()`, `DPR`, `deviceDpr()`,
  `createRenderer(canvas, opts)`, `TIMES`, `DEFAULT_TIME`, `GROUND_HALF`,
  `groundAxes(terrain)`, `createAtmosphere(renderer, scene, opts)`,
  `createGround(terrain)`, `createShroud(bounds, opts)`.
- `camera.js` - `MIN_DISTANCE`, `FLY`, `createCameraRig(camera, dom, heightAt,
  opts)` returns `{ flyTo, frame, fitBox, drive, stopDrive, update,
  setFlyInput, cancelFlight, setGameMode, controls, ... }`.
- `effects.js` - `BLOOM_THRESHOLD`, `createEffects(renderer, scene, camera,
  opts)` returns `{ setEnabled, setPostLevel, setSize, setQuality,
  setSunSource, setHaze, update, render, dispose, ... }`.
- `bounds.js` - `setRingBounds(mesh, cx, cz, R, ylo, yhi, smax)`.
- `cell-runs.js` - `cellRuns(object, opts)`, `createCellCuller()`.
- `textures.js` - `createStoneTextures(size)`, `createAzulejoTexture(size)`.

### Buildings and landmarks

- `buildings.js` - `BUILDING_UNIFORMS`, `hash`, `buildingColors`,
  `extrudeBuilding(T, pts, h, k, areaM2, seedIndex, heightAt, roofOnly, attrs)`,
  `lastPlan`, `FADE_S`, `FADE_VERT_PARS`, `FADE_VERT`, `FADE_FRAG_PARS`,
  `FADE_FRAG`, `setBuildingsLite`, `createBuildingMaterial`, `attrsOf`,
  `buildBuildings(data, project, heightAt, masks)`.
- `buildings-ms.js` - `createMsBuildings(opts)` returns `{ update, idle,
  countNear, setEnabled, retry, mainMs, group, stats, tiles, wave, begun }`.
- `buildings-pack.js` (pure) - `packBuildings(data)`, `unpackBuildings(buf)`.
- `facades.js` (pure) - `setFacadeConfig`, `getFacadeConfig`, `HIST_M`,
  `RING_M`, `STYLE`, `centreDist`, `hexLinear`, `facadeStyle`, `wallBase`,
  `roofBase`, `colourHex`, `osmExtras`, `minRect`, `normShape`, `roofPlan`,
  `extrudeRoofed(T, pts, plan, g)`, `FACADE_VERT_PARS`, `FACADE_VERT`,
  `FACADE_FRAG_PARS`, `FACADE_FRAG`.
- `models.js` - re-exports `PALETTE`, `MAT`, `triangleCount`; `LANDMARK_SPECS`,
  `MODEL_TYPES`, `registerModels({ builders, specs })`, `loadCityModels(id)`,
  `specFor`, `isMetric`, `builderRule`, `buildModel(type, landmarkId, site)`.
- `fit.js` (no DOM) - `setDims(dims)`, `DEVIATION_WARN`, `DEVIATION_FAIL`,
  `SHRINK_MIN`, `shrinkCheck(fit)`, `FIT_RULES`, `dimsFor`, `dirOf`,
  `bearingOf`, `siteFrame`, `fitLandmark(l, ctx)`, `padFor(fit)`.
- `landmarks.js` - `buildLandmarks(list, fits, heightAt, outlines,
  onLabelClick)` returns `{ group, items, pins, updatePins,
  setHiddenCategories, setActive, pick, realScale, setResolution, ... }`.

### Roads, tiles and nature

- `road-network.js` (pure) - `CLASS`, `SURFACE_COLOR`, `surfaceOf`, `LANE_M`,
  `CLEAR_WATER`, `CLEAR_WAY`, `MIN_TUNNEL_M`,
  `buildNetwork(roads, project, heightAt)`, `VEHICLE`,
  `createFlow(net, opts)`.
- `road-structures.js` (pure) - `quad`, `orientedBox`, `bridgeGeometry`,
  `portalGeometry`.
- `roads.js` - `STYLE`, `SURFACE`, `LIFT`, `RIBBON_LIFT`, `asphaltGrain`,
  `MAX_SEG`, `STRUCTURE_COLORS`, `SIDEWALK_R`, `WALKED`, `sidewalkM`,
  `buildRoads(roads, project, heightAt, opts)`, `LAMP_HEIGHT_M`, `lampSites`,
  `lampGlow`.
- `routes.js` - `planRoute`, `MODE_RU`, `MODE_STYLE`, `BIRD_M`,
  `createRouteLayer(opts)`, `createFlyAlong(path, opts)`.
- `tiles.js` - `createTiles(opts)` returns `{ group, stats, update, wave,
  setEnabled, retry, setBudgetScale, idle, ... }`.
- `tile-worker.js` - Web Worker, no exports. Messages in: `init`
  (`origin`, `grid`, `axes`, `facade` and config) and `load`
  (`id`, `key`, `url`, `lod`, `extras`). Messages out: `ready` (`ms`), `tile`
  (`id`, `key`, `lod`, `mesh`, `extras`, `stats`) and `error`
  (`id`, `key`, `lod`, `error`).
- `nature.js` - `TREE_TABLES`, `buildNature(opts)`, `LEAF_GLSL`.
- `water.js` - `setWaterLite`, `setWaterLiteLive`, `waterUniforms`,
  `seekWater(t)`, `resumeWater()`, `getWaterTime()`, `createWaterMaterial`,
  `createWater({ data, areas, project, heightAt })`.
- `leaves.js` - `createLeaves({ field, capacity })`.
- `seasons.js` - `SEASONS`, `seasonForDate(d)`, `createSeasons(opts)`.
- `weather.js` - `WEATHERS`, `addScaled`, `createWeather(opts)`.

### City life

- `life.js` - `setLifeData(doc)`, `surfaceHeights(mesh, xs, zs, lo, hi)`,
  `createLife(ctx)` returns `{ update, setStreet, retryStreet, setLive, ... }`.
- `streetscape.js` - `CALCADA`, `calcadaPatternOf`, `calcadaMaterial`,
  `createStreetscape(ctx)`.
- `people.js` - `pedestrianDemand(hour, weekend, ymd)`, `DEMAND_MAX`,
  `createPeople(opts)`.
- `pois.js` - `parseHours`, `openAt`, `isOpen`, `isOpenAtHour`, `loadPois()`,
  `installPois(debug)`, `SIGN_KINDS`, `createPoiSigns`, `guessOpen`.
- `traffic-model.js` - `setTrafficAxes(doc)`, `PRESET_HOUR`, `demandAt`,
  `lisbonClock`, `AXIS_IDS`, `decodeAxes`, `axisAt`, `optInKey`,
  `createTrafficModel(opts)`.
- `live.js` - `sunPosition`, `sunTimes`, `weatherFromCode`,
  `createLive(opts)`.
- `liveair.js` - `createHoverLabel(opts)`, `esc`, `plural`,
  `createLiveAir(opts)`.
- `livebus.js` - `createLiveBus(opts)`.

### UI and panels

- `ui.js` - `categoryLabel`, `placesWord`, `fmtDistance`, `fmtKm`,
  `fmtMinutes`, `createUI(landmarks, routes, h)`, `TOOL_GROUPS`,
  `mountTool(node, group, opts)`, `toolsSheet()`, `createAtmosphere()`,
  `createCallout`, `createInstruments`, `createLoader`.
- `search.js` - `fold`, `matchScore`, `IMPORTANCE`, `createSearch(opts)`.
- `discovery.js` - `createDiscovery({ landmarks, pois, onPlace, onPoi, toast })`.
- `discovery-state.js` (pure) - `dailyPlace`, `readSaved`, `osmLink`,
  `walkingLink`.
- `gallery.js` - `KIND_RU`, `creditText`, `creditNode`, `createLightbox()`,
  `renderGallery(host, gallery, lightbox)`.
- `video.js` - `renderVideos(host, videos)`, `stopVideos(host)`.
- `panorama.js` - `placeholderPanoramaUrl`, `panoramaThumbUrl`,
  `createPanorama(opts)`.
- `share.js` - `PRESETS`, `uiOff`, `embedded`, `shareLinks(placeIds)`,
  `installShare(ctx)`.
- `guide.js` - `createGuide(opts)`.
- `layer-defs.js` (pure) - `LAYERS`, `LAYER_IDS`, `PRESETS`, `PRESET_ORDER`,
  `CLASS_PRESET`, `presetLayers`, `defaultsFor`, `presetOf`,
  `resolveSelection`, `serializeSelection`, `urlSelection`, `selectionBytes`,
  `formatMB`.
- `layers.js` - `createLayers({ cls, cityId })`.
- `layers-ui.js` - `createLayersUI(opts)`.
- `load-status.js` (pure) - `DONE_SHOW_MS`, `createWave()`,
  `summarize(entries, opts)`.
- `events.js` - `EVENT = 'p3d:event'`, `emit(name, detail)`.

### Guided modes

- `intro.js` - `createIntro(opts)`.
- `tour.js` - `FLIGHT_CLEARANCE`, `easeInOut`, `createSkyline`, `flightCurve`,
  `CINEMA_ORDER`, `createCinema(ctx)`.
- `story.js` - `createStory(ctx)`.
- `quest.js` - `preloadQuest()`, `createQuest(ctx)`.
- `quest-progress.js` - `LEGACY_ROUTE`, `isToken`, `stopResult`,
  `migrateProgress`, `createQuestProgress(city, legacyV2)`, `questSummary`.
- `quest-tasks.js` (pure) - `TASK_TYPES`, `answerKey`, `taskErrors`,
  `questErrors`.
- `game.js` - `createGame(ctx)`.
- `game-hud.js` - `createGameHud(opts)`.
- `game-audio.js` - `createGameAudio()`.
- `game-vfx.js` - `createGameVfx({ scene })`.
- `game-progress.js` - `createGameProgress(city)`.
- `walk.js` - `EYE`, `NEAR`, `createWalk(opts)`.
- `walk-collide.js` (pure) - `createCollider(polys, cell, also)`.
- `walk-figure.js` - `createFigure(colours)`.
- `fly.js` - `createFlyKeys(opts)`.

### Performance

- `perf-classes.js` (pure) - `CLASS_ORDER`, `CLASSES`, `QUALITY_MODES`,
  `parseQuality`, `modeToClass`, `classDown`, `classUp`, `GPU_RULES`,
  `gpuScore`, `classify(caps)`, `MOVES`, `MAX_PRESSURE`,
  `knobsFor(cls, pressure)`.
- `governor.js` (pure) - `createGovernor(opts)` returns `{ state, knobs,
  targetMs, setRefreshMs, setTargetFloor, force, setCeiling, setHidden, feed,
  changesPerMinute }`.
- `perf.js` - `detectCaps()`, `initPerf()`, `glMemory()`, `showNotice`,
  `QUALITY_MODES`.

### Styles

- `style.css` (imported by `main.js`) and `quest.css` (imported by `quest.js`).

## Invariants

### Units and frames

- `[geo.js:METRES_PER_UNIT]` 1 world unit = 4 m on all three axes.
  `S = 1 / 4` is world units per metre.
- `[geo.js:createProjection]` x points east. z points south; north is `-z`.
  y points up.
- `[road-network.js:S]`, `[road-structures.js:M]`, `[liveair.js:S]` Each holds
  its own copy of `1 / 4`. All copies must equal `geo.js` `S`.
- `[terrain.js:heightAt]` `heightAt` (bilinear plus pads) is the height datum
  for draped objects. The smooth mesh surface does not replace it.
- `[terrain.js:datum]` The DEM height at local (0, 0) is subtracted, so the
  city centre is at y = 0.
- `[terrain.js:hash2]` Terrain noise is deterministic in world coordinates, so
  `tile-worker.js` builds the same surface.
- `[models.js:header]` Metric model frame: origin at the centre of the OSM
  outline box, y = 0 at the base, local `+z` is the main front.
- `[fit.js:fitLandmark place()]` Landmarks get a rigid transform only; x, y
  and z all scale by `S`. `[landmarks.js:realScale]` checks that every
  landmark mesh keeps scale 1.
- `[fit.js:SHRINK_MIN]` A model must not be smaller than 0.97 of the real
  plan extent or height. `[fit.js:DEVIATION_WARN]` deviation above 0.1 logs a
  warning.

### Call order

- `[i18n.js:initLanguage]` Must run before the scene and the dynamic UI start.
- `[city.js:CITY]` Read `CITY` only after `loadCity()` resolves.
- `[models.js:loadCityModels]` Must run before the first `buildModel`.
- `[fit.js:setDims]` Must run before the first `fitLandmark`. `data.js:loadData`
  calls it.
- `[life.js:setLifeData]` Must run before `createLife`.
- `[scene.js:installAtmosphereFog]` Must run before the first material
  compiles. It runs once.
- `[scene.js:createShroud]` Needs the mask texture that `installAtmosphereFog`
  creates. Call `flush()` once per frame after stamping.
- `[water.js:setWaterLite]` Must run before the first water material is made.
- `[perf.js:initPerf]` Installs GL accounting before three.js creates its
  context. The governor exists only after `perf.start(applyKnobs)`.
- `[main.js:start]` Terrain pads are added only after the fit loop, then
  `ground.userData.applyPads()` runs.
- `[landmarks.js:buildLandmarks]` `fits` holds one entry per landmark, in list
  order.
- `[camera.js:update]` The caller calls `update` every frame. Order inside:
  tour, then flight, else keyboard flight, controls, clamp, parallax.

### Shared constants and enums

- `[scene.js:FOG_UNIFORMS]` Uniform values stay plain objects, not `Vector3`,
  so one write reaches every cloned material.
- `[facades.js:STYLE]` The numeric values must match the `bSt` comparisons in
  `FACADE_FRAG`.
- `[facades.js:extrudeRoofed]` `aWall.w` holds `style * 2 + seed`; `aWall.z`
  holds height, plus 1000 for a shop front.
- `[streetscape.js:CALCADA]` `aPat.x` pattern ids: 1 waves, 2 net, 3 sidewalk,
  4 street; 0 means vertex colour.
- `[nature.js:SPECIES]` Species indices 0 to 4 keep their meaning;
  `tile-worker.js` picks from the same `TREE_TABLES`.
- `[road-structures.js:portalGeometry]` Default `hoodM = 11` must match
  `road-network.js` `HOOD`.
- `[effects.js:BLOOM_THRESHOLD]` Bloom starts at 1.5 linear HDR. Emissive
  items that must glow sit above it.
- `[buildings-pack.js:MAGIC]` The binary magic is `BPB2`; `unpackBuildings`
  throws on any other value. A building holds at most 255 points.
- `[quest-tasks.js:TASK_TYPES]` Exactly five task types. `answerKey` tokens
  must match the token format in `quest-progress.js`.
- `[events.js:emit]` The detail object is frozen and has exactly the keys
  `name, city, route, stop, attempt, type, lang`.
- `[tile-worker.js:decode]`, `[buildings-pack.js:SCALE]` Coordinates are
  integers in 1e-5 degrees.

### Limits and guards

- `[main.js:start]` Without WebGL 2 the app shows a notice and stops.
- `[main.js:frame]` Frame `dt` is clamped to 1/30 s. The camera never goes
  below ground plus 2 units (0.38 in walk mode).
- `[main.js:applyKnobs]` The governor never turns effects on over the user's
  "off" choice.
- `[camera.js:MAP_LIMIT]` The orbit target stays within 1700 units of the
  centre. `[camera.js:GROUND_CLEARANCE]` The camera stays 3 units above
  terrain.
- `[scene.js:deviceDpr]` Pixel ratio is at least 0.5 and at most `DPR.cap`
  before `DPR.scale`.
- `[data.js:fetchJSON]`, `[city.js:loadCity]`, `[pois.js:fetchPois]`,
  `[quest.js:preloadQuest]`, `[streetscape.js:fetchStreet]`,
  `[tile-worker.js:getTile]`, `[layers.js:loadManifest]` A response counts
  only when it is OK and its content type includes `json`. The Vite dev server
  answers a missing file with HTML and status 200.
- `[data.js:loadData]` Placeholder landmarks, roads and routes apply only when
  `CITY.id` is `braga`.
- `[data.js:cleanRich]` URLs must be http(s). A YouTube id must match
  `/^[\w-]{6,20}$/`.
- `[city.js:ID_RE]` A city id must match `/^[a-z][a-z0-9-]*$/` and be in the
  known list, else the app falls back to `braga`.
- `[i18n.js:supportedLanguages]` Only `pt`, `en` and `ru`; any other value
  falls back to `pt`.
- `[buildings.js:MAX_TRIS]` Building budget is 1,500,000 triangles.
- `[tiles.js:MAX_INFLIGHT]` At most 6 tile requests in flight.
  `[tiles.js:MEM_CAP]` GPU cap 350 MB on desktop, 120 MB on mobile. A tile
  gives up after 3 errors.
- `[buildings-ms.js:constants]` At most 4 fetches at once and 1.5 ms of
  extrusion per frame.
- `[liveair.js:MAX]` At most 60 aircraft (40 on mobile).
  `[livebus.js:MAX]` At most 150 buses (80 on mobile).
- `[life.js:createLife]` Vehicle cap: 150 in lite mode, 300 on mobile, 600
  otherwise.
- `[pois.js:createPoiSigns]` At most 400 signs (120 in lite mode).
- `[guide.js:MAX_Q]` A guide question holds at most 300 characters. Source
  links must start with `https://`.
- `[discovery.js:loadHeadlines]` A news item shows only when its URL is https
  and its host is `ominho.pt`.
- `[video.js:renderVideos]` The YouTube iframe is created on click only.
- `[governor.js:feed]` Pressure stays in `0..MAX_PRESSURE`.
  `[perf-classes.js:classify]` A software GPU gives class `P`.
- `[quest-progress.js:createQuestProgress]`,
  `[game-progress.js:read, write]`, `[layers.js:createLayers]` Every storage
  access sits in try/catch; memory keeps the state when storage is blocked.
- `[streetscape.js:createStreetscape]`, `[pois.js:loadPois]` The `ready`
  promise never rejects.

### Purity

- `[layer-defs.js:header]`, `[perf-classes.js:header]` These files must stay
  DOM-free; Node scripts import them. The same holds for `geo.js`,
  `terrain.js`, `facades.js`, `road-network.js`, `road-structures.js`,
  `governor.js`, `load-status.js`, `quest-tasks.js`, `walk-collide.js`,
  `buildings-pack.js` and `discovery-state.js`, which hold no DOM code.

### Known mismatches between comments and code

- `[main.js:buildNatureLayer]` The comment says at most 2500 trees in light
  mode; the code uses 1200.
- `[models.js:header]` The comment says "all 16 are metric"; the registry
  lists 30 ids.
- `[weather.js:STATES]` The header says five states; the code has seven.
- `[game-audio.js:muted]` The header says muted until the first touch; the
  code starts with `muted = false`.
- `[search.js:flyStreet]` The comment says 100 m to 2.4 km; the code clamps
  to 25..600 units.
- `[road-network.js:createFlow]` The comment names `speedK` and `lorryShare`;
  the function does not read them.

## Side Effects

### Network

- `[city.js:loadCity]` `cities/<id>.json`.
- `[data.js:fetchJSON]` Under `CITY.data_dir`: landmarks, roads, routes,
  terrain, footprints, nature, dimensions, life, traffic-axes, story.
  `[data.js:fetchBuildings]` `buildings.bin.gz`, then `buildings.json`.
- `[buildings-ms.js]` `buildings-ms.json`, `tiles-ms/index.json`,
  `tiles-ms/<x>_<y>.json`.
- `[tiles.js:start]` `tiles/index.json`. `[tile-worker.js:getTile]`
  `tiles/<key>.json`.
- `[layers.js:loadManifest]` `layers.json`. `[pois.js:fetchPois]` `pois.json`.
  `[streetscape.js:fetchStreet]` `streetscape.json`.
  `[quest.js:preloadQuest]` `quest.json`. `[game.js:loadConfig]`
  `data/game.json`. `[livebus.js:load]` `gtfs/schedule.json`.
- Own API routes: `[guide.js:post]` `POST /api/guide`;
  `[liveair.js:poll]` `GET /api/adsb`; `[liveair.js:pump]` `GET /api/route`;
  `[discovery.js:loadHeadlines]` `GET api/news?city=braga`.
- Third parties: `[live.js:fetchWeather]` `api.open-meteo.com`;
  `[traffic-model.js:pollTomTom]` `api.tomtom.com` (only with an opt-in key);
  `[video.js]` `i.ytimg.com` thumbnails and a `youtube-nocookie.com` iframe on
  click.
- Outbound links: Google Maps directions (`ui.js`, `discovery-state.js`),
  OpenStreetMap (`discovery-state.js`), `globe.adsb.lol` (`liveair.js`),
  `portugal-3d.com` (`back-to-globe.js`).
- `[share.js:module top level]` Registers `./sw.js` as a service worker in
  production builds.

### Browser storage

- `localStorage` keys: `braga-language` (`i18n.js`), `braga-time` (`main.js`,
  `live.js`), `braga-fx` (`main.js`), `braga-quality`, `braga-class-last`,
  `braga-tier`, `braga-tier-probe` (`perf.js`, `seasons.js`), `braga-season`
  (`seasons.js`), `braga-weather`, `braga-live`, `<city>-live-weather`
  (`live.js`), `<city>-layers` (`layers.js`), `<city>-saved-places-v1`
  (`discovery.js`), `braga-quests-<city>` and legacy `braga-quest-<city>`
  (`quest-progress.js`), `braga-game-<city>` (`game-progress.js`),
  `braga-game-help` (`game.js`), `braga-guide-voice` (`guide.js`),
  `tomtomKey` and `tubKey` (`traffic-model.js:optInKey`; these hold
  user-supplied API keys).
- `sessionStorage` key: `braga-intro` (`main.js`).

### URL and history

- `history.replaceState`: `[main.js:setHash]`, `[i18n.js:initLanguage]`,
  `[seasons.js:writeHash]`, `[traffic-model.js:optInKey]` (removes the key
  parameter from the URL).
- `[i18n.js:initLanguage]` A language change reloads the page.
  `[main.js]` A quality change that needs a rebuild reloads the page.
- Query flags read at import or creation: `facades=0` (`facades.js`),
  `ms=0|debug` (`buildings-ms.js`), `tiles=0` (`tiles.js`), `layers=`
  (`layers.js`), `keys=0` (`fly.js`), `demo`, `packed=0` (`data.js`),
  `quality=`, `perf` (`perf.js`), `ui=0`, `embed=1` (`share.js`), `city=`
  (`city.js`), `lang=` (`i18n.js`), `from=globe` (`back-to-globe.js`),
  `tomtom=` (`traffic-model.js`), `tubkey=` (`livebus.js`).

### Globals and events

- `[main.js]` Creates `window.__braga`, the shared debug object. Many modules
  write to it (`debug.life`, `debug.tiles`, `debug.ms`, `debug.pois`,
  `debug.guide`, `debug.game`, `debug.stats.*`).
- Window custom events: `p3d:event` (`events.js:emit`), `braga:view`
  (`ui.js:setView`; `discovery.js` listens), `braga:pois` (`pois.js`).
- `[perf.js:installGlAccounting]` Wraps `WebGL2RenderingContext.prototype`
  methods to count GPU bytes.
- `[scene.js:installAtmosphereFog]` Replaces `THREE.ShaderChunk` fog and light
  chunks and adds shared uniforms to every `THREE.ShaderLib` entry with fog.
- Module-level state other modules depend on: `CITY` (`city.js`), facade
  config (`facades.js`), `FIT_RULES` and dims (`fit.js`), model registry
  (`models.js`), `BUILDING_UNIFORMS` (`buildings.js`, clock written by
  `tiles.js`), `FOG_UNIFORMS`, `WEATHER_UNIFORMS`, `SHROUD_UNIFORMS`
  (`scene.js`), `waterUniforms` and the water clock (`water.js`), POI store
  (`pois.js`), traffic axes (`traffic-model.js`), life data (`life.js`), the
  network memo (`road-network.js`).
- Import-time effects: `back-to-globe.js` mounts its link; `share.js` adds a
  style element, sets `ui-off` and `is-embed` classes and registers the
  service worker; `i18n.js` resolves the language; `city.js` resolves the
  city id; `facades.js` reads the query string.

### DOM, timers and devices

- DOM: `main.js` and the UI modules read and write fixed element ids from
  `index.html` (for example `#scene`, `#app`, `#labels`, `#loader`, `#search`,
  `#pano`, `#lightbox`, `#cinema`, `#story`, `#callout`, `#tools-sheet`).
  Several modules append their own nodes to `document.body`: `#game`
  (`game-hud.js`), `#quest` (`quest.js`), `.walk-hud` (`walk.js`),
  `#load-status` and `#layers` (`layers-ui.js`), `#share-pop` (`share.js`),
  `.live-label` (`liveair.js`), `.perf-overlay` and `.gpu-notice` (`perf.js`),
  the guide panel (`guide.js`).
- Body mode classes: `is-intro`, `is-cinema`, `is-story`, `is-quest`,
  `is-quest-picking`, `is-game`, `is-walk`, `is-guide-open`, `is-layers-open`,
  `is-tools-open`, `is-atmo-open`, `is-callout`, `is-search-open`.
- Render loop: `[main.js:frame]` owns `requestAnimationFrame` and pauses on
  `visibilitychange`. `panorama.js` runs its own loop while open.
- Timers: `[layers-ui.js]` 250 ms interval; `[guide.js]` 800 ms interval;
  short timeouts in `ui.js`, `fly.js`, `game-hud.js`, `story.js`, `tour.js`.
- Workers: `[tiles.js:start]` creates module workers from `tile-worker.js`.
- GPU: `[scene.js:createRenderer]` creates the main WebGL renderer;
  `[panorama.js:build]` creates a second one and releases it on close; the
  layer modules create geometry, textures and materials.
- Audio and devices: `[game-audio.js]` Web Audio; `[guide.js]` speech
  synthesis and speech recognition; `[game.js:vibrate]` `navigator.vibrate`;
  `[panorama.js:toggleGyro]` device orientation; `[share.js]`, `[main.js]`,
  `[discovery.js]` clipboard and `navigator.share`.
- Console: modules log with a `[braga]` prefix through `console.warn` and
  `console.info`.

## Verification

- Run: `npm test`
- Run: `npm run verify`
