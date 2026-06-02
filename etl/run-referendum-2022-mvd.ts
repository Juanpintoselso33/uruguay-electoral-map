/**
 * Orquestador ETL — Referéndum LUC 2022, Montevideo (Story 7.7). Tipo `plebiscito`, OpcionBinaria.
 *
 * Referéndum contra 135 artículos de la Ley de Urgente Consideración (Ley 19.889). A diferencia
 * de los plebiscitos 2024 (sin papeleta "No"), acá HAY papeletas Sí Y No explícitas:
 * `Total_SI` y `Total_NO` por CRV. El "Sí" deroga los artículos; el "No" los mantiene.
 *
 * válidos (denominador del % Sí) = Sí + No (blanco/anulado/observado son aparte, no cuentan al
 * resultado). Reusa el join CRV→BARRIO de Montevideo (no regenera geometría).
 *
 * NOTA: las columnas de totales del export oficial NO cierran exactamente entre sí (p. ej.
 * Sí+No+blanco+anulado ≠ Total_Votos_NO_Observados por ~0.01%, por resolución de observados/
 * recuentos). Eso es del dato fuente, no del pipeline → NO se asume esa identidad.
 *
 * Gate (no tautológico): ancla contra el RESULTADO PUBLICADO de Montevideo — en MO ganó el Sí
 * (derogar) con ~56.5% (a nivel nacional fue ~48.8% y NO se derogó). Si el % cae fuera de una
 * banda razonable o gana el No, hubo un error de columna/join. Más la validación estructural del
 * contrato (assertVotosShard: ganador=máx, no-negativos) vía buildShard.
 *
 * Ejecutar: `npm run etl:referendum-2022-mvd`.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import type { AgregadoZona, VotoOpcion } from '../src/lib/contracts';
import { parseCsv } from './extract/parse-csv';
import { buildShard, writeShard } from './load/emit-shard';
import { normName } from './lib/normalize';

const CSV = 'data/raw/electoral/referendum-2022/refer-ndum-contra-135-art-culos-de-la-le.csv';
const MAPPING_IN = 'data/mappings/montevideo-circuito-barrio.referendum-2022.json';
const DEPTO = 'montevideo';
const ELECCION = 'referendum-luc-2022';
const PREGUNTA = '¿Está a favor de derogar los 135 artículos de la Ley de Urgente Consideración (LUC)?';

function resolveBarrio(map: Record<string, string>, crv: string): string | undefined {
  if (map[crv]) return map[crv];
  const n = Number(crv);
  if (Number.isFinite(n) && map[String(n)]) return map[String(n)];
  return undefined;
}

function main(): void {
  console.log('=== ETL Referéndum LUC 2022 Montevideo (Story 7.7) ===');
  const { crvToBarrio } = JSON.parse(readFileSync(MAPPING_IN, 'utf8')) as { crvToBarrio: Record<string, string> };
  const rows = parseCsv(CSV).filter((r) => r['Departamento'] === 'MO');

  interface Acc { display: string; si: number; no: number; enBlanco: number; anulados: number; observados: number }
  const porBarrio = new Map<string, Acc>();
  let unmappedSi = 0;
  let unmappedNo = 0;
  for (const r of rows) {
    const si = Number(r['Total_SI']) || 0;
    const no = Number(r['Total_NO']) || 0;
    const barrio = resolveBarrio(crvToBarrio, (r['CRV'] ?? '').trim());
    if (!barrio) { unmappedSi += si; unmappedNo += no; continue; }
    const k = normName(barrio);
    let e = porBarrio.get(k);
    if (!e) { e = { display: barrio, si: 0, no: 0, enBlanco: 0, anulados: 0, observados: 0 }; porBarrio.set(k, e); }
    e.si += si;
    e.no += no;
    e.enBlanco += Number(r['Total_EN_Blanco']) || 0;
    e.anulados += Number(r['Total_Anulados']) || 0;
    e.observados += Number(r['Total_Votos_Observados']) || 0;
  }

  const zonas: AgregadoZona[] = [];
  let mappedSi = 0;
  let mappedNo = 0;
  for (const e of porBarrio.values()) {
    const validos = e.si + e.no; // % Sí sobre votos al referéndum (Sí+No)
    if (validos === 0) continue;
    mappedSi += e.si;
    mappedNo += e.no;
    const porOpcion: VotoOpcion[] = [
      { opcionId: 'si', votos: e.si },
      { opcionId: 'no', votos: e.no },
    ];
    zonas.push({
      geoId: e.display,
      ganadorOpcionId: e.si >= e.no ? 'si' : 'no',
      validos,
      porOpcion,
      noPartidarios: { enBlanco: e.enBlanco, anulados: e.anulados, observados: e.observados },
    });
  }

  // Ancla contra el resultado publicado de Montevideo (cross-check externo, NO tautológico):
  // en MO ganó el Sí (derogar) con ~56.5%. Fuera de banda → error de columna/join.
  const val = mappedSi + mappedNo;
  const pctSi = val > 0 ? (mappedSi / val) * 100 : 0;
  if (mappedSi <= mappedNo) throw new Error(`${ELECCION}: en MO debió ganar el Sí (Sí ${mappedSi} ≤ No ${mappedNo}) — ¿columnas Sí/No intercambiadas?`);
  if (pctSi < 53 || pctSi > 60) throw new Error(`${ELECCION}: Sí% MO ${pctSi.toFixed(1)}% fuera de la banda esperada (~56.5%) — ¿error de join/columna?`);

  const SHARD_OUT = `public/data/${ELECCION}/${DEPTO}/votes.json`;
  const OPC_OUT = `public/data/${ELECCION}/${DEPTO}/opciones.json`;
  const shard = buildShard(zonas, { eleccionId: ELECCION, departamento: DEPTO, tipo: 'plebiscito', nivel: 'zona', outPath: SHARD_OUT });
  writeShard(shard, SHARD_OUT);
  mkdirSync(dirname(OPC_OUT), { recursive: true });
  writeFileSync(OPC_OUT, JSON.stringify({ pregunta: PREGUNTA, opciones: [{ opcionId: 'si', nombre: 'Sí' }, { opcionId: 'no', nombre: 'No' }] }), 'utf8');

  console.log(
    `  ${ELECCION}: ${zonas.length} barrios · Sí ${mappedSi.toLocaleString('es-UY')} / ${val.toLocaleString('es-UY')} = ${pctSi.toFixed(1)}% · ` +
      `unmapped Sí ${unmappedSi.toLocaleString('es-UY')} / No ${unmappedNo.toLocaleString('es-UY')} · ancla resultado MO ✅`,
  );
  console.log('\n=== Referéndum LUC 2022 MVD: gates PASARON ✅ ===');
}

main();
