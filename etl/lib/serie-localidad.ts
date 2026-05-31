/** Tipo para el mapping SERIE electoral → localidad. Generado por etl:serie-localidad. */

export interface SerieLocalidadEntry {
  readonly serie: string;
  readonly localidad: string;
  readonly tipo: '1:1' | 'ciudad-grande';
}

export type SerieLocalidadMap = SerieLocalidadEntry[];
