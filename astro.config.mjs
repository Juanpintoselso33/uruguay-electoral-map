// @ts-check
import { defineConfig } from 'astro/config';
import vue from '@astrojs/vue';
import vercel from '@astrojs/vercel';
import tailwindcss from '@tailwindcss/vite';
import sitemap from '@astrojs/sitemap';
import vercelCorsHeaders from './scripts/vercel-cors-headers.mjs';

// https://astro.build/config
export default defineConfig({
  // URL de producción — necesaria para sitemap y meta og:url absolutos.
  site: 'https://uruguay-electoral-map.vercel.app',
  // Sitio estático servido por CDN (dato inmutable, sin backend). Ver architecture.md §NFR5.
  output: 'static',
  // Redirect de raíz INSTANTÁNEO: el adapter Vercel lo emite como redirect HTTP de plataforma
  // (no una página HTML con meta-refresh, que mostraba el "flash" de redirección).
  redirects: {
    '/': '/internas-2024/montevideo',
  },
  // Deploy en Vercel. El adapter es la fuente de verdad del deploy (reemplaza vercel.json).
  adapter: vercel(),
  // vercelCorsHeaders va DESPUÉS del adapter en el orden de hooks (el adapter se
  // antepone solo), así inyecta CORS/cache en config.json una vez que el adapter
  // ya lo escribió. Ver scripts/vercel-cors-headers.mjs.
  integrations: [vue(), sitemap(), vercelCorsHeaders()],
  vite: {
    plugins: [tailwindcss()],
    server: {
      watch: {
        // public/data tiene ~2700 JSONs / 360 MB — excluirlos del watcher
        // evita que chokidar los cargue en memoria durante `astro dev`.
        ignored: ['**/public/data/**'],
      },
    },
  },
});
