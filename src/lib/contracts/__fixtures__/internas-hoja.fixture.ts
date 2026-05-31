/**
 * Fixture seco — INTERNAS a nivel HOJA (v3, Epic 10). Prueba la escalera de
 * granularidad y el catálogo jerárquico: ODN (lema→precandidato→hoja, 3 niveles)
 * y ODD (lema→hoja, 2 niveles). Si compila contra el contrato v3, el modelo de
 * granularidad está bien integrado. Ids de hoja compuestos (ver `opcionIdHoja`).
 */
import type { CatalogoOpciones, VotosShard } from '../index';

export const catalogoInternasHoja = {
  eleccionId: 'internas-2024',
  departamento: 'montevideo',
  contiendas: [
    {
      contienda: 'odn',
      niveles: ['lema', 'precandidato', 'hoja'],
      // Ids de nodo = slug del lema/precandidato (NO prefijado por contienda: el árbol se
      // scopea por contienda, y así `lemaId` coincide con `partidoId` y deriva el opcion_id).
      nodos: [
        { id: 'frente-amplio', nivel: 'lema', etiqueta: 'Frente Amplio', partidoId: 'frente-amplio' },
        {
          id: 'frente-amplio-cosse',
          nivel: 'precandidato',
          etiqueta: 'Carolina Cosse',
          parentId: 'frente-amplio',
          partidoId: 'frente-amplio',
        },
      ],
      // opcion_id = opcionIdHoja('odn','frente-amplio',hoja) = `odn-frente-amplio-{hoja}`.
      opciones: [
        {
          clase: 'hoja', id: 'odn-frente-amplio-609', hoja: '609', partidoId: 'frente-amplio',
          contienda: 'odn', lemaId: 'frente-amplio', precandidatoId: 'frente-amplio-cosse',
        },
        {
          clase: 'hoja', id: 'odn-frente-amplio-90', hoja: '90', partidoId: 'frente-amplio',
          contienda: 'odn', lemaId: 'frente-amplio', precandidatoId: 'frente-amplio-cosse',
        },
      ],
    },
    {
      contienda: 'odd',
      niveles: ['lema', 'hoja'],
      nodos: [
        { id: 'frente-amplio', nivel: 'lema', etiqueta: 'Frente Amplio', partidoId: 'frente-amplio' },
      ],
      opciones: [
        {
          clase: 'hoja', id: 'odd-frente-amplio-190', hoja: '190', partidoId: 'frente-amplio',
          contienda: 'odd', lemaId: 'frente-amplio',
        },
      ],
    },
  ],
} as const satisfies CatalogoOpciones;

/** Shard a nivel HOJA (ODN, lema Frente Amplio): porOpcion son hojas, no lemas. */
export const shardInternasHoja = {
  eleccionId: 'internas-2024',
  departamento: 'montevideo',
  nivel: 'zona',
  escrutinio: 'definitivo',
  tipo: 'internas',
  zonas: [
    {
      geoId: 'centro',
      ganadorOpcionId: 'odn-frente-amplio-609',
      validos: 3000,
      porOpcion: [
        { opcionId: 'odn-frente-amplio-609', votos: 2100 },
        { opcionId: 'odn-frente-amplio-90', votos: 900 },
      ],
      noPartidarios: { enBlanco: 0, anulados: 0, observados: 0 },
    },
  ],
} as const satisfies VotosShard;
