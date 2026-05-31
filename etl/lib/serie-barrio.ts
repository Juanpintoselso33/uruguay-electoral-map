/** Tipo para el mapping SERIE electoral → barrio de ciudad grande. */

export interface SerieBarrioEntry {
  readonly serie: string;
  readonly barrio: string;
}

export type SerieBarrioMap = SerieBarrioEntry[];
