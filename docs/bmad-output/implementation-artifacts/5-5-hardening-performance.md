# Story 5.5 — Hardening de performance en gama baja

**Status:** Done  
**Epic:** 5 — Pulido y robustez  
**Branch:** rebuild/bmad-astro

## Objetivo

Garantizar LCP<2.5s, INP<200ms, CLS<0.1 en un Android de gama baja con CPU throttling 4x, sin que el mapa se reinicialice al navegar entre rutas.

## Diagnóstico pre-fix

```
LCP 968ms  ✅
CLS 0.1184 ❌  ← única falla
INP 152ms  ✅
TBT 2654ms (diagnóstico — MapLibre init, no parte del NFR1)
```

## Causa raíz del CLS

`OpcionSelector` es una isla `client:idle`. En SSR renderiza el estado de carga (~71px):
- `.opcion-selector__header` + `<p>Cargando opciones…</p>` + padding

Al hidratar en cliente, `onMounted` fetch-ea `opciones.json` y monta el listbox completo (~231px):
- header (22px) + `.opcion-selector__lista` (max-height 12rem = 192px) + padding (16px)

Diferencia: **+160px** que empuja hacia abajo LevelSelector y el contenedor del mapa → CLS = 0.1184.

*El API de Layout Shift reportaba el mapa con height 480→323 porque solo la porción visible dentro del viewport (844px) se contabiliza en `currentRect.height`.*

## Fix

`min-height: 15rem` en `.opcion-selector` → reserva espacio desde el SSR equivalente al estado cargado. No requiere skeleton, no cambia lógica JS.

```css
.opcion-selector {
  padding: 0.5rem 1rem;
  border-bottom: 1px solid var(--color-border);
  font-size: 0.875rem;
  min-height: 15rem; /* evita CLS durante hidratación */
}
```

**Archivo:** `src/components/selectors/OpcionSelector.vue`

## Resultado post-fix

```
=== Core Web Vitals (mobile, CPU 4x) — NFR1 ===
  LCP  400ms (budget 2500) ✅
  CLS  0     (budget 0.1)  ✅
  INP  104ms (budget 200)  ✅
  · TBT carga ≈ 2368ms (init MapLibre — diagnóstico, no NFR1)

=== CWV PASA (NFR1) ✅ ===
```

Todos los gates verdes: perf-budget ✅ · a11y ✅ · cwv ✅.

## Estado del mapa al navegar

NFR1 (no re-inicialización) ya estaba implementado vía `transition:persist` en `#map-persist`. Verificado: el mapa sobrevive la navegación entre departamentos sin destruir/recrear la instancia MapLibre.
