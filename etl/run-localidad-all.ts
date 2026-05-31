/**
 * Generador GENÉRICO de votes-localidad.json para TODO el interior × TODAS las elecciones (Story 7.7).
 *
 * Re-agrega el votes.json por SERIE (que ya existe para cada elección×depto) en LOCALIDADES,
 * usando `public/data/mappings/{depto}/serie-localidad.json`. Es agnóstico de la elección (opera
 * sobre el shard por serie, no sobre el CSV crudo), así que cubre internas/nacionales/balotaje/
 * plebiscito/departamentales/histórico por igual. Emite también localidad-meta.json (ciudades
 * grandes, para el rótulo de degradación de Story 8.4).
 *
 * Geometría de localidad (localidad.topo.json) ya existe por dept (Story 8.2). Reusa opciones.json.
 *
 * Ejecutar: `npm run etl:localidad-all`.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import type { AgregadoZona, VotosShard } from '../src/lib/contracts';
import { buildShard, writeShard } from './load/emit-shard';
import deptsConfig from '../src/config/departments.json';

interface SLEntry { serie: string; localidad: string; tipo: string }
interface DeptEntry { id: string; levels: string[]; elecciones: string[] }

function main(): void {
  console.log('=== Generador votes-localidad (interior × todas las elecciones) ===');
  const DEPTS = (deptsConfig as DeptEntry[]).filter((d) => d.id !== 'montevideo' && d.levels.includes('serie'));
  let okElec = 0; let skipped = 0; const warns: string[] = [];

  for (const dept of DEPTS) {
    const mapPath = `public/data/mappings/${dept.id}/serie-localidad.json`;
    const topoPath = `public/data/geo/${dept.id}/localidad.topo.json`;
    if (!existsSync(mapPath) || !existsSync(topoPath)) { warns.push(`${dept.id}: sin mapping/topo de localidad`); continue; }
    const mapping = JSON.parse(readFileSync(mapPath, 'utf8')) as SLEntry[];
    const serieLoc = new Map<string, string>();
    for (const e of mapping) serieLoc.set(e.serie.trim().toLowerCase(), e.localidad);
    const ciudadesGrandes = [...new Set(mapping.filter((e) => e.tipo === 'ciudad-grande').map((e) => e.localidad))];

    for (const eleccion of dept.elecciones) {
      const votesPath = `public/data/${eleccion}/${dept.id}/votes.json`;
      if (!existsSync(votesPath)) { skipped++; continue; }
      const base = JSON.parse(readFileSync(votesPath, 'utf8')) as VotosShard;

      // localidad → opcionId → votos  +  no-partidarios + unmapped.
      const porLoc = new Map<string, { op: Map<string, number>; enBlanco: number; anulados: number; observados: number }>();
      let unmapped = 0;
      for (const z of base.zonas) {
        const loc = serieLoc.get(z.geoId.trim().toLowerCase());
        if (!loc) { unmapped += z.validos; continue; }
        let acc = porLoc.get(loc);
        if (!acc) { acc = { op: new Map(), enBlanco: 0, anulados: 0, observados: 0 }; porLoc.set(loc, acc); }
        for (const v of z.porOpcion) acc.op.set(v.opcionId, (acc.op.get(v.opcionId) ?? 0) + v.votos);
        acc.enBlanco += z.noPartidarios.enBlanco;
        acc.anulados += z.noPartidarios.anulados;
        acc.observados += z.noPartidarios.observados;
      }

      const zonas: AgregadoZona[] = [];
      for (const [loc, acc] of porLoc) {
        const porOpcion = [...acc.op.entries()].filter(([, v]) => v > 0).map(([opcionId, votos]) => ({ opcionId, votos }));
        if (porOpcion.length === 0) continue;
        const ganador = porOpcion.reduce((a, b) => (b.votos > a.votos ? b : a));
        zonas.push({ geoId: loc, ganadorOpcionId: ganador.opcionId, validos: porOpcion.reduce((s, o) => s + o.votos, 0), porOpcion, noPartidarios: { enBlanco: acc.enBlanco, anulados: acc.anulados, observados: acc.observados } });
      }
      if (zonas.length === 0) { skipped++; continue; }

      const out = `public/data/${eleccion}/${dept.id}/votes-localidad.json`;
      const shard = buildShard(zonas, { eleccionId: base.eleccionId, departamento: dept.id, tipo: base.tipo, nivel: 'localidad', outPath: out });
      writeShard(shard, out);
      writeFileSync(`public/data/${eleccion}/${dept.id}/localidad-meta.json`, JSON.stringify({ ciudadesGrandes }), 'utf8');
      okElec++;
      if (unmapped > 0 && unmapped > 0.1 * base.zonas.reduce((s, z) => s + z.validos, 0)) {
        warns.push(`${dept.id}/${eleccion}: ${(100 * unmapped / Math.max(1, base.zonas.reduce((s, z) => s + z.validos, 0))).toFixed(0)}% de votos en series sin localidad`);
      }
    }
    console.log(`  ${dept.id}: localidades generadas para sus elecciones`);
  }
  console.log(`\n=== votes-localidad: ${okElec} elección×depto generadas · ${skipped} sin serie-votes ===`);
  if (warns.length > 0) { console.log('Avisos:'); for (const w of warns) console.log('  ⚠️ ' + w); }
}

main();
