---
baseline_commit: 1119e9003857ed8773a6982d80ae4ea26ce0e933
---

# Story 5.1: Dark Mode

Status: in-progress

## Story

As a usuario,
I want un modo oscuro,
So that lea cómodo de noche en el celular.

## Acceptance Criteria

1. **Given** los tokens dark del DESIGN.md **When** activo dark mode (o preferencia del sistema) **Then** chrome, mapa y ficha usan el set oscuro con focus-ring-dark y stroke-selected-dark visibles.
2. **Given** dark mode activo **Then** los colores de partido siguen distinguibles sobre fondo oscuro.

## Dev Notes

- Dark mode: `@media (prefers-color-scheme: dark)` — CSS-only, sin toggle.
- CSS custom properties en `:root`, overrides en `@media (prefers-color-scheme: dark)`.
- MapLibre `zonas-sel` stroke: dark mode = `#E8ECF6` (visible sobre fondo oscuro) vs `#111827` (light).
- `COLOR_SIN_DATOS`: dark = `#313C56`, light = `#E5E7EB`.
- Colores de partido: fijos (mismos en ambos modos) — ya distinguibles en fondo oscuro.
- `.zona-sigla` markers: usan `var(--color-ink)` + `var(--color-card)` para shadow → switch automático.

## Tasks

- [ ] global.css: full token set + dark media query
- [ ] Base.astro: `<meta name="color-scheme" content="light dark">`
- [ ] [departamento].astro: dark: Tailwind variants en nav/header
- [ ] EleccionSelector.vue: dark: Tailwind variants
- [ ] CompareControls.vue: dark: Tailwind variants
- [ ] OpcionSelector.vue: CSS vars en scoped styles
- [ ] LevelSelector.vue: CSS vars en scoped styles
- [ ] ZoneSheet.vue: CSS vars en scoped styles
- [ ] MapLegend.vue: CSS vars en scoped styles
- [ ] ShareButton.vue: CSS vars en scoped styles
- [ ] Sello.astro: CSS vars en styles
- [ ] DataTable.astro: CSS vars en styles
- [ ] ChoroplethMap.vue: JS dark detection + CSS vars en scoped styles

## Story Completion Checklist

- [ ] ACs verificados en browser con dark mode OS activo
- [ ] `astro check` sin errores TS
- [ ] Commit `feat(ui): dark mode via CSS tokens y prefers-color-scheme (Story 5.1)`
- [ ] `sprint-status.yaml`: `5-1-dark-mode: done`
