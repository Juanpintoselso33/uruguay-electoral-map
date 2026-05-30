/**
 * Self-test de los gates de integridad (Story 1.6).
 * Patrón del proyecto (igual que contracts/__fixtures__/validate.ts): compila bajo
 * `astro check` y es ejecutable con esbuild+node hasta que exista el runner (Story 1.10).
 * Cubre caso feliz + caso de fallo de cada gate.
 */
import type { VotosShard } from '../../src/lib/contracts';
import { reconcile } from './reconcile';
import { checkCoverage } from './coverage';

function expectThrow(fn: () => void, label: string): void {
  let threw = false;
  try {
    fn();
  } catch {
    threw = true;
  }
  if (!threw) throw new Error(`FALLA: se esperaba que "${label}" lanzara y no lo hizo`);
}

const shard: VotosShard = {
  eleccionId: 'internas-2024',
  departamento: 'montevideo',
  nivel: 'zona',
  escrutinio: 'definitivo',
  tipo: 'internas',
  zonas: [
    {
      geoId: 'Ciudad Vieja',
      ganadorOpcionId: 'a',
      validos: 100,
      porOpcion: [
        { opcionId: 'a', votos: 60 },
        { opcionId: 'b', votos: 40 },
      ],
      noPartidarios: { enBlanco: 5, anulados: 2, observados: 1 },
    },
    {
      geoId: 'Centro',
      ganadorOpcionId: 'a',
      validos: 30,
      porOpcion: [{ opcionId: 'a', votos: 30 }],
      noPartidarios: { enBlanco: 0, anulados: 0, observados: 0 },
    },
  ],
};
// total zona = (100+8) + (30+0) = 138; + unmapped 12 = 150
const TOTAL = 150;
const UNMAPPED = 12;

export function runGatesSelfTest(): string[] {
  const out: string[] = [];

  // --- reconcile: caso feliz (delta 0) ---
  const rec = reconcile(shard, TOTAL, UNMAPPED);
  if (rec.delta !== 0) throw new Error(`reconcile feliz: delta=${rec.delta} (esperaba 0)`);
  out.push('OK reconcile delta=0');

  // --- reconcile: caso de fallo (total declarado != suma → debe lanzar) ---
  expectThrow(() => reconcile(shard, TOTAL + 1, UNMAPPED), 'reconcile con delta≠0');
  out.push('OK reconcile lanza con delta≠0');

  // --- coverage: caso feliz (geometría cubre ambos barrios) ---
  const geo = ['Ciudad Vieja', 'Centro', 'Pocitos', 'Cordón']; // fill 2/4 = 50% < 75 → forzamos fill OK con menos barrios
  const geoFull = ['Ciudad Vieja', 'Centro']; // fill 2/2 = 100%, placement 138/150 = 92%? < 95 → ajustamos
  // placement = votos colocados / total. Ambos barrios matchean → colocados=138, total=150 → 92% < 95 ⇒ fallaría.
  // Para el caso feliz subimos el total colocado: sin unmapped el placement es 100%.
  const recOk = checkCoverage({ shard, geoBarrioNames: geoFull, totalCanonico: 138 });
  if (recOk.placement < 0.95 || recOk.barrioFill < 0.75) {
    throw new Error(`coverage feliz: placement=${recOk.placement} fill=${recOk.barrioFill}`);
  }
  out.push(`OK coverage feliz (placement ${(recOk.placement * 100).toFixed(0)}%, fill ${(recOk.barrioFill * 100).toFixed(0)}%)`);
  void geo;

  // --- coverage: caso de fallo placement (un geoId del shard no está en la geometría) ---
  expectThrow(
    () => checkCoverage({ shard, geoBarrioNames: ['Centro'], totalCanonico: 138 }),
    'coverage con placement bajo (Ciudad Vieja sin geometría)',
  );
  out.push('OK coverage lanza con placement bajo');

  // --- coverage: caso de fallo barrio-fill (muchos barrios de geometría sin votos) ---
  expectThrow(
    () =>
      checkCoverage({
        shard,
        geoBarrioNames: ['Ciudad Vieja', 'Centro', 'X1', 'X2', 'X3', 'X4', 'X5', 'X6'],
        totalCanonico: 138,
      }),
    'coverage con barrio-fill bajo (2/8 = 25%)',
  );
  out.push('OK coverage lanza con barrio-fill bajo');

  return out;
}

runGatesSelfTest().forEach((l) => console.log(l));
console.log('\n=== gates self-test: TODO OK ✅ ===');
