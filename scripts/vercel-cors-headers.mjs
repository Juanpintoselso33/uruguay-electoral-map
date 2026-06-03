#!/usr/bin/env node
/**
 * Post-build: inyecta headers CORS + cache en `.vercel/output/config.json`
 * (formato Build Output API).
 *
 * Por qué no `vercel.json`: un `vercel.json` en la raíz rompe el deploy del
 * adapter @astrojs/vercel en `output: 'static'` (confirmado empíricamente con
 * A/B; ver PR #26). Y el feature nativo `experimentalStaticHeaders` del adapter
 * solo cubre rutas Astro (deriva de CSP por ruta), no los archivos estáticos de
 * `public/` que sirven la API (`/data/**`, `/api/v1/**`).
 *
 * Solución: el adapter ya escribe `.vercel/output/config.json` con un array
 * `routes`. Acá insertamos header-routes (con `continue: true`, para que el
 * request siga hasta el handle `filesystem` y se sirva el archivo) justo antes
 * de ese handle — exactamente como hace el propio adapter para sus CSP headers.
 *
 * Se corre como último paso de `npm run build` (después de `astro build`).
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const CONFIG = fileURLToPath(new URL('../.vercel/output/config.json', import.meta.url));

const CACHE = 'public, max-age=3600, s-maxage=31536000, immutable';

// Build Output API: `headers` es un objeto plano (no el array {key,value} de vercel.json).
const HEADER_ROUTES = [
  {
    src: '^/api/v1/(.*)$',
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
      'Cache-Control': CACHE,
    },
    continue: true,
  },
  {
    src: '^/data/(.*)$',
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': CACHE,
    },
    continue: true,
  },
];

if (!existsSync(CONFIG)) {
  console.error(`[vercel-cors] no existe ${CONFIG} — ¿corrió "astro build" antes?`);
  process.exit(1);
}

const config = JSON.parse(readFileSync(CONFIG, 'utf-8'));
if (!Array.isArray(config.routes)) config.routes = [];

// Idempotencia: si ya están inyectadas (re-build local), no duplicar.
const already = config.routes.some((r) => r && r.src === HEADER_ROUTES[0].src && r.continue);
if (already) {
  console.log('[vercel-cors] header-routes ya presentes — sin cambios.');
  process.exit(0);
}

const fsIdx = config.routes.findIndex((r) => r && r.handle === 'filesystem');
const at = fsIdx === -1 ? config.routes.length : fsIdx;
config.routes.splice(at, 0, ...HEADER_ROUTES);

writeFileSync(CONFIG, JSON.stringify(config, null, 2));
console.log(`[vercel-cors] inyectadas ${HEADER_ROUTES.length} header-routes en config.json (antes de filesystem, idx ${at}).`);
