/**
 * Story 1.3 — Spike de geo-join.
 *
 * Prueba el riesgo más caro: que los votos de UNA zona (barrio) caigan en el
 * polígono correcto y pinten al ganador correcto, sobre datos REALES.
 *
 * Fuentes:
 *  - Geometría: public/montevideo_map.json (barrios; properties.name en MAYÚSCULAS).
 *  - Votos: public/montevideo_odn.csv (ZONA = nombre de barrio; ESCRUTINIO='Departamental').
 *
 * Hallazgos documentados en el reporte: clave de join (barrio normalizado),
 * tasa de cobertura ZONA↔GeoJSON (insumo para el gate de Story 1.6), y el
 * gotcha de parseo CSV (el campo PRECANDIDATO tiene comas dentro de comillas).
 *
 * Ejecutar: esbuild bundle + node (ver story / patrón de Story 1.2).
 */
import { readFileSync } from 'node:fs';
import { getPartyColor } from '../../src/lib/party-colors';
import { assertVotosShard } from '../../src/lib/contracts';
import type { AgregadoZona, VotosShard } from '../../src/lib/contracts';

// --- Parser CSV mínimo con soporte de campos entre comillas (gotcha: PRECANDIDATO tiene comas) ---
function parseCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"' && line[i + 1] === '"') { cur += '"'; i++; }
      else if (ch === '"') inQuotes = false;
      else cur += ch;
    } else if (ch === '"') inQuotes = true;
    else if (ch === ',') { out.push(cur); cur = ''; }
    else cur += ch;
  }
  out.push(cur);
  return out;
}

// Normaliza un nombre de barrio para el join (MAYÚSCULAS, sin acentos, espacios colapsados).
function normBarrio(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // quita diacríticos
    .toUpperCase()
    .replace(/\s+/g, ' ')
    .trim();
}

interface FilaCsv {
  partido: string;
  escrutinio: string;
  hoja: string;
  votos: number;
  zona: string;
}

function leerCsv(path: string): FilaCsv[] {
  const lines = readFileSync(path, 'utf8').split(/\r?\n/);
  const header = parseCsvLine(lines[0]);
  const idx = {
    partido: header.indexOf('PARTIDO'),
    escrutinio: header.indexOf('ESCRUTINIO'),
    hoja: header.indexOf('HOJA'),
    votos: header.indexOf('CNT_VOTOS'),
    zona: header.indexOf('ZONA'),
  };
  const filas: FilaCsv[] = [];
  for (let k = 1; k < lines.length; k++) {
    if (!lines[k]) continue;
    const c = parseCsvLine(lines[k]);
    if (c.length < header.length) continue;
    filas.push({
      partido: c[idx.partido],
      escrutinio: c[idx.escrutinio],
      hoja: c[idx.hoja],
      votos: Number(c[idx.votos]) || 0,
      zona: c[idx.zona],
    });
  }
  return filas;
}

interface GeoFeature { properties: { name: string } }

function main(): void {
  const ESC_CANONICO = 'Departamental'; // único valor de ESCRUTINIO en el dataset (OQ3)

  const geo = JSON.parse(readFileSync('public/montevideo_map.json', 'utf8')) as { features: GeoFeature[] };
  const barriosGeo = new Map<string, string>(); // normalizado -> name original
  for (const f of geo.features) barriosGeo.set(normBarrio(f.properties.name), f.properties.name);

  const filas = leerCsv('public/montevideo_odn.csv').filter((f) => f.escrutinio === ESC_CANONICO);

  // Cobertura: ¿qué zonas (barrios) del CSV existen en el GeoJSON? (preview gate Story 1.6)
  const zonasCsv = new Set(filas.map((f) => f.zona));
  let matched = 0;
  const sinMatch: string[] = [];
  for (const z of zonasCsv) {
    if (barriosGeo.has(normBarrio(z))) matched++;
    else sinMatch.push(z);
  }
  const cobertura = zonasCsv.size ? ((matched / zonasCsv.size) * 100).toFixed(1) : '0';

  // Elegir UNA zona que matchee, agregar votos por partido, hallar ganador.
  const zonaSpike = [...zonasCsv].find((z) => barriosGeo.has(normBarrio(z)));
  if (!zonaSpike) {
    console.error('FALLA: ninguna ZONA del CSV matchea un barrio del GeoJSON');
    process.exit(1);
  }
  const filasZona = filas.filter((f) => f.zona === zonaSpike);
  const porPartido = new Map<string, number>();
  for (const f of filasZona) porPartido.set(f.partido, (porPartido.get(f.partido) ?? 0) + f.votos);

  const ranking = [...porPartido.entries()].sort((a, b) => b[1] - a[1]);
  const [ganadorPartido, ganadorVotos] = ranking[0];
  const validos = ranking.reduce((s, [, v]) => s + v, 0);
  const color = getPartyColor(ganadorPartido);

  // Shapear como AgregadoZona del contrato (Story 1.2) y validar con el guard.
  const agregado: AgregadoZona = {
    geoId: barriosGeo.get(normBarrio(zonaSpike))!,
    ganadorOpcionId: ganadorPartido,
    validos,
    porOpcion: ranking.map(([opcionId, votos]) => ({ opcionId, votos })),
    noPartidarios: { enBlanco: 0, anulados: 0, observados: 0 },
  };
  const shard: VotosShard = {
    eleccionId: 'internas-2024',
    departamento: 'montevideo',
    nivel: 'zona',
    escrutinio: 'definitivo', // mapeamos 'Departamental' (fuente) -> etapa canónica del contrato
    tipo: 'internas',
    zonas: [agregado],
  };
  assertVotosShard(shard); // si el join/ganador fuera inconsistente, lanza

  // Reporte + veredicto
  const pct = validos ? ((ganadorVotos / validos) * 100).toFixed(1) : '0';
  console.log('=== SPIKE GEO-JOIN (Story 1.3) ===');
  console.log(`Clave de join: ZONA(CSV, barrio) ↔ GeoJSON properties.name (normalizado: MAYÚSCULAS sin acentos)`);
  console.log(`Cobertura ZONA↔GeoJSON: ${matched}/${zonasCsv.size} (${cobertura}%)  [insumo gate Story 1.6]`);
  if (sinMatch.length) console.log(`  Zonas sin match (${sinMatch.length}): ${sinMatch.slice(0, 5).join(' | ')}${sinMatch.length > 5 ? ' …' : ''}`);
  console.log(`\nZona spike: "${zonaSpike}" → feature GeoJSON "${agregado.geoId}" ✓`);
  console.log(`Ganador: ${ganadorPartido} — ${ganadorVotos} votos (${pct}% de ${validos} válidos)`);
  console.log(`Color de partido: ${color}`);
  console.log(`Contrato (assertVotosShard): OK`);
  console.log(`\nVEREDICTO: PASA ✅ (voto agregado por zona, matcheado a su polígono, ganador validado por el contrato)`);
}

main();
