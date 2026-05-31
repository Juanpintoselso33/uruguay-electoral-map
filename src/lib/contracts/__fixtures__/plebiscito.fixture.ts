/**
 * Fixture seco — PLEBISCITO (prueba del tipo binario, AC4).
 * La opción es Sí/No SIN partido ni HOJA. Si esto compila contra el contrato,
 * `OpcionBinaria` está correctamente integrada en el union `Opcion`.
 */
import type { Eleccion, Opcion, VotosShard } from '../index';

export const eleccionPlebiscito2024 = {
  id: 'plebiscito-seguridad-2024',
  tipo: 'plebiscito',
  anio: 2024,
  nombre: 'Plebiscito Seguridad Pública 2024',
  pregunta: '¿Está de acuerdo con la reforma constitucional propuesta en materia de seguridad pública?',
} as const satisfies Eleccion;

// Opción binaria Sí/No — NO hay partido ni HOJA.
export const opcionesPlebiscito = [
  { clase: 'binaria', id: 'pleb24seg-si', etiqueta: 'si' },
  { clase: 'binaria', id: 'pleb24seg-no', etiqueta: 'no' },
] as const satisfies readonly Opcion[];

export const shardPlebiscito = {
  eleccionId: 'plebiscito-seguridad-2024',
  departamento: 'montevideo',
  nivel: 'zona',
  escrutinio: 'definitivo',
  tipo: 'plebiscito',
  zonas: [
    {
      geoId: 'centro',
      ganadorOpcionId: 'pleb24seg-no',
      validos: 2000,
      porOpcion: [
        { opcionId: 'pleb24seg-si', votos: 900 },
        { opcionId: 'pleb24seg-no', votos: 1100 },
      ],
      noPartidarios: { enBlanco: 30, anulados: 8, observados: 2 },
    },
    {
      geoId: 'pocitos',
      ganadorOpcionId: 'pleb24seg-no',
      validos: 3500,
      porOpcion: [
        { opcionId: 'pleb24seg-si', votos: 1200 },
        { opcionId: 'pleb24seg-no', votos: 2300 },
      ],
      noPartidarios: { enBlanco: 45, anulados: 12, observados: 3 },
    },
  ],
} as const satisfies VotosShard;
