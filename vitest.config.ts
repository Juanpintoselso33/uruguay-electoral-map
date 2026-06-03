/// <reference types="vitest/config" />
/**
 * Config de Vitest (Epic 18). Reusa la config de Vite resuelta por Astro vía `getViteConfig`
 * → hereda el plugin de Vue (SFC), los alias y el transform de TS sin duplicar setup.
 *
 * Alcance: funciones puras de `src/lib/**` y componentes Vue (`@vue/test-utils` sobre jsdom).
 * Los componentes `.astro` NO se unit-testean (SSR) → quedan para `astro build` + Playwright.
 *
 * Convención: tests junto al archivo bajo prueba como `*.test.ts` (o `*.spec.ts`).
 */
import { getViteConfig } from 'astro/config';

export default getViteConfig({
  test: {
    environment: 'jsdom',
    include: ['src/**/*.{test,spec}.ts'],
    // `globals` apagado a propósito: los tests importan { describe, it, expect } de 'vitest'
    // → sin tocar tsconfig ni contaminar el scope global del resto del código.
    globals: false,
  },
});
