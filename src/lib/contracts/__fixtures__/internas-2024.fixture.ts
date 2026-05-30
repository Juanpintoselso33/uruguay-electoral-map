/**
 * Fixture seco — internas 2024 (opción tipo HOJA con precandidato).
 * Valida en COMPILE-TIME contra el contrato (AC3). No es dato real.
 */
import type { Eleccion, Opcion, VotosShard } from '../index';

export const eleccionInternas2024 = {
  id: 'internas-2024',
  tipo: 'internas',
  anio: 2024,
  nombre: 'Internas 2024',
} as const satisfies Eleccion;

export const opcionesInternas = [
  {
    clase: 'hoja',
    id: 'i24-609',
    hoja: '609',
    partidoId: 'frente-amplio',
    precandidato: 'Yamandú Orsi',
  },
  {
    clase: 'hoja',
    id: 'i24-71',
    hoja: '71',
    partidoId: 'partido-nacional',
    precandidato: 'Álvaro Delgado',
  },
] as const satisfies readonly Opcion[];

export const shardInternas = {
  eleccionId: 'internas-2024',
  departamento: 'montevideo',
  nivel: 'zona',
  escrutinio: 'definitivo',
  tipo: 'internas',
  zonas: [
    {
      geoId: 'centro',
      ganadorOpcionId: 'i24-609',
      validos: 1200,
      porOpcion: [
        { opcionId: 'i24-609', votos: 700 },
        { opcionId: 'i24-71', votos: 500 },
      ],
      noPartidarios: { enBlanco: 20, anulados: 5, observados: 2 },
    },
  ],
} as const satisfies VotosShard;
