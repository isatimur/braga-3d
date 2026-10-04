#!/usr/bin/env node
// Single verification gate for braga-3d. Runs the repository's checks and the
// production build, and reports PASS / FAIL / SKIP for each. Any FAIL exits 1.
//
//   npm run verify [-- --city guimaraes]
//
// A check is SKIPped when its input data has not been produced yet, so the gate
// stays honest and green while data rounds are in progress. Do not weaken this
// gate to make a feature pass; produce the missing data or fix the check.
//
// This repo is the engine source of truth and hosts more than one city
// (data/ = Braga, data/guimaraes/ = Guimarães). Set CITY or pass --city.
import { existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const argv = process.argv.slice(2);
const cityFlag = argv.findIndex((a) => a === '--city');
const CITY =
  process.env.CITY ||
  (cityFlag >= 0 ? argv[cityFlag + 1] : undefined) ||
  argv.find((a) => a.startsWith('--city='))?.slice('--city='.length) ||
  'braga';
const dataDir = CITY === 'braga' ? 'data' : `data/${CITY}`;
const has = (...parts) => existsSync(join(ROOT, ...parts));

const checks = [
  { name: 'build', cmd: ['npm', 'run', 'build'], needs: [] },
  ...(CITY === 'braga' ? [{ name: 'discovery', cmd: ['npm', 'run', 'check:discovery'], needs: ['data/pois.json', 'data/landmarks.json'] }] : []),
  {
    name: 'data contract',
    cmd: ['node', 'scripts/check-data.mjs', '--city', CITY],
    needs: [`${dataDir}/landmarks.json`, `${dataDir}/routes.json`],
  },
  { name: 'geo', cmd: ['node', 'scripts/check-geo.mjs', '--city', CITY], needs: [] },
  {
    name: 'dimensions',
    cmd: ['node', 'scripts/check-dimensions.mjs', '--city', CITY],
    needs: [`${dataDir}/dimensions.json`, `${dataDir}/landmarks.json`],
  },
  {
    name: '1:1 fit',
    cmd: ['node', 'scripts/check-fit.mjs', '--city', CITY],
    needs: [`${dataDir}/footprints.json`, `${dataDir}/landmarks.json`],
  },
  { name: 'traffic', cmd: ['node', 'scripts/check-traffic.mjs', '--city', CITY], needs: [`${dataDir}/roads.json`] },
  {
    name: 'models',
    cmd: ['node', 'scripts/count-tris.mjs', '--city', CITY],
    needs: [`${dataDir}/footprints.json`, `${dataDir}/landmarks.json`, `${dataDir}/roads.json`, `${dataDir}/terrain.json`],
  },
];

let failed = 0;
let skipped = 0;

console.log(`city: ${CITY}  (data dir: ${dataDir})\n`);

for (const check of checks) {
  const missing = check.needs.filter((f) => !has(f));
  if (missing.length) {
    skipped += 1;
    console.log(`SKIP  ${check.name}  (missing: ${missing.join(', ')})`);
    continue;
  }
  console.log(`RUN   ${check.name}  ($ ${check.cmd.join(' ')})`);
  const result = spawnSync(check.cmd[0], check.cmd.slice(1), {
    cwd: ROOT,
    stdio: 'inherit',
    env: process.env,
  });
  if (result.status === 0) {
    console.log(`PASS  ${check.name}`);
  } else {
    failed += 1;
    console.log(`FAIL  ${check.name}  (exit ${result.status})`);
  }
}

console.log(
  `\nverify: ${failed ? 'FAILED' : 'OK'}` +
    (skipped ? ` — ${skipped} check(s) skipped, data not produced yet` : ''),
);
process.exit(failed ? 1 : 0);
