---
baseline_commit: 88e1091
---

# Story 3.3: Meta-tags por ruta + SEO

Status: done

## Story

As a usuario que busca en Google,
I want que el sitio sea encontrable,
so that llegue por búsqueda.

## Acceptance Criteria

1. **Given** cada ruta SSG `{eleccion}/{departamento}` **When** se renderiza **Then** tiene `<title>`, `<meta name="description">`, `<meta property="og:*">` y `<meta name="twitter:*">` propios con la OG-image generada por Story 3.2.
2. **Given** la ruta raíz `/` **Then** tiene su propio título/descripción genérico.
3. **Given** el build **Then** genera un `sitemap.xml` con todas las rutas canónicas.
4. **Given** cada ruta **Then** tiene `<link rel="canonical">` apuntando a la URL canónica.
5. **Given** `astro check` y `npm run build` **Then** 0 errores; sitemap presente en `dist/sitemap-index.xml` o `dist/sitemap.xml`.

## Tasks / Subtasks

- [ ] **Task 1: Instalar @astrojs/sitemap (AC: 3)**
  - [ ] `npm install --save-dev @astrojs/sitemap`
  - [ ] Añadir `site` URL en `astro.config.mjs`
  - [ ] Añadir integración `sitemap()` en `astro.config.mjs`

- [ ] **Task 2: Ampliar Base.astro con OG/Twitter meta-tags (AC: 1, 2, 4)**
  - [ ] Añadir props: `ogImage?: string`, `ogType?: string`, `canonical?: string`
  - [ ] Generar las 9 meta-tags necesarias: og:title, og:description, og:image, og:url, og:type, og:locale, twitter:card, twitter:title, twitter:description

- [ ] **Task 3: Pasar meta-props desde [departamento].astro (AC: 1)**
  - [ ] Calcular `description` por ruta: "Resultados por zona del departamento X en Y."
  - [ ] Pasar `ogImage` como `/og/{eleccion}/{departamento}.png`
  - [ ] Pasar `canonical` como URL canónica de la ruta

- [ ] **Task 4: Verificación (AC: 1–5)**
  - [ ] `npm run build` → `dist/sitemap*.xml` existe
  - [ ] Revisar HTML generado: contiene `<meta property="og:image">`

## Dev Notes

### Meta-tags en Base.astro

```astro
---
interface Props {
  title?: string;
  description?: string;
  ogImage?: string;
  canonical?: string;
}

const {
  title = 'Uruguay Electoral Map',
  description = 'Explorador electoral interactivo de Uruguay por departamento y zona.',
  ogImage,
  canonical,
} = Astro.props;

const siteUrl = Astro.site?.toString().replace(/\/$/, '') ?? '';
const ogImageAbs = ogImage ? `${siteUrl}${ogImage}` : undefined;
const canonicalUrl = canonical ? `${siteUrl}${canonical}` : undefined;
---

<head>
  <title>{title}</title>
  <meta name="description" content={description} />
  {canonicalUrl && <link rel="canonical" href={canonicalUrl} />}
  <meta property="og:title" content={title} />
  <meta property="og:description" content={description} />
  <meta property="og:type" content="website" />
  <meta property="og:locale" content="es_UY" />
  {ogImageAbs && <meta property="og:image" content={ogImageAbs} />}
  {ogImageAbs && <meta property="og:image:width" content="1200" />}
  {ogImageAbs && <meta property="og:image:height" content="630" />}
  {canonicalUrl && <meta property="og:url" content={canonicalUrl} />}
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content={title} />
  <meta name="twitter:description" content={description} />
  {ogImageAbs && <meta name="twitter:image" content={ogImageAbs} />}
</head>
```

### astro.config.mjs

```js
import sitemap from '@astrojs/sitemap';

export default defineConfig({
  site: 'https://uruguay-electoral-map.vercel.app',
  integrations: [vue(), sitemap()],
  // ...
});
```

### Archivos a crear/modificar

| Acción | Archivo |
|--------|---------|
| UPDATE | `astro.config.mjs` — añadir `site` + integración `sitemap()` |
| UPDATE | `src/layouts/Base.astro` — añadir meta OG/Twitter |
| UPDATE | `src/pages/[eleccion]/[departamento].astro` — pasar ogImage y description |

## Dev Agent Record

### Agent Model Used
claude-sonnet-4-6
