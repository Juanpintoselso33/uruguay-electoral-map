# Rediseño de la ficha de zona/local — desglose completo, agrupado por tipo de elección, con per-circuito

- **Fecha:** 2026-06-05
- **Autora del spec:** Sally (UX) · **Pedido por:** Juan
- **Componentes:** `src/components/sheet/ZoneSheet.vue`, `src/components/map/ChoroplethMap.vue` (`buildDesglose`), ETL de nivel local/circuito.
- **Relacionado:** Epic 17 (circuito/local), `2026-06-02-ficha-por-circuito-local-design.md`, Epic 10 (granularidad por hoja).

## Problema

La ficha hoy tiene **dos vistas que compiten** y ninguna muestra el desglose completo por sí sola:
- **Sin selección** → `resultadoZona`: ranking **plano de lemas** (ganador + %). Sin sublema/precandidato, sin listas.
- **Con selección** → `desglose`: muestra listas, pero **agrupadas solo por lema** y **truncadas a `TOP = 10`** (`ChoroplethMap.vue:1233,1268`) con "+N más" duro.

Síntomas reportados por Juan (todos del mismo origen):
1. Al clickear un local se ve el **agregado**, no cómo votó **cada circuito** adentro.
2. Aparece **solo el ganador**, no el desglose por lista/candidato/sublema.
3. El desglose **recién aparece al filtrar/seleccionar** una opción.
4. **"+25 más…"** trunca; debe mostrar **todo siempre**.
5. **No hay comportamiento por tipo de elección** (ej. internas debería agrupar por sublema departamental/nacional y precandidato).

## Principio de diseño

> La ficha **siempre** renderiza el **árbol completo** de la contienda activa, derivado de los `niveles[]` que el catálogo **ya declara**. El comportamiento por tipo de elección **emerge del catálogo** — sin ramas `if (tipo === ...)`.

| Elección | `contiendas[].niveles[]` | Árbol en la ficha |
|---|---|---|
| Internas ODN | `lema → precandidato → sublema → hoja` | Lema ▸ Precandidato ▸ Sublema ▸ Lista |
| Internas ODD | `lema → sublema → hoja` | Lema ▸ Sublema ▸ Lista |
| Nacionales (legislativo) | `lema → sublema → hoja` | Lema ▸ Sublema ▸ Lista |
| Balotaje | `lema` | Lemas/candidatos (plano) |
| Plebiscito / Referéndum | `opción` | Sí / No (plano) |
| Departamentales | por contienda (intendente / junta / municipio) | Árbol de la contienda activa |
| Municipales | `municipio`/lema | Árbol de la contienda municipal |

**La selección deja de ser requisito**: muestra el árbol completo siempre; la selección del acordeón pasa a ser **resaltado** (highlight de los nodos seleccionados), no precondición.

## Decisiones del usuario (2026-06-05)

- **Expansión por defecto: TODO EXPANDIDO.** Al abrir la ficha, el árbol está desplegado hasta cada lista. Se puede colapsar (chevrons en cada nodo) pero el estado inicial es completo. Control "Colapsar/Expandir todo". **Nada se trunca nunca.**
- **Per-circuito: ENTREGA ÚNICA con ETL.** Se retiene per-circuito × per-opción en las 14 elecciones para que cada circuito del local se expanda a su desglose real desde el inicio.

## UX / Layout objetivo

```
▾ Local · CLUB ATLÉTICO BOHEMIOS
  Gabriel Pereira 3025 · 2.011 habilitados · 3 circuitos
  Ganó acá:  🔵 PN  36.7% · 633 votos

  ── Resultado por lista ───────────────  [⤢ Colapsar todo]
  ▾ 🔵 PN  Partido Nacional            36.7%   633
       ▾ Sublema "Por el Cambio"       21.1%   364
            Lista 404                  12.3%   212
            Lista 71                    8.8%   152
       ▾ Sublema "Adelante"            15.6%   269
            …todas las listas…
  ▾ 🟣 FA  Frente Amplio               25.1%   433   …
  ▾ 🔴 PC  Partido Colorado            23.0%   397   …
  …todos los lemas, nada se corta…

  ── Circuitos que votan acá ───────────
  ▾ Circuito 121   🔵 PN ganó · 612 válidos
        🔵 PN 41% · 🟣 FA 28% · 🔴 PC 22% · …   ← desglose por opción del circuito
  ▾ Circuito 122   🟣 FA ganó · 588 válidos
        …
  ▾ Circuito 123   🔵 PN ganó · 524 válidos

  Participación 88.6% · Válidos 1.724 · Blanco 15 · Anul. 13 · Obs. 9
  Corte Electoral — escrutinio definitivo
```

Reglas visuales:
- % siempre sobre **votos válidos** de la zona (mismo denominador que el ganador), igual que hoy (`pctValidos`).
- Cada nodo: swatch/bandera del lema (los hijos heredan el color del lema), sigla/nombre, %, total.
- Reusar tokens/clases existentes (`zone-sheet__grupo`, `__hoja`, `__swatch`, banderas SVG). No introducir paleta nueva.
- Accesible: cada nodo colapsable es un `button` con `aria-expanded`; jerarquía con `role`/indentación semántica.
- Mobile (bottom-sheet): el árbol largo scrollea dentro del sheet; el header (local + ganó acá) queda sticky.

## Arquitectura — un solo constructor de árbol

Hoy la jerarquía lema→precandidato/sublema→lista la arma **`OpcionAccordion`**; la ficha la ignora. Para no divergir:

- **Extraer** un builder puro compartido a `src/lib/` (p. ej. `opcion-tree.ts`):
  `buildOpcionTree(porOpcion: {opcionId, votos}[], meta: CatalogoOpcMeta, niveles: Nivel[]) → TreeNode[]`
  donde `TreeNode = { nivel, id, label, sigla?, color?, flagUrl?, votos, hijos: TreeNode[] }`.
- **Consumidores:** `OpcionAccordion` (selección) y `ZoneSheet` (desglose). Una sola fuente de verdad de agrupación → la ficha y el acordeón nunca se contradicen.
- **Tests Vitest** del builder por cada forma de `niveles[]` (ODN 4 niveles, ODD 3, plano 1).
- **Borrar** el truncado `TOP = 10` de `buildDesglose`; el árbol no descarta nodos.

## Datos / ETL — per-circuito × per-opción

- **Objetivo:** que cada circuito del local lleve su `porOpcion[]` completo (no solo `{ganador, válidos}`).
- **Fuente:** desglose crudo por CRV (existe para 2014/2019/2022/2020/2025 + 2024) con HOJA/opción × CRV.
- **Cambio:** en el build del shard local (`build-votes-local.py` / `votes_local_lib.aggregate_to_local` / `enrich-votes-local.py`), retener por cada circuito su `porOpcion[]` (mismos `opcionId` del catálogo que usa el local) y emitirlo en `votes-local.json` (`zonas[].circuitos[].porOpcion[]`) o en `votes-circuito.json` por elección×depto.
- **Decisión de forma de dato:** preferir extender `circuitos[]` en `votes-local.json` (un solo fetch ya que la ficha del local lo necesita junto). Evaluar tamaño (≤3 MB por archivo; si excede, `votes-circuito.json` lazy por click).
- **Gate:** reconciliación — suma de `circuitos[].porOpcion` por opción == `porOpcion` del local (delta=0). Reusar patrón de gates de losslessness.
- **internas-2024** ya tiene `votes-circuito.json` con porOpcion → usar como caso de validación cruzada.

## Verificación (browser, por tipo de elección)

Checklist de aceptación, una por tipo:
- [ ] **Internas** (MVD ODD + ODN): árbol lema→sublema/precandidato→lista, todo expandido, sin "+N más".
- [ ] **Nacionales** (MVD + interior serie): lema→sublema→lista.
- [ ] **Balotaje / Plebiscito / Referéndum**: plano (lemas / Sí-No), sin sub-niveles fantasma.
- [ ] **Departamentales**: contiendas paralelas (intendente/junta/municipio) con su árbol.
- [ ] **Municipales**: contienda municipal + alcalde/concejo intactos.
- [ ] **Local con varios circuitos**: cada circuito expande a su desglose por opción; reconciliación visible == total del local.
- [ ] **Deep-link** `?circ=1[&zona=L…]`: abre overlay LOCAL + ficha con el árbol (arreglar la carrera de `astro:after-swap` de paso).
- [ ] Gates: `npm test` (builder), `gate:data`, reconciliación per-circuito, `astro check` 0 err.

## Fuera de alcance

- SVGs/logos custom por sublema (vive en `appearance-overrides.ts`, intacto).
- Cambiar el coloreo del mapa (esto es solo la ficha).
- Overlay de límites como capa sobre otras elecciones (follow-up de Epic 22).
