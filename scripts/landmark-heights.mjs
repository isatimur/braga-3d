// Landmark heights used by fetch-footprints.mjs when OSM has no usable height tag.
// m = height of the tallest element in metres. source = "wikipedia" or "estimate".
// No published figure exists for most of these sites (searched pt/en Wikipedia,
// SIPA, official sites on 2026-09-28), so most are estimates; `note` gives the reasoning.
// on / onTag = OSM key (and part tag) of the tallest element, when it is not the main object.
// main_m = height of the main object when the tallest element is another part.
// force = true overrides an OSM tag that is clearly wrong for the real building.
export const HEIGHTS = {
  'bom-jesus': { m: 34, source: 'estimate', note: 'Twin façade towers of the basilica. No published height; scaled from the 6 m façade columns (pt.wikipedia Basílica do Bom Jesus) and photos.' },
  sameiro: { m: 32, source: 'estimate', note: 'Dome of the sanctuary. No published height; sources put the dome top at "over 600 m" altitude and the terrace at 566-572 m, so 28-34 m.' },
  'se-braga': { m: 30, source: 'estimate', note: 'Twin bell towers. No published height (pt/en Wikipedia checked); estimated from photos and the scale of the nave.' },
  'arco-porta-nova': { m: 12, source: 'estimate', width_m: 8, depth_m: 3, note: 'OSM maps the gate as a node plus a 7 m barrier=wall line; the outline is a synthesized 8 x 3 m rectangle on that line. Height with attic from photos, no published figure.' },
  'santa-barbara': { m: 20, source: 'estimate', on: 'r20123877', note: 'Tallest element is the wing of the Antigo Paço Episcopal (3 storeys) beside the garden; garden itself is flat.' },
  'praca-republica': { m: 22, source: 'estimate', on: 'w167193931', note: 'Tallest element is the bell tower of the Igreja da Lapa behind the Arcada; square itself is flat.' },
  'theatro-circo': { m: 28, source: 'estimate', force: true, note: 'Fly tower. The venue rider (theatrocirco.com RIDER_THEATRO_CIRCO.pdf) gives 24 m stage-to-grid; roof adds ~4 m. The OSM building:levels=2 counts only the façade storeys.' },
  'palacio-raio': { m: 15, source: 'estimate', note: 'Two tall storeys plus attic and roof; no published height.' },
  'santa-cruz': { m: 28, source: 'estimate', note: 'Twin bell towers (1694); no published height.' },
  'estadio-braga': { m: 40, source: 'estimate', on: 'r17396393', onTag: 'stand', main_m: 0, main_source: 'flat', note: 'Top of the two stands. Published 40 m is the carved granite quarry face the east stand stands against (flagra.pt; Arquitectura Viva: VIP plaza "forty meters higher" than the pitch); used as the stand/roof height.' },
  'termas-romanas': { m: 6, source: 'estimate', note: 'Protective roof canopy over the ruins; no published height.' },
  'fonte-idolo': { m: 5, source: 'estimate', note: 'Single-storey interpretation centre built over the fountain (2001-2004); no published height.' },
  tibaes: { m: 28, source: 'estimate', on: 'w170604958', main_m: 14, main_source: 'estimate', note: 'Church bell towers; monastery wings ~14 m (3 storeys). No published height.' },
  biscainhos: { m: 16, source: 'estimate', note: 'Two-storey Baroque palace with high roof; no published height.' },
  populo: { m: 26, source: 'estimate', note: 'Twin façade towers (Carlos Amarante, late 18th c.) with Baroque cupolas and crosses. No published height (pt/en Wikipedia, e-cultura, visitbraga checked 2026-09-29); the frontal Commons photo gives tower-top/façade-width about 1.2-1.4 on the 18.8 m OSM church width.' },
  'ucp-braga': { m: 26, source: 'estimate', note: 'Faculdade de Filosofia building on Praça da Faculdade: about six storeys and a corner tower with a statue. No published height; from Commons photos.' },
  'estadio-1-maio': { m: 30, source: 'estimate', note: 'The slender granite tower over the north entrance is the tallest element; OSM has no tower or stand objects, so the height sits on the stadium outline. Open stands about 10 m. No published height; from Commons photos.' },
  'parque-ponte': { m: 10, source: 'estimate', on: 'w121590142', note: 'Tallest built element is the Capela de São João da Ponte (1616), single nave with bell gable; the park itself is flat. No published height.' },
  'forum-braga': { m: 14.5, source: 'wikipedia', note: 'Pavilion clear height 11.5-14.5 m across the hall (pt.wikipedia Forum Braga; forumbraga.com/Espacos/Pavilhao).' },
  'avenida-central': { m: 8, source: 'estimate', on: 'w108153350', note: 'Tallest element on the avenue is the 1868 iron bandstand (Coreto da Avenida); garden itself is flat.' },
};
