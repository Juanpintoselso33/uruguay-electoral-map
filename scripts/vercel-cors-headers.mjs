/**
 * Integración Astro: inyecta headers CORS + cache en `.vercel/output/config.json`
 * (formato Build Output API).
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
 * existe el archivo y podemos insertar las header-routes con `continue: true`
 * justo antes del handle `filesystem` (igual que hace el propio adapter para CSP).
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

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

export default function vercelCorsHeaders() {
  return {
    name: 'vercel-cors-headers',
    hooks: {
      'astro:build:done': ({ logger }) => {
        const configPath = fileURLToPath(new URL('../.vercel/output/config.json', import.meta.url));
        if (!existsSync(configPath)) {
          logger?.warn?.('[vercel-cors] sin .vercel/output/config.json (¿adapter no-Vercel?) — no se inyectan headers.');
          return;
        }
        const config = JSON.parse(readFileSync(configPath, 'utf-8'));
        if (!Array.isArray(config.routes)) config.routes = [];

        // Idempotencia: si ya están, no duplicar.
        if (config.routes.some((r) => r && r.src === HEADER_ROUTES[0].src && r.continue)) {
          logger?.info?.('[vercel-cors] header-routes ya presentes — sin cambios.');
          return;
        }

        const fsIdx = config.routes.findIndex((r) => r && r.handle === 'filesystem');
        const at = fsIdx === -1 ? config.routes.length : fsIdx;
        config.routes.splice(at, 0, ...HEADER_ROUTES);

        writeFileSync(configPath, JSON.stringify(config, null, 2));
        logger?.info?.(`[vercel-cors] inyectadas ${HEADER_ROUTES.length} header-routes en config.json (antes de filesystem, idx ${at}).`);
      },
    },
  };
}
