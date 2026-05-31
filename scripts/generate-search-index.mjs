/**
 * Genera public/search-index.json con todas las entidades buscables:
 * departamentos disponibles + opciones/partidos por departamento.
 * Corre antes de `astro build` para que el JSON esté en public/.
 */
import { readFileSync, writeFileSync } from 'node:fs';

const ROUTES = [
  { eleccion: 'internas-2024',   departamento: 'montevideo' },
  { eleccion: 'internas-2024',   departamento: 'rivera'     },
  { eleccion: 'nacionales-2019', departamento: 'montevideo' },
];

const entries = [];

for (const { eleccion, departamento } of ROUTES) {
  const deptLabel = departamento.charAt(0).toUpperCase() + departamento.slice(1);

  entries.push({
    label: deptLabel,
    sublabel: eleccion,
    type: 'depto',
    href: `/${eleccion}/${departamento}`,
  });

  const opciones = JSON.parse(
    readFileSync(`public/data/${eleccion}/${departamento}/opciones.json`, 'utf8'),
  ).opciones;

  for (const op of opciones) {
    entries.push({
      label: op.nombre,
      sublabel: `${deptLabel} · ${eleccion}`,
      type: 'partido',
      href: `/${eleccion}/${departamento}?opcion=${op.opcionId}`,
    });
  }
}

writeFileSync('public/search-index.json', JSON.stringify(entries));
console.log(`[generate:search] OK: ${entries.length} entrada(s) → public/search-index.json`);
