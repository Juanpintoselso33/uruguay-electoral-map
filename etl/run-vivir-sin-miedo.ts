/**
 * Story 14.2 — Plebiscito "Vivir sin Miedo" (reforma constitucional de seguridad, 27/10/2019).
 * Binaria Sí/No, tipo `plebiscito`. Montevideo por BARRIO (join CRV→barrio) + 18 interior por SERIE.
 *
 * Como los plebiscitos 2024, NO hubo papeleta "No": se vota Sí incluyendo la papeleta "Por SÍ";
 * no incluirla = No. Por lo tanto: válidos = NoObservados; Sí = "Papeleta por SI"; No = válidos − Sí.
 *
 * Fuente (Story 14.1): el dato por CRV NO está en datos abiertos (CKAN solo trae `TotalSoloSi`).
 * `scripts/extract-vivir-sin-miedo.py` lo extrae del PDF oficial "Resultados del plebiscito por
 * circuito" y lo joinea contra `totales-generales-por-CRV` → `vivir-sin-miedo-2019-por-crv.csv`
 * (Sí nacional = 1.139.433, exacto). Reusa la geometría (serie/barrio) ya generada.
 *
 * Ejecutar: `npm run etl:vivir-sin-miedo`.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import type { AgregadoZona, VotoOpcion } from '../src/lib/contracts';
import { parseCsv } from './extract/parse-csv';
import { buildShard, writeShard } from './load/emit-shard';
import { normName } from './lib/normalize';
import { runBinariaInterior } from './lib/run-binaria-interior';

const CSV = 'data/raw/electoral/plebiscito-2019/vivir-sin-miedo-2019-por-crv.csv';
const MAPPING_IN = 'data/mappings/montevideo-circuito-barrio.2019.json';
const ELECCION = 'plebiscito-vivir-sin-miedo-2019';
const PREGUNTA = '¿Aprueba el proyecto de reforma constitucional sobre seguridad pública ("Vivir sin Miedo")?';
const SI_NO = [
  { opcionId: 'si', nombre: 'Sí' },
  { opcionId: 'no', nombre: 'No' },
] as const;

function resolveBarrio(map: Record<string, string>, crv: string): string | undefined {
  if (map[crv]) return map[crv];
  const n = Number(crv);
  if (Number.isFinite(n) && map[String(n)]) return map[String(n)];
  return undefined;
}

/** Montevideo: agrega CRV→barrio. Gate: losslessness (Sí+No==válidos) + ancla resultado MO (~38,6%). */
function runMontevideo(): void {
  const { crvToBarrio } = JSON.parse(readFileSync(MAPPING_IN, 'utf8')) as { crvToBarrio: Record<string, string> };
  const rows = parseCsv(CSV).filter((r) => r['Departamento'] === 'MO');

  interface Acc { display: string; si: number; validos: number; anulados: number; observados: number }
  const porBarrio = new Map<string, Acc>();
  let unmapped = 0;
  for (const r of rows) {
    const validos = Number(r['NoObservados']) || 0;
    const si = Number(r['Si']) || 0;
    const barrio = resolveBarrio(crvToBarrio, (r['CRV'] ?? '').trim());
    if (!barrio) { unmapped += validos; continue; }
    const k = normName(barrio);
    let e = porBarrio.get(k);
    if (!e) { e = { display: barrio, si: 0, validos: 0, anulados: 0, observados: 0 }; porBarrio.set(k, e); }
    e.si += si;
    e.validos += validos;
    e.anulados += Number(r['Anulados']) || 0;
    e.observados += Number(r['Observados']) || 0;
  }

  const zonas: AgregadoZona[] = [];
  let siGlobal = 0;
  let valGlobal = 0;
  for (const e of porBarrio.values()) {
    const no = e.validos - e.si;
    if (no < 0) throw new Error(`${ELECCION}/${e.display}: Sí ${e.si} > válidos ${e.validos}`);
    siGlobal += e.si;
    valGlobal += e.validos;
    const porOpcion: VotoOpcion[] = [
      { opcionId: 'si', votos: e.si },
      { opcionId: 'no', votos: no },
    ];
    zonas.push({
      geoId: e.display,
      ganadorOpcionId: e.si >= no ? 'si' : 'no',
      validos: e.validos,
      porOpcion,
      noPartidarios: { enBlanco: 0, anulados: e.anulados, observados: e.observados },
    });
  }

  // Ancla externa (no tautológica): en MO el Sí PERDIÓ con ~38,6% (publicado 38,89%).
  const pctSi = valGlobal > 0 ? (siGlobal / valGlobal) * 100 : 0;
  if (siGlobal >= valGlobal - siGlobal) throw new Error(`${ELECCION}: en MO el Sí debió perder (Sí% ${pctSi.toFixed(1)}%) — ¿error de join/columna?`);
  if (pctSi < 36 || pctSi > 41) throw new Error(`${ELECCION}: Sí% MO ${pctSi.toFixed(1)}% fuera de banda (~38,6%) — ¿error de join/columna?`);

  const SHARD_OUT = `public/data/${ELECCION}/montevideo/votes.json`;
  const OPC_OUT = `public/data/${ELECCION}/montevideo/opciones.json`;
  const shard = buildShard(zonas, { eleccionId: ELECCION, departamento: 'montevideo', tipo: 'plebiscito', nivel: 'zona', outPath: SHARD_OUT });
  writeShard(shard, SHARD_OUT);
  mkdirSync(dirname(OPC_OUT), { recursive: true });
  writeFileSync(OPC_OUT, JSON.stringify({ pregunta: PREGUNTA, opciones: SI_NO }), 'utf8');
  console.log(`  ✅ montevideo: ${zonas.length} barrios · Sí ${siGlobal.toLocaleString('es-UY')} / ${valGlobal.toLocaleString('es-UY')} = ${pctSi.toFixed(1)}% · unmapped ${unmapped} · ancla MO ✅`);
}

function main(): void {
  console.log(`=== ETL ${ELECCION} (Story 14.2) ===`);
  console.log('\n--- Montevideo (barrio) ---');
  runMontevideo();
  console.log('\n--- Interior (serie) ---');
  runBinariaInterior({
    eleccionId: ELECCION,
    tipo: 'plebiscito',
    csv: CSV,
    opciones: SI_NO,
    pregunta: PREGUNTA,
    extract: (r) => {
      const validos = Number(r['NoObservados']) || 0;
      const si = Number(r['Si']) || 0;
      return { a: si, b: validos - si, enBlanco: 0, anulados: Number(r['Anulados']) || 0, observados: Number(r['Observados']) || 0 };
    },
  });
  console.log(`\n=== ${ELECCION}: ETL COMPLETO (19 deptos) ✅ ===`);
}

main();
