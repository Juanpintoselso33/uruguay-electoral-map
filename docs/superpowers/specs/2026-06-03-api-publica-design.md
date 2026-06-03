# API pública de datos electorales — Diseño

> Spec de brainstorming. Estado: **aprobado el diseño, pendiente review del usuario** antes de pasar a `writing-plans`.
> Fecha: 2026-06-03. Se registra como **Epic 20** en BMAD.

## Objetivo

Exponer los datos electorales del proyecto como una **API pública, read-only, HTTP+JSON**, que sirva tanto para **descargar datasets** (periodistas, investigadores, ciudadanía) como para **consultar en vivo con filtros** (apps/bots de terceros). Cubre **toda** la profundidad de datos que ya tiene el proyecto: resultados desde agregados nacional/departamento hasta **circuito/local** y **por hoja (lista)**, más la **geometría** (TopoJSON) para que terceros dibujen sus propios mapas.

## Consumidores y casos de uso

| Consumidor | Caso de uso | Cubierto por |
|---|---|---|
| Periodistas / investigadores / ciudadanía | Bajar datasets completos o por elección, citables y estables | Dumps + archivos estáticos versionados |
| Apps / bots de terceros | Consultar resultados con filtros (elección, depto, nivel, partido) | Endpoints serverless de query (Fase 2) |
| Constructores de mapas | Obtener geometría + resultados para visualizar | Recursos `geo/` + `results/` |

## Restricciones de contexto

- **Datos inmutables:** el escrutinio definitivo no cambia → todo el dataset es estable y altamente cacheable. Esta es la propiedad que hace barata y simple a la API.
- **Volumen:** `public/data/` pesa **~443 MB**. Inviable cargar todo en memoria de una función; se sirven **shards puntuales** o **archivos estáticos**.
- **Hosting:** Vercel (estático + funciones serverless / Fluid Compute). Sensibilidad a **costo de ancho de banda** (la cuenta ya tuvo tope de presupuesto LFS). Mitigación central: **cache agresivo en CDN**.
- **Sin backend hoy:** el app es 100% estático; no hay rutas API ni base de datos.

## Arquitectura — enfoque elegido (A: estático-first + capa fina de queries, por fases)

API **read-only, JSON, versionada en `/api/v1/`**, mismo deploy de Vercel, **CORS abierto**.

Se descartaron:
- **B (serverless + base de datos):** ETL a DB + hosting + ops + costo, sobredimensionado para datos inmutables.
- **C (solo estático sin compute):** no cubre las queries en vivo con filtros. (Es exactamente la Fase 1 de A.)

### Versionado pragmático (sin duplicar datos)

- El **contrato** (rutas + formas) se congela en `/api/v1/`. Cambios **solo aditivos** dentro de v1; cualquier cambio **breaking → `/api/v2`**.
- Para no duplicar los 443 MB, `/api/v1/...` se sirve mediante **rewrites de Vercel** hacia los archivos actuales bajo `public/data/`. El compromiso operativo: **no romper el esquema dentro de v1** (los builders del ETL no quitan ni renombran campos contractados; solo agregan).
- Riesgo asumido y mitigación: el contrato apunta a archivos "vivos"; se protege con un **test de contrato** (ver Testing) que falla el build si el JSON servido deja de validar contra el JSON-Schema publicado.

## Modelo de recursos

Punto de entrada de **descubrimiento**:

- `GET /api/v1/index.json` — elecciones, departamentos y niveles disponibles, con links a cada recurso. Se deriva de `src/config/departments.json` (fuente de verdad de cobertura).

Recursos:

- `GET /api/v1/elections` — lista de elecciones con metadata (id, label, tipo, año).
- `GET /api/v1/elections/{eleccion}` — detalle: departamentos cubiertos, contiendas y catálogo de opciones (deriva de `catalogo.json` / `opciones.json`).
- `GET /api/v1/results/{eleccion}/{departamento}?nivel=…` — resultados por unidad geográfica. **Fase 1:** devuelve el shard `votes*.json` correspondiente al nivel. **Fase 2:** además filtrable por `partido`, `nivel`, etc.
- `GET /api/v1/results/{eleccion}/{departamento}/hoja` — desglose **por hoja/lista** (el core del proyecto; deriva de `hoja/` y `hoja-local.json`).
- `GET /api/v1/geo/{departamento}/{nivel}.topojson` — **geometría** TopoJSON.
- `GET /api/v1/dumps/{eleccion}.ndjson` — **descarga masiva** por elección (una fila por registro, streameable) + `GET /api/v1/dumps/{eleccion}.manifest.json`.

Las **formas de respuesta** son las mismas que los shards actuales (no se inventa envelope para lo estático), documentadas en JSON-Schema. Los errores usan códigos HTTP estándar + cuerpo `{ "error": { "code": "...", "message": "..." } }`.

## Operativo

- **CORS:** `Access-Control-Allow-Origin: *`; métodos `GET, HEAD, OPTIONS`.
- **Cache:** datos inmutables → `Cache-Control: public, s-maxage=31536000, immutable` + `ETag`. El CDN de Vercel absorbe el tráfico; los hits cacheados no consumen compute. Es el mecanismo principal de control de costo.
- **Auth / rate-limit:** **sin API key** (datos abiertos). Control de abuso = cache agresivo, no gatekeeping. **Opcional** (no en MVP): rate-limit suave por IP **solo** en los endpoints serverless de Fase 2, si aparece abuso.
- **Dumps:** **NDJSON** por elección + `manifest.json` (qué contiene, conteos, versión, fecha de generación). Generados en un paso de build del ETL.
- **Docs / contrato:** **OpenAPI 3** en `/api/v1/openapi.json` + **JSON-Schema** por cada forma; página de docs legible (Swagger/Scalar UI). `index.json` como entrada de descubrimiento.
- **Licencia / atribución:** declarar fuente **Corte Electoral del Uruguay** + licencia de uso de los datos (datos abiertos con atribución). El código sigue MIT.

## Fases

### Fase 1 — Contrato estático (sin compute)
Rewrites `/api/v1/*` + headers CORS/cache en `vercel.ts`; `index.json`, `elections`, `results` (shards tal cual), `geo`, dumps NDJSON generados en build, OpenAPI + JSON-Schema + página de docs, nota de licencia/atribución. **Entrega una API usable y descargable sin backend.**

### Fase 2 — Queries
Funciones serverless (`/api/v1/results?eleccion=&departamento=&nivel=&partido=`) que leen el shard pertinente y devuelven JSON filtrado/agregado, con cache inmutable y rate-limit opcional. **Agrega consulta en vivo con filtros.**

## Testing

- **Vitest:** lógica pura de los endpoints de query (filtros/agregación) y el builder del `index.json`.
- **Test de contrato (gate de build):** el JSON servido en `/api/v1/...` valida contra el JSON-Schema/OpenAPI publicado; si un builder del ETL rompe una forma contractada, el build falla.
- **Integración (preview):** golpear `/api/v1/...` y verificar headers (CORS, `Cache-Control`, `ETag`) y formas de respuesta.
- **Reusar `gate-*`** para integridad de los datos generados.

## Eje candidate-centric (caso de uso externo)

Surgió un consumidor real (Octavio R., sitio que centraliza info de gobernantes) pidiendo el **eje invertido**: *dado un candidato, ¿en qué departamentos sacó más votos?* — útil para legisladores. La API base es *elección → geografía → resultados*; esto pide un recurso **candidate-centric**.

Se cubre en dos tiempos:

- **Personas ya modeladas (sin datos nuevos):** presidenciales/balotaje (candidato = opción), precandidatos de internas (nivel del catálogo) e intendentes (departamentales). Para ellos se agrega un recurso `GET /api/v1/candidatos/{id}/resultados` que agrega por depto/elección. **Va en este epic (Story de API).**
- **Legisladores (requiere datos nuevos):** el voto legislativo en Uruguay es **a la LISTA, no a la persona** → "votos de un candidato" = votos de su(s) **hoja(s)**. El mapeo **persona↔hoja** SÍ existe como dato abierto: la Corte publica **"nóminas de candidatos" / "integrantes de las hojas de votación"** en CKAN por elección (Nacionales 2024/2019, Internas, Departamentales 2020/2025). Sourcearlo + **normalizar la identidad de personas entre elecciones** es un subsistema de ETL propio → **Epic 21 (dimensión de candidatos/personas)**, que luego alimenta el mismo recurso `candidatos` para cubrir legisladores.

Precisión de contrato: el recurso de candidato debe **explicitar la métrica** ("votos de la lista N que integra", no "votos personales") para legisladores, y manejar que una persona puede estar en **varias hojas** (titular/suplente, senado/diputados) y repetirse entre elecciones.

## Fuera de alcance (no-goals)

- Base de datos / GraphQL (enfoque B).
- Escritura / autenticación de usuarios / cuentas.
- API keys y dashboards de uso en el MVP (rate-limit queda como opcional de Fase 2).
- Webhooks / streaming en tiempo real (los datos son inmutables).

## Riesgos / decisiones abiertas

- **Ancho de banda / costo:** mitigado por cache inmutable en CDN; monitorear uso real. Si escala, evaluar mover dumps/geo a object storage con CDN propio.
- **Disciplina de contrato:** v1 sirve archivos vivos vía rewrites → el test de contrato es la red de seguridad contra cambios breaking accidentales del ETL.
- **Tope de presupuesto LFS de la cuenta:** no bloquea la API (Vercel sirve los archivos), pero conviene resolverlo para no romper CI. (Ver memoria `ci-lfs-budget-vercel-es-el-gate`.)
