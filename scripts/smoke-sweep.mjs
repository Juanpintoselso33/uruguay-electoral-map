/**
 * Barrido de humo (smoke sweep): navega una matriz de URLs (elección × depto × modo × nivel ×
 * selección × ficha) con ids reales leídos de public/data, y reporta errores de consola y
 * excepciones JS (pageerror) por página. Objetivo: "ver si algo explota" en todas las elecciones.
 *
 * Uso: node scripts/smoke-sweep.mjs [maxDeptosPorEleccion]
 *   (requiere el dev server corriendo en BASE)
 */
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const BASE = process.env.SWEEP_BASE || 'http://localhost:4322';
const DATA = 'public/data';
const MAX_DEPTOS = Number(process.argv[2] ?? 6);   // por elección, además de montevideo
const CONCURRENCY = 5;

const readJSON = (p) => { try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return null; } };

// ── Recolectar elección×depto desde disco ─────────────────────────────────
const pairs = [];
for (const e of fs.readdirSync(DATA)) {
  const ed = path.join(DATA, e);
  if (!fs.statSync(ed).isDirectory()) continue;
  if (e === 'mappings') continue;
  const deptos = fs.readdirSync(ed).filter((d) => fs.existsSync(path.join(ed, d, 'votes.json')));
  // montevideo siempre + una muestra de interior
  const interior = deptos.filter((d) => d !== 'montevideo');
  const muestra = ['montevideo', ...interior.slice(0, MAX_DEPTOS)].filter((d) => deptos.includes(d));
  for (const d of muestra) pairs.push([e, d]);
}

// ── Construir URLs variantes por par ──────────────────────────────────────
function variantsFor(e, d) {
  const dir = path.join(DATA, e, d);
  const votes = readJSON(path.join(dir, 'votes.json'));
  const firstZona = votes?.zonas?.[0]?.geoId;
  const cat = readJSON(path.join(dir, 'catalogo.json'));
  const opc = readJSON(path.join(dir, 'opciones.json'));
  const baseUrl = `/${e}/${d}`;
  const Z = firstZona ? `zona=${encodeURIComponent(firstZona)}` : '';
  const out = [];
  out.push({ url: baseUrl, tag: 'default' });
  if (Z) out.push({ url: `${baseUrl}?${Z}`, tag: 'ficha-ganador' });

  // selección con ids reales
  const addSelVariants = (cont, ids) => {
    if (!ids.length) return;
    const sel = ids.slice(0, 3).join(',');
    const c = cont ? `cont=${cont}&` : '';
    out.push({ url: `${baseUrl}?${c}sel=${sel}&modo=ganador`, tag: 'sel-ganador' });
    out.push({ url: `${baseUrl}?${c}sel=${sel}&modo=share${Z ? '&' + Z : ''}`, tag: 'sel-share-ficha' });
    out.push({ url: `${baseUrl}?${c}sel=${sel}&modo=heatmap`, tag: 'sel-heatmap' });
  };
  if (cat) {
    for (const c of cat.contiendas) {
      const ids = (c.opciones || []).map((o) => o.id);
      addSelVariants(c.contienda, ids);   // cada contienda (departamentales: intendente/junta/municipio)
    }
  } else if (opc) {
    addSelVariants(null, opc.opciones.map((o) => o.opcionId));   // plano fallback
  }

  // niveles con shard propio
  const lvlFile = { circuito: 'votes-circuito.json', localidad: 'votes-localidad.json', barrio: 'votes-barrio.json' };
  for (const [lvl, f] of Object.entries(lvlFile)) {
    if (fs.existsSync(path.join(dir, f))) out.push({ url: `${baseUrl}?level=${lvl}`, tag: `level-${lvl}` });
  }
  return out;
}

const jobs = [];
for (const [e, d] of pairs) for (const v of variantsFor(e, d)) jobs.push({ e, d, ...v });

console.log(`Pares elección×depto: ${pairs.length} | URLs a probar: ${jobs.length} | concurrencia ${CONCURRENCY}`);

// ── Filtro de 404/5xx benignos (recursos OPCIONALES que el cliente sondea) ──────
// catalogo.json: plano fallback. localidad-meta/serie-localidad/barrio/circuito: shards de nivel
// que no existen en toda elección×depto y el cliente degrada. og/favicon: assets no críticos.
const urlBenigna = (url) =>
  /\/catalogo\.json/.test(url) ||
  /(localidad-meta|serie-localidad|-serie-barrio|votes-localidad|votes-barrio|votes-circuito|hoja-localidad|hoja-barrio)\.json/.test(url) ||
  /favicon/.test(url) || /\/og\//.test(url) || /og-.*\.(png|jpg|svg)/.test(url);

// ── Ejecutar con pool de concurrencia ─────────────────────────────────────
const browser = await chromium.launch();
const results = [];
let idx = 0;

async function worker(wid) {
  const ctx = await browser.newContext({ viewport: { width: 1100, height: 800 } });
  const page = await ctx.newPage();
  while (true) {
    const job = jobs[idx++];
    if (!job) break;
    const errs = [];
    // Excepciones JS no atrapadas = las explosiones de verdad.
    const onPageErr = (err) => errs.push('PAGEERROR: ' + (err?.message || String(err)));
    // Errores de consola REALES (no el "Failed to load resource" de un 404 — esos van por response).
    const onConsole = (m) => {
      if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errs.push('console: ' + m.text());
    };
    // 404/5xx con su URL → clasificar benigno/real.
    const onResp = (r) => {
      const s = r.status();
      if (s >= 400 && !urlBenigna(r.url())) errs.push(`HTTP ${s}: ${r.url().replace(BASE, '')}`);
    };
    page.on('pageerror', onPageErr);
    page.on('console', onConsole);
    page.on('response', onResp);
    let navOk = true;
    try {
      await page.goto(BASE + job.url, { waitUntil: 'load', timeout: 20000 });
      await page.waitForTimeout(1600); // hidratación de islas (client:idle/load) + fetches async
    } catch (e) {
      navOk = false;
      errs.push('NAV: ' + (e?.message || String(e)));
    }
    page.off('pageerror', onPageErr);
    page.off('console', onConsole);
    page.off('response', onResp);
    const real = [...new Set(errs)];
    results.push({ ...job, navOk, real });
    if (real.length) console.log(`  ✗ [${job.tag}] ${job.url}\n      ${real.join('\n      ')}`);
  }
  await ctx.close();
}

await Promise.all(Array.from({ length: CONCURRENCY }, (_, i) => worker(i)));
await browser.close();

// ── Reporte ───────────────────────────────────────────────────────────────
const fails = results.filter((r) => r.real.length || !r.navOk);
console.log(`\n=== RESUMEN ===`);
console.log(`URLs probadas: ${results.length}`);
console.log(`Con errores reales: ${fails.length}`);
if (fails.length) {
  const porEleccion = {};
  for (const f of fails) porEleccion[f.e] = (porEleccion[f.e] || 0) + 1;
  console.log('Por elección:', JSON.stringify(porEleccion));
  console.log('\n--- Detalle ---');
  for (const f of fails) console.log(`[${f.e}/${f.d}] [${f.tag}] ${f.url}\n   ${f.real.join('\n   ') || '(nav fail)'}`);
} else {
  console.log('✅ Sin explosiones: ninguna URL con errores de consola/JS no benignos.');
}
