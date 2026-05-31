/**
 * Agrega votos de nacionales-2019 Montevideo por CRV → barrio.
 *
 * El CSV tiene un schema diferente a internas-2024: columnas CRV, Lema, CantidadVotos,
 * TipoRegistro; sin columna ESCRUTINIO (el archivo _odd.csv ES el definitivo).
 *
 * TipoRegistro:
 *  HOJA_EN   — votos de una lista específica, atribuidos al Lema
 *  VOTO_LEMA — votos directos al lema (sin lista); mutuamente exclusivos con HOJA_EN
 * Ambos se suman para el total del lema (no hay doble conteo).
 *
 * Lema normalization: todos los Lemas llevan prefijo "Partido " → se elimina antes de
 * hacer slug para que "Partido Frente Amplio" → "frente-amplio" coincida con internas-2024.
 */
import type { AgregadoZona, VotoOpcion } from '../../src/lib/contracts';
import { normName, slug } from '../lib/normalize';

export interface AggregateNacionalesResult {
  zonas: AgregadoZona[];
  totalCanonico: number;
  unmappedVotos: number;
  circuitosSinBarrio: string[];
  opciones: { opcionId: string; nombre: string }[];
}

export function aggregateNacionalesMvd(
  rows: Record<string, string>[],
  crvToBarrio: Record<string, string>,
): AggregateNacionalesResult {
  const relevant = rows.filter(
    (r) =>
      (r['TipoRegistro'] === 'HOJA_EN' || r['TipoRegistro'] === 'VOTO_LEMA') &&
      r['Departamento'] === 'MO',
  );

  const porBarrio = new Map<string, { display: string; lemas: Map<string, number> }>();
  const opcionesPorId = new Map<string, string>();
  const circuitosSinBarrio = new Set<string>();
  let totalCanonico = 0;
  let unmappedVotos = 0;

  for (const r of relevant) {
    const votos = Number(r['CantidadVotos']) || 0;
    if (votos < 0) continue;
    totalCanonico += votos;

    const crv = (r['CRV'] ?? '').trim();
    const barrio = crvToBarrio[crv] ?? crvToBarrio[String(Number(crv))];
    if (!barrio) {
      circuitosSinBarrio.add(crv);
      unmappedVotos += votos;
      continue;
    }

    const lemaRaw = (r['Lema'] ?? '').trim();
    const lemaDisplay = lemaRaw.replace(/^Partido\s+/i, '');
    if (!lemaDisplay) continue;

    const key = normName(barrio);
    let entry = porBarrio.get(key);
    if (!entry) {
      entry = { display: barrio, lemas: new Map() };
      porBarrio.set(key, entry);
    }
    entry.lemas.set(lemaDisplay, (entry.lemas.get(lemaDisplay) ?? 0) + votos);
    opcionesPorId.set(slug(lemaDisplay), lemaDisplay);
  }

  const zonas: AgregadoZona[] = [];
  for (const [, entry] of porBarrio) {
    const ranking = [...entry.lemas.entries()].sort((a, b) => b[1] - a[1]);
    const validos = ranking.reduce((s, [, v]) => s + v, 0);
    const porOpcion: VotoOpcion[] = ranking.map(([lema, v]) => ({ opcionId: slug(lema), votos: v }));
    zonas.push({
      geoId: entry.display,
      ganadorOpcionId: ranking.length ? slug(ranking[0][0]) : '',
      validos,
      porOpcion,
      noPartidarios: { enBlanco: 0, anulados: 0, observados: 0 },
    });
  }

  return {
    zonas,
    totalCanonico,
    unmappedVotos,
    circuitosSinBarrio: [...circuitosSinBarrio],
    opciones: [...opcionesPorId.entries()].map(([opcionId, nombre]) => ({ opcionId, nombre })),
  };
}
