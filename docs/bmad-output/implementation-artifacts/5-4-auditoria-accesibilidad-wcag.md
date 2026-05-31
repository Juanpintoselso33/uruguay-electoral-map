# Story 5.4 — Auditoría a11y WCAG 2.2 AA

**Status:** Done  
**Epic:** 5 — Pulido y robustez  
**Branch:** rebuild/bmad-astro

## Objetivo

Auditar y corregir la aplicación para cumplir WCAG 2.2 AA en los criterios críticos aplicables a un mapa electoral.

## Criterios auditados y resultado

| Criterio | Descripción | Estado |
|----------|-------------|--------|
| 1.4.3 | Contraste texto ≥ 4.5:1 (light y dark mode) | ✅ |
| 1.4.11 | Contraste no-texto ≥ 3:1 (bordes de UI components) | ✅ |
| 2.1.1 | Teclado completo (listbox con arrow keys) | ✅ |
| 2.4.1 | Bypass blocks (skip link) | ✅ |
| 2.4.7 | Focus visible (focus-visible en todos los interactivos) | ✅ |

## Cambios implementados

### Skip link (WCAG 2.4.1)
- `src/layouts/Base.astro`: `<a href="#main-content" class="skip-link">` antes del `<slot />`
- `src/styles/global.css`: `.skip-link` fuera del viewport, `.skip-link:focus` lo trae a pantalla
- `src/pages/[eleccion]/[departamento].astro`: `<main id="main-content">`

### Listbox keyboard nav (WCAG 2.1.1 / WAI-ARIA listbox pattern)
- `src/components/selectors/OpcionSelector.vue`:
  - `<ul role="listbox" tabindex="0" :aria-activedescendant="...">`
  - `<li role="option" :aria-selected="..." :id="`opt-${opcionId}`">`
  - `handleListboxKeydown`: ArrowDown/Up/Home/End/Enter/Space
  - `handleListboxFocus` / `handleListboxBlur`
  - CSS: `.opcion-selector__lista:focus-visible`, `.opcion-selector__item--focused`

### Focus visible en chips y clear button (WCAG 2.4.7)
- CSS: `.opcion-selector__clear:focus-visible`, `.opcion-selector__vs-chip:focus-visible`

### Contraste dark mode — texto (WCAG 1.4.3)
Todos los pares verificados (≥4.5:1):
- ink (#E8ECF6) sobre bg (#0E1320): 15.68:1
- ink (#E8ECF6) sobre paper (#151B2B): 14.52:1
- ink-soft (#C1CAE0) sobre card (#28324A): 7.77:1
- ink-muted (#93A0BC) sobre card (#28324A): 4.86:1

### Contraste dark mode — no-texto (WCAG 1.4.11)
Tokens corregidos en `src/styles/global.css` (dark mode):
- `--color-border: #5F6E92` (era #313C56 — 1.69:1; ahora 3.65:1 vs bg) ✅
- `--color-border-strong: #6E7FA5` (era #3A4660 — 1.35:1 vs card; ahora 3.19:1) ✅

El gate `scripts/a11y-check.mjs` verifica cada borde contra su fondo adyacente real:
- `border` vs `--color-bg`: listbox y separadores aparecen sobre el fondo de página
- `border-strong` vs `--color-card`: botones/chips aparecen sobre su propio fondo

## Gate CI (scripts/a11y-check.mjs)

```
=== a11y WCAG 2.2 AA ===
  tabla: 61 barrios, cada uno con sigla TEXTO (color nunca solo) ✅
  contraste sigla/nombre tabla: 17.74:1 ≥ 4.5 ✅
  ...
  skip link presente: .skip-link → #main-content (WCAG 2.4.1) ✅
  listbox: estilos focused presentes (WCAG 2.1.1) ✅
  contraste dark: ink-muted sobre card: 4.86:1 ≥ 4.5 ✅
  contraste no-texto dark: border sobre bg: 3.65:1 ≥ 3 ✅
  contraste no-texto dark: border-strong sobre card: 3.19:1 ≥ 3 ✅

=== a11y WCAG 2.2 AA PASA ✅ ===
```

14/14 checks passing.
