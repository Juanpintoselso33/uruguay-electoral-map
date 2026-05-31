---
baseline_commit: 5061e17
---

# Story 2.6: Entrada en frío + progressive disclosure

Status: done

## Story

As a ciudadano que llega sin contexto,
I want un punto de partida claro,
so that encuentre rápido mi departamento sin abrumarme.

## Acceptance Criteria

1. **Given** la ruta `/` **Then** la página muestra un título claro, la elección activa (internas 2024), y un selector de departamento.
2. **Given** el selector de departamento **Then** los departamentos disponibles (Montevideo, Rivera) son links navegables; los 17 restantes aparecen griseados con estado "Próximamente" — no son links.
3. **Given** la página de inicio **Then** las herramientas avanzadas (selector de opción, nivel, ficha) NO están visibles — están a un clic (en la página del depto).
4. **Given** la página de inicio **Then** NO hay geolocalización, mapa en la portada, ni interactividad compleja; es HTML estático.
5. **Given** SEO básico **Then** `<title>` y `<meta description>` tienen contenido significativo (no el placeholder de Story 1.1).
6. **Given** mobile **Then** la cuadrícula de departamentos es legible y usable (targets ≥44px, texto visible).
7. **Given** la pagina de inicio **Then** `astro check` 0 · `npm run build` verde.

## Tasks / Subtasks

- [ ] **Task 1: Reescribir `src/pages/index.astro` (AC: 1–6)**
  - [ ] Eliminar `HelloIsland` y el stub de Story 1.1.
  - [ ] Añadir hero: título "Mapa Electoral Uruguay", subtítulo "Internas 2024 — escrutinio definitivo", fuente "Corte Electoral".
  - [ ] Añadir cuadrícula de los 19 departamentos:
    - Disponibles: `<a href="/internas-2024/{dept}">` con estilo card activo.
    - No disponibles: `<span>` con texto gris + "Próximamente" (no link, `aria-disabled`).
  - [ ] Título y meta description significativos.
  - [ ] Sin islas Vue (`client:*`) — HTML estático puro.

- [ ] **Task 2: Verificar (AC: 1–7)**
  - [ ] Clic en Montevideo → navega a `/internas-2024/montevideo`.
  - [ ] Clic en Rivera → navega a `/internas-2024/rivera`.
  - [ ] Deps no disponibles no son clicables.
  - [ ] Mobile viewport: cuadrícula legible, targets ≥44px.
  - [ ] `astro check` 0 · `npm run build` verde.

## Dev Notes

### Lista completa de departamentos (Uruguay, 19)

```typescript
const DEPARTAMENTOS = [
  { slug: 'artigas',       nombre: 'Artigas',       disponible: false },
  { slug: 'canelones',     nombre: 'Canelones',      disponible: false },
  { slug: 'cerro_largo',   nombre: 'Cerro Largo',    disponible: false },
  { slug: 'colonia',       nombre: 'Colonia',        disponible: false },
  { slug: 'durazno',       nombre: 'Durazno',        disponible: false },
  { slug: 'flores',        nombre: 'Flores',         disponible: false },
  { slug: 'florida',       nombre: 'Florida',        disponible: false },
  { slug: 'lavalleja',     nombre: 'Lavalleja',      disponible: false },
  { slug: 'maldonado',     nombre: 'Maldonado',      disponible: false },
  { slug: 'montevideo',    nombre: 'Montevideo',      disponible: true  },
  { slug: 'paysandu',      nombre: 'Paysandú',       disponible: false },
  { slug: 'rio_negro',     nombre: 'Río Negro',      disponible: false },
  { slug: 'rivera',        nombre: 'Rivera',          disponible: true  },
  { slug: 'rocha',         nombre: 'Rocha',           disponible: false },
  { slug: 'salto',         nombre: 'Salto',           disponible: false },
  { slug: 'san_jose',      nombre: 'San José',        disponible: false },
  { slug: 'soriano',       nombre: 'Soriano',         disponible: false },
  { slug: 'tacuarembo',    nombre: 'Tacuarembó',      disponible: false },
  { slug: 'treinta_y_tres', nombre: 'Treinta y Tres', disponible: false },
];
```

### HTML estático — sin islas

Esta página es SSG pura. No necesita nanostores, commit, ni ningún import de Vue/stores. El ClientRouter de Astro (`<Base>`) maneja la navegación.

### Progressive disclosure — estado actual

Las herramientas avanzadas ya viven en `/[eleccion]/[departamento]`. La portada solo muestra el punto de entrada. El ciudadano llega → elige departamento → entra al mapa → desde ahí explora opciones/nivel/ficha. No hace falta ninguna lógica adicional.

### Meta tags

```astro
<Base
  title="Mapa Electoral Uruguay — Internas 2024"
  description="Explorá los resultados de las elecciones internas 2024 por departamento y barrio. Datos del escrutinio definitivo de la Corte Electoral."
>
```

### Estructura del hero

```
Uruguay Electoral Map
Internas 2024 — escrutinio definitivo
[Fuente: Corte Electoral Uruguay]

Elegí un departamento para explorar los resultados:

[Cuadrícula 19 departamentos]
```

### Diseño de la cuadrícula

CSS Grid: `repeat(auto-fill, minmax(140px, 1fr))` — se adapta a mobile. Cada card:
- Disponible: link, fondo blanco, borde, hover sutil, nombre capitalizado.
- No disponible: `<span>` (no link), fondo gris claro, texto gris, badge "Próximamente" pequeño.
- Altura mínima 44px para cumplir NFR2.

### Eliminar HelloIsland

`HelloIsland.vue` (stub de Story 1.1) puede quedar en el filesystem por ahora pero deja de importarse en `index.astro`. No eliminar el archivo todavía (puede haber tests que lo referencien).

### Referencias

- [epics.md § Story 2.6, FR25, FR26, UX-DR14] · [architecture.md § index.astro (FR26)] · [Base.astro] · [global.css tokens]

## Dev Agent Record

### Agent Model Used
claude-sonnet-4-6
