// @ts-check
import { defineConfig } from 'astro/config';
import vue from '@astrojs/vue';
import vercel from '@astrojs/vercel';
import tailwindcss from '@tailwindcss/vite';

// https://astro.build/config
export default defineConfig({
  // Sitio estático servido por CDN (dato inmutable, sin backend). Ver architecture.md §NFR5.
  output: 'static',
  // Deploy en Vercel. El adapter es la fuente de verdad del deploy (reemplaza vercel.json).
  adapter: vercel(),
  integrations: [vue()],
  vite: {
    plugins: [tailwindcss()],
  },
});
