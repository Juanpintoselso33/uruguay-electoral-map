/**
 * Story 11.3 — Balotajes históricos 2014 y 2019 a los 18 deptos del interior.
 * Tipo `balotaje`, escalera plana (candidato), nivel SERIE.
 *
 * Dos columnas de candidato fijas por año (no hay columna PARTIDO). Se mapea a opcionId
 * estable por lema para color/comparación (igual que el runner MVD, Story 7.7):
 *   - FA (Vázquez-Sendic 2014 / Martínez-Villar 2019) → `frente-amplio`
 *   - PN (Lacalle Pou-Larrañaga 2014 / Lacalle Pou-Argimón 2019) → `partido-nacional`
 * válidos = FA + PN. (En 2024 el rival del FA fue `coalicion-republicana`; acá, pre-coalición, es PN.)
 *
 * Ejecutar: `npm run etl:balotajes-historicos-interior`.
 */
import { runBinariaInterior, type ElecBinariaConfig } from './lib/run-binaria-interior';

const FA_PN = [
  { opcionId: 'frente-amplio', nombre: 'Frente Amplio' },
  { opcionId: 'partido-nacional', nombre: 'Partido Nacional' },
] as const;

function extractBalotaje(faCol: string, pnCol: string): ElecBinariaConfig['extract'] {
  return (r) => ({
    a: Number(r[faCol]) || 0,
    b: Number(r[pnCol]) || 0,
    enBlanco: Number(r['Total_EN_Blanco']) || 0,
    anulados: Number(r['Total_Anulados']) || 0,
    observados: Number(r['Total_Votos_Observados']) || 0,
  });
}

const ELECCIONES: ElecBinariaConfig[] = [
  {
    eleccionId: 'balotaje-2014',
    tipo: 'balotaje',
    csv: 'data/raw/electoral/balotaje-2014/balotaje-2014.csv',
    opciones: FA_PN,
    extract: extractBalotaje('Total_Vazquez_Sendic', 'Total_Lacalle Pou_Larrañaga'),
  },
  {
    eleccionId: 'balotaje-2019',
    tipo: 'balotaje',
    csv: 'data/raw/electoral/balotaje-2019/balotaje-2019.csv',
    opciones: FA_PN,
    extract: extractBalotaje('Total_Martinez_Villar', 'Total_Lacalle Pou_Argimon'),
  },
];

function main(): void {
  console.log('=== ETL Interior: balotajes históricos 2014 + 2019 (Story 11.3) ===');
  for (const cfg of ELECCIONES) runBinariaInterior(cfg);
  console.log('\n=== Balotajes históricos interior: completado ✅ ===');
}

main();
