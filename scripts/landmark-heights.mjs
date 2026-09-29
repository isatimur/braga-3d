// Landmark heights used by fetch-footprints.mjs when OSM has no usable height tag.
// m = height of the tallest element in metres. source = "wikipedia" or "estimate".
// No published figure exists for most of these sites (searched pt/en Wikipedia,
// SIPA, official sites on 2026-09-28), so most are estimates; `note` gives the reasoning.
// on / onTag = OSM key (and part tag) of the tallest element, when it is not the main object.
// main_m = height of the main object when the tallest element is another part.
// force = true overrides an OSM tag that is clearly wrong for the real building.
// parts = {OSM key or synth id: [m, reasoning]}: estimated heights of other parts.
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
  // --- second batch, 2026-09-29 (researched pt/en Wikipedia, DGPC, SIPA, museum and school sites) ---
  'uminho-gualtar': { m: 19.2, source: 'osm building:levels×3.2', on: 'w448580564', note: 'Tallest mapped campus building: the Instituto para a Bio-Sustentabilidade (IB-S, 2015), building:levels=6 in OSM. No published building heights for the campus (uminho.pt, pt/en Wikipedia checked 2026-09-29); the other schools carry 1-4 levels in OSM. The campus area itself is flat.' },
  'dmaria-ii': {
    m: 13, source: 'estimate', on: 'w473728998',
    note: 'North-west wing of the 1964 Liceu (the only block OSM maps), three storeys. The original school had 2960 m² covered and 7060 m² of floors (asap-ehc.tecnico.ulisboa.pt escola id 28): about 2.4 floors on average, so three storeys at most; 3 x 3.8 m school storeys + parapet ≈ 13 m.',
    parts: { 'ms:1': [12, 'Parque Escolar blocks (2011), two to three storeys; MS footprint only.'], 'ms:2': [12, 'Parque Escolar blocks (2011), two to three storeys; MS footprint only.'] },
  },
  'sao-frutuoso': {
    m: 9, source: 'estimate',
    note: 'Top of the square tower over the crossing of the Greek-cross chapel (DGPC 70191: four apses around a square crossing). No published height; the chapel is 13 x 11 m in OSM with single-storey apses, so the crossing tower is about 9 m.',
    parts: {
      w131049722: [12, 'Igreja de São Jerónimo de Real (former Franciscan church, rebuilt from 1728): single nave, no published height.'],
      w159104084: [9, 'Convento de São Francisco: two storeys, no published height.'],
    },
  },
  'diogo-sousa': {
    m: 12.8, source: 'osm building:levels×3.2', on: 'w444600885',
    note: 'The museum (2007, Carlos Guimarães and Luís Soares Carneiro) has three bodies: technical/services, cafeteria and public area (maddiogosousa.gov.pt/edificio). The tallest is the four-level block w444600885 (building:levels=4), read as the technical sector. The exhibition body w108351556 is set to 10 m: OSM says 2 levels, but the exhibition halls are double-height (estimate).',
    parts: { w108351556: [10, 'Two-level exhibition body with tall halls, about 2 x 4.5 m + parapet.'] },
  },
  coimbras: {
    m: 16, source: 'estimate', on: 'w1343853590', main_m: 12, main_source: 'estimate',
    note: 'The chapel is a Manueline "igreja-torre" with a square plan and a tower-like front in two registers (DGPC 70651), 12.25 x 6.25 m (en.wikipedia infobox). In OSM it is the 7 x 6 m tower w1343853590; the 37 m way w223138080 also covers the Igreja de São João do Souto it is attached to. Tower top with merlons about 16 m (two registers plus crenellation, about 2.5 x the 6.25 m width); church body 12 m. No published heights.',
    parts: { w146342996: [12, 'Casa dos Coimbras (rebuilt 1924): three storeys.'] },
  },
  congregados: {
    m: 32, source: 'estimate',
    note: 'Twin bell towers (east tower 18th c., west tower completed 1964, pt.wikipedia Basílica dos Congregados). No published height; the towers rise about 1.3 x the 25 m façade width in frontal photos.',
  },
  'nogueira-silva': {
    m: 13, source: 'estimate', on: 'synth:nogueira-house', main_m: 0, main_source: 'flat',
    note: 'The house (built 1950s-60s, architect Raul Rodrigues de Lima, per webraga.pt) is the part of the OSM plot south of the garden; three storeys on Avenida Central with a pitched roof, about 13 m. No published height. The plot and garden are flat.',
  },
  'sao-marcos': {
    m: 20, source: 'estimate',
    note: 'Convex Baroque front by Carlos Amarante (project 1787) crowned by 12 statues of apostles (pt.wikipedia Igreja de São Marcos); top of the statues and pediment about 20 m. No published height.',
    parts: {
      r17978905: [16, 'Former north pavilion of the hospital, now the Vila Galé hotel (pt.wikipedia Hospital de São Marcos): three tall storeys plus roof.'],
      r8340055: [16, 'Later hospital pavilion, 3-4 storeys; no published height.'],
      w146343003: [14, 'Later hospital wing, three storeys; no published height.'],
    },
  },
  'avenida-central': { m: 8, source: 'estimate', on: 'w108153350', note: 'Tallest element on the avenue is the 1868 iron bandstand (Coreto da Avenida); garden itself is flat.' },
};
