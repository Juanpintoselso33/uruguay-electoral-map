# Coloreo del mapa por ganador a cualquier nivel — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que el modo *Ganador* del mapa pueda colorear por la opción ganadora a nivel lema / precandidato / sublema / lista (selector `gnivel`), con paleta en cascada determinística desde el lema padre y un seam de apariencia listo para SVGs custom.

**Architecture:** Toda la lógica nueva vive detrás de funciones PURAS en `src/lib/appearance.ts` (`grupoKeyDeOpcion`, `winnerAtLevel`, `cascadeShade`, `resolveOpcionAppearance`) + un registry vacío `appearance-overrides.ts`. `ChoroplethMap.vue` las cablea: el selector `gnivel` (en URL), `catalogoOpcMeta` ampliado con `sublemaId`/`precandidatoId`/`etiqueta`, y `buildSeleccionGanadorFC`/leyenda reescritos sobre el core puro. Verificación al estilo del repo: `scripts/gate-appearance.ts` (tsx) para las funciones puras + `npm run check` + Playwright.

**Tech Stack:** Astro 5 + Vue 3.5 (Composition API), nanostores, MapLibre GL 5, TypeScript, tsx (gates). **No hay vitest** → los "tests" son asserts en un gate tsx.

**Spec:** `docs/superpowers/specs/2026-06-03-coloreo-ganador-por-nivel-design.md`

**Alcance v1 (refinamiento del spec):** el coloreo por sub-nivel aplica al **choropleth de zonas**. Los **dots de circuito** siguen a nivel lema (los circuitos agregan por sigla; subirlos a sub-nivel queda trivial vía el resolver pero fuera de v1). Heatmap/Share intactos.

---

## File Structure

- **Create** `src/lib/appearance.ts` — núcleo puro: tipo `Nivel`, `NIVEL_LABEL`, `grupoKeyDeOpcion`, `winnerAtLevel`, `cascadeShade` (+ hex↔hsl), `resolveOpcionAppearance`. Una responsabilidad: "dado un nivel y metadata, quién gana y cómo se ve".
- **Create** `src/lib/appearance-overrides.ts` — registry `APARIENCIA_OVERRIDES` (vacío). Único lugar a tocar para SVGs custom.
- **Create** `scripts/gate-appearance.ts` — asserts puros (roll-up, determinismo, fallbacks, clamp). Script `gate:appearance`.
- **Modify** `src/lib/url-state.ts` — campo `gnivel` en `MapView` + parse/serialize.
- **Modify** `src/stores/map-state.ts` — `gnivel` en `hydrateStores`/`currentView`.
- **Modify** `src/components/map/ChoroplethMap.vue` — `catalogoOpcMeta` ampliado; `gnivel` ref + selector; `buildSeleccionGanadorFC`/`buildSeleccionGanadorLegend` reescritos sobre el core; path "absoluto sub-nivel" (sin selección); leyenda agrupada.
- **Modify** `src/components/map/MapLegend.vue` — entradas con `subEntradas` opcionales (agrupado por lema) sin romper el uso actual.
- **Modify** `package.json` — script `gate:appearance`.

---

## Task 1: Núcleo puro de niveles y ganador (`appearance.ts` + gate)

**Files:**
- Create: `src/lib/appearance.ts`
- Create: `scripts/gate-appearance.ts`
- Modify: `package.json` (scripts)

- [ ] **Step 1: Escribir el gate que falla** — `scripts/gate-appearance.ts`

```ts
/**
 * Gate de las funciones puras de apariencia (no hay vitest en el repo → asserts en tsx).
 * Ejecuta: `npm run gate:appearance`. Falla con exit≠0 si algún assert no se cumple.
 */
import { grupoKeyDeOpcion, winnerAtLevel, cascadeShade, type OpcMeta } from '../src/lib/appearance';

let fail = 0;
function ok(cond: boolean, msg: string): void {
  if (!cond) { console.error(`  ✗ ${msg}`); fail++; } else { console.log(`  ✓ ${msg}`); }
}

// Fixture: 1 lema (PN) con 2 precandidatos, cada uno con 2 sublemas, cada sublema 1 lista.
const META: Record<string, OpcMeta> = {
  'h1': { lemaId: 'pn', precandidatoId: 'pn-a', sublemaId: 'pn-a-s1' },
  'h2': { lemaId: 'pn', precandidatoId: 'pn-a', sublemaId: 'pn-a-s2' },
  'h3': { lemaId: 'pn', precandidatoId: 'pn-b', sublemaId: 'pn-b-s1' },
  'h4': { lemaId: 'fa', precandidatoId: 'fa-a', sublemaId: undefined }, // FA sin sublema
};
const metaOf = (id: string): OpcMeta | undefined => META[id];

// grupoKeyDeOpcion: clave por nivel + fallbacks
ok(grupoKeyDeOpcion('h1', 'lema', metaOf) === 'pn', 'lema → lemaId');
ok(grupoKeyDeOpcion('h1', 'precandidato', metaOf) === 'pn-a', 'precandidato → precandidatoId');
ok(grupoKeyDeOpcion('h1', 'sublema', metaOf) === 'pn-a-s1', 'sublema → sublemaId');
ok(grupoKeyDeOpcion('h1', 'lista', metaOf) === 'h1', 'lista → opcionId');
ok(grupoKeyDeOpcion('h4', 'sublema', metaOf) === 'fa-a', 'sublema sin dato → fallback precandidato');
ok(grupoKeyDeOpcion('h1', 'candidato', metaOf) === 'h1', 'candidato (terminal) → opcionId');

// winnerAtLevel + roll-up exacto: Σ por sublema == total por lema en una zona
const votos = new Map<string, number>([['h1', 10], ['h2', 30], ['h3', 5], ['h4', 100]]);
ok(winnerAtLevel(votos, metaOf, 'lema').key === 'fa', 'lema ganador = FA (100)');
ok(winnerAtLevel(votos, metaOf, 'sublema').key === 'fa-a', 'sublema ganador = fa-a (100)');
ok(winnerAtLevel(votos, metaOf, 'precandidato').key === 'fa-a', 'precandidato ganador = fa-a');
const totalPN = 10 + 30 + 5;
const sumaSublemasPN = ['pn-a-s1', 'pn-a-s2', 'pn-b-s1']
  .reduce((acc, k) => acc + winnerAtLevel(votos, metaOf, 'sublema').totals[k] ?? 0, 0);
ok(sumaSublemasPN === totalPN, 'roll-up: Σ sublemas PN == total PN');

// cascadeShade determinístico: misma key → mismo hex; distinta key → distinto (en general)
ok(cascadeShade('#1e40af', 'pn-a-s1') === cascadeShade('#1e40af', 'pn-a-s1'), 'cascadeShade determinístico');
ok(/^#[0-9a-fA-F]{6}$/.test(cascadeShade('#1e40af', 'pn-a-s1')), 'cascadeShade devuelve hex válido');

console.log(fail === 0 ? '✓ gate-appearance OK' : `✗ ${fail} fallas`);
process.exit(fail === 0 ? 0 : 1);
```

- [ ] **Step 2: Agregar script y correr el gate para verlo fallar**

En `package.json`, dentro de `"scripts"`, agregar:
```json
"gate:appearance": "npx tsx scripts/gate-appearance.ts",
```
Run: `npm run gate:appearance`
Expected: FAIL — `Cannot find module '../src/lib/appearance'` (todavía no existe).

- [ ] **Step 3: Implementar `src/lib/appearance.ts` (núcleo puro)**

```ts
/**
 * Apariencia y ganador por nivel (lema → precandidato → sublema → lista).
 * Funciones PURAS (sin DOM/red) → testables por scripts/gate-appearance.ts y reusables en SSR.
 * El color base de lema y la bandera vienen de party-meta; este módulo deriva la cascada y
 * resuelve overrides (SVG custom) sin acoplarse al render.
 */
import { resolveParty } from './party-meta';
import { APARIENCIA_OVERRIDES } from './appearance-overrides';

/** Niveles a los que se puede calcular el ganador. 'lista'/'candidato' = terminal. */
export type Nivel = 'lema' | 'precandidato' | 'sublema' | 'lista' | 'candidato';

/** Etiqueta legible del selector de nivel. */
export const NIVEL_LABEL: Record<Nivel, string> = {
  lema: 'Lema',
  precandidato: 'Precandidato',
  sublema: 'Sublema',
  lista: 'Lista',
  candidato: 'Candidato',
};

/** Metadata por opción que el cómputo necesita (subconjunto de catalogoOpcMeta). */
export interface OpcMeta {
  readonly lemaId: string;
  readonly lemaNombre?: string;
  readonly precandidatoId?: string;
  readonly sublemaId?: string;
  /** Etiqueta del nodo terminal (lista→"609"/hoja; candidato→nombre). */
  readonly hoja?: string;
  readonly etiqueta?: string;
}

type MetaOf = (opcionId: string) => OpcMeta | undefined;

/** Clave de agrupación del ganador a un nivel, con fallback al padre disponible. */
export function grupoKeyDeOpcion(opcionId: string, nivel: Nivel, metaOf: MetaOf): string {
  const m = metaOf(opcionId);
  if (!m) return opcionId;
  switch (nivel) {
    case 'lema': return m.lemaId || opcionId;
    case 'precandidato': return m.precandidatoId || m.lemaId || opcionId;
    case 'sublema': return m.sublemaId || m.precandidatoId || m.lemaId || opcionId;
    case 'lista':
    case 'candidato': return opcionId;
  }
}

/** Ganador a un nivel dado un mapa opcionId→votos. Devuelve la clave ganadora, sus votos,
 *  y el total por clave (para roll-up/leyenda). */
export function winnerAtLevel(
  votos: Map<string, number>,
  metaOf: MetaOf,
  nivel: Nivel,
): { key: string | null; votos: number; totals: Record<string, number> } {
  const totals: Record<string, number> = {};
  for (const [oid, v] of votos) {
    if (v <= 0) continue;
    const k = grupoKeyDeOpcion(oid, nivel, metaOf);
    totals[k] = (totals[k] ?? 0) + v;
  }
  let key: string | null = null;
  let best = 0;
  for (const k in totals) if (totals[k] > best) { best = totals[k]; key = k; }
  return { key, votos: best, totals };
}

// ── Cascada de color determinística (hex ↔ hsl) ────────────────────────────────
function hexToHsl(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16) / 255;
  const g = parseInt(h.slice(2, 4), 16) / 255;
  const b = parseInt(h.slice(4, 6), 16) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let hue = 0; const l = (max + min) / 2; const d = max - min;
  const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));
  if (d !== 0) {
    if (max === r) hue = ((g - b) / d) % 6;
    else if (max === g) hue = (b - r) / d + 2;
    else hue = (r - g) / d + 4;
    hue *= 60; if (hue < 0) hue += 360;
  }
  return [hue, s, l];
}
function hslToHex(hue: number, s: number, l: number): string {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((hue / 60) % 2) - 1));
  const mm = l - c / 2;
  let r = 0, g = 0, b = 0;
  if (hue < 60) [r, g, b] = [c, x, 0];
  else if (hue < 120) [r, g, b] = [x, c, 0];
  else if (hue < 180) [r, g, b] = [0, c, x];
  else if (hue < 240) [r, g, b] = [0, x, c];
  else if (hue < 300) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];
  const to = (v: number): string => Math.round((v + mm) * 255).toString(16).padStart(2, '0');
  return `#${to(r)}${to(g)}${to(b)}`;
}
function hashStr(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return (h >>> 0);
}
/** Tono determinístico derivado del color del lema: varía la luminosidad ±, estable por `key`. */
export function cascadeShade(baseHex: string, key: string): string {
  const [h, s, l] = hexToHsl(baseHex);
  // 6 escalones de luminosidad en [-0.18, +0.18] alrededor del lema, elegidos por hash.
  const steps = [-0.18, -0.11, -0.05, 0.05, 0.11, 0.18];
  const dl = steps[hashStr(key) % steps.length];
  const nl = Math.min(0.82, Math.max(0.2, l + dl));
  return hslToHex(h, Math.max(0.25, s), nl);
}

// ── Resolver de apariencia (el seam para SVGs custom) ──────────────────────────
export interface OpcAppearance {
  readonly color: string;
  readonly label: string;
  readonly sigla: string;           // del lema padre → agrupa leyenda
  readonly pattern: { kind: 'flag' | 'custom'; id: string; url: string } | null;
}

/** Resuelve color/label/ícono de la clave ganadora a un nivel. `nodeLabel` mapea nodeId→etiqueta
 *  (de catalogo.nodos) para sublema/precandidato; `terminalLabel` arma "Lista N" para listas. */
export function resolveOpcionAppearance(
  key: string,
  nivel: Nivel,
  eleccion: string,
  ctx: { lemaNombre: string; nodeLabel?: string; terminalLabel?: string },
): OpcAppearance {
  const party = resolveParty(ctx.lemaNombre, eleccion);
  const override = APARIENCIA_OVERRIDES[`${eleccion}:${nivel}:${key}`] ?? APARIENCIA_OVERRIDES[key];
  if (nivel === 'lema') {
    return {
      color: override?.color ?? party.color,
      label: ctx.lemaNombre,
      sigla: party.sigla,
      pattern: override?.svgUrl
        ? { kind: 'custom', id: `svg-${key}`, url: override.svgUrl }
        : party.flagUrl ? { kind: 'flag', id: `flag-${party.sigla.toLowerCase()}`, url: party.flagUrl } : null,
    };
  }
  const label = ctx.nodeLabel ?? ctx.terminalLabel ?? key;
  return {
    color: override?.color ?? cascadeShade(party.color, key),
    label,
    sigla: party.sigla,
    pattern: override?.svgUrl ? { kind: 'custom', id: `svg-${key}`, url: override.svgUrl } : null,
  };
}
```

- [ ] **Step 4: Implementar el registry vacío `src/lib/appearance-overrides.ts`**

```ts
/**
 * Overrides de apariencia por opción (sublema/lista) — el seam para SVGs/logos custom.
 * Keyed por `${eleccion}:${nivel}:${key}` (preferente) o por `key` suelto (reusar entre años).
 * VACÍO por ahora. Ejemplo futuro:
 *   'internas-2024:sublema:frente-amplio-ana-olivera-sl-mpp': { svgUrl: '/icons/mpp.svg' },
 *   'frente-amplio-...-sl-mpp': { color: '#7c3aed', svgUrl: '/icons/mpp.svg' },
 */
export interface AparienciaOverride {
  readonly color?: string;
  readonly svgUrl?: string;
}
export const APARIENCIA_OVERRIDES: Record<string, AparienciaOverride> = {};
```

- [ ] **Step 5: Correr el gate y type-check**

Run: `npm run gate:appearance && npm run check`
Expected: `✓ gate-appearance OK`; check con 0 errores.

- [ ] **Step 6: Commit**

```bash
git add src/lib/appearance.ts src/lib/appearance-overrides.ts scripts/gate-appearance.ts package.json
git commit -m "feat(appearance): núcleo puro de ganador-por-nivel + cascada + registry de overrides"
```

---

## Task 2: Estado `gnivel` en URL y stores

**Files:**
- Modify: `src/lib/url-state.ts:17-36` (interface), `:53-90` (parse), `:93-114` (serialize)
- Modify: `src/stores/map-state.ts:40-67`

- [ ] **Step 1: Agregar `gnivel` a `MapView`** — en `src/lib/url-state.ts`, dentro de `interface MapView`, después de `modo`:

```ts
  /** Nivel del ganador en el modo Ganador (`?gnivel=`): lema|precandidato|sublema|lista. Default lema. */
  readonly gnivel: string | null;
```

- [ ] **Step 2: Parsear `gnivel`** — en `parseUrl`, en el objeto `return`, después de `modo: orNull(params.get('modo')),`:

```ts
    gnivel: orNull(params.get('gnivel')),
```

- [ ] **Step 3: Serializar `gnivel`** — en `toUrl`, después de `if (view.modo) params.set('modo', view.modo);`:

```ts
  if (view.gnivel && view.gnivel !== 'lema') params.set('gnivel', view.gnivel); // lema = default, se omite
```

- [ ] **Step 4: Volcar `gnivel` a/desde stores** — en `src/stores/map-state.ts`:

En `hydrateStores`, cambiar la línea de `$selection.set` para incluir `gnivel`:
```ts
  $selection.set({ zona: view.zona, opcion: view.opcion, contienda: view.contienda, seleccion: view.seleccion, modo: view.modo, gnivel: view.gnivel });
```
En `currentView`, agregar al objeto devuelto, después de `modo: sel.modo,`:
```ts
    gnivel: sel.gnivel,
```
Y en la interface `Seleccion` (líneas 16-25), después de `readonly modo: string | null;`:
```ts
  /** Nivel del ganador en el modo Ganador (Epic coloreo-por-nivel). */
  readonly gnivel: string | null;
```
Y en el `atom` inicial `$selection` (línea 33), agregar `gnivel: null`:
```ts
export const $selection = atom<Seleccion>({ zona: null, opcion: null, contienda: null, seleccion: [], modo: null, gnivel: null });
```

- [ ] **Step 5: Type-check**

Run: `npm run check`
Expected: 0 errores (todas las construcciones de `MapView` ahora requieren `gnivel`; si alguna falla, agregar `gnivel: null`).

- [ ] **Step 6: Commit**

```bash
git add src/lib/url-state.ts src/stores/map-state.ts
git commit -m "feat(state): gnivel en URL y stores (nivel del ganador)"
```

---

## Task 3: Ampliar `catalogoOpcMeta` con sublema/precandidato/etiqueta

**Files:**
- Modify: `src/components/map/ChoroplethMap.vue:190-191` (tipo), `:900-929` (loader)

- [ ] **Step 1: Ampliar el tipo del Map** — reemplazar la declaración (línea ~190-191):

```ts
// hojaId → metadata del catálogo para coloreo por nivel (Epic coloreo-por-nivel).
let catalogoOpcMeta: Map<string, {
  contienda: string; lemaId: string; hoja: string; lemaNombre: string;
  precandidatoId?: string; sublemaId?: string;
}> | null = null;
/** nodeId → etiqueta (de catalogo.nodos): labels de precandidato/sublema para leyenda. */
let catalogoNodeLabel: Map<string, string> = new Map();
```

- [ ] **Step 2: Poblar los campos nuevos en el loader** — reemplazar el cuerpo del `for (const c of doc.contiendas)` (líneas ~917-923) por:

```ts
        const nodeLabel = catalogoNodeLabel;
        for (const c of doc.contiendas) {
          const lemaNombre = new Map(c.nodos.filter((n) => n.nivel === 'lema').map((n) => [n.id, n.etiqueta]));
          for (const n of c.nodos) nodeLabel.set(n.id, n.etiqueta); // precandidato/sublema/lema
          for (const o of c.opciones) {
            const lemaId = o.lemaId ?? '';
            built.set(o.id, {
              contienda: c.contienda, lemaId, hoja: o.hoja ?? '',
              lemaNombre: lemaNombre.get(lemaId) ?? lemaId,
              precandidatoId: o.precandidatoId, sublemaId: o.sublemaId,
            });
          }
        }
```

Y ampliar el tipo inline del `doc` (líneas ~910-916) para incluir los campos leídos:
```ts
        const doc = (await res.json()) as {
          contiendas: {
            contienda: string;
            niveles: string[];
            nodos: { id: string; nivel: string; etiqueta: string }[];
            opciones: { id: string; hoja?: string; lemaId?: string; precandidatoId?: string; sublemaId?: string }[];
          }[];
        };
```

- [ ] **Step 3: Resetear `catalogoNodeLabel` junto a `catalogoOpcMeta`** — en `reloadData` (donde hace `catalogoOpcMeta = null;`, línea ~1543), agregar:
```ts
  catalogoNodeLabel = new Map();
```

- [ ] **Step 4: Type-check**

Run: `npm run check`
Expected: 0 errores.

- [ ] **Step 5: Commit**

```bash
git add src/components/map/ChoroplethMap.vue
git commit -m "feat(map): catalogoOpcMeta con sublemaId/precandidatoId + node labels"
```

---

## Task 4: Cablear `ganadorDeZona` por nivel + FC/leyenda de selección

**Files:**
- Modify: `src/components/map/ChoroplethMap.vue` — imports (~17), `:189` (ref gnivel), `:1158-1221` (reemplazo de ganadorSelDeZona / buildSeleccionGanadorFC / buildSeleccionGanadorLegend)

- [ ] **Step 1: Importar el núcleo** — junto a `import { resolveParty } ...` (línea ~17):

```ts
import { grupoKeyDeOpcion, winnerAtLevel, resolveOpcionAppearance, type Nivel, type OpcMeta } from '../../lib/appearance';
```

- [ ] **Step 2: Ref de nivel + lectura de selección** — cerca de `const coloreoMode = ref(...)` (línea ~189):

```ts
const gnivel = ref<Nivel>('lema');
/** Niveles agrupables disponibles en la contienda activa (de catalogo.niveles), para el selector. */
const nivelesDisponibles = ref<Nivel[]>(['lema']);
```

- [ ] **Step 3: Helper metaOf + reemplazar el cómputo del ganador** — reemplazar `ganadorSelDeZona` (líneas ~1161-1175) y `buildSeleccionGanadorFC`/`buildSeleccionGanadorLegend` (líneas ~1179-1221) por:

```ts
/** Lookup OpcMeta para el núcleo puro (desde catalogoOpcMeta; plano → solo lemaId=oid). */
function metaOf(oid: string): OpcMeta | undefined {
  const m = catalogoOpcMeta?.get(oid);
  if (m) return { lemaId: m.lemaId, lemaNombre: m.lemaNombre, precandidatoId: m.precandidatoId, sublemaId: m.sublemaId, hoja: m.hoja };
  return { lemaId: oid, lemaNombre: opcNombreMap.get(oid) ?? oid };
}

/** Votos de las opciones del universo en una zona (selección de hojas → mm; base → zonasVotos). */
function votosDeZonaUniverso(key: string, universo: string[]): Map<string, number> {
  const mm = hojaVotos.get(key);
  const base = zonasVotos.get(key);
  const out = new Map<string, number>();
  for (const oid of universo) {
    const v = mm?.get(oid) ?? base?.get(oid) ?? 0;
    if (v > 0) out.set(oid, v);
  }
  return out;
}

/** Apariencia de una clave ganadora al nivel actual (color/sigla/label/pattern). */
function appearanceDeKey(key: string, nivel: Nivel): ReturnType<typeof resolveOpcionAppearance> {
  const lemaNombre = nivel === 'lema'
    ? (catalogoNodeLabel.get(key) ?? opcNombreMap.get(key) ?? key)
    : (() => {
        // key es nodeId (sublema/precand) u opcionId (lista): el lema padre sale de su meta o del prefijo.
        const m = catalogoOpcMeta?.get(key);
        if (m) return m.lemaNombre;
        // nodeId de sublema/precand: su lema es el ancestro; lo tomamos del primer opcionId que lo use.
        return lemaNombrePorNodo(key);
      })();
  const esTerminal = nivel === 'lista' || nivel === 'candidato';
  const terminalLabel = esTerminal ? etiquetaTerminal(key) : undefined;
  const nodeLabel = !esTerminal && nivel !== 'lema' ? catalogoNodeLabel.get(key) : undefined;
  return resolveOpcionAppearance(key, nivel, activeEleccion, { lemaNombre, nodeLabel, terminalLabel });
}

/** Nombre de lema padre de un nodeId de sublema/precandidato (busca una opción que cuelgue de él). */
function lemaNombrePorNodo(nodeId: string): string {
  if (!catalogoOpcMeta) return nodeId;
  for (const m of catalogoOpcMeta.values()) {
    if (m.sublemaId === nodeId || m.precandidatoId === nodeId) return m.lemaNombre;
  }
  return catalogoNodeLabel.get(nodeId) ?? nodeId;
}

/** "Lista N" / "Voto al lema" para un opcionId terminal. */
function etiquetaTerminal(oid: string): string {
  const hoja = catalogoOpcMeta?.get(oid)?.hoja;
  if (hoja === 'vl') return 'Voto al lema';
  return hoja ? `Lista ${hoja}` : (opcNombreMap.get(oid) ?? oid);
}

/** FC del modo "ganador" al nivel actual: cada zona toma el grupo ganador del universo. */
function buildSeleccionGanadorFC(fc: FeatureCollection, sel: string[]): FeatureCollection {
  const nivel = gnivel.value;
  const universo = sel; // sel no vacío en este path (applySeleccion); el caso "todas" es Task 6
  return {
    ...fc,
    features: fc.features.map((f) => {
      const key = norm(String((f.properties as { name: string }).name));
      const validos = zonasValidos.get(key) ?? 0;
      const { key: ganKey, votos } = winnerAtLevel(votosDeZonaUniverso(key, universo), metaOf, nivel);
      if (!ganKey || votos <= 0) {
        const color = validos > 0 ? interpolateHex(INTENSIDAD_LIGHT, SEL_BASE, 0.12) : COLOR_SIN_DATOS;
        return { ...f, properties: { ...f.properties, color, sigla: '', flagPattern: null, selVal: 0, selPct: 0 } };
      }
      const ap = appearanceDeKey(ganKey, nivel);
      const flagPattern = ap.pattern ? ap.pattern.id : null;
      return {
        ...f,
        properties: {
          ...f.properties,
          color: ap.color, sigla: ap.sigla, flagPattern,
          selVal: votos, selPct: validos > 0 ? votos / validos : 0,
        },
      };
    }),
  } as FeatureCollection;
}

/** Leyenda del modo ganador-por-nivel: agrupada por LEMA, con sub-ganadores como sub-entradas. */
function buildSeleccionGanadorLegend(fc: FeatureCollection, sel: string[]): LegendEntry[] {
  const nivel = gnivel.value;
  const winsPorClave = new Map<string, number>();   // claveGanadora → nº zonas
  for (const f of fc.features) {
    const key = norm(String((f.properties as { name: string }).name));
    const { key: ganKey, votos } = winnerAtLevel(votosDeZonaUniverso(key, sel), metaOf, nivel);
    if (ganKey && votos > 0) winsPorClave.set(ganKey, (winsPorClave.get(ganKey) ?? 0) + 1);
  }
  if (nivel === 'lema') {
    return [...winsPorClave.entries()]
      .map(([k, n]) => { const ap = appearanceDeKey(k, nivel); return { sigla: ap.sigla, nombre: ap.label, color: ap.color, votos: n, flagUrl: ap.pattern?.url ?? null }; })
      .sort((a, b) => b.votos - a.votos);
  }
  // Sub-nivel: agrupar por sigla de lema → sub-entradas (cap top-6 + "+N más").
  const porLema = new Map<string, { sigla: string; color: string; flagUrl: string | null; total: number; subs: { nombre: string; color: string; votos: number }[] }>();
  for (const [k, n] of winsPorClave) {
    const ap = appearanceDeKey(k, nivel);
    let e = porLema.get(ap.sigla);
    if (!e) { const lap = appearanceDeKey(metaOf(k)?.lemaId ?? k, 'lema'); e = { sigla: ap.sigla, color: lap.color, flagUrl: lap.pattern?.url ?? null, total: 0, subs: [] }; porLema.set(ap.sigla, e); }
    e.total += n; e.subs.push({ nombre: ap.label, color: ap.color, votos: n });
  }
  return [...porLema.values()].sort((a, b) => b.total - a.total).map((e) => {
    const subs = e.subs.sort((a, b) => b.votos - a.votos);
    const top = subs.slice(0, 6);
    const masN = subs.length - top.length;
    return { sigla: e.sigla, nombre: '', color: e.color, votos: e.total, flagUrl: e.flagUrl, subEntradas: top, masN };
  });
}
```

> Nota: `LegendEntry` se amplía con `subEntradas?`/`masN?` en Task 7. `winnerAtLevel`'s `key` para sub-niveles devuelve el nodeId (sublema/precand) o el opcionId (lista); `metaOf(k)?.lemaId` funciona cuando `k` es un opcionId (lista); para nodeId de sublema usamos `appearanceDeKey`→`lemaNombrePorNodo`.

- [ ] **Step 4: Type-check + gate**

Run: `npm run check && npm run gate:appearance`
Expected: 0 errores; gate OK.

- [ ] **Step 5: Commit**

```bash
git add src/components/map/ChoroplethMap.vue
git commit -m "feat(map): ganador por nivel en FC y leyenda de selección"
```

---

## Task 5: Derivar `nivelesDisponibles` + clamp de `gnivel` por contienda

**Files:**
- Modify: `src/components/map/ChoroplethMap.vue` — loader de catálogo (~929, tras poblar) y `reloadData`

- [ ] **Step 1: Calcular niveles agrupables de la contienda activa** — agregar helper cerca de `metaOf`:

```ts
/** Niveles del selector para una contienda: sus `niveles` de catálogo mapeados a Nivel.
 *  hoja→'lista'. Siempre incluye 'lema'. Plano (1 nivel) → solo ['lema'] (selector oculto). */
function nivelesDeContienda(niveles: string[]): Nivel[] {
  const map: Record<string, Nivel> = { lema: 'lema', precandidato: 'precandidato', sublema: 'sublema', hoja: 'lista', candidato: 'candidato' };
  const out = niveles.map((n) => map[n]).filter(Boolean) as Nivel[];
  return out.length > 1 ? out : ['lema'];
}
```

- [ ] **Step 2: Guardar niveles por contienda al cargar el catálogo** — en el loader, dentro del `for (const c of doc.contiendas)`, acumular un `Map<contienda, Nivel[]>`. Agregar antes del loop: `const nivPorCont = new Map<string, Nivel[]>();` y dentro: `nivPorCont.set(c.contienda, nivelesDeContienda(c.niveles));`. Tras poblar (`catalogoOpcMeta = built;`), guardar en un módulo-level `let catalogoNivelesPorCont = nivPorCont;` (declararlo junto a `catalogoNodeLabel`).

- [ ] **Step 3: Recomputar `nivelesDisponibles` + clamp al cambiar de contienda** — crear función y llamarla tras cargar catálogo y en el subscribe de `$selection` cuando cambia `contienda`:

```ts
function syncNivelesDisponibles(): void {
  const cont = $selection.get().contienda ?? [...(catalogoNivelesPorCont.keys())][0];
  nivelesDisponibles.value = (cont && catalogoNivelesPorCont.get(cont)) || ['lema'];
  if (!nivelesDisponibles.value.includes(gnivel.value)) {
    gnivel.value = 'lema';            // clamp: la contienda no tiene ese nivel
  }
}
```
Llamarla: (a) al final del `.then`/await donde se usa `ensureCatalogo`; (b) en el subscribe de `$selection` (donde ya se lee `s.contienda`), agregando `syncNivelesDisponibles();`.

- [ ] **Step 4: Leer `gnivel` inicial del store** — donde se lee `coloreoMode` del estado inicial/subscribe (líneas ~1827 y ~2000), agregar el espejo:
```ts
  if (s.gnivel === 'lema' || s.gnivel === 'precandidato' || s.gnivel === 'sublema' || s.gnivel === 'lista' || s.gnivel === 'candidato') gnivel.value = s.gnivel;
```
(En ambos sitios; usar `initSel.gnivel` en el de `onMounted`.)

- [ ] **Step 5: Type-check**

Run: `npm run check`
Expected: 0 errores.

- [ ] **Step 6: Commit**

```bash
git add src/components/map/ChoroplethMap.vue
git commit -m "feat(map): niveles disponibles por contienda + clamp de gnivel"
```

---

## Task 6: Path "absoluto" (sin selección) por sub-nivel + re-aplicar al cambiar gnivel

**Files:**
- Modify: `src/components/map/ChoroplethMap.vue` — `setColoreo`/nuevo `setGnivel`, `applySeleccion`/restore

- [ ] **Step 1: `setGnivel` + reaplicar** — junto a `setColoreo` (línea ~1285):

```ts
/** Cambia el nivel del ganador (URL → subscribe re-aplica el coloreo). */
function setGnivel(nivel: Nivel): void {
  gnivel.value = nivel;
  commit({ gnivel: nivel });
  // Re-aplicar: con selección → applySeleccion; sin selección y sub-nivel → ganador absoluto por nivel.
  if (seleccionActiva.value.length > 0) void applySeleccion();
  else void aplicarGanadorAbsolutoPorNivel();
}
```

- [ ] **Step 2: Ganador absoluto por sub-nivel (sin selección)** — nueva función. Carga todos los shards de hoja de la contienda (universo = todas las opciones) y reusa `buildSeleccionGanadorFC` con ese universo. Para nivel 'lema' restaura el FC base actual.

```ts
/** Sin selección: colorea por el ganador ABSOLUTO al nivel actual.
 *  nivel 'lema' → FC base (restore). Sub-nivel → carga todos los shards de hoja y computa winnerAtLevel. */
async function aplicarGanadorAbsolutoPorNivel(): Promise<void> {
  const m = map.value; const fc = fcRef.value;
  if (!m || !fc || !m.getSource('zonas')) return;
  if (gnivel.value === 'lema') { restoreGanadorDesdeSeleccion(); return; }
  await ensureCatalogo(activeEleccion, activeDepartamento);
  const universo = [...(catalogoOpcMeta?.keys() ?? [])].filter((id) => metaOf(id)?.contienda === ($selection.get().contienda ?? metaOf(id)?.contienda));
  await ensureHojaShards(activeEleccion, activeDepartamento, universo); // carga todos los lemas de la contienda
  const selFC = buildSeleccionGanadorFC(fc, universo);
  (m.getSource('zonas') as GeoJSONSource).setData(selFC); zonasDisplayFC = selFC;
  m.setPaintProperty('zonas-fill', 'fill-color', ['get', 'color']);
  seleccionFCActive = true;
  setPatternVisible(true);
  rebuildMarkers(selFC);
  legend.value = buildSeleccionGanadorLegend(fc, universo);
}
```

> Nota perf: `universo` se limita a las opciones de la **contienda activa**; los shards de hoja son por-lema-por-barrio (chicos). En internas MVD son ~15 lemas. Documentar en el código.

- [ ] **Step 3: `buildSeleccionGanadorFC`/Legend reciben el universo** — ya reciben `sel`; en Task 4 se llamó con `sel`. Confirmar que en `applySeleccion` (modo ganador) sigue pasando `sel`, y en `aplicarGanadorAbsolutoPorNivel` pasa `universo`. (Ambos son `string[]`.)

- [ ] **Step 4: Type-check + Playwright smoke** (manual)

Run: `npm run check`
Expected: 0 errores.

- [ ] **Step 5: Commit**

```bash
git add src/components/map/ChoroplethMap.vue
git commit -m "feat(map): ganador absoluto por sub-nivel sin selección + setGnivel"
```

---

## Task 7: Selector `gnivel` en la UI + leyenda agrupada (MapLegend)

**Files:**
- Modify: `src/components/map/ChoroplethMap.vue` — template (~2094, junto al toggle de coloreo) + tipo `LegendEntry`
- Modify: `src/components/map/MapLegend.vue`

- [ ] **Step 1: Ampliar `LegendEntry`** — buscar la interface `LegendEntry` (en ChoroplethMap o lib) y agregar:
```ts
  subEntradas?: { nombre: string; color: string; votos: number }[];
  masN?: number;
```

- [ ] **Step 2: Selector de nivel en el template** — en `ChoroplethMap.vue`, justo después del bloque `<div v-if="seleccionActiva.length > 0" ... aria-label="Modo de coloreo del mapa">...</div>` (línea ~2094-2103), agregar:

```vue
    <!-- Selector de nivel del ganador — solo en modo Ganador y si la contienda tiene >1 nivel -->
    <div
      v-if="coloreoMode === 'ganador' && nivelesDisponibles.length > 1"
      class="gnivel" role="group" aria-label="Nivel del ganador"
    >
      <span class="gnivel__lbl">Ganador por:</span>
      <button
        v-for="nv in nivelesDisponibles" :key="nv"
        type="button"
        class="gnivel__btn"
        :class="{ 'gnivel__btn--activo': gnivel === nv }"
        :aria-pressed="gnivel === nv"
        @click="setGnivel(nv)"
      >{{ NIVEL_LABEL[nv] }}</button>
    </div>
```
Importar `NIVEL_LABEL` (agregar a la import de `../../lib/appearance`). Exponerlo al template: en `<script setup>` ya es accesible si está importado; si no, asignar `const nivelLabel = NIVEL_LABEL` y usar `nivelLabel`.

Notar: el toggle de coloreo solo aparece con `seleccionActiva.length > 0`. Para que el selector de nivel también sirva **sin selección**, su `v-if` usa `coloreoMode === 'ganador'` (no depende de selección). Como sin selección el modo base ya es "ganador", se mostrará en la vista base cuando la contienda tenga niveles.

- [ ] **Step 3: Estilos del selector** (en el `<style scoped>` de ChoroplethMap, reusando tokens):

```css
.gnivel { display: flex; flex-wrap: wrap; align-items: center; gap: 0.375rem; padding: 0.25rem 0.75rem 0.5rem; font-size: 0.75rem; }
.gnivel__lbl { color: var(--color-ink-muted); font-weight: 600; }
.gnivel__btn { padding: 0.2rem 0.55rem; border: 1px solid var(--color-border-strong); border-radius: 9999px; background: var(--color-surface-1); color: var(--color-ink-soft); cursor: pointer; min-height: 30px; }
.gnivel__btn--activo { background: var(--color-ink); color: var(--color-paper); border-color: var(--color-ink); }
.gnivel__btn:focus-visible { outline: 2px solid var(--color-focus); outline-offset: 2px; }
```

- [ ] **Step 4: Render de sub-entradas en `MapLegend.vue`** — tras el `<div v-for="e in entradas" class="legend__item">`, agregar dentro del item (o como bloque hijo) el render de `subEntradas`:

```vue
      <span v-if="e.masN" class="legend__mas">+{{ e.masN }}</span>
```
Y un bloque de sub-chips bajo cada item cuando hay `subEntradas` (nueva fila):
```vue
    <div v-if="e.subEntradas && e.subEntradas.length" class="legend__subs">
      <span v-for="s in e.subEntradas" :key="s.nombre" class="legend__sub">
        <span class="legend__swatch" :style="{ background: s.color }" aria-hidden="true"></span>
        {{ s.nombre }} <span class="legend__subn">{{ s.votos }}</span>
      </span>
    </div>
```
Agregar a la interface `Entrada` de MapLegend: `subEntradas?: {nombre:string;color:string;votos:number}[]; masN?: number;`. Estilos `.legend__subs{display:flex;flex-wrap:wrap;gap:0.25rem 0.5rem;width:100%;padding-left:1.25rem;font-size:0.6875rem;color:var(--color-ink-muted)} .legend__sub{display:inline-flex;align-items:center;gap:0.25rem}`.

- [ ] **Step 5: Type-check**

Run: `npm run check`
Expected: 0 errores.

- [ ] **Step 6: Commit**

```bash
git add src/components/map/ChoroplethMap.vue src/components/map/MapLegend.vue
git commit -m "feat(ui): selector 'Ganador por: nivel' + leyenda agrupada por lema"
```

---

## Task 8: Verificación end-to-end (Playwright) + gates

**Files:** ninguno (verificación).

- [ ] **Step 1: Arrancar dev** — `npm run dev` (puerto que reporte, p. ej. 4334).

- [ ] **Step 2: ODN nivel sublema/lista** — navegar `/?…/internas-2024/montevideo?cont=odn`, modo Ganador, click "Ganador por: Sublema". Verificar: el mapa repinta por sublema (tonos del lema), la leyenda agrupa por lema con sub-chips, no explota. Cambiar a "Lista": idem. Screenshot.

- [ ] **Step 3: Selección + nivel** — seleccionar listas de PN y FA en el acordeón; con "Ganador por: Lista" cada zona toma la lista ganadora **entre lo seleccionado**. Verificar URL trae `?gnivel=lista`.

- [ ] **Step 4: Clamp por contienda** — cambiar a una elección plana (balotaje-2024) o contienda sin niveles: el selector desaparece y `gnivel` cae a lema (URL sin `gnivel`).

- [ ] **Step 5: No-regresión** — nivel "Lema" pinta y la leyenda son IDÉNTICOS al comportamiento previo; Heatmap/Share intactos; dots de circuito siguen a nivel lema.

- [ ] **Step 6: Gates** — `npm run check && npm run gate:appearance && npm run gate:escaleras`. Todo verde.

- [ ] **Step 7: Commit** (si hubo ajustes durante la verificación)

```bash
git add -A && git commit -m "test(map): verificación coloreo por nivel (Playwright + gates)"
```

---

## Self-Review (checklist del autor)

- **Cobertura del spec:** selector explícito (T7), universo selección/todas (T4 selección + T6 absoluto), cascada (T1 `cascadeShade`), resolver+overrides (T1/T3), leyenda sin saturar (T7), clamp por contienda (T5), circuitos = lema en v1 (documentado, refinamiento). ✔
- **Sin placeholders:** todo el código pure (T1-T3) es completo; los edits de ChoroplethMap dan código + anclas exactas. ✔
- **Consistencia de tipos:** `Nivel`, `OpcMeta`, `winnerAtLevel().totals`, `LegendEntry.subEntradas/masN`, `gnivel:string|null` en URL ↔ `Nivel` en runtime (clamp valida). ✔
- **Riesgo conocido:** el path "absoluto sub-nivel" (T6) carga todos los shards de hoja de la contienda — bound a la contienda activa; si fuera pesado, degradar a "lema" sin selección y exigir selección para sub-nivel (decisión a confirmar en ejecución).
