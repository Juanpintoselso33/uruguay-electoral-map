/**
 * Genera public/search-index.json con todas las entidades buscables:
 * departamentos disponibles + opciones/partidos por departamento.
 * Corre antes de `astro build` para que el JSON esté en public/.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DEPTS = JSON.parse(readFileSync(join(__dirname, '..', 'src', 'config', 'departments.json'), 'utf8'));
const ROUTES = DEPTS.flatMap((d) => d.elecciones.map((e) => ({ eleccion: e, departamento: d.id, label: d.label })));

const entries = [];

for (const { eleccion, departamento, label } of ROUTES) {
  const deptLabel = label ?? (departamento.charAt(0).toUpperCase() + departamento.slice(1));

  entries.push({
    label: deptLabel,
    sublabel: eleccion,
    type: 'depto',
    href: `/${eleccion}/${departamento}`,
  });

  let opcDoc;
  try {
    opcDoc = JSON.parse(readFileSync(`public/data/${eleccion}/${departamento}/opciones.json`, 'utf8'));
  } catch {
    // Ruta sin opciones.json (aún no ingerida) → solo se indexa el depto, no se rompe el build.
    console.warn(`[generate:search] sin opciones.json para ${eleccion}/${departamento} — se omiten opciones`);
    continue;
  }
  const opciones = opcDoc.opciones;
  // Plebiscito/referéndum (Story 7.5): el dato trae la pregunta y las opciones son Sí/No,
  // que NO son partidos. Se rotulan como 'opcion' y la pregunta se hace buscable.
  const esBinaria = !!opcDoc.pregunta;
  if (esBinaria) {
    entries.push({
      label: opcDoc.pregunta,
      sublabel: `${deptLabel} · ${eleccion}`,
      type: 'pregunta',
      href: `/${eleccion}/${departamento}`,
    });
  }

  for (const op of opciones) {
    entries.push({
      label: op.nombre,
      sublabel: `${deptLabel} · ${eleccion}`,
      type: esBinaria ? 'opcion' : 'partido',
      href: `/${eleccion}/${departamento}?opcion=${op.opcionId}`,
    });
  }
}

writeFileSync('public/search-index.json', JSON.stringify(entries));
console.log(`[generate:search] OK: ${entries.length} entrada(s) → public/search-index.json`);
