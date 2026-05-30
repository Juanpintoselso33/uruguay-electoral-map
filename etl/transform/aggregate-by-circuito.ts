/**
 * Agrega votos por CIRCUITO → BARRIO usando la mapping table explícita (Story 1.6).
 *
 * Reemplaza la agregación por ZONA de la Story 1.4: la columna ZONA del CSV son
 * etiquetas editoriales compuestas que NO matchean barrios (join naive = 38%).
 * El join correcto es CIRCUITO(CRV)→BARRIO vía `data/mappings/montevideo-crv-barrio.json`,
 * cuyos valores de barrio coinciden exacto con `v_sig_barrios.json` (la geometría limpia).
 *
 * LOSSLESSNESS: todo voto canónico va a un barrio o al bucket `unmapped` (circuito sin
 * barrio en la mapping). Nada se descarta con `continue` → habilita el gate de reconciliación.
 */
import type { AgregadoZona, VotoOpcion } from '../../src/lib/contracts';
import { normName, slug } from '../lib/normalize';

/** Marcadores de categorías no partidarias en la columna PARTIDO (si aparecen). */
const NO_PARTIDARIOS = new Map<string, keyof CatAcc>([
  ['EN BLANCO', 'enBlanco'],
  ['BLANCO', 'enBlanco'],
  ['ANULADO', 'anulados'],
  ['ANULADOS', 'anulados'],
  ['OBSERVADO', 'observados'],
  ['OBSERVADOS', 'observados'],
]);

interface CatAcc { enBlanco: number; anulados: number; observados: number }

export interface AggregateByCircuitoOptions {
  /** Valor de ESCRUTINIO considerado canónico (definitivo). */
  escrutinioCanonico: string;
  /** Mapa CIRCUITO(string) → nombre de BARRIO (igual a v_sig_barrios.BARRIO). */
  crvToBarrio: Record<string, string>;
}

export interface AggregateByCircuitoResult {
  zonas: AgregadoZona[];
  /** Suma de TODOS los votos canónicos del CSV (partidarios + no partidarios). Para reconciliación. */
  totalCanonico: number;
  /** Votos cuyo circuito no tiene barrio en la mapping (bucket explícito; no se descartan). */
  unmappedVotos: number;
  /** Circuitos distintos sin barrio (diagnóstico). */
  circuitosSinBarrio: string[];
  partidosVistos: string[];
}

/** Resuelve el barrio de un circuito (tolera ceros a la izquierda / numérico). */
function resolveBarrio(map: Record<string, string>, circuito: string): string | undefined {
  if (map[circuito]) return map[circuito];
  const n = Number(circuito);
  if (Number.isFinite(n) && map[String(n)]) return map[String(n)];
  return undefined;
}

export function aggregateByCircuito(
  rows: Record<string, string>[],
  opts: AggregateByCircuitoOptions,
): AggregateByCircuitoResult {
  // barrio (display) -> { partido -> votos } + categorías
  const porBarrio = new Map<string, { display: string; partidos: Map<string, number>; cat: CatAcc }>();
  const partidosVistos = new Set<string>();
  const circuitosSinBarrio = new Set<string>();
  let totalCanonico = 0;
  let unmappedVotos = 0;

  for (const r of rows) {
    if (r['ESCRUTINIO'] !== opts.escrutinioCanonico) continue; // filtra ETAPA, no votos válidos
    const votos = Number(r['CNT_VOTOS']) || 0;
    if (votos < 0) continue; // dato inválido (no debería ocurrir; lo ignoramos explícitamente)
    totalCanonico += votos;

    const circuito = (r['CIRCUITO'] ?? '').trim();
    const barrio = resolveBarrio(opts.crvToBarrio, circuito);
    if (!barrio) {
      circuitosSinBarrio.add(circuito);
      unmappedVotos += votos; // bucket explícito → losslessness
      continue;
    }

    const key = normName(barrio);
    let entry = porBarrio.get(key);
    if (!entry) {
      entry = { display: barrio, partidos: new Map(), cat: { enBlanco: 0, anulados: 0, observados: 0 } };
      porBarrio.set(key, entry);
    }

    const partido = (r['PARTIDO'] ?? '').trim();
    const catKey = NO_PARTIDARIOS.get(normName(partido));
    if (catKey) {
      entry.cat[catKey] += votos;
    } else {
      entry.partidos.set(partido, (entry.partidos.get(partido) ?? 0) + votos);
      partidosVistos.add(partido);
    }
  }

  const zonas: AgregadoZona[] = [];
  for (const [, entry] of porBarrio) {
    const ranking = [...entry.partidos.entries()].sort((a, b) => b[1] - a[1]);
    const validos = ranking.reduce((s, [, v]) => s + v, 0);
    const porOpcion: VotoOpcion[] = ranking.map(([partido, v]) => ({ opcionId: slug(partido), votos: v }));
    zonas.push({
      geoId: entry.display,
      ganadorOpcionId: ranking.length ? slug(ranking[0][0]) : '',
      validos,
      porOpcion,
      noPartidarios: entry.cat,
    });
  }

  return {
    zonas,
    totalCanonico,
    unmappedVotos,
    circuitosSinBarrio: [...circuitosSinBarrio],
    partidosVistos: [...partidosVistos],
  };
}
