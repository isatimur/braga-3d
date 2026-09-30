// Guimarães landmark models: the per-city registry src/models.js loads
// for ?city=guimaraes (loadCityModels). Builders live in
// src/models/guimaraes/<id>.js, one file per landmark, in the metric
// convention of src/models.js (builder.metric = true, 1:1 metres, +z the
// front). Register them here:
//
//   import castelo from './guimaraes/castelo.js';
//   export const builders = { ...castelo };
//   export const specs = { castelo: { type: 'castle', h: 28, yaw: 0 } };
//
// Until then every Guimarães landmark falls back by model type to a Braga
// builder ('santa-cruz' when the type is unknown).
export const builders = {};
export const specs = {};
