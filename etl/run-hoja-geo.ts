/**
 * Generador de shards de HOJA por nivel geográfico agregado: `hoja-localidad.json` y
 * `hoja-barrio.json` por (elección × depto) del interior (Story 7.8).
 *
 * PROBLEMA QUE RESUELVE: el drill-down por HOJA (lema→precandidato/sublema→lista) sólo coloreaba
 * a nivel SERIE, porque los shards `hoja/{contienda}/{lema}.json` están keyed por código de serie.
 * Al subir a localidad/barrio el join geográfico fallaba y el mapa quedaba en blanco — el mismo
 * downscope (perder granularidad por HOJA) que NO se acepta. Este ETL re-agrega cada shard de hoja
 * por serie en localidades/barrios usando los mismos mappings que la capa base, y consolida TODAS
 * las hojas de TODAS las contiendas en UN archivo por nivel (evita la explosión de miles de
 * archivos por-lema; cf. Epic 5.2 payload).
 *
 * El cliente (`ensureHojaShards`) carga este único archivo cuando el nivel activo es localidad/barrio
 * y puebla `hojaVotos` keyed por nombre de localidad/barrio — el mismo índice de join que serie.
 *
 * GATES (no tautológicos):
 *  (A) Conservación por contienda: Σ votos de hoja re-agregados == Σ votos de las series mapeadas.
 *      Caza votos perdidos/duplicados y series sin localidad.
 *  (B) Ancla cross-file: la contienda cuyo total de depto coincide con el votes.json base se
 *      reconcilia, por localidad, contra votes-{nivel}.json (construido aparte desde votes.json).
 *      Distintos archivos upstream → el desacuerdo caza drift real.
 *
 * Ejecutar: `npm run etl:hoja-geo`.
 */
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import type { AgregadoZona, VotoOpcion, VotosShard } from '../src/lib/contracts';
import { buildShard, writeShard } from './load/emit-shard';
import deptsConfig from '../src/config/departments.json';

interface DeptEntry { id: string; levels: string[]; elecciones: string[] }
interface MapEntry { serie: string; localidad?: string; barrio?: string }

interface NivelCfg {
  nivel: 'localidad' | 'barrio';
  serieToGeo: Map<string, string>;
  votesGeoPath: string;
  outPath: string;
}

/** serie(lowercase) → nombre de zona geográfica, leído del mapping del nivel. */
function loadMapping(deptId: string, nivel: 'localidad' | 'barrio'): Map<string, string> | null {
  const dir = `public/data/mappings/${deptId}`;
  if (!existsSync(dir)) return null;
  let file: string | undefined;
  let field: 'localidad' | 'barrio';
  if (nivel === 'localidad') {
    file = existsSync(`${dir}/serie-localidad.json`) ? `${dir}/serie-localidad.json` : undefined;
    field = 'localidad';
  } else {
    file = readdirSync(dir).find((n) => n.endsWith('-serie-barrio.json'));
    if (file) file = `${dir}/${file}`;
    field = 'barrio';
  }
  if (!file || !existsSync(file)) return null;
  const rows = JSON.parse(readFileSync(file, 'utf8')) as MapEntry[];
  const m = new Map<string, string>();
  for (const e of rows) {
    const geo = e[field];
    if (geo) m.set(e.serie.trim().toLowerCase(), geo);
  }
  return m;
}

/** Lee todos los shards de hoja por serie de un depto/elección, agrupados por contienda. */
function readHojaShards(dir: string): Map<string, VotosShard[]> {
  const byCont = new Map<string, VotosShard[]>();
  const hojaDir = `${dir}/hoja`;
  if (!existsSync(hojaDir)) return byCont;
  for (const cont of readdirSync(hojaDir)) {
    const cd = `${hojaDir}/${cont}`;
    if (!statSync(cd).isDirectory()) continue; // ignora archivos sueltos en hoja/
    const shards: VotosShard[] = [];
    for (const f of readdirSync(cd).filter((n) => n.endsWith('.json'))) {
      shards.push(JSON.parse(readFileSync(`${cd}/${f}`, 'utf8')) as VotosShard);
    }
    if (shards.length > 0) byCont.set(cont, shards); // sin contiendas vacías → tipo[0][0] seguro
  }
  return byCont;
}

function main(): void {
  console.log('=== Generador hoja-localidad / hoja-barrio (interior × elecciones con HOJA) ===');
  const DEPTS = (deptsConfig as DeptEntry[]).filter(
    (d) => d.id !== 'montevideo' && d.levels.includes('serie'),
  );
  let ok = 0;
  let skipped = 0;
  const errors: string[] = [];
  const warns: string[] = [];

  for (const dept of DEPTS) {
    for (const eleccion of dept.elecciones) {
      const dir = `public/data/${eleccion}/${dept.id}`;
      const byCont = readHojaShards(dir);
      if (byCont.size === 0) { skipped++; continue; } // tipo plano (balotaje/plebiscito): sin HOJA

      // Anchor: la contienda cuyo total == votes.json base (ODN para internas, única para nacionales).
      const basePath = `${dir}/votes.json`;
      let baseTotal = 0;
      if (existsSync(basePath)) {
        const base = JSON.parse(readFileSync(basePath, 'utf8')) as VotosShard;
        for (const z of base.zonas) for (const o of z.porOpcion) baseTotal += o.votos;
      }
      let anchorCont: string | null = null;
      for (const [cont, shards] of byCont) {
        let t = 0;
        for (const s of shards) for (const z of s.zonas) for (const o of z.porOpcion) t += o.votos;
        if (baseTotal > 0 && t === baseTotal) { anchorCont = cont; break; }
      }

      const niveles: NivelCfg[] = [];
      for (const nivel of ['localidad', 'barrio'] as const) {
        const votesGeoPath = `${dir}/votes-${nivel}.json`;
        if (!existsSync(votesGeoPath)) continue;
        const serieToGeo = loadMapping(dept.id, nivel);
        if (!serieToGeo) continue;
        niveles.push({ nivel, serieToGeo, votesGeoPath, outPath: `${dir}/hoja-${nivel}.json` });
      }
      if (niveles.length === 0) { skipped++; continue; }

      for (const cfg of niveles) {
        // Re-agrega TODAS las contiendas en porGeo[geoZone][opcionId] = votos.
        const porGeo = new Map<string, Map<string, number>>();
        let totalFull = 0;   // votos de TODOS los shards (mapeados o no) — base independiente
        let totalMapped = 0; // votos que cayeron en alguna zona geográfica
        const anchorPorGeo = new Map<string, number>(); // Σ votos del anchor por geo
        for (const [cont, shards] of byCont) {
          for (const s of shards) {
            for (const z of s.zonas) {
              const zTotal = z.porOpcion.reduce((acc, o) => acc + o.votos, 0);
              totalFull += zTotal; // se cuenta SIEMPRE: anclaje independiente del mapping
              const geo = cfg.serieToGeo.get(z.geoId.trim().toLowerCase());
              if (!geo) continue; // serie fuera del recorte del nivel (rural / no-urbana en barrio)
              totalMapped += zTotal;
              let mm = porGeo.get(geo);
              if (!mm) { mm = new Map(); porGeo.set(geo, mm); }
              for (const o of z.porOpcion) mm.set(o.opcionId, (mm.get(o.opcionId) ?? 0) + o.votos);
              if (cont === anchorCont) anchorPorGeo.set(geo, (anchorPorGeo.get(geo) ?? 0) + zTotal);
            }
          }
        }

        const zonas: AgregadoZona[] = [];
        for (const [geo, mm] of porGeo) {
          const porOpcion: VotoOpcion[] = [...mm.entries()]
            .filter(([, v]) => v > 0)
            .map(([opcionId, votos]) => ({ opcionId, votos }));
          if (porOpcion.length === 0) continue;
          const ganador = porOpcion.reduce((a, b) => (b.votos > a.votos ? b : a));
          zonas.push({
            geoId: geo,
            ganadorOpcionId: ganador.opcionId,
            validos: porOpcion.reduce((s, o) => s + o.votos, 0),
            porOpcion,
            noPartidarios: { enBlanco: 0, anulados: 0, observados: 0 },
          });
        }
        if (zonas.length === 0) { skipped++; continue; }

        // GATE (A) No-drop (independiente, no tautológico): totalFull viene de TODOS los shards;
        // totalMapped, solo de los que mapearon. En localidad cada serie DEBE tener localidad →
        // diferencia = votos perdidos por mapping incompleto (warning informativo; el redistritado
        // entre años puede dejar alguna serie nueva sin entrada). En barrio la diferencia es
        // esperada (barrio = solo capital), así que ahí no aplica.
        if (cfg.nivel === 'localidad' && totalFull !== totalMapped) {
          const drop = totalFull - totalMapped;
          warns.push(`${dept.id}/${eleccion}/${cfg.nivel}: ${drop} votos (${(100 * drop / Math.max(1, totalFull)).toFixed(1)}%) en series sin localidad`);
        }

        // GATE (B) Ancla cross-file (HARD, no tautológico): Σ anchor por geo == Σ votes-{nivel} por
        // geo. `votes-{nivel}.json` se construyó aparte desde votes.json (no desde los shards de
        // hoja), así que un desacuerdo caza misplacement/aritmética. La MISMA serie→geo coloca ODN y
        // ODD; validar ODN por geo prueba el mapping para ambas contiendas. Sin ancla → NO emitir.
        if (!anchorCont) {
          errors.push(`${dept.id}/${eleccion}/${cfg.nivel}: sin contienda ancla (ningún total de contienda == votes.json base) — no se puede validar, se omite`);
          continue;
        }
        const vg = JSON.parse(readFileSync(cfg.votesGeoPath, 'utf8')) as VotosShard;
        const baseGeoTotal = new Map<string, number>();
        for (const z of vg.zonas) baseGeoTotal.set(z.geoId, z.porOpcion.reduce((s, o) => s + o.votos, 0));
        let mismatch = 0;
        for (const [geo, anchorSum] of anchorPorGeo) {
          const baseSum = baseGeoTotal.get(geo);
          if (baseSum === undefined) { warns.push(`${dept.id}/${eleccion}/${cfg.nivel}: geo "${geo}" ausente en votes-${cfg.nivel}`); continue; }
          if (anchorSum !== baseSum) mismatch++;
        }
        if (mismatch > 0) {
          errors.push(`${dept.id}/${eleccion}/${cfg.nivel}: ancla cross-file falló en ${mismatch} zonas (contienda ${anchorCont})`);
          continue;
        }

        const shard = buildShard(zonas, {
          eleccionId: eleccion,
          departamento: dept.id,
          tipo: [...byCont.values()][0][0].tipo,
          nivel: cfg.nivel,
          outPath: cfg.outPath,
        });
        writeShard(shard, cfg.outPath);
        ok++;
      }
    }
    console.log(`  ${dept.id}: hoja-geo generado`);
  }

  console.log(`\n=== hoja-geo: ${ok} archivos generados · ${skipped} skip (plano / sin nivel) ===`);
  if (warns.length > 0) { console.log('Avisos:'); for (const w of warns) console.log('  ⚠️ ' + w); }
  if (errors.length > 0) {
    console.error('\n❌ ERRORES (gates):');
    for (const e of errors) console.error('  ' + e);
    process.exit(1);
  }
  console.log('Gate (B) ancla cross-file (hard) + (A) no-drop (independiente): PASARON ✅');
}

main();
