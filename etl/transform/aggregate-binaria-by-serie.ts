/**
 * Agrega por SERIE una elección de DOS opciones — balotaje (FA vs PN/coalición) o
 * Sí/No (plebiscito/referéndum) — para los departamentos del interior.
 *
 * Estructuralmente idéntico a `aggregate-balotaje-by-serie` (2024) pero parametrizado
 * por las columnas de cada opción y los no-partidarios, de modo que sirve para:
 *   - balotajes históricos 2014/2019 (columnas de candidato propias por año)
 *   - plebiscitos 2024 (Sí = SiArt{N}; No derivado = válidos − Sí)
 *   - referéndum LUC 2022 (Total_SI / Total_NO explícitos)
 *
 * Clave geográfica = SERIE (en minúsculas). Una CRV puede abarcar varias series
 * ("AAA AAB") → se distribuye pro-rata entero (sobrante a la primera), igual que el
 * resto de ETL del interior, para que Σ por serie == Σ del CSV (losslessness exacta).
 */
import type { AgregadoZona, VotoOpcion } from '../../src/lib/contracts';

export interface OpcionDef {
  readonly opcionId: string;
  readonly nombre: string;
}

/** Votos crudos de una fila: opción A, opción B, y no-partidarios. */
export interface BinariaExtract {
  a: number;
  b: number;
  enBlanco: number;
  anulados: number;
  observados: number;
}

export interface BinariaConfig {
  /** [opción A, opción B]; A es la primera columna, B la segunda. */
  readonly opciones: readonly [OpcionDef, OpcionDef];
  /** Extrae de una fila los votos de A/B y los no-partidarios. La serie viene de `r['Serie']`. */
  readonly extract: (r: Record<string, string>) => BinariaExtract;
}

export interface BinariaResult {
  zonas: AgregadoZona[];
  /** Σ válidos (a+b) de todas las filas. Ancla de losslessness (debe == Σ zona.validos). */
  totalValidos: number;
  /** Σ (a+b+enBlanco+anulados+observados). Denominador de cobertura (mismo conteo que `votosColocados`). */
  totalCanonico: number;
  opciones: readonly OpcionDef[];
}

interface SerieAcc {
  a: number;
  b: number;
  enBlanco: number;
  anulados: number;
  observados: number;
}

export function aggregateBinariaBySerie(
  rows: Record<string, string>[],
  cfg: BinariaConfig,
): BinariaResult {
  const [opA, opB] = cfg.opciones;
  const porSerie = new Map<string, SerieAcc>();
  let totalValidos = 0;
  let totalCanonico = 0;

  for (const r of rows) {
    const serieRaw = (r['Serie'] ?? '').trim();
    if (!serieRaw) continue;
    const ex = cfg.extract(r);
    totalValidos += ex.a + ex.b;
    totalCanonico += ex.a + ex.b + ex.enBlanco + ex.anulados + ex.observados;

    const seriesCodes = serieRaw.split(/\s+/).filter(Boolean).map((s) => s.toLowerCase());
    const n = seriesCodes.length;
    for (let i = 0; i < n; i++) {
      const geoId = seriesCodes[i];
      let acc = porSerie.get(geoId);
      if (!acc) {
        acc = { a: 0, b: 0, enBlanco: 0, anulados: 0, observados: 0 };
        porSerie.set(geoId, acc);
      }
      if (n === 1) {
        acc.a += ex.a;
        acc.b += ex.b;
        acc.enBlanco += ex.enBlanco;
        acc.anulados += ex.anulados;
        acc.observados += ex.observados;
      } else {
        // Pro-rata: distribución entera, el sobrante va a la primera serie.
        const distribute = (v: number): number => Math.floor(v / n) + (i === 0 ? v - Math.floor(v / n) * n : 0);
        acc.a += distribute(ex.a);
        acc.b += distribute(ex.b);
        acc.enBlanco += distribute(ex.enBlanco);
        acc.anulados += distribute(ex.anulados);
        acc.observados += distribute(ex.observados);
      }
    }
  }

  const zonas: AgregadoZona[] = [];
  for (const [geoId, acc] of porSerie) {
    const validos = acc.a + acc.b;
    const porOpcion: VotoOpcion[] = [
      { opcionId: opA.opcionId, votos: acc.a },
      { opcionId: opB.opcionId, votos: acc.b },
    ];
    zonas.push({
      geoId,
      // Convención de empate: `>=` ⇒ el empate exacto se adjudica a la opción A.
      // Empates a nivel serie son prácticamente imposibles; determinístico para build reproducible.
      ganadorOpcionId: acc.a >= acc.b ? opA.opcionId : opB.opcionId,
      validos,
      porOpcion,
      noPartidarios: { enBlanco: acc.enBlanco, anulados: acc.anulados, observados: acc.observados },
    });
  }

  return { zonas, totalValidos, totalCanonico, opciones: cfg.opciones };
}
