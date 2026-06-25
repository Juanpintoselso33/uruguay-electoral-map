/**
 * Generador GENÉRICO de votes-barrio.json para las ciudades grandes del interior × TODAS las
 * elecciones con datos por serie (Story 7.8).
 *
 * Re-agrega el votes.json por SERIE (capa base ya existente) en BARRIOS de la capital, usando
 * `public/data/mappings/{depto}/{ciudad}-serie-barrio.json` (solo las series urbanas de la capital
 * contribuyen; el resto del depto queda fuera del barrio.topo.json → no es "unmapped" sino zona
 * no-urbana esperada). Es agnóstico de la elección: opera sobre el shard por serie, así que cubre
 * internas/nacionales/departamentales por igual con el mismo mapping.
 *
 * Las series del shard base ya vienen separadas (compound resuelto en el paso por serie), así que
 * heredamos ese split sin re-implementarlo y quedamos byte-consistentes con la capa serie.
 *
 * Geometría (barrio.topo.json) ya existe por dept (Story 8.5). Reusa opciones.json.
 *
 * GATE de cobertura DURO (no warning): cada barrio del mapping DEBE recibir votos. Un código de
 * serie obsoleto en el mapping produciría barrios vacíos silenciosamente; el gate lo caza.
 *
 * Ejecutar: `npm run etl:barrio-all`.
 */
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import type { AgregadoZona, VotosShard } from '../src/lib/contracts';
import { buildShard, writeShard } from './load/emit-shard';
import deptsConfig from '../src/config/departments.json';

interface SBEntry { serie: string; barrio: string }
interface DeptEntry { id: string; levels: string[]; elecciones: string[] }

/** Resuelve el mapping {ciudad}-serie-barrio.json del depto (el prefijo de ciudad varía). */
function findMapping(deptId: string): string | null {
  const dir = `public/data/mappings/${deptId}`;
  if (!existsSync(dir)) return null;
  const f = readdirSync(dir).find((n) => n.endsWith('-serie-barrio.json'));
  return f ? `${dir}/${f}` : null;
}

function main(): void {
  console.log('=== Generador votes-barrio (capitales del interior × todas las elecciones) ===');
  // Criterio: deptos del interior CON geometría de barrio (capital subdividida). No depende de
  // departments.json.levels (que ya no lista 'barrio'); el insumo real es geo/{id}/barrio.topo.json.
  const DEPTS = (deptsConfig as DeptEntry[]).filter(
    (d) => d.id !== 'montevideo' && existsSync(`public/data/geo/${d.id}/barrio.topo.json`),
  );
  let okElec = 0;
  let skipped = 0;
  const errors: string[] = [];

  const warns: string[] = [];

  for (const dept of DEPTS) {
    const mapPath = findMapping(dept.id);
    const topoPath = `public/data/geo/${dept.id}/barrio.topo.json`;
    if (!mapPath || !existsSync(topoPath)) {
      errors.push(`${dept.id}: sin mapping/topo de barrio`);
      continue;
    }
    const mapping = JSON.parse(readFileSync(mapPath, 'utf8')) as SBEntry[];
    const serieBarrio = new Map<string, string>();
    for (const e of mapping) serieBarrio.set(e.serie.trim().toLowerCase(), e.barrio);
    const barriosEsperados = new Set(mapping.map((e) => e.barrio));
    // Unión de barrios con votos en ALGUNA elección del depto: un barrio nunca cubierto = mapping
    // obsoleto (ERROR); un barrio vacío en una elección puntual = serie ausente ese año (WARN).
    const barriosVistos = new Set<string>();

    for (const eleccion of dept.elecciones) {
      const votesPath = `public/data/${eleccion}/${dept.id}/votes.json`;
      if (!existsSync(votesPath)) { skipped++; continue; }
      const base = JSON.parse(readFileSync(votesPath, 'utf8')) as VotosShard;

      const porBarrio = new Map<
        string,
        { op: Map<string, number>; enBlanco: number; anulados: number; observados: number }
      >();
      for (const z of base.zonas) {
        const barrio = serieBarrio.get(z.geoId.trim().toLowerCase());
        if (!barrio) continue; // serie no-urbana: fuera de la capital, esperado
        let acc = porBarrio.get(barrio);
        if (!acc) { acc = { op: new Map(), enBlanco: 0, anulados: 0, observados: 0 }; porBarrio.set(barrio, acc); }
        for (const v of z.porOpcion) acc.op.set(v.opcionId, (acc.op.get(v.opcionId) ?? 0) + v.votos);
        acc.enBlanco += z.noPartidarios.enBlanco;
        acc.anulados += z.noPartidarios.anulados;
        acc.observados += z.noPartidarios.observados;
      }

      const zonas: AgregadoZona[] = [];
      for (const [barrio, acc] of porBarrio) {
        const porOpcion = [...acc.op.entries()].filter(([, v]) => v > 0).map(([opcionId, votos]) => ({ opcionId, votos }));
        if (porOpcion.length === 0) continue;
        const ganador = porOpcion.reduce((a, b) => (b.votos > a.votos ? b : a));
        zonas.push({
          geoId: barrio,
          ganadorOpcionId: ganador.opcionId,
          validos: porOpcion.reduce((s, o) => s + o.votos, 0),
          porOpcion,
          noPartidarios: { enBlanco: acc.enBlanco, anulados: acc.anulados, observados: acc.observados },
        });
      }
      if (zonas.length === 0) { skipped++; continue; }

      // Barrios vacíos en ESTA elección: warning (serie puede no existir ese año por redistritado).
      const conVotos = new Set(zonas.map((z) => z.geoId));
      for (const b of conVotos) barriosVistos.add(b);
      const vacios = [...barriosEsperados].filter((b) => !conVotos.has(b));
      if (vacios.length > 0) {
        warns.push(`${dept.id}/${eleccion}: ${vacios.length} barrio(s) sin votos (serie ausente ese año) → ${vacios.join(', ')}`);
      }

      const out = `public/data/${eleccion}/${dept.id}/votes-barrio.json`;
      const shard = buildShard(zonas, {
        eleccionId: base.eleccionId,
        departamento: dept.id,
        tipo: base.tipo,
        nivel: 'barrio',
        outPath: out,
      });
      writeShard(shard, out);
      okElec++;
    }

    // GATE DURO: un barrio del mapping nunca cubierto en NINGUNA elección = código de serie obsoleto.
    const nuncaVistos = [...barriosEsperados].filter((b) => !barriosVistos.has(b));
    if (nuncaVistos.length > 0) {
      errors.push(`${dept.id}: ${nuncaVistos.length} barrio(s) sin votos en NINGUNA elección (mapping obsoleto) → ${nuncaVistos.join(', ')}`);
    }
    console.log(`  ${dept.id}: barrios generados para sus elecciones`);
  }

  console.log(`\n=== votes-barrio: ${okElec} elección×depto generadas · ${skipped} sin serie-votes ===`);
  if (warns.length > 0) { console.log('Avisos (sparsity por año, esperado):'); for (const w of warns) console.log('  ⚠️ ' + w); }
  if (errors.length > 0) {
    console.error('\n❌ ERRORES (gate de cobertura):');
    for (const e of errors) console.error('  ' + e);
    process.exit(1);
  }
  console.log('Gate de cobertura: cada barrio del mapping recibió votos en al menos una elección ✅');
}

main();
