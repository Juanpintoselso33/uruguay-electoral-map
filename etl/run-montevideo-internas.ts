/**
 * Entrypoint ETL — Montevideo internas-2024 (Story 1.4).
 * Extract (CSV) → Transform (normalizar + agregar) → Load (emitir shard validado).
 * Ejecutar: esbuild bundle + node.
 */
import { parseCsv } from './extract/parse-csv';
import { aggregateVotes } from './transform/aggregate-votes';
import { buildShard, writeShard } from './load/emit-shard';

function main(): void {
  const CSV = 'public/montevideo_odn.csv';
  const OUT = 'public/data/internas-2024/montevideo/votes.json';

  console.log('=== ETL Montevideo internas-2024 (Story 1.4) ===');
  const rows = parseCsv(CSV);
  console.log(`CSV parseado: ${rows.length} filas`);

  const agg = aggregateVotes(rows, { escrutinioCanonico: 'Departamental' });
  console.log(`Zonas agregadas: ${agg.zonas.length}`);
  console.log(`Partidos vistos: ${agg.partidosVistos.length} → ${agg.partidosVistos.slice(0, 6).join(', ')}${agg.partidosVistos.length > 6 ? ' …' : ''}`);
  console.log(`Total válidos (depto): ${agg.totalValidos.toLocaleString('es-UY')}`);
  console.log(`Ganador global: ${agg.ganadorGlobal.partido} (${agg.ganadorGlobal.votos.toLocaleString('es-UY')})`);

  const shard = buildShard(agg.zonas, {
    eleccionId: 'internas-2024',
    departamento: 'montevideo',
    tipo: 'internas',
    nivel: 'zona',
    outPath: OUT,
  });
  writeShard(shard, OUT);
  console.log(`\nShard escrito: ${OUT} (validado por assertVotosShard) ✅`);
}

main();
