/**
 * Build SERIE → localidad mapping desde el plan circuital oficial.
 *
 * Algoritmo:
 *  1. Agrupar circuitos por (dept, serie) → conteo de localidades.
 *  2. Si localidad única o dominante ≥80%: tipo="1:1".
 *     Si ninguna dominante: tipo="ciudad-grande" (serie repartida).
 *  3. Ciudad-grande override: si una localidad aparece en ≥3 series del dept → todo ese grupo es "ciudad-grande".
 *  4. Verificar cobertura ≥95% contra series activas de internas-2024; exit≠0 si falla.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { parseCsv } from './extract/parse-csv';
import { normName } from './lib/normalize';
import type { SerieLocalidadEntry } from './lib/serie-localidad';

const PLAN_CSV = 'data/raw/electoral/plan-circuital.csv';
const ACTIVE_CSV = 'data/raw/electoral/internas-2024/desglose-de-votos.csv';
const COVERAGE_THRESHOLD = 0.95;
const CIUDAD_GRANDE_MIN_SERIES = 3;

const DEPT_CODE_TO_NAME: Record<string, string> = {
  AR: 'artigas',
  CA: 'canelones',
  CL: 'cerro_largo',
  CO: 'colonia',
  DU: 'durazno',
  FD: 'florida',
  FS: 'flores',
  LA: 'lavalleja',
  MA: 'maldonado',
  PA: 'paysandu',
  RN: 'rio_negro',
  RV: 'rivera',
  RO: 'rocha',
  SA: 'salto',
  SJ: 'san_jose',
  SO: 'soriano',
  TA: 'tacuarembo',
  TT: 'treinta_y_tres',
};

function toTitleCase(s: string): string {
  return s.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
}

function main(): void {
  console.log('=== ETL: Build SERIE → Localidad mapping ===\n');

  // --- 1) Parse plan circuital ---
  const planRows = parseCsv(PLAN_CSV);
  console.log(`Plan circuital: ${planRows.length} filas`);

  // Group by (deptCode, serie) → Map<localidad_norm, { count, display }>
  type LocalidadAcc = Map<string, { count: number; display: string }>;
  const byDept: Record<string, Map<string, LocalidadAcc>> = {};

  for (const r of planRows) {
    const dept = r['Departamento']?.trim();
    const serieRaw = r['Serie']?.trim();
    const localidadRaw = r['Localidad']?.trim();
    if (!dept || !serieRaw || !localidadRaw) continue;
    if (dept === 'MO' || !(dept in DEPT_CODE_TO_NAME)) continue;
    const serie = serieRaw.toUpperCase();
    if (serie.endsWith('ZZ')) continue;

    const localNorm = normName(localidadRaw);
    const localDisplay = toTitleCase(localidadRaw);

    if (!byDept[dept]) byDept[dept] = new Map();
    const deptMap = byDept[dept];
    if (!deptMap.has(serie)) deptMap.set(serie, new Map());
    const serieMap = deptMap.get(serie)!;
    const existing = serieMap.get(localNorm);
    if (existing) existing.count++;
    else serieMap.set(localNorm, { count: 1, display: localDisplay });
  }

  // --- 2) Parse active series from internas-2024 ---
  const activeSeriesPerDept: Record<string, Set<string>> = {};
  const activeRows = parseCsv(ACTIVE_CSV);
  for (const r of activeRows) {
    const dept = r['DEPARTAMENTO']?.trim();
    const seriesRaw = r['SERIES']?.trim().toUpperCase();
    if (!dept || !seriesRaw || dept === 'MO' || !(dept in DEPT_CODE_TO_NAME)) continue;
    // SERIES puede ser compuesto (e.g. "GDB GDC") — split y agregar cada código individualmente
    const codes = seriesRaw.split(/\s+/).filter(Boolean);
    for (const serie of codes) {
      if (serie.endsWith('ZZ')) continue;
      if (!activeSeriesPerDept[dept]) activeSeriesPerDept[dept] = new Set();
      activeSeriesPerDept[dept].add(serie);
    }
  }

  let failCount = 0;
  const deptResults: Record<string, { covered: number; total: number }> = {};

  // --- 3) Process each interior dept ---
  for (const [deptCode, deptName] of Object.entries(DEPT_CODE_TO_NAME)) {
    const serieMap = byDept[deptCode];
    if (!serieMap || serieMap.size === 0) {
      const hasActive = (activeSeriesPerDept[deptCode]?.size ?? 0) > 0;
      if (hasActive) {
        console.error(`❌ ${deptCode} (${deptName}): sin filas en plan-circuital pero tiene series activas en internas-2024`);
        failCount++;
      } else {
        console.warn(`⚠️  ${deptCode} (${deptName}): sin filas en plan-circuital`);
      }
      continue;
    }

    // Step 3a: assign candidate localidad per serie
    const candidates = new Map<string, { localidad: string; tipo: '1:1' | 'ciudad-grande' }>();

    for (const [serie, localidadCounts] of serieMap) {
      const sorted = [...localidadCounts.entries()].sort((a, b) => b[1].count - a[1].count);
      const [, topVal] = sorted[0];

      // Asignar la localidad dominante; T1.4 (≥3 series) decide ciudad-grande
      candidates.set(serie, { localidad: topVal.display, tipo: '1:1' });
    }

    // Step 3b: ciudad-grande override — localidad que aparece en ≥3 series
    const localidadSerieCount = new Map<string, number>();
    for (const { localidad } of candidates.values()) {
      const norm = normName(localidad);
      localidadSerieCount.set(norm, (localidadSerieCount.get(norm) ?? 0) + 1);
    }

    const result: SerieLocalidadEntry[] = [];
    for (const [serie, c] of candidates) {
      const norm = normName(c.localidad);
      const freq = localidadSerieCount.get(norm) ?? 0;
      const tipo: '1:1' | 'ciudad-grande' = freq >= CIUDAD_GRANDE_MIN_SERIES ? 'ciudad-grande' : c.tipo;
      result.push({ serie, localidad: c.localidad, tipo } satisfies SerieLocalidadEntry);
    }

    result.sort((a, b) => a.serie.localeCompare(b.serie));

    // Step 3c: write output
    const outPath = `public/data/mappings/${deptName}/serie-localidad.json`;
    mkdirSync(dirname(outPath), { recursive: true });
    writeFileSync(outPath, JSON.stringify(result, null, 2), 'utf8');

    // Step 3d: coverage check vs internas-2024 active series
    const active = activeSeriesPerDept[deptCode] ?? new Set<string>();
    if (active.size === 0) {
      console.warn(`⚠️  ${deptCode} (${deptName}): sin series activas en internas-2024 — posible fallo de ingestión`);
      failCount++;
      continue;
    }
    const mappedSeries = new Set(result.map((e) => e.serie.toUpperCase()));
    const uncovered: string[] = [];
    let covered = 0;
    for (const s of active) {
      if (mappedSeries.has(s)) covered++;
      else uncovered.push(s);
    }
    const coverage = covered / active.size;
    const pct = (coverage * 100).toFixed(1);

    deptResults[deptCode] = { covered, total: active.size };

    const cov1to1 = result.filter((e) => e.tipo === '1:1').length;
    const covCG = result.filter((e) => e.tipo === 'ciudad-grande').length;

    if (coverage < COVERAGE_THRESHOLD) {
      console.error(`❌ ${deptCode} (${deptName}): cobertura ${pct}% (${covered}/${active.size}) < 95%`);
      if (uncovered.length > 0) console.error(`   Sin mapping: ${uncovered.slice(0, 15).join(', ')}`);
      failCount++;
    } else {
      console.log(
        `✅ ${deptCode} (${deptName}): ${result.length} series [1:1=${cov1to1} ciudad-grande=${covCG}]` +
          ` cobertura ${pct}% (${covered}/${active.size}) → ${outPath}`,
      );
    }
  }

  // --- 4) Summary ---
  console.log('\n--- Resumen cobertura ---');
  for (const [code, { covered, total }] of Object.entries(deptResults)) {
    const pct = total > 0 ? ((covered / total) * 100).toFixed(1) : 'N/A';
    console.log(`  ${code}: ${covered}/${total} = ${pct}%`);
  }

  if (failCount > 0) {
    console.error(`\n❌ ${failCount} departamento(s) con cobertura <95% — BUILD FAILED`);
    process.exit(1);
  }

  console.log('\n=== Build SERIE → Localidad: completado ✅ ===');
}

main();
