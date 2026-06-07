/**
 * UX smoke de PRODUCCIÓN: maneja el sitio vivo con Chromium real y ejercita los
 * selectores/botones/combinaciones, ASERTANDO que las interacciones producen resultado
 * correcto (no solo que no tiran error). Cubre 1 elección por TIPO + las históricas
 * nuevas, en MVD + interior + vista nacional.
 *
 * Verdict por página:
 *   - FAIL  → excepción no atrapada / 404 INESPERADO / aserción funcional fallida.
 *   - INFO  → 404 de dato OPCIONAL (hoja-local/circuito, catalogo, serie-annexed…): la app
 *             los maneja con .catch (mismo patrón que eleccionSinHojaBase). No es bug.
 *
 * Uso: BASE=https://... node scripts/ux-smoke-prod.mjs
 */
import { chromium } from 'playwright';

const BASE = process.env.BASE || 'https://uruguay-electoral-map.vercel.app';

const PAGES = [
  '/internas-2024/montevideo',
  '/nacionales-2024/montevideo',
  '/balotaje-2024/montevideo',
  '/departamentales-2025/montevideo',
  '/municipales-2025/montevideo',
  '/plebiscito-seguridad-social-2024/montevideo',
  '/referendum-luc-2022/montevideo',
  '/plebiscito-vivir-sin-miedo-2019/montevideo',
  '/internas-2014/montevideo',
  '/departamentales-2015/montevideo',
  '/internas-2009/montevideo',
  '/nacionales-2009/montevideo',
  '/balotaje-2009/montevideo',
  '/departamentales-2010/montevideo',
  '/municipales-2010/montevideo',
  '/municipales-2010/canelones',
  '/municipales-2010',
  '/nacionales-2024/canelones',
  '/internas-2014/canelones',
  '/departamentales-2025/salto',
  '/nacionales-2024',
];

// 404 de dato OPCIONAL → tolerado (la app degrada limpio). Resto de 404 → inesperado.
const OPTIONAL_404 = [
  /\/hoja-local\.json$/,
  /\/hoja-circuito\.json$/,
  /\/hoja-local\//,
  /\/hoja\//,
  /\/catalogo\.json$/,
  /\/serie-annexed\.json$/,
  /\/zona-annexed\.json$/,
  /\/serie-localidad\.json$/,
  /\/localidad-meta\.json$/,
  /\/intendentes(-zona)?\.json$/,
  /\/alcaldes\.json$/,
  /\/concejos\.json$/,
  /\/hoja-equivalencias\//,
];
const ASSET_IGNORE = [/favicon/i, /\.(png|jpg|svg|woff2?|ico)(\?|$)/i];
const isOptional404 = (u) => OPTIONAL_404.some((re) => re.test(u));
const isAsset = (u) => ASSET_IGNORE.some((re) => re.test(u));

async function exercise(page) {
  const fails = [];
  const info = [];

  // 1) La isla del mapa debe montar (canvas) — si no, la página está rota.
  const hasCanvas = await page.waitForSelector('.map canvas', { timeout: 20000 }).then(() => true).catch(() => false);
  if (!hasCanvas) { fails.push('ASSERT: no montó el canvas del mapa'); return { fails, info }; }
  await page.waitForTimeout(1500);

  // 2) Cambiar de nivel geográfico (zona/serie/circuito/local/municipio) — no debe romper.
  try {
    const btns = await page.$$('.level-sel .seg button, .gran-sel .seg button');
    let switched = 0;
    for (const b of btns.slice(0, 6)) {
      if (await b.isEnabled().catch(() => false)) {
        await b.click({ timeout: 4000 }).catch(() => {});
        await page.waitForTimeout(700);
        switched++;
      }
    }
    if (!(await page.$('.map canvas'))) fails.push('ASSERT: el canvas desapareció tras cambiar de nivel');
    info.push(`niveles probados: ${switched}`);
  } catch (e) { fails.push('INTERACT[levels]: ' + e.message); }

  // 3) Toggle de vista (ganador ↔ selección) + compare — no debe romper.
  try {
    for (const sel of ['.vista-toggle__btn', '.cmp-view__btn']) {
      for (const b of (await page.$$(sel)).slice(0, 3)) {
        await b.click({ timeout: 4000 }).catch(() => {});
        await page.waitForTimeout(500);
      }
    }
  } catch (e) { fails.push('INTERACT[vista]: ' + e.message); }

  // 4) ASERCIÓN: OpcionAccordion abre y muestra OPCIONES (listas/sublemas/candidatos).
  try {
    const toggle = await page.$('.acc__toggle, .acc button[aria-expanded]');
    if (toggle) { await toggle.click({ timeout: 4000 }).catch(() => {}); await page.waitForTimeout(700); }
    // expandir lemas para que aparezcan listas
    for (const ex of (await page.$$('.acc__expand, .acc [role="treeitem"] .acc__chevron')).slice(0, 4)) {
      await ex.click({ timeout: 2500 }).catch(() => {}); await page.waitForTimeout(300);
    }
    const opciones = await page.$$('.acc [role="treeitem"], .acc__lista, .acc__hoja, .acc__cb');
    if (opciones.length === 0) fails.push('ASSERT: el selector de opción no muestra NINGUNA opción');
    else info.push(`opciones en accordion: ${opciones.length}`);
    // seleccionar un par → modo selección
    for (const it of opciones.slice(0, 3)) { await it.click({ timeout: 2500 }).catch(() => {}); await page.waitForTimeout(400); }
  } catch (e) { fails.push('INTERACT[accordion]: ' + e.message); }

  // 5) ASERCIÓN: click en el mapa abre la FICHA (ZoneSheet) con contenido.
  try {
    const canvas = await page.$('.map canvas');
    const box = canvas ? await canvas.boundingBox() : null;
    let fichaOk = false;
    if (box) {
      // Barrido denso: cubre también latitudes bajas (sur) para la vista nacional de municipales,
      // donde los polígonos son islas chicas y dispersas (gran parte del país sin municipio en 2010)
      // y los clicks centrales caen en hueco. No es bug de la app: es geometría rala.
      const fxs = [0.5, 0.42, 0.58, 0.35, 0.65, 0.3, 0.7, 0.8];
      const fys = [0.5, 0.4, 0.6, 0.72, 0.82, 0.88];
      const pts = fys.flatMap((fy) => fxs.map((fx) => [fx, fy]));
      for (const [fx, fy] of pts) {
        await canvas.click({ position: { x: box.width * fx, y: box.height * fy }, timeout: 4000 }).catch(() => {});
        await page.waitForTimeout(450);
        // ficha con contenido real: el árbol o el cuerpo con texto
        const body = await page.$('.zone-sheet__arbol, .zone-sheet__body, .zone-sheet__cands');
        const txt = body ? (await body.innerText().catch(() => '')) : '';
        if (txt && txt.trim().length > 3) { fichaOk = true; break; }
      }
    }
    if (!fichaOk) fails.push('ASSERT: click en el mapa NO abrió una ficha con contenido');
  } catch (e) { fails.push('INTERACT[ficha]: ' + e.message); }

  // 6) Theme toggle.
  try {
    const tt = await page.$('.tt-sw, button[aria-label*="tema" i], button[aria-label*="theme" i]');
    if (tt) { await tt.click({ timeout: 3000 }).catch(() => {}); await page.waitForTimeout(400); }
  } catch (e) { fails.push('INTERACT[theme]: ' + e.message); }

  return { fails, info };
}

const browser = await chromium.launch();
const results = [];
for (const path of PAGES) {
  const ctx = await browser.newContext({ viewport: { width: 1366, height: 900 } });
  const page = await ctx.newPage();
  const fails = [];
  const opt404 = new Set();
  page.on('console', (m) => {
    if (m.type() !== 'error') return;
    const t = m.text();
    if (/Failed to load resource/i.test(t)) return; // el 404 ya se captura en 'response'
    if (!isAsset(t)) fails.push('CONSOLE: ' + t);
  });
  page.on('pageerror', (e) => fails.push('PAGEERROR: ' + e.message));
  page.on('response', (r) => {
    const s = r.status();
    if (s < 400) return;
    const u = r.url().replace(BASE, '');
    if (isAsset(u)) return;
    if (isOptional404(u)) opt404.add(`${s} ${u}`);
    else fails.push(`HTTP ${s} INESPERADO: ${u}`);
  });
  let info = [];
  try {
    await page.goto(BASE + path, { waitUntil: 'domcontentloaded', timeout: 45000 });
    const r = await exercise(page);
    fails.push(...r.fails);
    info = r.info;
  } catch (e) { fails.push('NAV/EXC: ' + e.message); }
  const uniqFails = [...new Set(fails)];
  results.push({ path, fails: uniqFails, opt404: [...opt404], info });
  const tag = uniqFails.length ? `❌ ${uniqFails.length}` : '✅';
  console.log(`${tag.padEnd(5)} ${path}   ${info.join(' · ')}${opt404.size ? `  (opt404: ${opt404.size})` : ''}`);
  uniqFails.slice(0, 8).forEach((e) => console.log('      FAIL · ' + e.slice(0, 180)));
  await ctx.close();
}
await browser.close();

const broken = results.filter((r) => r.fails.length);
console.log(`\n=== UX smoke prod: ${results.length - broken.length}/${results.length} funcionalmente OK ===`);
const totalOpt = results.reduce((n, r) => n + r.opt404.length, 0);
console.log(`(404s de dato opcional tolerados, total ${totalOpt} — degradación limpia, no-bug)`);
if (broken.length) {
  console.log('\nPÁGINAS CON FALLO FUNCIONAL:');
  broken.forEach((r) => { console.log(`  ${r.path}`); r.fails.forEach((f) => console.log('     - ' + f.slice(0, 180))); });
  process.exit(1);
}
console.log('TODO FUNCIONALMENTE OK ✅');
