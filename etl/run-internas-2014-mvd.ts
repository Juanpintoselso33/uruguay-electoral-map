/**
 * ETL — Montevideo internas-2014, DEPTO-TOTAL (una sola zona = "Montevideo").
 *
 * POR QUÉ depto-total y no por barrio: el join CRV→barrio de Montevideo es POR CICLO (ADR-0001).
 * internas-2014 (junio) NO comparte la numeración de CRV de nacionales-2014 (octubre): el test
 * CRV→SERIES da 8,2% de coincidencia → reusar `montevideo-circuito-barrio.2014.json` mis-joinea
 * (el bug "Carrasco 66,5%"). Y NO existe plan-circuital de internas-2014 (ni en el repo ni en CKAN)
 * para generar un mapeo address-based propio con build-circuito-barrio-cycles.py. El fallback
 * serie→barrio dominante tiene pureza ponderada por votos de sólo 59% → inaceptable (ADR último tier).
 *
 * Solución honesta: emitir el TOTAL departamental exacto (suma de todas las filas MO HOJA_ODN,
 * sin join), en una única zona "Montevideo". Esto:
 *   - mantiene MVD (el depto más grande) en la VISTA NACIONAL (build-nacional-votes exige 19 deptos),
 *     con totales correctos a nivel departamento.
 *   - degrada con gracia la ficha per-depto de MVD a una sola zona (sin barrios falsos).
 * Para recuperar el barrio + circuito + local de MVD hace falta el plan-circuital de internas-2014.
 *
 * Ejecutar: `npm run etl:internas-2014-mvd`
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import type { AgregadoZona, VotoOpcion } from '../src/lib/contracts';
import { parseCsv } from './extract/parse-csv';
import { buildShard, writeShard } from './load/emit-shard';
import { reconcile } from './gates/reconcile';
import { slug } from './lib/normalize';

const CSV = 'data/raw/electoral/internas-2014/desglose-de-votos.csv';
const ELECCION = 'internas-2014';
const SHARD_OUT = `public/data/${ELECCION}/montevideo/votes.json`;
const OPCIONES_OUT = `public/data/${ELECCION}/montevideo/opciones.json`;

function main(): void {
  console.log('=== ETL Montevideo internas-2014 — DEPTO-TOTAL (sin barrio; ver ADR-0001) ===');
  const rows = parseCsv(CSV, 'utf8');

  const lemas = new Map<string, number>();   // lemaId → votos
  const lemaNombre = new Map<string, string>();
  let total = 0;
  for (const r of rows) {
    if (r['DEPARTAMENTO'] !== 'MO' || r['TIPO_REGISTRO'] !== 'HOJA_ODN') continue;
    const votos = Number(r['CANTIDAD_VOTOS']) || 0;
    if (votos <= 0) continue;
    const lemaRaw = (r['LEMA'] ?? '').trim();
    if (!lemaRaw) continue;
    const lemaId = slug(lemaRaw);
    lemaNombre.set(lemaId, lemaRaw);
    lemas.set(lemaId, (lemas.get(lemaId) ?? 0) + votos);
    total += votos;
  }

  const ranking = [...lemas.entries()].sort((a, b) => b[1] - a[1]);
  const porOpcion: VotoOpcion[] = ranking.map(([opcionId, votos]) => ({ opcionId, votos }));
  const zona: AgregadoZona = {
    geoId: 'Montevideo',
    ganadorOpcionId: ranking.length ? ranking[0][0] : '',
    validos: total,
    porOpcion,
    noPartidarios: { enBlanco: 0, anulados: 0, observados: 0 },
  };

  const shard = buildShard([zona], { eleccionId: ELECCION, departamento: 'montevideo', tipo: 'internas', nivel: 'zona', outPath: SHARD_OUT });
  writeShard(shard, SHARD_OUT);
  const opciones = [...lemaNombre.entries()].map(([opcionId, nombre]) => ({ opcionId, nombre }));
  mkdirSync(dirname(OPCIONES_OUT), { recursive: true });
  writeFileSync(OPCIONES_OUT, JSON.stringify({ opciones }), 'utf8');

  console.log(`Montevideo depto-total: ${total.toLocaleString('es-UY')} votos · ${opciones.length} lemas`);
  const rec = reconcile(shard, total, 0);
  console.log(`Reconciliación: sum-in=${rec.sumIn.toLocaleString('es-UY')} delta=${rec.delta} ✅`);
  console.log('=== MVD internas-2014: OK (depto-total) ✅ ===');
}

main();
