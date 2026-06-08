/**
 * Integración Astro: configura la superficie pública de la API en
 * `.vercel/output/config.json` (formato Build Output API):
 *   1. Headers CORS + cache para /api/v1/** y /data/**.
 *   2. Rewrites que desacoplan el contrato v1 del layout interno de archivos:
 *        /api/v1/results/{elec}/{depto}/{archivo}  ->  /data/{elec}/{depto}/{archivo}
 *        /api/v1/geo/{depto}/{archivo}             ->  /data/geo/{depto}/{archivo}
 *
 * Por qué una integración y no `vercel.json` ni un paso npm post-build:
 *   - Un `vercel.json` en la raíz rompe el deploy del adapter @astrojs/vercel en
 *     `output: 'static'` (confirmado con A/B; ver PR #26).
 *   - Vercel no necesariamente corre `npm run build`: con el preset Astro corre
 *     `astro build`, así que un paso encadenado en el script `build` se saltearía
 *     en silencio. Una integración corre SIEMPRE que corra `astro build`.
 *   - El feature nativo `experimentalStaticHeaders` del adapter solo cubre rutas
 *     Astro (CSP por ruta), no los estáticos de `public/` que sirven la API.
 *
 * Orden de ejecución: el adapter se `unshift`ea al frente de `config.integrations`
 * (astro/dist/integrations/hooks.js), de modo que su hook `astro:build:done`
 * —que escribe `config.json`— corre ANTES que esta integración. Por eso acá ya
 * existe el archivo y podemos insertar las routes justo antes del handle
 * `filesystem`. Orden de inserción: headers (continue) primero para que el CORS
 * quede adherido a la respuesta, luego los rewrites; el handle `filesystem` sirve
 * el archivo de /data ya reescrito.
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

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

// Rewrites del contrato v1 -> archivos reales en /data. No llevan `continue`:
// reescriben `dest` y el handle `filesystem` sirve el archivo resultante.
const REWRITE_ROUTES = [
  { src: '^/api/v1/results/(.+)$', dest: '/data/$1' },
  { src: '^/api/v1/geo/(.+)$', dest: '/data/geo/$1' },
];

const MARKER_SRC = HEADER_ROUTES[0].src; // para idempotencia

export default function vercelCorsHeaders() {
  return {
    name: 'vercel-api-routes',
    hooks: {
      // Gate de contrato + completitud de la API ANTES del build. Corre en Vercel (que ejecuta
      // `astro build`, no `npm run build`), así que un index/dumps/openapi obsoleto frente a /data
      // ABORTA el deploy en vez de derivar en silencio. Ver scripts/gate-api-contract.mjs.
      'astro:build:start': ({ logger }) => {
        const gate = fileURLToPath(new URL('./gate-api-contract.mjs', import.meta.url));
        try {
          execFileSync('node', [gate], { stdio: 'inherit' });
        } catch {
          throw new Error('[vercel-api] gate de API falló — la API está obsoleta frente a /data. '
            + "Corré 'npm run etl:api-index' y 'npm run etl:api-dumps <eleccion>' y commiteá.");
        }
      },
      'astro:build:done': ({ logger }) => {
        const configPath = fileURLToPath(new URL('../.vercel/output/config.json', import.meta.url));
        if (!existsSync(configPath)) {
          logger?.warn?.('[vercel-api] sin .vercel/output/config.json (¿adapter no-Vercel?) — no se configuran routes.');
          return;
        }
        const config = JSON.parse(readFileSync(configPath, 'utf-8'));
        if (!Array.isArray(config.routes)) config.routes = [];

        // Idempotencia: si ya están, no duplicar.
        if (config.routes.some((r) => r && r.src === MARKER_SRC && r.continue)) {
          logger?.info?.('[vercel-api] routes ya presentes — sin cambios.');
          return;
        }

        const fsIdx = config.routes.findIndex((r) => r && r.handle === 'filesystem');
        const at = fsIdx === -1 ? config.routes.length : fsIdx;
        // Headers primero (CORS adherido), luego rewrites; ambos antes de filesystem.
        config.routes.splice(at, 0, ...HEADER_ROUTES, ...REWRITE_ROUTES);

        writeFileSync(configPath, JSON.stringify(config, null, 2));
        logger?.info?.(
          `[vercel-api] inyectadas ${HEADER_ROUTES.length} header-routes + ${REWRITE_ROUTES.length} rewrites (antes de filesystem, idx ${at}).`
        );
      },
    },
  };
}
