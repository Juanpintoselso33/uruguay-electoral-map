// @ts-check
import { defineConfig } from 'astro/config';
import vue from '@astrojs/vue';
import vercel from '@astrojs/vercel';
import tailwindcss from '@tailwindcss/vite';
import sitemap from '@astrojs/sitemap';

// https://astro.build/config
export default defineConfig({
  // URL de producción — necesaria para sitemap y meta og:url absolutos.
  site: 'https://uruguay-electoral-map.vercel.app',
  // Sitio estático servido por CDN (dato inmutable, sin backend). Ver architecture.md §NFR5.
  output: 'static',
  // Deploy en Vercel. El adapter es la fuente de verdad del deploy (reemplaza vercel.json).
  adapter: vercel(),
  integrations: [vue(), sitemap()],
  vite: {
    plugins: [tailwindcss()],
  },
});
