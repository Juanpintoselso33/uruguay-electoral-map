/**
 * Gate de perf-budget (Story 1.10). Determinístico, corre en CI tras `astro build`.
 * Verifica NFR1: la PORTADA no arrastra el peso del mapa (MapLibre carga on-demand),
 * y el JS eager por página queda bajo presupuesto. La geometría ya tiene su gate (1.6).
 *
 * "Eager" = JS que la página carga sí o sí (islas + sus imports estáticos). Los
 * `import()` dinámicos (MapLibre) NO son eager → se cargan cuando se montan.
 *
 * Exit ≠ 0 si se viola algún budget → rompe el build/CI.
 */
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { join } from 'node:path';

const ROOT = '.vercel/output/static';
const ASTRO = join(ROOT, '_astro');

// Presupuestos (gz). Recalibrados según medición real (2026-06-05; antes story 1.10).
// La PORTADA `/` hoy es un 301 → vista nacional (departamentales-2025), que YA es un mapa.
// Por eso el invariante que importa no es "la portada no tiene mapa" sino "NINGUNA página
// carga MapLibre eager" (siempre import() dinámico) + un budget de JS eager por página.
const BUDGETS = {
  landingEager: 85 * 1024, // vista nacional (entry): islas + Vue, SIN MapLibre (lazy). Medido ~71KB.
  mapaEager: 90 * 1024, // página de mapa depto: SIN MapLibre (lazy). Medido ~75KB.
  maplibreChunk: 300 * 1024, // guardia de regresión del chunk del mapa. Medido ~277KB.
};

/** Página de aterrizaje real: el destino del redirect `^/$` en la config de salida de Vercel. */
function landingPage() {
  try {
    const cfg = JSON.parse(readFileSync('.vercel/output/config.json', 'utf8'));
    const r = cfg.routes?.find((x) => x.src === '^/$' && x.headers?.Location);
    if (r) return r.headers.Location.replace(/^\//, '') + '/index.html';
  } catch {
    /* sin config de salida → fallback a index.html */
  }
  return 'index.html';
}

const pageExists = (rel) => existsSync(join(ROOT, rel.replace(/^\//, '')));

const gz = (buf) => gzipSync(buf, { level: 9 }).length;
const sizeOf = (rel) => {
  try {
    return gz(readFileSync(join(ROOT, rel.replace(/^\//, ''))));
  } catch {
    return 0;
  }
};

/** Imports ESTÁTICOS de un chunk (eager). Excluye `import(...)` dinámico. */
function staticImports(rel) {
  let code = '';
  try {
    code = readFileSync(join(ROOT, rel.replace(/^\//, '')), 'utf8');
  } catch {
    return [];
  }
  const out = new Set();
  for (const m of code.matchAll(/from"([^"]+\.js)"/g)) out.add(m[1]);
  // bare static import:  import"./x.js"   (NO seguido de "(")
  for (const m of code.matchAll(/(?:^|[;}\s])import"([^"]+\.js)"/g)) out.add(m[1]);
  return [...out].map(resolveRel);
}

/** Los chunks viven en /_astro/; los imports relativos son "./x.js". */
function resolveRel(imp) {
  return imp.startsWith('/') ? imp : '/_astro/' + imp.replace(/^\.\//, '');
}

/** Conjunto transitivo de chunks eager alcanzables desde unos chunks raíz. */
function eagerClosure(roots) {
  const seen = new Set();
  const stack = [...roots];
  while (stack.length) {
    const cur = stack.pop();
    if (seen.has(cur)) continue;
    seen.add(cur);
    for (const dep of staticImports(cur)) if (!seen.has(dep)) stack.push(dep);
  }
  return seen;
}

/** Chunks que una página carga eager: component-url + renderer-url de cada astro-island. */
function pageIslandRoots(pageRel) {
  const html = readFileSync(join(ROOT, pageRel), 'utf8');
  const roots = new Set();
  for (const m of html.matchAll(/component-url="([^"]+\.js)"/g)) roots.add(m[1]);
  for (const m of html.matchAll(/renderer-url="([^"]+\.js)"/g)) roots.add(m[1]);
  return [...roots];
}

function eagerSize(pageRel) {
  const closure = eagerClosure(pageIslandRoots(pageRel));
  let total = 0;
  let hasMaplibre = false;
  for (const c of closure) {
    total += sizeOf(c);
    if (/maplibre/i.test(c)) hasMaplibre = true;
  }
  return { total, hasMaplibre, chunks: [...closure] };
}

function maplibreChunkSize() {
  const f = readdirSync(ASTRO).find((n) => /maplibre.*\.js$/i.test(n));
  return f ? sizeOf('/_astro/' + f) : 0;
}

const fails = [];
const ok = [];

// 1) Página de aterrizaje (vista nacional, destino del redirect `/`): MapLibre debe ser
//    lazy (no eager) + budget de JS eager.
const landingRel = landingPage();
if (!pageExists(landingRel)) {
  fails.push(`no existe la página de aterrizaje '${landingRel}' (¿cambió el redirect de '/'?)`);
} else {
  const landing = eagerSize(landingRel);
  if (landing.hasMaplibre) fails.push(`PORTADA (${landingRel}) carga MapLibre EAGER (debe ser on-demand) ❌`);
  else ok.push(`portada (${landingRel}) NO carga MapLibre eager ✅`);
  if (landing.total > BUDGETS.landingEager)
    fails.push(`portada eager ${(landing.total / 1024).toFixed(1)}KB > ${BUDGETS.landingEager / 1024}KB`);
  else ok.push(`portada eager ${(landing.total / 1024).toFixed(1)}KB ≤ ${BUDGETS.landingEager / 1024}KB ✅`);
}

// 2) Página del mapa depto: MapLibre debe ser lazy (no en el set eager) + budget eager.
const mapaRel = 'internas-2024/montevideo/index.html';
if (!pageExists(mapaRel)) {
  fails.push(`no existe la página de mapa de referencia '${mapaRel}'`);
} else {
  const mapa = eagerSize(mapaRel);
  if (mapa.hasMaplibre) fails.push('MapLibre está en el JS EAGER del mapa (debería ser import() dinámico) ❌');
  else ok.push('MapLibre lazy en el mapa (no eager) ✅');
  if (mapa.total > BUDGETS.mapaEager)
    fails.push(`mapa eager ${(mapa.total / 1024).toFixed(1)}KB > ${BUDGETS.mapaEager / 1024}KB`);
  else ok.push(`mapa eager ${(mapa.total / 1024).toFixed(1)}KB ≤ ${BUDGETS.mapaEager / 1024}KB ✅`);
}

// 3) Guardia de regresión del chunk MapLibre.
const ml = maplibreChunkSize();
if (ml > BUDGETS.maplibreChunk)
  fails.push(`chunk MapLibre ${(ml / 1024).toFixed(1)}KB > ${BUDGETS.maplibreChunk / 1024}KB`);
else ok.push(`chunk MapLibre ${(ml / 1024).toFixed(1)}KB ≤ ${BUDGETS.maplibreChunk / 1024}KB ✅`);

console.log('=== perf-budget (NFR1) ===');
ok.forEach((l) => console.log('  ' + l));
if (fails.length) {
  console.error('\n[perf-budget] FALLA:');
  fails.forEach((l) => console.error('  - ' + l));
  process.exit(1);
}
console.log('\n=== perf-budget PASA ✅ ===');
