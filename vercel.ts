/**
 * Configuración de deploy en Vercel para Uruguay Electoral Map.
 *
 * NOTA: el mecanismo real de deploy es el adapter `@astrojs/vercel`
 * configurado en `astro.config.mjs` (output: 'static'). Este archivo
 * reemplaza al viejo `vercel.json` y documenta los ajustes de proyecto
 * de forma tipada. Cuando `@vercel/config` (vercel.ts oficial) esté GA en
 * el proyecto, migrar este objeto a `export const config: VercelConfig`.
 *
 * Ver architecture.md §Infrastructure & Deployment (AR2).
 */
export const deployConfig = {
  framework: 'astro',
  buildCommand: 'astro build',
  outputDirectory: 'dist',
  // Sitio estático: sin functions en MVP. OG-images se generan en build (Epic 3).
  // Headers de cache para artefactos de datos inmutables se definen en su historia.
} as const;

export default deployConfig;
