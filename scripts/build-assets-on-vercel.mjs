/**
 * Integración Astro: genera en Vercel los artefactos de build que viven en
 * `public/` y que el script `npm run build` produce ANTES de `astro build`.
 *
 * Por qué: Vercel corre `astro build` (build command del preset Astro), NO
 * `npm run build` — confirmado porque `vercel-build: npm run build` fue ignorado
 * (PR #27) y porque las OG (gitignored, generadas por `npm run build`) daban 404
 * en producción. Al saltarse el script npm, nunca se generaban:
 *   - imágenes OG (`public/og/{elec}/{depto}.png`) → 404 al compartir links.
 *   - índice de búsqueda (`public/search-index.json`).
 *
 * Esta integración los genera en `astro:build:start` (antes de que Astro copie
 * `public/` al output), pero SOLO en Vercel (`process.env.VERCEL`): en local
 * `npm run build` ya los genera, y un `astro build` a secas no los necesita, así
 * que no se duplica el trabajo.
 *
 * Nota: los gates (gate-data, gate-escaleras) y vitest del script `build`
 * TAMPOCO corren en Vercel por el mismo motivo. Eso se deja como decisión aparte
 * (correrlos en build:start los volvería bloqueantes del deploy — cambio de
 * comportamiento). Ver memoria [[vercel-deploy-sin-vercel-json]].
 */
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../', import.meta.url));

const STEPS = [
  ['build:manifest', 'node scripts/build-data-manifest.mjs'],
  ['generate:og', 'node scripts/generate-og.mjs'],
  ['generate:search', 'node scripts/generate-search-index.mjs'],
];

export default function buildAssetsOnVercel() {
  return {
    name: 'build-assets-on-vercel',
    hooks: {
      'astro:build:start': ({ logger }) => {
        if (!process.env.VERCEL) {
          logger?.info?.('[build-assets] fuera de Vercel — se omite (los genera `npm run build`).');
          return;
        }
        for (const [label, cmd] of STEPS) {
          logger?.info?.(`[build-assets] ${label}: ${cmd}`);
          execSync(cmd, { cwd: ROOT, stdio: 'inherit' });
        }
      },
    },
  };
}
