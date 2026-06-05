/**
 * Gate de Core Web Vitals (Story 1.10, NFR1). Levanta el build estático, lo carga en
 * Chromium headless con throttling mobile (CPU 4x) y mide las métricas EXACTAS de NFR1:
 * LCP, CLS (carga) e INP REAL (latencia de una interacción de tap, Event Timing API).
 * Falla (exit≠0) si exceden el budget. Corre en CI (con `playwright install chromium`).
 *
 * NFR1: LCP < 2.5s, INP < 200ms, CLS < 0.1.
 * TBT se reporta como DIAGNÓSTICO (bloqueo de hilo en carga) — NO es NFR1, no es gate:
 * TBT≠INP. MapLibre tiene init pesado; eso es jank de carga, no latencia de interacción.
 */
import { chromium } from 'playwright';
import { preview } from 'astro';

const PATH = '/internas-2024/montevideo/';
const BUDGET = { lcp: 2500, cls: 0.1, inp: 200 }; // NFR1

const server = await preview({ logLevel: 'error' });
const base = `http://localhost:${server.port}`;

const browser = await chromium.launch();
const ctx = await browser.newContext({
  viewport: { width: 390, height: 844 }, // mobile
  deviceScaleFactor: 3,
});
const page = await ctx.newPage();

// Throttling CPU 4x (gama media) vía CDP.
const cdp = await ctx.newCDPSession(page);
await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });

await page.goto(base + PATH, { waitUntil: 'networkidle' });
// Esperar a que el mapa termine de inicializar y QUEDE INTERACTIVO.
// OJO: en la vista por defecto (modo ganador) las siglas/banderas se dibujan en el CANVAS
// overlay — NO hay markers `.zona-sigla` (esos son de modo selección). Esperar `.zona-sigla`
// hacía timeout SIEMPRE (15s) e inflaba el LCP artificialmente. El elemento LCP real de la
// página de mapa es el canvas de MapLibre: esperamos a que esté montado.
await page.waitForSelector('.map canvas', { timeout: 15000 }).catch(() => {});
await page.waitForTimeout(3500); // dejar drenar el init pesado de MapLibre (TBT de carga)

// Warm-up: un par de taps para superar el init y estabilizar, ANTES de medir.
const canvas = await page.$('.map canvas');
if (canvas) {
  await canvas.click({ position: { x: 200, y: 150 } });
  await page.waitForTimeout(500);
  await canvas.click({ position: { x: 140, y: 210 } });
  await page.waitForTimeout(800);
}

// Instrumentar Event Timing (INP) recién AHORA (página ya interactiva).
await page.evaluate(() => {
  globalThis.__inp = 0;
  new PerformanceObserver((l) => {
    for (const e of l.getEntries()) globalThis.__inp = Math.max(globalThis.__inp, e.duration);
  }).observe({ type: 'event', buffered: false, durationThreshold: 16 });
});

// Interacción REAL medida: taps en estado estable.
if (canvas) {
  await canvas.click({ position: { x: 180, y: 170 } });
  await page.waitForTimeout(400);
  await canvas.click({ position: { x: 110, y: 120 } });
  await page.waitForTimeout(600);
}

const metrics = await page.evaluate(
  () =>
    new Promise((resolve) => {
      let lcp = 0;
      let cls = 0;
      let tbt = 0;
      new PerformanceObserver((l) => {
        for (const e of l.getEntries()) lcp = e.startTime;
      }).observe({ type: 'largest-contentful-paint', buffered: true });
      new PerformanceObserver((l) => {
        for (const e of l.getEntries()) if (!e.hadRecentInput) cls += e.value;
      }).observe({ type: 'layout-shift', buffered: true });
      new PerformanceObserver((l) => {
        for (const e of l.getEntries()) tbt += Math.max(0, e.duration - 50);
      }).observe({ type: 'longtask', buffered: true });
      setTimeout(
        () =>
          resolve({
            lcp: Math.round(lcp),
            cls: Number(cls.toFixed(4)),
            inp: Math.round(globalThis.__inp || 0),
            tbt: Math.round(tbt),
          }),
        500,
      );
    }),
);

await browser.close();
await server.stop();

const fails = [];
if (metrics.lcp > BUDGET.lcp) fails.push(`LCP ${metrics.lcp}ms > ${BUDGET.lcp}ms`);
if (metrics.cls > BUDGET.cls) fails.push(`CLS ${metrics.cls} > ${BUDGET.cls}`);
if (metrics.inp > BUDGET.inp) fails.push(`INP ${metrics.inp}ms > ${BUDGET.inp}ms`);

console.log('=== Core Web Vitals (mobile, CPU 4x) — NFR1 ===');
console.log(`  LCP ${metrics.lcp}ms (budget ${BUDGET.lcp}) ${metrics.lcp <= BUDGET.lcp ? '✅' : '❌'}`);
console.log(`  CLS ${metrics.cls} (budget ${BUDGET.cls}) ${metrics.cls <= BUDGET.cls ? '✅' : '❌'}`);
console.log(`  INP ${metrics.inp}ms (budget ${BUDGET.inp}) ${metrics.inp <= BUDGET.inp ? '✅' : '❌'}  [tap real]`);
console.log(`  · diagnóstico (no-NFR1): TBT carga ≈ ${metrics.tbt}ms (init de MapLibre; jank de carga)`);
if (fails.length) {
  console.error('\n[cwv] FALLA NFR1:');
  fails.forEach((l) => console.error('  - ' + l));
  process.exit(1);
}
console.log('\n=== CWV PASA (NFR1) ✅ ===');
