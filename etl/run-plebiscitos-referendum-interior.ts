/**
 * Story 11.2 — Plebiscitos 2024 (×2) + Referéndum LUC 2022 a los 18 deptos del interior.
 * Tipo `plebiscito`, escalera plana Sí/No, nivel SERIE.
 *
 * Plebiscitos 2024: no hay papeleta "No" → Sí = SiArt{N}; No = válidos (TotalVotosNoObservados) − Sí.
 * Referéndum LUC 2022: hay Sí y No explícitos (Total_SI / Total_NO).
 * Opciones e ids replican los shards de Montevideo ya publicados (consistencia de leyenda/color).
 *
 * Ejecutar: `npm run etl:plebiscitos-referendum-interior`.
 */
import { runBinariaInterior, type ElecBinariaConfig } from './lib/run-binaria-interior';

const PLEB_CSV = 'data/raw/electoral/nacionales-2024/totales-generales-plebiscitos.csv';
const REF_CSV = 'data/raw/electoral/referendum-2022/refer-ndum-contra-135-art-culos-de-la-le.csv';

const SI_NO = [
  { opcionId: 'si', nombre: 'Sí' },
  { opcionId: 'no', nombre: 'No' },
] as const;

const ELECCIONES: ElecBinariaConfig[] = [
  {
    eleccionId: 'plebiscito-allanamientos-2024',
    tipo: 'plebiscito',
    csv: PLEB_CSV,
    opciones: SI_NO,
    pregunta: '¿Aprueba la reforma del artículo 11 de la Constitución (allanamientos nocturnos)?',
    extract: (r) => {
      const validos = Number(r['TotalVotosNoObservados']) || 0;
      const si = Number(r['SiArt11']) || 0;
      return { a: si, b: validos - si, enBlanco: 0, anulados: Number(r['TotalAnulados']) || 0, observados: Number(r['TotalVotosObservados']) || 0 };
    },
  },
  {
    eleccionId: 'plebiscito-seguridad-social-2024',
    tipo: 'plebiscito',
    csv: PLEB_CSV,
    opciones: SI_NO,
    pregunta: '¿Aprueba la reforma del artículo 67 de la Constitución (seguridad social)?',
    extract: (r) => {
      const validos = Number(r['TotalVotosNoObservados']) || 0;
      const si = Number(r['SiArt67']) || 0;
      return { a: si, b: validos - si, enBlanco: 0, anulados: Number(r['TotalAnulados']) || 0, observados: Number(r['TotalVotosObservados']) || 0 };
    },
  },
  {
    eleccionId: 'referendum-luc-2022',
    tipo: 'plebiscito',
    csv: REF_CSV,
    opciones: SI_NO,
    pregunta: '¿Está a favor de derogar los 135 artículos de la Ley de Urgente Consideración (LUC)?',
    extract: (r) => ({
      a: Number(r['Total_SI']) || 0,
      b: Number(r['Total_NO']) || 0,
      enBlanco: Number(r['Total_EN_Blanco']) || 0,
      anulados: Number(r['Total_Anulados']) || 0,
      observados: Number(r['Total_Votos_Observados']) || 0,
    }),
  },
];

function main(): void {
  console.log('=== ETL Interior: plebiscitos 2024 + referéndum LUC 2022 (Story 11.2) ===');
  for (const cfg of ELECCIONES) runBinariaInterior(cfg);
  console.log('\n=== Plebiscitos + referéndum interior: completado ✅ ===');
}

main();
