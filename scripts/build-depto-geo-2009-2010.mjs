#!/usr/bin/env node
/**
 * Genera geo/{depto}/departamento.topo.json: extracto de UN solo departamento del
 * topo nacional (geo/_nacional/departamento.topo.json), re-topologizado.
 *
 * Las elecciones 2009-2010 son DEPARTAMENTO-only: la página per-depto (ruta
 * /{eleccion}/{depto}) rinde el polígono de ESE departamento + el acordeón de HOJA.
 * ChoroplethMap pide geo/{depto}/{nivel}.topo.json (nivel='departamento'), que para
 * los demás ciclos no existe en geo/{depto}/. Lo creamos como feature único.
 *
 * geoId join: ChoroplethMap matchea por norm(properties.name); preservamos `name`
 * (y `id`) del feature original, así votes.json geoId="Cerro Largo" joinea.
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { feature } from 'topojson-client';
import { topology } from 'topojson-server';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const GEO = join(ROOT, 'public', 'data', 'geo');

const nacTopo = JSON.parse(readFileSync(join(GEO, '_nacional', 'departamento.topo.json'), 'utf8'));
const objName = Object.keys(nacTopo.objects)[0];
const fc = feature(nacTopo, nacTopo.objects[objName]);

let n = 0;
for (const feat of fc.features) {
  const id = feat.properties?.id;
  if (!id) {
    console.warn('! feature sin properties.id, salteado:', feat.properties);
    continue;
  }
  // Re-topologizar SOLO este feature (no arrastrar los 19 deptos de arcos).
  const single = topology({ departamento: { type: 'FeatureCollection', features: [feat] } });
  const dir = join(GEO, id);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'departamento.topo.json'), JSON.stringify(single));
  n++;
}
console.log(`generados ${n} geo/{depto}/departamento.topo.json`);
