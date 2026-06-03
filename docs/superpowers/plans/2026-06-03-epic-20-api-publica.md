# Epic 20 — API pública de datos electorales — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Exponer los datos electorales como una API pública read-only JSON versionada en `/api/v1/`, con descubrimiento, contrato (JSON-Schema/OpenAPI), descargas (dumps NDJSON), CORS y cache inmutable; luego sumar queries serverless con filtros y un recurso candidate-centric.

**Architecture:** El sitio es `output: 'static'` (Astro 5 + `@astrojs/vercel` v8). Fase 1 = **archivos estáticos** bajo `public/api/v1/` (índice, esquema, dumps — generados en build) + **rewrites** en `vercel.json` que mapean `/api/v1/results|geo/...` a los `/data/...` existentes (sin duplicar los 443 MB) + headers CORS/cache. Fase 2 = endpoints **serverless** (`src/pages/api/v1/*.ts` con `export const prerender = false`) que leen los shards y filtran. Un gate de contrato valida que el JSON servido cumple el esquema.

**Tech Stack:** Astro 5 (`output: 'static'`, rutas server on-demand vía `prerender=false`), `vercel.json` (headers/rewrites), Python 3 (generadores de índice/dumps, stdlib), JSON-Schema + OpenAPI 3, Vitest (lógica de query), gate `.mjs`/`.py`.

**Decisiones clave:**
- **No duplicar datos:** `results`/`geo` se sirven por **rewrite** a `/data/...`. Lo NUEVO (índice, esquema, dumps) son archivos chicos generados bajo `public/api/v1/`.
- **Fase 1 = recursos por path** (`/api/v1/results/{eleccion}/{departamento}/{archivo}.json`). El filtrado por query (`?nivel=&partido=`) es **Fase 2** (serverless).
- **Cache:** datos inmutables → `s-maxage` largo + `immutable`. CORS `*`.

**Alcance:** Fase 1 = Tasks 1–6 (contrato estático usable). Fase 2 = Tasks 7–8 (queries + candidate-centric de personas ya modeladas). Legisladores → Epic 21 (plan aparte).

---

### Task 1: `vercel.json` con CORS + cache + rewrites de `/api/v1/`

**Files:**
- Create: `vercel.json`

Vercel lee `vercel.json` en la raíz y aplica headers/rewrites sobre el output estático del adapter. `vercel.ts` actual es inerte (solo doc) → se deja como está.

- [ ] **Step 1: Crear `vercel.json`**

```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "headers": [
    {
      "source": "/api/v1/(.*)",
      "headers": [
        { "key": "Access-Control-Allow-Origin", "value": "*" },
        { "key": "Access-Control-Allow-Methods", "value": "GET, HEAD, OPTIONS" },
        { "key": "Cache-Control", "value": "public, max-age=3600, s-maxage=31536000, immutable" }
      ]
    },
    {
      "source": "/data/(.*)",
      "headers": [
        { "key": "Access-Control-Allow-Origin", "value": "*" },
        { "key": "Cache-Control", "value": "public, max-age=3600, s-maxage=31536000, immutable" }
      ]
    }
  ],
  "rewrites": [
    { "source": "/api/v1/results/:eleccion/:departamento/:file", "destination": "/data/:eleccion/:departamento/:file" },
    { "source": "/api/v1/geo/:path*", "destination": "/data/geo/:path*" }
  ]
}
```

- [ ] **Step 2: Verificar que no rompe el build**

Run: `npm run check`
Expected: 0 errores (vercel.json no afecta el type-check; es config de plataforma).

Nota: el efecto real de headers/rewrites solo se observa en un deploy de Vercel (preview), no en `astro dev`. La verificación end-to-end (CORS/cache/rewrite) va en el Task 6 (sobre preview).

- [ ] **Step 3: Commit**

```bash
git add vercel.json
git commit -m "feat(api): vercel.json con CORS + cache inmutable + rewrites /api/v1 (Epic 20.1)"
```

---

### Task 2: Generador del índice de descubrimiento + elections

**Files:**
- Create: `scripts/build-api-index.py`
- Create (salida): `public/api/v1/index.json`, `public/api/v1/elections.json`, `public/api/v1/elections/{eleccion}.json`
- Modify: `package.json` (`etl:api-index`)

Deriva de `src/config/departments.json` (fuente de verdad de cobertura) y del disco (qué shards existen por depto), espejando la lógica de `[departamento].astro` (`existsSync` por nivel). Produce el punto de entrada de descubrimiento.

- [ ] **Step 1: Escribir el generador**

```python
#!/usr/bin/env python3
"""Genera el descubrimiento de la API: public/api/v1/index.json + elections.json + elections/{e}.json
a partir de src/config/departments.json y de los archivos presentes en public/data/. Uso:
  python scripts/build-api-index.py
"""
import json, os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA = os.path.join(ROOT, 'public/data')
OUT = os.path.join(ROOT, 'public/api/v1')
# archivos de datos que, si existen, se exponen como recursos 'results' del depto
RESULT_FILES = ['catalogo.json', 'opciones.json', 'votes.json', 'votes-local.json',
                'votes-circuito.json', 'votes-barrio.json', 'hoja-local.json']

def depts():
    return json.load(open(os.path.join(ROOT, 'src/config/departments.json'), encoding='utf-8'))

def resources_for(eleccion, depto):
    base = os.path.join(DATA, eleccion, depto)
    files = [f for f in RESULT_FILES if os.path.exists(os.path.join(base, f))]
    out = {f.replace('.json', ''): f"/api/v1/results/{eleccion}/{depto}/{f}" for f in files}
    return out

def geo_for(depto):
    gdir = os.path.join(DATA, 'geo', depto)
    if not os.path.isdir(gdir):
        return {}
    return {os.path.splitext(f)[0]: f"/api/v1/geo/{depto}/{f}"
            for f in sorted(os.listdir(gdir)) if f.endswith('.json')}

def main():
    ds = depts()
    os.makedirs(os.path.join(OUT, 'elections'), exist_ok=True)
    elections = {}  # eleccion → set de deptos
    for d in ds:
        for e in d['elecciones']:
            elections.setdefault(e, []).append(d['id'])
    # index.json
    index = {
        "version": "v1",
        "fuente": "Corte Electoral del Uruguay (catalogodatos.gub.uy)",
        "licencia": "Datos abiertos con atribución a la Corte Electoral.",
        "docs": "/api/v1/docs",
        "openapi": "/api/v1/openapi.json",
        "elections": "/api/v1/elections.json",
        "departamentos": sorted(d['id'] for d in ds),
        "elecciones": sorted(elections),
    }
    json.dump(index, open(os.path.join(OUT, 'index.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    # elections.json
    elist = [{"id": e, "departamentos": sorted(set(elections[e])), "detalle": f"/api/v1/elections/{e}.json"}
             for e in sorted(elections)]
    json.dump({"elecciones": elist}, open(os.path.join(OUT, 'elections.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    # elections/{e}.json
    for e in sorted(elections):
        detalle = {"id": e, "departamentos": []}
        for depto in sorted(set(elections[e])):
            detalle["departamentos"].append({
                "id": depto, "results": resources_for(e, depto), "geo": geo_for(depto),
            })
        json.dump(detalle, open(os.path.join(OUT, 'elections', f'{e}.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    print(f"índice generado: {len(elections)} elecciones, {len(ds)} departamentos → public/api/v1/")

if __name__ == '__main__':
    main()
```

- [ ] **Step 2: npm script**

En `package.json`:
```json
"etl:api-index": "python scripts/build-api-index.py",
```

- [ ] **Step 3: Correr y verificar**

Run: `python scripts/build-api-index.py`
Expected: `índice generado: 14 elecciones, 19 departamentos → public/api/v1/`.

Run: `python3 -c "import json; d=json.load(open('public/api/v1/elections/nacionales-2024.json')); print(d['departamentos'][0])"`
Expected: un dict `{id: 'artigas'|..., results: {votes: '/api/v1/results/nacionales-2024/.../votes.json', ...}, geo: {...}}` con links coherentes.

- [ ] **Step 4: Commit**

```bash
git add scripts/build-api-index.py package.json public/api/v1/index.json public/api/v1/elections.json public/api/v1/elections/
git commit -m "feat(api): índice de descubrimiento + elections (Epic 20.1)"
```

---

### Task 3: JSON-Schema de las formas + OpenAPI

**Files:**
- Create: `public/api/v1/schema/votes.schema.json`, `public/api/v1/schema/catalogo.schema.json`, `public/api/v1/schema/index.schema.json`
- Create: `public/api/v1/openapi.json`

Documenta las formas reales que ya tienen los shards. Se escriben a mano (son estables) y se validan en el gate (Task 5).

- [ ] **Step 1: Escribir `votes.schema.json`** (forma de `votes.json`: `{ zonas: [{ geoId, validos, ganadorOpcionId, porOpcion: [{opcionId, votos}], ... }] }`)

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://uruguay-electoral-map.vercel.app/api/v1/schema/votes.schema.json",
  "title": "Resultados por zona (votes)",
  "type": "object",
  "required": ["zonas"],
  "properties": {
    "nivel": { "type": "string" },
    "zonas": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["geoId", "validos", "porOpcion"],
        "properties": {
          "geoId": { "type": "string" },
          "validos": { "type": "integer", "minimum": 0 },
          "ganadorOpcionId": { "type": "string" },
          "porOpcion": {
            "type": "array",
            "items": {
              "type": "object",
              "required": ["opcionId", "votos"],
              "properties": {
                "opcionId": { "type": "string" },
                "votos": { "type": "integer" }
              }
            }
          }
        }
      }
    }
  }
}
```

- [ ] **Step 2: Escribir `index.schema.json`** (forma del `index.json` del Task 2)

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://uruguay-electoral-map.vercel.app/api/v1/schema/index.schema.json",
  "title": "Índice de descubrimiento",
  "type": "object",
  "required": ["version", "elecciones", "departamentos"],
  "properties": {
    "version": { "type": "string" },
    "fuente": { "type": "string" },
    "elecciones": { "type": "array", "items": { "type": "string" } },
    "departamentos": { "type": "array", "items": { "type": "string" } }
  }
}
```

- [ ] **Step 3: Escribir `catalogo.schema.json`** (forma de `catalogo.json`: `{ contiendas: [{ contienda, niveles, nodos, opciones: [{id, hoja, lemaId, ...}] }] }`)

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://uruguay-electoral-map.vercel.app/api/v1/schema/catalogo.schema.json",
  "title": "Catálogo de opciones",
  "type": "object",
  "required": ["contiendas"],
  "properties": {
    "contiendas": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["contienda", "opciones"],
        "properties": {
          "contienda": { "type": "string" },
          "niveles": { "type": "array", "items": { "type": "string" } },
          "opciones": {
            "type": "array",
            "items": {
              "type": "object",
              "required": ["id"],
              "properties": {
                "id": { "type": "string" },
                "hoja": { "type": "string" },
                "lemaId": { "type": "string" }
              }
            }
          }
        }
      }
    }
  }
}
```

- [ ] **Step 4: Escribir `openapi.json`** (mínimo navegable; describe los recursos de Fase 1)

```json
{
  "openapi": "3.1.0",
  "info": {
    "title": "API pública — Mapa Electoral de Uruguay",
    "version": "1.0.0",
    "description": "Datos electorales de Uruguay (resultados, catálogos, geometría). Read-only. Fuente: Corte Electoral. Datos abiertos con atribución.",
    "license": { "name": "Datos abiertos con atribución a la Corte Electoral" }
  },
  "servers": [{ "url": "https://uruguay-electoral-map.vercel.app/api/v1" }],
  "paths": {
    "/index.json": { "get": { "summary": "Descubrimiento", "responses": { "200": { "description": "OK" } } } },
    "/elections.json": { "get": { "summary": "Lista de elecciones", "responses": { "200": { "description": "OK" } } } },
    "/elections/{eleccion}.json": { "get": { "summary": "Detalle de una elección (deptos + recursos)", "parameters": [{ "name": "eleccion", "in": "path", "required": true, "schema": { "type": "string" } }], "responses": { "200": { "description": "OK" } } } },
    "/results/{eleccion}/{departamento}/votes.json": { "get": { "summary": "Resultados por zona", "parameters": [{ "name": "eleccion", "in": "path", "required": true, "schema": { "type": "string" } }, { "name": "departamento", "in": "path", "required": true, "schema": { "type": "string" } }], "responses": { "200": { "description": "OK" } } } },
    "/geo/{departamento}/{nivel}.topo.json": { "get": { "summary": "Geometría TopoJSON", "parameters": [{ "name": "departamento", "in": "path", "required": true, "schema": { "type": "string" } }, { "name": "nivel", "in": "path", "required": true, "schema": { "type": "string" } }], "responses": { "200": { "description": "OK" } } } }
  }
}
```

- [ ] **Step 5: Commit**

```bash
git add public/api/v1/schema/ public/api/v1/openapi.json
git commit -m "feat(api): JSON-Schema de formas + OpenAPI 3 (Epic 20.2)"
```

---

### Task 4: Página de docs (Scalar UI sobre el OpenAPI)

**Files:**
- Create: `src/pages/api/v1/docs.astro`

Página estática que renderiza el OpenAPI con Scalar (CDN, sin build extra). Ruta `/api/v1/docs` (coincide con `index.json.docs`).

- [ ] **Step 1: Crear la página**

```astro
---
// Docs de la API pública (Scalar UI sobre /api/v1/openapi.json). Estática (prerender por defecto).
---
<!doctype html>
<html lang="es">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>API pública — Mapa Electoral de Uruguay</title>
  </head>
  <body>
    <script id="api-reference" data-url="/api/v1/openapi.json"></script>
    <script src="https://cdn.jsdelivr.net/npm/@scalar/api-reference"></script>
  </body>
</html>
```

- [ ] **Step 2: Verificar build + ruta**

Run: `npm run check`
Expected: 0 errores.

Run (dev): `npm run dev` y abrir `http://localhost:4335/api/v1/docs`
Expected: carga la UI de Scalar listando los paths del OpenAPI. (Si Scalar CDN está bloqueado, cae a un fallback: documentar el link a `/api/v1/openapi.json` crudo.)

- [ ] **Step 3: Commit**

```bash
git add src/pages/api/v1/docs.astro
git commit -m "feat(api): página de docs (Scalar) sobre el OpenAPI (Epic 20.2)"
```

---

### Task 5: Gate de contrato (el JSON servido cumple el esquema)

**Files:**
- Create: `scripts/gate-api-contract.mjs`
- Modify: `package.json` (`gate:api`), y agregar `gate:api` a la cadena de `build` si aplica

Valida una muestra de recursos contra los JSON-Schema (Task 3). Usa `ajv` (ya transitivo o instalar). Falla el build si una forma contractada se rompió.

- [ ] **Step 1: Escribir el gate**

```javascript
// Valida que los recursos servidos cumplen los JSON-Schema publicados (contrato v1).
// Uso: node scripts/gate-api-contract.mjs
import { readFileSync, existsSync } from 'node:fs';
import Ajv from 'ajv/dist/2020.js';

const ajv = new Ajv({ allErrors: true, strict: false });
const load = (p) => JSON.parse(readFileSync(p, 'utf-8'));

const checks = [
  ['public/api/v1/index.json', 'public/api/v1/schema/index.schema.json'],
  ['public/data/nacionales-2024/montevideo/votes.json', 'public/api/v1/schema/votes.schema.json'],
  ['public/data/nacionales-2024/montevideo/catalogo.json', 'public/api/v1/schema/catalogo.schema.json'],
];

let failed = false;
for (const [data, schema] of checks) {
  if (!existsSync(data) || !existsSync(schema)) {
    console.error(`[gate:api] falta ${existsSync(data) ? schema : data}`); failed = true; continue;
  }
  const validate = ajv.compile(load(schema));
  if (!validate(load(data))) {
    console.error(`[gate:api] ${data} NO cumple ${schema}:`, validate.errors?.slice(0, 5));
    failed = true;
  } else {
    console.log(`[gate:api] OK ${data}`);
  }
}
if (failed) process.exit(1);
console.log('[gate:api] contrato v1 OK');
```

- [ ] **Step 2: Asegurar `ajv` disponible + npm script**

Run: `npm ls ajv || npm i -D ajv`
En `package.json`:
```json
"gate:api": "node scripts/gate-api-contract.mjs",
```

- [ ] **Step 3: Correr el gate**

Run: `npm run gate:api`
Expected: `[gate:api] OK ...` por cada recurso y `[gate:api] contrato v1 OK`. Si falla, ajustar el schema a la forma real (no al revés) salvo que sea una regresión real del ETL.

- [ ] **Step 4: Commit**

```bash
git add scripts/gate-api-contract.mjs package.json package-lock.json
git commit -m "test(gate): contrato de la API v1 (JSON-Schema) (Epic 20.4)"
```

---

### Task 6: Dumps NDJSON por elección + verificación end-to-end en preview

**Files:**
- Create: `scripts/build-api-dumps.py`
- Create (salida): `public/api/v1/dumps/{eleccion}.ndjson`, `public/api/v1/dumps/{eleccion}.manifest.json`
- Modify: `package.json` (`etl:api-dumps`)

- [ ] **Step 1: Escribir el generador de dumps**

```python
#!/usr/bin/env python3
"""Genera dumps NDJSON por elección: una fila por (departamento, zona, opcion) con sus votos, a partir
de los votes.json existentes. + manifest.json con conteos/versión. Uso:
  python scripts/build-api-dumps.py nacionales-2024
"""
import json, os, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA = os.path.join(ROOT, 'public/data')
OUT = os.path.join(ROOT, 'public/api/v1/dumps')

def depts_de(eleccion):
    ds = json.load(open(os.path.join(ROOT, 'src/config/departments.json'), encoding='utf-8'))
    return [d['id'] for d in ds if eleccion in d['elecciones']]

def main():
    if len(sys.argv) < 2:
        raise SystemExit("uso: build-api-dumps.py <eleccion>")
    eleccion = sys.argv[1]
    os.makedirs(OUT, exist_ok=True)
    ndjson_path = os.path.join(OUT, f'{eleccion}.ndjson')
    n = 0
    with open(ndjson_path, 'w', encoding='utf-8') as out:
        for depto in depts_de(eleccion):
            vp = os.path.join(DATA, eleccion, depto, 'votes.json')
            if not os.path.exists(vp):
                continue
            doc = json.load(open(vp, encoding='utf-8'))
            for z in doc.get('zonas', []):
                for o in z.get('porOpcion', []):
                    out.write(json.dumps({
                        "eleccion": eleccion, "departamento": depto, "geoId": z["geoId"],
                        "opcionId": o["opcionId"], "votos": o["votos"], "validos": z.get("validos"),
                    }, ensure_ascii=False) + "\n")
                    n += 1
    manifest = {"eleccion": eleccion, "registros": n, "formato": "ndjson",
                "campos": ["eleccion", "departamento", "geoId", "opcionId", "votos", "validos"],
                "fuente": "Corte Electoral del Uruguay", "version": "v1"}
    json.dump(manifest, open(os.path.join(OUT, f'{eleccion}.manifest.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    print(f"{eleccion}: {n} filas → {ndjson_path}")

if __name__ == '__main__':
    main()
```

- [ ] **Step 2: npm script + correr**

En `package.json`:
```json
"etl:api-dumps": "python scripts/build-api-dumps.py",
```
Run: `python scripts/build-api-dumps.py nacionales-2024`
Expected: `nacionales-2024: N filas → public/api/v1/dumps/nacionales-2024.ndjson` con N > 0; `head -1 public/api/v1/dumps/nacionales-2024.ndjson` es un objeto JSON válido.

- [ ] **Step 3: Commit + deploy a preview + verificación end-to-end**

```bash
git add scripts/build-api-dumps.py package.json public/api/v1/dumps/
git commit -m "feat(api): dumps NDJSON por elección + manifest (Epic 20.3)"
```
Abrir un PR (rama desde master) → esperar el preview de Vercel → verificar sobre el preview:
- `curl -sI <preview>/api/v1/index.json` → `200`, `access-control-allow-origin: *`, `cache-control: ...immutable`.
- `curl -s <preview>/api/v1/results/nacionales-2024/montevideo/votes.json | head -c 100` → JSON (rewrite funcionando).
- `curl -sI <preview>/api/v1/geo/montevideo/<archivo>.topo.json` → `200`.

(El preview tiene Vercel Auth → usar el navegador logueado o token; ver memoria `ci-lfs-budget-vercel-es-el-gate`.)

---

### Task 7: Fase 2 — endpoint serverless de query

**Files:**
- Create: `src/pages/api/v1/results.ts`
- Test: `src/pages/api/v1/results.test.ts` (lógica de filtro, Vitest)

Ruta on-demand (`prerender = false` → función serverless en Vercel). Lee el `votes.json` del depto y filtra por `partido` (sigla) si se pide. Cache inmutable.

- [ ] **Step 1: Test de la lógica de filtro (Vitest)**

```typescript
import { describe, it, expect } from 'vitest';
import { filtrarPorOpcion } from './results';

describe('filtrarPorOpcion', () => {
  it('filtra porOpcion por un opcionId dado', () => {
    const zonas = [{ geoId: 'a', validos: 10, porOpcion: [{ opcionId: 'x', votos: 6 }, { opcionId: 'y', votos: 4 }] }];
    const r = filtrarPorOpcion(zonas, 'x');
    expect(r[0].porOpcion).toEqual([{ opcionId: 'x', votos: 6 }]);
  });
  it('sin filtro devuelve todo', () => {
    const zonas = [{ geoId: 'a', validos: 10, porOpcion: [{ opcionId: 'x', votos: 6 }] }];
    expect(filtrarPorOpcion(zonas, null)[0].porOpcion).toHaveLength(1);
  });
});
```

- [ ] **Step 2: Verificar que falla**

Run: `npx vitest run src/pages/api/v1/results.test.ts`
Expected: FAIL (`filtrarPorOpcion` no existe).

- [ ] **Step 3: Implementar el endpoint + la función pura**

```typescript
import type { APIRoute } from 'astro';
import { readFileSync } from 'node:fs';

export const prerender = false; // → función serverless en Vercel

interface Zona { geoId: string; validos?: number; porOpcion: { opcionId: string; votos: number }[]; }

export function filtrarPorOpcion(zonas: Zona[], opcionId: string | null): Zona[] {
  if (!opcionId) return zonas;
  return zonas.map((z) => ({ ...z, porOpcion: z.porOpcion.filter((o) => o.opcionId === opcionId) }));
}

export const GET: APIRoute = ({ url }) => {
  const eleccion = url.searchParams.get('eleccion');
  const departamento = url.searchParams.get('departamento');
  const opcion = url.searchParams.get('opcion');
  if (!eleccion || !departamento) {
    return new Response(JSON.stringify({ error: { code: 'bad_request', message: 'faltan eleccion y departamento' } }),
      { status: 400, headers: { 'content-type': 'application/json', 'access-control-allow-origin': '*' } });
  }
  try {
    const doc = JSON.parse(readFileSync(`public/data/${eleccion}/${departamento}/votes.json`, 'utf-8'));
    const zonas = filtrarPorOpcion(doc.zonas ?? [], opcion);
    return new Response(JSON.stringify({ eleccion, departamento, opcion, zonas }), {
      headers: { 'content-type': 'application/json', 'access-control-allow-origin': '*',
        'cache-control': 'public, max-age=3600, s-maxage=31536000, immutable' },
    });
  } catch {
    return new Response(JSON.stringify({ error: { code: 'not_found', message: 'recurso inexistente' } }),
      { status: 404, headers: { 'content-type': 'application/json', 'access-control-allow-origin': '*' } });
  }
};
```

- [ ] **Step 4: Verificar test + check**

Run: `npx vitest run src/pages/api/v1/results.test.ts && npm run check`
Expected: test PASS, check 0 errores.

- [ ] **Step 5: Commit**

```bash
git add src/pages/api/v1/results.ts src/pages/api/v1/results.test.ts
git commit -m "feat(api): endpoint serverless de query con filtro por opción (Epic 20.5)"
```

---

### Task 8: Recurso candidate-centric (personas ya modeladas)

**Files:**
- Create: `src/pages/api/v1/candidatos/[id]/resultados.ts`
- Test: `src/pages/api/v1/candidatos/resultados.test.ts`

Para candidatos que YA son opciones modeladas (presidenciales/balotaje, precandidatos de internas, intendentes): `{id}` = un `opcionId`/`nodeId` del catálogo; agrega sus votos por departamento. (Legisladores → Epic 21.) `prerender = false`.

- [ ] **Step 1: Test de la agregación pura**

```typescript
import { describe, it, expect } from 'vitest';
import { agregarPorDepto } from './resultados';

describe('agregarPorDepto', () => {
  it('suma votos de un opcionId por departamento, ordenado desc', () => {
    const porDepto = { mvd: [{ opcionId: 'orsi', votos: 100 }], canelones: [{ opcionId: 'orsi', votos: 250 }] };
    const r = agregarPorDepto(porDepto, 'orsi');
    expect(r).toEqual([{ departamento: 'canelones', votos: 250 }, { departamento: 'mvd', votos: 100 }]);
  });
});
```

- [ ] **Step 2: Verificar que falla** — `npx vitest run src/pages/api/v1/candidatos/resultados.test.ts` → FAIL.

- [ ] **Step 3: Implementar**

```typescript
import type { APIRoute } from 'astro';
import { readFileSync, existsSync } from 'node:fs';
import deptsRaw from '../../../../../config/departments.json';

export const prerender = false;

type ByDepto = Record<string, { opcionId: string; votos: number }[]>;
const depts = deptsRaw as { id: string; elecciones: string[] }[];

export function agregarPorDepto(porDepto: ByDepto, opcionId: string): { departamento: string; votos: number }[] {
  return Object.entries(porDepto)
    .map(([departamento, ops]) => ({ departamento, votos: ops.filter((o) => o.opcionId === opcionId).reduce((s, o) => s + o.votos, 0) }))
    .filter((r) => r.votos > 0)
    .sort((a, b) => b.votos - a.votos);
}

export const GET: APIRoute = ({ params, url }) => {
  const opcionId = params.id!;
  const eleccion = url.searchParams.get('eleccion');
  if (!eleccion) {
    return new Response(JSON.stringify({ error: { code: 'bad_request', message: 'falta ?eleccion=' } }),
      { status: 400, headers: { 'content-type': 'application/json', 'access-control-allow-origin': '*' } });
  }
  const porDepto: ByDepto = {};
  for (const d of depts.filter((d) => d.elecciones.includes(eleccion))) {
    const p = `public/data/${eleccion}/${d.id}/votes.json`;
    if (!existsSync(p)) continue;
    const doc = JSON.parse(readFileSync(p, 'utf-8'));
    porDepto[d.id] = (doc.zonas ?? []).flatMap((z: { porOpcion: { opcionId: string; votos: number }[] }) => z.porOpcion);
  }
  const ranking = agregarPorDepto(porDepto, opcionId);
  return new Response(JSON.stringify({ candidato: opcionId, eleccion, metrica: 'votos de la opción', ranking }), {
    headers: { 'content-type': 'application/json', 'access-control-allow-origin': '*',
      'cache-control': 'public, max-age=3600, s-maxage=31536000, immutable' },
  });
};
```

- [ ] **Step 4: Verificar test + check** — `npx vitest run src/pages/api/v1/candidatos/resultados.test.ts && npm run check` → PASS, 0 err.

- [ ] **Step 5: Commit**

```bash
git add src/pages/api/v1/candidatos/ package.json
git commit -m "feat(api): recurso candidate-centric para opciones modeladas (Epic 20.6)"
```

---

## Notas de cierre

- **Integrar generadores al build:** agregar `etl:api-index` + `etl:api-dumps` + `gate:api` a la cadena de `npm run build` (o a un `etl:api` agregador) para que el contrato se regenere y valide en cada deploy.
- **`prerender = false` + `output:'static'`:** en Astro 5 las rutas con `prerender=false` se vuelven on-demand (función serverless del adapter Vercel) sin cambiar el output global. Verificar tras el primer deploy que `/api/v1/results?...` responde (no 404 estático).
- **Rewrites vs serverless:** los `results/geo` por path son estáticos (rewrite, cache CDN, costo ~0). El `?nivel=&partido=` y `/candidatos` son serverless (compute por request, cacheado). Mantener lo más posible en estático.
- **Lectura de archivos en serverless:** `readFileSync('public/data/...')` asume que esos archivos se incluyen en el bundle de la función; si el adapter no los traza, alternativa = `fetch` al propio dominio (`/data/...`) desde la función. Verificar en el primer deploy y ajustar a `fetch` si hace falta.
- 20.6 cubre candidatos ya modelados; legisladores quedan cubiertos cuando aterrice el Epic 21 (mismo endpoint, resolviendo `{id}` de persona → sus hojas).
