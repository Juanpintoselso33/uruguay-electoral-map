# public/data/ — Contrato de datos

Datos que sirve la app, ya procesados por el pipeline [`etl/`](../../etl/README.md). El frontend los consume como archivos estáticos: nunca procesa datos crudos en el cliente. Todo es JSON pequeño (*shards*) o TopoJSON.

## Organización

```
public/data/
├── elections-meta.json            # metadata de las 14 instancias electorales
├── <eleccion>/                    # una carpeta por elección (ej. nacionales-2024)
│   ├── _nacional/                 # vista nacional consolidada
│   │   ├── opciones.json          # catálogo de opciones electorales
│   │   ├── votes.json             # votos por departamento
│   │   ├── votes-zona.json        # votos por zona
│   │   └── zona-annexed.json      # zonas anexadas (sin geometría propia)
│   └── <departamento>/            # 19 departamentos (montevideo, canelones, …)
│       ├── catalogo.json          # opciones + partidos disponibles
│       ├── opciones.json          # opciones electorales del depto
│       ├── votes.json             # votos por unidad geográfica del nivel base
│       ├── votes-local.json       # votos a nivel "local de votación"
│       └── hoja/                  # desglose por hoja (lista)
├── geo/                           # TopoJSON por departamento + _nacional
│   └── _nacional/                 # departamento.topo.json, zona.topo.json
├── mappings/                      # tablas de mapeo geográfico
└── hoja-equivalencias/            # equivalencias de hojas entre instancias
```

> `id` de elección y `id` de departamento (snake_case: `cerro_largo`, `rio_negro`, `san_jose`, `treinta_y_tres`) se declaran en [`src/config/departments.json`](../../src/config/departments.json), la fuente de verdad de la cobertura.

## Invariantes de dominio (verdad del sistema electoral uruguayo)

Estas reglas son **durables** y todo el modelo las respeta. No replicar datos que las violen.

### Entidades y jerarquía
- 19 departamentos. Jerarquía geográfica: **CIRCUITO ⊃ SERIE ⊃ ZONA**.
- Una `HOJA` (lista) pertenece a exactamente **un** `PARTIDO`.
- Tipos de elección: `internas | nacionales | balotaje | departamentales` (más plebiscitos/referéndum binarios). El modelo es **agnóstico al tipo**.
- **ODN** = Orden Departamental Nacional · **ODD** = Orden Departamental Departamental. En ODN una `HOJA` mapea a 1 `PRECANDIDATO`; en ODD no hay precandidato.

### Voto canónico (crítico)
- El voto se cuenta de la etapa de **escrutinio definitiva** (la final validada). **Nunca** sumar a través de etapas distintas.
- **Unidad base = opción electoral × unidad geográfica.** La *opción* es `HOJA` en internas/legislativas, o **candidato/lema** en balotaje/presidencial (donde no hay hoja).
- Las agregaciones (serie, circuito, departamento, nacional) se derivan por *roll-up* de **votos válidos**.
- **Blancos / anulados / observados** existen en los totales oficiales pero **no** tienen partido ni hoja → son categorías aparte. La reconciliación contra oficiales se hace sobre **votos válidos**, no sobre el total bruto.
- Sin duplicados (opción × geografía) dentro de una misma etapa. Votos ≥ 0.

### Join geográfico (varía según el mapa)
- **Mapa por barrio/zona** (Montevideo): join `ZONA ↔ GeoJSON (BARRIO | texto | zona)`.
- **Mapa por serie** (interior): join vía mapeo curado `SERIE → barrio/localidad`, **no** por `ZONA` directa.
- El mapeo serie↔barrio se cura **manualmente por capital**: no existe un join espacial automático correcto.

### Integridad en ingesta
- Normalización a **UTF-8** (el origen de la Corte Electoral suele venir en Latin-1).
- **Cobertura de zonas:** se reporta toda zona del CSV sin match en GeoJSON; el build falla si la cobertura cae bajo el umbral.
- **Reconciliación:** los totales agregados deben coincidir con los resultados oficiales por departamento.

### Esquema CSV de origen (columnas obligatorias)
```
PARTIDO, DEPTO, CIRCUITO, SERIES, ESCRUTINIO, PRECANDIDATO, HOJA, CNT_VOTOS, ZONA
```

## Fuentes

- **Electoral:** Corte Electoral de Uruguay (Catálogo de Datos Abiertos).
- **Geográfico:** IDE Uruguay (límites departamentales).
