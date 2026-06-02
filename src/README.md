# src/ — Frontend

Aplicación **Astro 5** con **islas Vue 3.5**. Astro genera páginas estáticas; las partes interactivas (mapa, selectores, hoja de detalle) son componentes Vue hidratados en el cliente. El mapa usa **MapLibre GL**; el estado compartido vive en **nanostores**.

## Estructura

| Carpeta | Contenido |
|---------|-----------|
| `pages/` | Rutas Astro. `[eleccion]/[departamento].astro` es la vista principal (ruteo dinámico por elección y departamento). |
| `components/map/` | Mapa MapLibre GL y capas. |
| `components/selectors/` | Selección de elección, departamento, nivel geográfico y opción/lista (acordeón). |
| `components/sheet/` | Hoja de detalle: resultados de la zona seleccionada. |
| `components/compare/` | Comparación entre elecciones/resultados. |
| `components/search/` | Búsqueda (barrio, serie, localidad). |
| `components/share/` | Compartir vista / enlaces con estado. |
| `components/a11y/` | Tabla de datos accesible por nivel geográfico. |
| `components/ui/` | Componentes de UI transversales. |
| `stores/` | Estado de la app (`map-state.ts`, nanostores). |
| `lib/` | Lógica de dominio del frontend: colores de partido, metadata, estado-en-URL, contratos. |
| `config/` | `departments.json` — fuente de verdad de qué departamentos, niveles y elecciones existen. |
| `layouts/` | Layouts Astro. |
| `styles/` | Estilos globales (Tailwind 4). |

## Conceptos clave

- **`config/departments.json` es la fuente de verdad** de la cobertura: cada departamento declara sus `levels` (Montevideo usa `zona`; el interior usa `serie`/`localidad`) y sus `elecciones`. Agregar una elección/departamento empieza por acá.
- **Estado en la URL** (`lib/url-state.ts`): la elección, el departamento, el nivel y la selección se reflejan en la URL, de modo que toda vista es compartible y enlazable.
- **Contratos de datos** (`lib/contracts/`): tipos que validan la forma de los shards JSON que sirve el ETL. Ver [`lib/contracts/README.md`](lib/contracts/README.md).
- **Colores de partido** (`lib/party-colors.ts`, `lib/party-meta.ts`): ids *bare* + nombres canónicos consistentes en todas las elecciones.

## Carga de datos

El frontend **no** procesa datos crudos: consume los shards JSON pre-agregados de [`public/data/`](../public/data/README.md), cargando solo lo necesario para la elección y el departamento activos. La pesada lógica de agregación vive en [`etl/`](../etl/README.md).
