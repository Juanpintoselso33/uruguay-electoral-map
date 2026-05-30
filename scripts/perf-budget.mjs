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
import { readFileSync, readdirSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { join } from 'node:path';

const ROOT = '.vercel/output/static';
const ASTRO = join(ROOT, '_astro');

// Presupuestos (gz). Fijados según medición real (ver story 1.10).
const BUDGETS = {
  portadaEager: 40 * 1024, // la portada NO debe cargar el mapa
  mapaEager: 70 * 1024, // isla + runtime Vue, SIN MapLibre (que es lazy)
  maplibreChunk: 300 * 1024, // guardia de regresión del chunk del mapa
};

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

// 1) Portada NO carga MapLibre + budget.
const portada = eagerSize('index.html');
if (portada.hasMaplibre) fails.push('PORTADA carga MapLibre (debe ser on-demand) ❌');
else ok.push('portada NO carga MapLibre ✅');
if (portada.total > BUDGETS.portadaEager)
  fails.push(`portada eager ${(portada.total / 1024).toFixed(1)}KB > ${BUDGETS.portadaEager / 1024}KB`);
else ok.push(`portada eager ${(portada.total / 1024).toFixed(1)}KB ≤ ${BUDGETS.portadaEager / 1024}KB ✅`);

// 2) Página del mapa: MapLibre debe ser lazy (no en el set eager) + budget eager.
const mapa = eagerSize('internas-2024/montevideo/index.html');
if (mapa.hasMaplibre) fails.push('MapLibre está en el JS EAGER del mapa (debería ser import() dinámico) ❌');
else ok.push('MapLibre lazy en el mapa (no eager) ✅');
if (mapa.total > BUDGETS.mapaEager)
  fails.push(`mapa eager ${(mapa.total / 1024).toFixed(1)}KB > ${BUDGETS.mapaEager / 1024}KB`);
else ok.push(`mapa eager ${(mapa.total / 1024).toFixed(1)}KB ≤ ${BUDGETS.mapaEager / 1024}KB ✅`);

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
