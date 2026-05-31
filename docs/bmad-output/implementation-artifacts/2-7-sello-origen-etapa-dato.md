---
baseline_commit: e78ccbf
---

# Story 2.7: Sello de origen y etapa del dato

Status: done

## Story

As a usuario,
I want ver de dónde viene el dato,
so that confíe en lo que muestra el mapa.

## Acceptance Criteria

1. **Given** la página de departamento **When** la observo (sin interacción) **Then** un sello visible indica "Corte Electoral — escrutinio definitivo" — fuera de la ficha ZoneSheet, siempre a la vista.
2. **Given** el sello **Then** es HTML estático (SSG); el valor `escrutinio` que muestra proviene del campo `votes.json.escrutinio` leído en build-time, no calculado en runtime.
3. **Given** `npm run build` **When** algún shard tiene `escrutinio ≠ 'definitivo'` o falla `assertVotosShard` **Then** el build falla con exit ≠ 0 antes de generar HTML (gate de build explícito).
4. **Given** la portada **Then** ya muestra "escrutinio definitivo" en el subtítulo del hero (Story 2.6) — no se requiere cambio adicional.
5. **Given** el sello **Then** incluye un link a la fuente oficial (corteelectoral.gub.uy).
6. **Given** `astro check` y `npm run build` **Then** 0 errores.

## Tasks / Subtasks

- [ ] **Task 1: Sello.astro — componente estático (AC: 1, 2, 5)**
  - [ ] Crear `src/components/ui/Sello.astro`.
  - [ ] Props: `eleccion: string`, `departamento: string`.
  - [ ] Lee `public/data/{eleccion}/{departamento}/votes.json` en frontmatter (igual que DataTable.astro) y muestra `votes.escrutinio`.
  - [ ] Texto: "Corte Electoral Uruguay · Escrutinio {escrutinio}" con link a `https://www.corteelectoral.gub.uy/`.
  - [ ] Sin islas Vue (`client:*`) — HTML puro.

- [ ] **Task 2: Integrar Sello en la página de departamento (AC: 1)**
  - [ ] En `[departamento].astro`: importar `Sello` y añadir `<Sello eleccion={eleccion} departamento={departamento} />` después de `<DataTable>`.

- [ ] **Task 3: gate:data script (AC: 3)**
  - [ ] Crear `scripts/gate-data.mjs`.
  - [ ] Busca todos los `public/data/**/**/votes.json` (glob).
  - [ ] Para cada uno: importa y llama `assertVotosShard` del bundle ESM de contracts/guards.
  - [ ] Si alguno falla: imprime el error y sale con `process.exit(1)`.
  - [ ] Añadir a `package.json`:
    ```json
    "gate:data": "node scripts/gate-data.mjs"
    ```
  - [ ] Actualizar `"build"`:
    ```json
    "build": "node scripts/gate-data.mjs && astro build"
    ```

- [ ] **Task 4: Verificación (AC: 1–6)**
  - [ ] `npm run gate:data` → exit 0, imprime "OK: 2 shards validados".
  - [ ] Página Montevideo/Rivera: sello visible debajo de la tabla, sin abrir nada.
  - [ ] `astro check` 0 · `npm run build` verde.

## Dev Notes

### Sello.astro — estructura mínima

```astro
---
import { readFileSync } from 'node:fs';
import type { VotosShard } from '../../lib/contracts';

interface Props { eleccion: string; departamento: string; }
const { eleccion, departamento } = Astro.props;

const votes = JSON.parse(
  readFileSync(`public/data/${eleccion}/${departamento}/votes.json`, 'utf8')
) as VotosShard;
const escrutinioLabel = votes.escrutinio === 'definitivo' ? 'definitivo' : votes.escrutinio;
---
<p class="sello">
  Fuente:
  <a href="https://www.corteelectoral.gub.uy/" target="_blank" rel="noopener">
    Corte Electoral Uruguay
  </a>
  · Escrutinio <strong>{escrutinioLabel}</strong>
</p>
```

### gate-data.mjs — lógica

El script importa los guards compilados. Como el proyecto usa TypeScript, necesitamos una forma de ejecutar `assertVotosShard` en Node. Opciones:

**Opción A (más simple):** reimplementar el gate en el script MJS (sin imports TS):
```js
import { readFileSync } from 'node:fs';
import { glob } from 'node:fs/promises'; // Node 22+ o usar fast-glob

const paths = [...]; // glob public/data/**/votes.json
let errCount = 0;
for (const p of paths) {
  const shard = JSON.parse(readFileSync(p, 'utf8'));
  if (shard.escrutinio !== 'definitivo') {
    console.error(`FAIL: ${p} escrutinio=${shard.escrutinio}`);
    errCount++;
  }
  // Validaciones básicas del assertVotosShard
}
if (errCount > 0) process.exit(1);
console.log(`OK: ${paths.length} shards validados`);
```

**Opción B:** usar `esbuild` para bundlear `guards.ts` como script y ejecutarlo (más pesado).

Usar **Opción A** — el gate es simple y no necesita toda la infraestructura de contratos TS. El gate ya existe en ETL; este script es la verificación de que los artefactos *emitidos* son correctos.

### Glob de votes.json

```js
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

function findVotesFiles(base) {
  const results = [];
  const elecciones = readdirSync(base);
  for (const eleccion of elecciones) {
    const elecPath = join(base, eleccion);
    if (!statSync(elecPath).isDirectory()) continue;
    const deptos = readdirSync(elecPath);
    for (const depto of deptos) {
      const f = join(elecPath, depto, 'votes.json');
      try { statSync(f); results.push(f); } catch {}
    }
  }
  return results;
}
```

### Posición del sello en la página

```
[ChoroplethMap]
[DataTable]       ← ya existente
[Sello]           ← nuevo (debajo de tabla, antes del </main>)
```

El sello es un `<p>` con fuente pequeña, color muted — no ocupa espacio visual significativo pero responde "de dónde viene esto".

### ZoneSheet ya tiene el sello

`ZoneSheet.vue` ya muestra "Corte Electoral — escrutinio definitivo" dentro de la ficha (Story 2.4). El sello de Story 2.7 es ADICIONAL y visible sin abrir la ficha — complementa, no reemplaza.

### No duplicar en la portada

La portada (index.astro) ya dice "escrutinio definitivo" en el subtítulo del hero. No añadir Sello allí — sería redundante.

### Referencias

- [epics.md § Story 2.7, FR14, NFR4] · [architecture.md AR7, NFR4] · [Story 1.6 gates] · [contracts/guards.ts assertVotosShard] · [DataTable.astro] (patrón de lectura de votes.json en SSG)

## Dev Agent Record

### Agent Model Used
claude-sonnet-4-6
