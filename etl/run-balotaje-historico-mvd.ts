/**
 * Orquestador ETL — Balotajes históricos 2014 y 2019, Montevideo (Story 7.7). Tipo `balotaje`.
 *
 * Mismo formato que el referéndum/balotaje-2024: dos columnas de candidato fijas por CRV
 * (no hay columna PARTIDO). Se mapea a opcionId estable por lema para color/comparación:
 *   - FA (Vázquez-Sendic 2014 / Martínez-Villar 2019) → `frente-amplio` (verde)
 *   - PN (Lacalle Pou-Larrañaga 2014 / Lacalle Pou-Argimón 2019) → `partido-nacional` (azul)
 * válidos = FA + PN. Reusa el join CRV→BARRIO de Montevideo (no regenera geometría).
 *
 * Gate (no tautológico): ancla contra el resultado publicado de Montevideo — en MO ganó el FA
 * en ambos balotajes (nacionalmente: Vázquez ganó 2014; Lacalle Pou ganó 2019). Fuera de banda
 * o si gana el PN en MO → error de columna/join. Más assertVotosShard (estructural).
 *
 * Ejecutar: `npm run etl:balotaje-historico-mvd`.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import type { AgregadoZona, VotoOpcion } from '../src/lib/contracts';
import { parseCsv } from './extract/parse-csv';
import { buildShard, writeShard } from './load/emit-shard';
import { normName } from './lib/normalize';

const MAPPING_IN = 'data/mappings/montevideo-circuito-barrio.json';
const DEPTO = 'montevideo';

interface Bal {
  eleccionId: string;
  csv: string;
  faCol: string;
  pnCol: string;
  faNombre: string;
  pnNombre: string;
  faMinPct: number; // banda esperada de % FA en MO (ancla)
  faMaxPct: number;
}
const BALOTAJES: Bal[] = [
  {
    eleccionId: 'balotaje-2014', csv: 'data/raw/electoral/balotaje-2014/balotaje-2014.csv',
    faCol: 'Total_Vazquez_Sendic', pnCol: 'Total_Lacalle Pou_Larrañaga',
    faNombre: 'Frente Amplio', pnNombre: 'Partido Nacional', faMinPct: 55, faMaxPct: 70,
  },
  {
    eleccionId: 'balotaje-2019', csv: 'data/raw/electoral/balotaje-2019/balotaje-2019.csv',
    faCol: 'Total_Martinez_Villar', pnCol: 'Total_Lacalle Pou_Argimon',
    faNombre: 'Frente Amplio', pnNombre: 'Partido Nacional', faMinPct: 52, faMaxPct: 65,
  },
];

function resolveBarrio(map: Record<string, string>, crv: string): string | undefined {
  if (map[crv]) return map[crv];
  const n = Number(crv);
  if (Number.isFinite(n) && map[String(n)]) return map[String(n)];
  return undefined;
}

function main(): void {
  console.log('=== ETL Balotajes históricos (2014, 2019) Montevideo (Story 7.7) ===');
  const { crvToBarrio } = JSON.parse(readFileSync(MAPPING_IN, 'utf8')) as { crvToBarrio: Record<string, string> };

  for (const bal of BALOTAJES) {
    const rows = parseCsv(bal.csv).filter((r) => r['Departamento'] === 'MO');
    interface Acc { display: string; fa: number; pn: number; enBlanco: number; anulados: number; observados: number }
    const porBarrio = new Map<string, Acc>();
    let unmappedFa = 0;
    let unmappedPn = 0;
    for (const r of rows) {
      const fa = Number(r[bal.faCol]) || 0;
      const pn = Number(r[bal.pnCol]) || 0;
      const barrio = resolveBarrio(crvToBarrio, (r['CRV'] ?? '').trim());
      if (!barrio) { unmappedFa += fa; unmappedPn += pn; continue; }
      const k = normName(barrio);
      let e = porBarrio.get(k);
      if (!e) { e = { display: barrio, fa: 0, pn: 0, enBlanco: 0, anulados: 0, observados: 0 }; porBarrio.set(k, e); }
      e.fa += fa;
      e.pn += pn;
      e.enBlanco += Number(r['Total_EN_Blanco']) || 0;
      e.anulados += Number(r['Total_Anulados']) || 0;
      e.observados += Number(r['Total_Votos_Observados']) || 0;
    }

    const zonas: AgregadoZona[] = [];
    let mFa = 0;
    let mPn = 0;
    for (const e of porBarrio.values()) {
      const validos = e.fa + e.pn;
      if (validos === 0) continue;
      mFa += e.fa;
      mPn += e.pn;
      const porOpcion: VotoOpcion[] = [
        { opcionId: 'frente-amplio', votos: e.fa },
        { opcionId: 'partido-nacional', votos: e.pn },
      ];
      zonas.push({
        geoId: e.display,
        ganadorOpcionId: e.fa >= e.pn ? 'frente-amplio' : 'partido-nacional',
        validos,
        porOpcion,
        noPartidarios: { enBlanco: e.enBlanco, anulados: e.anulados, observados: e.observados },
      });
    }

    // Ancla externa contra el resultado publicado de Montevideo (FA ganó MO en ambos balotajes).
    const val = mFa + mPn;
    const pctFa = val > 0 ? (mFa / val) * 100 : 0;
    if (mFa <= mPn) throw new Error(`${bal.eleccionId}: en MO debió ganar el FA (FA ${mFa} ≤ PN ${mPn}) — ¿columnas intercambiadas?`);
    if (pctFa < bal.faMinPct || pctFa > bal.faMaxPct) {
      throw new Error(`${bal.eleccionId}: FA% MO ${pctFa.toFixed(1)}% fuera de banda [${bal.faMinPct},${bal.faMaxPct}] — ¿error de join/columna?`);
    }

    const SHARD_OUT = `public/data/${bal.eleccionId}/${DEPTO}/votes.json`;
    const OPC_OUT = `public/data/${bal.eleccionId}/${DEPTO}/opciones.json`;
    const shard = buildShard(zonas, { eleccionId: bal.eleccionId, departamento: DEPTO, tipo: 'balotaje', nivel: 'zona', outPath: SHARD_OUT });
    writeShard(shard, SHARD_OUT);
    mkdirSync(dirname(OPC_OUT), { recursive: true });
    writeFileSync(OPC_OUT, JSON.stringify({ opciones: [
      { opcionId: 'frente-amplio', nombre: bal.faNombre },
      { opcionId: 'partido-nacional', nombre: bal.pnNombre },
    ] }), 'utf8');

    console.log(
      `  ${bal.eleccionId}: ${zonas.length} barrios · FA ${mFa.toLocaleString('es-UY')} / ${val.toLocaleString('es-UY')} = ${pctFa.toFixed(1)}% · ` +
        `unmapped FA ${unmappedFa.toLocaleString('es-UY')} / PN ${unmappedPn.toLocaleString('es-UY')} · ancla resultado MO ✅`,
    );
  }
  console.log('\n=== Balotajes históricos MVD: gates PASARON ✅ ===');
}

main();
