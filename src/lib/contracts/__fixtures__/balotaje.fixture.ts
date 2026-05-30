/**
 * Fixture seco — BALOTAJE (la prueba de fuego, AC3).
 * La opción es candidato/lema SIN HOJA. Si esto compila contra el contrato,
 * la polimorfia es correcta. Si exigiera `hoja`, el contrato estaría mal.
 */
import type { Eleccion, Opcion, VotosShard } from '../index';

export const eleccionBalotaje2024 = {
  id: 'balotaje-2024',
  tipo: 'balotaje',
  anio: 2024,
  nombre: 'Balotaje 2024',
} as const satisfies Eleccion;

// Opción binaria por candidato/lema — NO hay HOJA.
export const opcionesBalotaje = [
  { clase: 'candidato', id: 'b24-orsi', candidato: 'Yamandú Orsi', partidoId: 'frente-amplio' },
  { clase: 'candidato', id: 'b24-delgado', candidato: 'Álvaro Delgado', partidoId: 'coalicion-republicana' },
] as const satisfies readonly Opcion[];

export const shardBalotaje = {
  eleccionId: 'balotaje-2024',
  departamento: 'montevideo',
  nivel: 'zona',
  escrutinio: 'definitivo',
  tipo: 'balotaje',
  zonas: [
    {
      geoId: 'centro',
      ganadorOpcionId: 'b24-orsi',
      validos: 1800,
      porOpcion: [
        { opcionId: 'b24-orsi', votos: 1100 },
        { opcionId: 'b24-delgado', votos: 700 },
      ],
      noPartidarios: { enBlanco: 25, anulados: 6, observados: 1 },
    },
  ],
} as const satisfies VotosShard;
