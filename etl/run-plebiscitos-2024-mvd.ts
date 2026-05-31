/**
 * Orquestador ETL — Plebiscitos 2024 Montevideo (Story 7.3). Tipo `plebiscito`, OpcionBinaria.
 *
 * En 2024 hubo DOS plebiscitos constitucionales (mismo sobre que las nacionales):
 *   - Art. 11 → allanamientos nocturnos   (columna SiArt11)
 *   - Art. 67 → reforma de la seguridad social (columna SiArt67)
 * NO hay papeleta "No": se vota Sí poniendo la papeleta; no ponerla = No.
 * Por lo tanto, por barrio: Sí = SiArt{N}; No = válidos − Sí (válidos = TotalVotosNoObservados).
 *
 * Reusa el join CRV→BARRIO de Montevideo (no regenera geometría). Gate de losslessness:
 * Sí + No == válidos por barrio. Ejecutar: `npm run etl:plebiscitos-mvd`.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import type { AgregadoZona, VotoOpcion } from '../src/lib/contracts';
import { parseCsv } from './extract/parse-csv';
import { buildShard, writeShard } from './load/emit-shard';
import { normName } from './lib/normalize';

const CSV = 'data/raw/electoral/nacionales-2024/totales-generales-plebiscitos.csv';
const MAPPING_IN = 'data/mappings/montevideo-circuito-barrio.json';
const DEPTO = 'montevideo';

interface Pleb { eleccionId: string; nombre: string; col: string; pregunta: string }
const PLEBISCITOS: Pleb[] = [
  {
    eleccionId: 'plebiscito-allanamientos-2024', nombre: 'Plebiscito Allanamientos Nocturnos 2024',
    col: 'SiArt11', pregunta: '¿Aprueba la reforma del artículo 11 de la Constitución (allanamientos nocturnos)?',
  },
  {
    eleccionId: 'plebiscito-seguridad-social-2024', nombre: 'Plebiscito Seguridad Social 2024',
    col: 'SiArt67', pregunta: '¿Aprueba la reforma del artículo 67 de la Constitución (seguridad social)?',
  },
];

function resolveBarrio(map: Record<string, string>, crv: string): string | undefined {
  if (map[crv]) return map[crv];
  const n = Number(crv);
  if (Number.isFinite(n) && map[String(n)]) return map[String(n)];
  return undefined;
}

function main(): void {
  console.log('=== ETL Plebiscitos 2024 Montevideo (Story 7.3) ===');
  const { crvToBarrio } = JSON.parse(readFileSync(MAPPING_IN, 'utf8')) as { crvToBarrio: Record<string, string> };
  const rows = parseCsv(CSV).filter((r) => r['Departamento'] === 'MO');

  for (const pleb of PLEBISCITOS) {
    // barrio(norm) → { display, si, validos, anulados, observados }
    const porBarrio = new Map<string, { display: string; si: number; validos: number; anulados: number; observados: number }>();
    let unmapped = 0;
    let totalValidos = 0;
    for (const r of rows) {
      const validos = Number(r['TotalVotosNoObservados']) || 0;
      const si = Number(r[pleb.col]) || 0;
      const barrio = resolveBarrio(crvToBarrio, (r['CRV'] ?? '').trim());
      if (!barrio) { unmapped += validos; continue; }
      totalValidos += validos;
      const k = normName(barrio);
      let e = porBarrio.get(k);
      if (!e) { e = { display: barrio, si: 0, validos: 0, anulados: 0, observados: 0 }; porBarrio.set(k, e); }
      e.si += si;
      e.validos += validos;
      e.anulados += Number(r['TotalAnulados']) || 0;
      e.observados += Number(r['TotalVotosObservados']) || 0;
    }

    const zonas: AgregadoZona[] = [];
    for (const e of porBarrio.values()) {
      const si = e.si;
      const no = e.validos - si; // No implícito (no hay papeleta No)
      if (no < 0) throw new Error(`${pleb.eleccionId}/${e.display}: Sí ${si} > válidos ${e.validos}`);
      const porOpcion: VotoOpcion[] = [
        { opcionId: 'si', votos: si },
        { opcionId: 'no', votos: no },
      ];
      zonas.push({
        geoId: e.display,
        ganadorOpcionId: si >= no ? 'si' : 'no',
        validos: e.validos,
        porOpcion,
        noPartidarios: { enBlanco: 0, anulados: e.anulados, observados: e.observados },
      });
    }

    const SHARD_OUT = `public/data/${pleb.eleccionId}/${DEPTO}/votes.json`;
    const OPC_OUT = `public/data/${pleb.eleccionId}/${DEPTO}/opciones.json`;
    const shard = buildShard(zonas, { eleccionId: pleb.eleccionId, departamento: DEPTO, tipo: 'plebiscito', nivel: 'zona', outPath: SHARD_OUT });
    writeShard(shard, SHARD_OUT);
    mkdirSync(dirname(OPC_OUT), { recursive: true });
    writeFileSync(OPC_OUT, JSON.stringify({ pregunta: pleb.pregunta, opciones: [{ opcionId: 'si', nombre: 'Sí' }, { opcionId: 'no', nombre: 'No' }] }), 'utf8');

    // Gate losslessness: Σ (sí+no) == Σ válidos.
    let sumSiNo = 0;
    let sumVal = 0;
    let siGlobal = 0;
    for (const z of zonas) { for (const v of z.porOpcion) sumSiNo += v.votos; sumVal += z.validos; siGlobal += z.porOpcion[0].votos; }
    if (sumSiNo !== sumVal) throw new Error(`${pleb.eleccionId}: Σ(sí+no) ${sumSiNo} ≠ Σválidos ${sumVal}`);
    const pct = sumVal > 0 ? (siGlobal / sumVal) * 100 : 0;
    console.log(`  ${pleb.eleccionId}: ${zonas.length} barrios · Sí ${siGlobal.toLocaleString('es-UY')} / válidos ${sumVal.toLocaleString('es-UY')} = ${pct.toFixed(1)}% · unmapped ${unmapped} · losslessness ✅`);
  }
  console.log('\n=== Plebiscitos 2024 MVD: gates PASARON ✅ ===');
}

main();
