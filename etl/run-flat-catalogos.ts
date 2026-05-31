/**
 * Generador de `catalogo.json` para elecciones de ESCALERA PLANA (Story 10.10).
 *
 * Balotaje y plebiscito no tienen jerarquía de HOJA: su unidad de voto (candidato /
 * Sí-No) vive directamente en `votes.json`. Para que el acordeón de opción (Story 10.3)
 * los renderice como lista plana con checkbox, emitimos un `catalogo.json` mínimo:
 * una sola contienda `unica`, sin nodos agrupadores, con una opción por unidad de voto.
 *
 * LINCHPIN (verificado por gate): el `id` de cada opción del catálogo DEBE ser idéntico
 * al `opcionId` del `votes.json` base; el mapa colorea la selección sumando desde
 * `zonasVotos` (sin shards de hoja) y el join es por ese id. Si difieren, el mapa pinta
 * uniforme-bajo. Por eso el catálogo se DERIVA de `opciones.json` (misma fuente).
 *
 * Ejecutar: `npm run etl:flat-catalogos`.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import type { EleccionTipo, Contienda, GranularidadNivel } from '../src/lib/contracts';
import { ESCALERAS } from '../src/lib/contracts/granularidad';

interface OpcionesDoc {
  pregunta?: string;
  opciones: { opcionId: string; nombre: string }[];
}
interface VotesDoc {
  tipo: EleccionTipo;
  eleccionId: string;
  departamento: string;
  zonas: { porOpcion: { opcionId: string }[] }[];
}

/** Elecciones planas con dato real ya ingerido (Montevideo). */
const TARGETS: { eleccionId: string; departamento: string }[] = [
  { eleccionId: 'balotaje-2024', departamento: 'montevideo' },
  { eleccionId: 'balotaje-2014', departamento: 'montevideo' },
  { eleccionId: 'balotaje-2019', departamento: 'montevideo' },
  { eleccionId: 'plebiscito-allanamientos-2024', departamento: 'montevideo' },
  { eleccionId: 'plebiscito-seguridad-social-2024', departamento: 'montevideo' },
  { eleccionId: 'referendum-luc-2022', departamento: 'montevideo' },
];

/** Nivel terminal (clase de opción) por tipo plano. Fuente de verdad: ESCALERAS. */
function escaleraPlana(tipo: EleccionTipo, contienda: Contienda): readonly GranularidadNivel[] {
  const esc = ESCALERAS.find((e) => e.tipo === tipo && e.contienda === contienda);
  if (!esc) throw new Error(`[gate] no hay escalera declarada para (${tipo}, ${contienda}) en ESCALERAS`);
  if (esc.niveles.length !== 1) {
    throw new Error(`[gate] escalera (${tipo}, ${contienda}) no es plana: ${esc.niveles.join('>')}`);
  }
  return esc.niveles;
}

function buildCatalogo(eleccionId: string, departamento: string): void {
  const dir = `public/data/${eleccionId}/${departamento}`;
  const opc = JSON.parse(readFileSync(`${dir}/opciones.json`, 'utf8')) as OpcionesDoc;
  const votes = JSON.parse(readFileSync(`${dir}/votes.json`, 'utf8')) as VotesDoc;

  const contienda: Contienda = 'unica';
  const niveles = escaleraPlana(votes.tipo, contienda);
  const terminal = niveles[niveles.length - 1]; // 'candidato' | 'binaria'

  const opciones = opc.opciones.map((o) => {
    if (terminal === 'candidato') {
      return { clase: 'candidato', id: o.opcionId, candidato: o.nombre, partidoId: o.opcionId, contienda };
    }
    if (terminal === 'binaria') {
      // OpcionBinaria.etiqueta ∈ {'si','no'} = el propio opcionId del dato.
      return { clase: 'binaria', id: o.opcionId, etiqueta: o.opcionId, nombre: o.nombre };
    }
    throw new Error(`[gate] nivel terminal inesperado para tipo plano: ${terminal}`);
  });

  const catalogo = {
    eleccionId,
    departamento,
    contiendas: [{ contienda, niveles: [...niveles], nodos: [], opciones }],
  };

  // Gate de reconciliación: los ids del catálogo deben cubrir EXACTAMENTE los opcionIds
  // que el mapa une en runtime, es decir los de `votes.json.zonas[].porOpcion` (NO los de
  // opciones.json, de donde derivan los del catálogo — eso sería tautológico). Si difieren,
  // el mapa pinta uniforme-bajo al no encontrar la opción en zonasVotos.
  const idsCat = new Set(opciones.map((o) => o.id));
  const idsVotes = new Set(votes.zonas.flatMap((z) => z.porOpcion.map((p) => p.opcionId)));
  const faltan = [...idsVotes].filter((id) => !idsCat.has(id));
  const sobran = [...idsCat].filter((id) => !idsVotes.has(id));
  if (faltan.length > 0 || sobran.length > 0) {
    throw new Error(
      `[gate] ${eleccionId}/${departamento}: ids del catálogo ≠ opcionIds del votes.json` +
        (faltan.length ? ` · sin cubrir: ${faltan.join(',')}` : '') +
        (sobran.length ? ` · sobran: ${sobran.join(',')}` : ''),
    );
  }

  writeFileSync(`${dir}/catalogo.json`, JSON.stringify(catalogo, null, 2) + '\n', 'utf8');
  console.log(`  ✓ ${eleccionId}/${departamento}: ${votes.tipo} plano → ${opciones.length} opciones (${terminal})`);
}

function main(): void {
  console.log('=== Generador de catálogos planos (Story 10.10) ===');
  for (const t of TARGETS) buildCatalogo(t.eleccionId, t.departamento);
  console.log('Listo. Catálogos planos emitidos.');
}

main();
