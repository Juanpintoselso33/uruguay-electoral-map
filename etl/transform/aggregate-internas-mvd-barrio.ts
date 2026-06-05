/**
 * Agrega votos de INTERNAS (Montevideo) por CRV → BARRIO, a nivel LEMA.
 *
 * Schema del desglose de internas (Corte, UTF-8): columnas UPPERCASE TIPO_REGISTRO, DEPARTAMENTO,
 * CRV, SERIES, LEMA, DESCRIPCIÓN_1/2, CANTIDAD_VOTOS. La interna nacional (ODN) define quién votó
 * en cada interna partidaria → el total del lema = Σ HOJA_ODN (igual que el agregado por serie).
 *
 * opcionId = slug(LEMA con prefijo "Partido ") — IDÉNTICO a aggregateBySerie (el votes.json por
 * serie que reemplaza), para que run-internas-2014-hoja.ts reconcilie ODN Σhojas == lema por geo
 * (ese runner normaliza el prefijo 'partido-' al comparar).
 *
 * El join CRV→barrio viene del mapeo POR CICLO (montevideo-circuito-barrio.internas-2014.json,
 * generado por build-circuito-barrio-cycles.py). Los CRV sin barrio van al bucket unmapped
 * (reconciliado, no perdido).
 */
import type { AgregadoZona, VotoOpcion } from '../../src/lib/contracts';
import { normName, slug } from '../lib/normalize';

export interface AggregateInternasMvdBarrioResult {
  zonas: AgregadoZona[];
  totalCanonico: number;
  unmappedVotos: number;
  circuitosSinBarrio: string[];
  opciones: { opcionId: string; nombre: string }[];
}

export function aggregateInternasMvdBarrio(
  rows: Record<string, string>[],
  crvToBarrio: Record<string, string>,
  deptCode = 'MO',
): AggregateInternasMvdBarrioResult {
  // barrio(norm) → { display, lemas: Map<lemaId, votos> }
  const porBarrio = new Map<string, { display: string; lemas: Map<string, number> }>();
  const opcionesPorId = new Map<string, string>();
  const circuitosSinBarrio = new Set<string>();
  let totalCanonico = 0;
  let unmappedVotos = 0;

  for (const r of rows) {
    if (r['DEPARTAMENTO'] !== deptCode || r['TIPO_REGISTRO'] !== 'HOJA_ODN') continue;
    const lema = (r['LEMA'] ?? '').trim();
    const votos = Number(r['CANTIDAD_VOTOS']);
    if (!lema || !Number.isFinite(votos) || votos < 0) continue;
    totalCanonico += votos;
    if (votos === 0) continue;

    const crv = (r['CRV'] ?? '').trim();
    const barrio = crvToBarrio[crv] ?? crvToBarrio[String(Number(crv))];
    if (!barrio) {
      circuitosSinBarrio.add(crv);
      unmappedVotos += votos;
      continue;
    }

    const lemaId = slug(lema); // CON prefijo "Partido " (igual que aggregateBySerie)
    opcionesPorId.set(lemaId, lema);
    const key = normName(barrio);
    let entry = porBarrio.get(key);
    if (!entry) {
      entry = { display: barrio, lemas: new Map() };
      porBarrio.set(key, entry);
    }
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

  return {
    zonas,
    totalCanonico,
    unmappedVotos,
    circuitosSinBarrio: [...circuitosSinBarrio],
    opciones: [...opcionesPorId.entries()].map(([opcionId, nombre]) => ({ opcionId, nombre })),
  };
}
