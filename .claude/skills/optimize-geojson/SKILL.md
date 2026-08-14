---
name: optimize-geojson
description: |
  Reduce el tamaño de archivos GeoJSON/TopoJSON del mapa (simplificación, precisión de
  coordenadas, limpieza de propiedades) respetando el techo de 3 MB y sin abrir huecos entre
  polígonos vecinos. Usar cuando un archivo de geometría exceda el presupuesto o renderice lento.
---

# Optimize GeoJSON

Baja el peso de la geometría del mapa manteniendo la calidad visual **y la topología**.

## Presupuesto

- **Máximo duro: 3 MB por archivo** (invariante del proyecto, ver `public/data/README.md`).
- Objetivo deseable: < 1 MB.
- Precisión de coordenadas: 5 decimales (≈1 m) es suficiente para este mapa.

## Herramientas: qué hay y qué no

Declarado en `package.json`: `topojson-server`, `topojson-simplify`, `topojson-client`,
`d3-geo`, `polygon-clipping`.

**No declarado:** `@turf/turf` no está instalado. `mapshaper` no es dependencia: solo lo usa
`npm run etl:nacional-geo` vía `npx` (baja al vuelo, necesita red). No escribir pasos que
dependan de ellos sin avisar.

## Por qué TopoJSON y no simplificar el GeoJSON directo

Simplificar polígonos independientes hace que dos barrios vecinos pierdan vértices distintos
sobre el borde que comparten: aparecen huecos y solapes. TopoJSON extrae los arcos compartidos
y los simplifica una sola vez, así que el borde común queda idéntico de los dos lados. Para un
mapa coroplético de unidades contiguas, es la única opción sensata.

## Workflow

### 1. Medir antes de tocar
```bash
ls -lh <archivo>
```
Anotar tamaño, cantidad de features y precisión actual de coordenadas.

### 2. Backup
El repo ya tiene `public/backups/`. Copiar ahí el original antes de sobreescribir.

### 3. Preferir el builder existente
```bash
npm run etl:localidad-geo     # etl/build-localidad-topojson.ts
```
Si el archivo entra por el pipeline, el arreglo va en el builder, no en el artefacto.

### 4. Para un archivo suelto: script `npx tsx`
Cadena: `topology()` (topojson-server) → `presimplify()` → `quantile()` → `simplify()`
(topojson-simplify) → si hace falta GeoJSON de vuelta, `feature()` (topojson-client).

La cuantización es la que más pesa en el resultado: bajar la grilla suele dar más reducción
que subir la agresividad de la simplificación, y sin deformar contornos.

### 5. Limpiar propiedades
Quedarse solo con las que consume el frontend. Cada propiedad de texto se repite por feature y
suma rápido.

### 6. Verificar
- Tamaño ≤ 3 MB.
- **La cantidad de features no cambió** — si bajó, se comió polígonos chicos.
- Sin geometrías nulas ni anillos degenerados.
- Coordenadas dentro de Uruguay: lat −35,0 a −30,0 · lon −58,5 a −53,0.
- Mirar el mapa a los zooms de uso real. Si hay dudas, `npm run dev` y comparar.
- `npm run gate:grises` — detecta zonas que quedaron sin geometría.

## Si no llega al objetivo

Iterar bajando cuantización antes que subir simplificación, y volver a medir en cada paso. Si
después de dos o tres pasadas sigue sin entrar, parar y reportar: puede ser que el archivo
tenga más detalle del que este mapa necesita (p. ej. geometría catastral donde alcanza el
límite de barrio) y la solución sea cambiar la fuente, no exprimirla.

## Relacionadas
- `validate-csv` · `add-department`
