/**
 * Fixture seco — nacionales 2019 (HOJA sin precandidato; lemas múltiples).
 * Valida la polimorfia para elecciones legislativas. Compile-time (AC3).
 */
import type { Eleccion, Opcion, VotosShard } from '../index';

export const eleccionNacionales2019 = {
  id: 'nacionales-2019',
  tipo: 'nacionales',
  anio: 2019,
  nombre: 'Nacionales 2019',
} as const satisfies Eleccion;

export const opcionesNacionales = [
  { clase: 'hoja', id: 'n19-609', hoja: '609', partidoId: 'frente-amplio' },
  { clase: 'hoja', id: 'n19-404', hoja: '404', partidoId: 'nacional' },
] as const satisfies readonly Opcion[];

export const shardNacionales = {
  eleccionId: 'nacionales-2019',
  departamento: 'montevideo',
  nivel: 'zona',
  escrutinio: 'definitivo',
  tipo: 'nacionales',
  zonas: [
    {
      geoId: 'centro',
      ganadorOpcionId: 'n19-609',
      validos: 1500,
      porOpcion: [
        { opcionId: 'n19-609', votos: 900 },
        { opcionId: 'n19-404', votos: 600 },
      ],
      noPartidarios: { enBlanco: 30, anulados: 8, observados: 3 },
    },
  ],
} as const satisfies VotosShard;
