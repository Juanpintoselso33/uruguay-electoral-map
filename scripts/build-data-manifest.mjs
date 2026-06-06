/**
 * Manifest de capacidades por (elección, depto): lista qué archivos OPCIONALES existen, para
 * que el front sólo pida lo que hay y no dispare 404 a datos que esa elección/depto no tiene
 * (binarias sin hoja-circuito, interior sin serie-annexed, etc.). Determinístico desde
 * public/data/. Salida: public/data/_manifest.json.
 *
 * Contrato de consumo (ChoroplethMap): el front SALTA un fetch opcional sólo si el manifest
 * conoce ese (elección, depto) y el archivo NO está listado. Si no lo conoce → fetch como antes
 * (fallback seguro, sin regresión).
 *
 * Corre en `npm run build` (antes de astro build) y en la integración de Vercel.
 */
import { readdirSync, statSync, existsSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const DATA = 'public/data';
// Archivos opcionales que el front fetchea condicionalmente (clave = stem del archivo).
const OPTIONAL = [
  'catalogo',
  'serie-annexed',
  'zona-annexed',
  'hoja-local',
  'hoja-circuito',
  'votes-circuito',
  'localidad-meta',
  'intendentes',
  'intendentes-zona',
  'alcaldes',
  'concejos',
];
// Subdirs de public/data que NO son elecciones.
const NOT_ELECTION = new Set(['geo', 'mappings', 'personas', 'api', 'hoja-equivalencias']);

const isDir = (p) => { try { return statSync(p).isDirectory(); } catch { return false; } };

const manifest = {};
let elecciones = 0;
let vistas = 0;
for (const eleccion of readdirSync(DATA)) {
  if (eleccion.startsWith('_') || NOT_ELECTION.has(eleccion)) continue;
  const epath = join(DATA, eleccion);
  if (!isDir(epath)) continue;
  let any = false;
  for (const depto of readdirSync(epath)) {
    const dpath = join(epath, depto);
    if (!isDir(dpath)) continue;
    // Una "vista" real tiene votes.json u opciones.json (depto o _nacional).
    if (!existsSync(join(dpath, 'votes.json')) && !existsSync(join(dpath, 'opciones.json'))) continue;
    const present = OPTIONAL.filter((k) => existsSync(join(dpath, `${k}.json`)));
    // 'hoja-base': existe el dir hoja/ (shards por lista). Ausente = elección lema-only (p.ej.
    // municipales) → el front no prueba hoja/{lema}.json (evita el 404 del probe eleccionSinHojaBase).
    if (isDir(join(dpath, 'hoja'))) present.push('hoja-base');
    (manifest[eleccion] ||= {})[depto] = present; // SIEMPRE registrar la vista (aunque present=[])
    any = true;
    vistas++;
  }
  if (any) elecciones++;
}

const out = join(DATA, '_manifest.json');
writeFileSync(out, JSON.stringify(manifest));
const bytes = JSON.stringify(manifest).length;
console.log(`[manifest] ${elecciones} elecciones, ${vistas} vistas → ${out} (${(bytes / 1024).toFixed(1)} KB)`);
