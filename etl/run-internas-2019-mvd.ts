/**
 * Orquestador ETL — Montevideo internas-2019, nivel LEMA (Story 7.7).
 *
 * Schema RAW de la Corte (Latin-1, campos entre comillas): TIPO_REGISTRO, DEPARTAMENTO, CRV,
 * SERIES, LEMA, DESCRIPCIÓN_1/2, CANTIDAD_VOTOS. La interna tiene ODN (Convención Nacional) y
 * ODD (Departamental). El total por PARTIDO en la interna = Σ de sus HOJA_ODN (la votación
 * nacional define quién votó en cada interna partidaria); se excluyen filas agregadas
 * (SUBLEMA_ODN/ODD y VOTOS_PREC) para no doble-contar.
 *
 * Nivel lema (no HOJA) → OpcionSelector estándar, sin catálogo. Reusa el mapping CRV→BARRIO.
 * Gates reales: reconciliación (Σ shard + no-mapeados == Σ crudo) + cobertura barrios↔geometría.
 *
 * Ejecutar: `npm run etl:internas-2019-mvd`.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { feature } from 'topojson-client';
import type { GeometryCollection } from 'topojson-specification';
import type { FeatureCollection } from 'geojson';
import type { AgregadoZona, VotoOpcion } from '../src/lib/contracts';
import { parseCsv } from './extract/parse-csv';
import { buildShard, writeShard } from './load/emit-shard';
import { reconcile } from './gates/reconcile';
import { checkCoverage } from './gates/coverage';
import { normName, slug } from './lib/normalize';

const CSV = 'data/raw/electoral/internas-2019/desglose-de-votos.csv';
const MAPPING_IN = 'data/mappings/montevideo-circuito-barrio.internas-2019.json';
const GEO_IN = 'public/data/geo/montevideo/zona.topo.json';
const SHARD_OUT = 'public/data/internas-2019/montevideo/votes.json';
const OPCIONES_OUT = 'public/data/internas-2019/montevideo/opciones.json';

function main(): void {
  console.log('=== ETL Montevideo internas-2019 (nivel lema, Story 7.7) ===');
  const rows = parseCsv(CSV, 'latin1');
  const { crvToBarrio } = JSON.parse(readFileSync(MAPPING_IN, 'utf8')) as { crvToBarrio: Record<string, string> };

  // barrio(norm) → { display, lemas: Map<lemaId, votos> }
  const porBarrio = new Map<string, { display: string; lemas: Map<string, number> }>();
  const lemaNombre = new Map<string, string>();
  let totalCanonico = 0;
  let unmappedVotos = 0;
  const circuitosSinBarrio = new Set<string>();

  for (const r of rows) {
    if (r['DEPARTAMENTO'] !== 'MO' || r['TIPO_REGISTRO'] !== 'HOJA_ODN') continue;
    const votos = Number(r['CANTIDAD_VOTOS']) || 0;
    if (votos < 0) continue;
    totalCanonico += votos;

    const crv = (r['CRV'] ?? '').trim();
    const barrio = crvToBarrio[crv] ?? crvToBarrio[String(Number(crv))];
    if (!barrio) { circuitosSinBarrio.add(crv); unmappedVotos += votos; continue; }

    const lemaRaw = (r['LEMA'] ?? '').trim();
    if (!lemaRaw) continue;
    // opcionId = slug SIN prefijo "Partido " (estable y consistente entre años: 'colorado', 'nacional'…);
    // nombre = nombre COMPLETO para que resolveParty resuelva el color correcto (p. ej. "Partido
    // Independiente" → PI morado, no el gris genérico de "Independiente").
    const lemaId = slug(lemaRaw.replace(/^Partido\s+/i, ''));
    if (!lemaNombre.has(lemaId)) lemaNombre.set(lemaId, lemaRaw);

    const key = normName(barrio);
    let entry = porBarrio.get(key);
    if (!entry) { entry = { display: barrio, lemas: new Map() }; porBarrio.set(key, entry); }
    entry.lemas.set(lemaId, (entry.lemas.get(lemaId) ?? 0) + votos);
  }

  const zonas: AgregadoZona[] = [];
  for (const entry of porBarrio.values()) {
    const ranking = [...entry.lemas.entries()].sort((a, b) => b[1] - a[1]);
    const validos = ranking.reduce((s, [, v]) => s + v, 0);
    if (validos === 0) continue;
    const porOpcion: VotoOpcion[] = ranking.map(([lemaId, v]) => ({ opcionId: lemaId, votos: v }));
    zonas.push({
      geoId: entry.display,
      ganadorOpcionId: ranking[0][0],
      validos,
      porOpcion,
      noPartidarios: { enBlanco: 0, anulados: 0, observados: 0 },
    });
  }

  const shard = buildShard(zonas, { eleccionId: 'internas-2019', departamento: 'montevideo', tipo: 'internas', nivel: 'zona', outPath: SHARD_OUT });
  writeShard(shard, SHARD_OUT);
  const opciones = [...lemaNombre.entries()].map(([opcionId, nombre]) => ({ opcionId, nombre }));
  mkdirSync(dirname(OPCIONES_OUT), { recursive: true });
  writeFileSync(OPCIONES_OUT, JSON.stringify({ opciones }), 'utf8');
  console.log(`barrios ${zonas.length} · ${opciones.length} lemas · total ${totalCanonico.toLocaleString('es-UY')} · unmapped ${unmappedVotos.toLocaleString('es-UY')} (${circuitosSinBarrio.size} circuitos)`);

  console.log('\n--- Gate: reconciliación (losslessness) ---');
  const rec = reconcile(shard, totalCanonico, unmappedVotos);
  console.log(`sum-in=${rec.sumIn.toLocaleString('es-UY')} sum-out=${rec.sumOut.toLocaleString('es-UY')} delta=${rec.delta} ✅`);

  console.log('\n--- Gate: cobertura barrios↔geometría ---');
  const topo = JSON.parse(readFileSync(GEO_IN, 'utf8'));
  const fc = feature(topo, topo.objects['zonas'] as GeometryCollection) as FeatureCollection;
  const geoNames = fc.features.map((f) => String((f.properties as { name: string }).name));
  const cov = checkCoverage({ shard, geoBarrioNames: geoNames, totalCanonico });
  console.log(`placement ${(cov.placement * 100).toFixed(1)}% (≥95%) · barrio-fill ${cov.barriosConVotos}/${cov.geoBarrios} = ${(cov.barrioFill * 100).toFixed(1)}% (≥75%)`);
  if (cov.shardSinMatch.length > 0) console.log(`⚠️ geoIds sin match (${cov.shardSinMatch.length}): ${cov.shardSinMatch.join(', ')}`);

  console.log('\n=== internas-2019 MVD: gates PASARON ✅ ===');
}

main();
