/**
 * Harness de validación del Data Contract (compile-time + runtime de guards).
 * Compila bajo `astro check` (valida tipos + polimorfia de los 3 fixtures).
 * Ejecutable con un runner cuando exista (Story 1.10); por ahora el valor es
 * el typecheck + la lógica de guards verificable.
 */
import { assertVotosShard, isOpcionHoja, isOpcionCandidato, ContractError } from '../guards';
import { shardInternas, opcionesInternas } from './internas-2024.fixture';
import { shardNacionales } from './nacionales-2019.fixture';
import { shardBalotaje, opcionesBalotaje } from './balotaje.fixture';

export function runContractSelfTest(): string[] {
  const results: string[] = [];

  // Positivos: los 3 shards válidos no deben lanzar.
  for (const shard of [shardInternas, shardNacionales, shardBalotaje]) {
    assertVotosShard(shard);
    results.push(`OK shard ${shard.eleccionId}/${shard.departamento}`);
  }

  // Guards de opción: internas = hoja; balotaje = candidato.
  if (!isOpcionHoja(opcionesInternas[0])) throw new Error('esperaba hoja en internas');
  if (!isOpcionCandidato(opcionesBalotaje[0])) throw new Error('esperaba candidato en balotaje');
  results.push('OK guards de opción');

  // Negativo: un shard con votos negativos debe lanzar ContractError.
  let lanzado = false;
  try {
    assertVotosShard({
      ...shardInternas,
      zonas: [
        {
          ...shardInternas.zonas[0],
          porOpcion: [{ opcionId: 'i24-609', votos: -1 }],
          ganadorOpcionId: 'i24-609',
        },
      ],
    });
  } catch (e) {
    lanzado = e instanceof ContractError;
  }
  if (!lanzado) throw new Error('el guard no detectó votos negativos');
  results.push('OK guard detecta violación (votos negativos)');

  // Negativo M1: ganador declarado que NO es el de más votos.
  let lanzadoGanador = false;
  try {
    assertVotosShard({
      ...shardInternas,
      zonas: [
        {
          ...shardInternas.zonas[0],
          ganadorOpcionId: 'i24-71',
          porOpcion: [
            { opcionId: 'i24-609', votos: 700 },
            { opcionId: 'i24-71', votos: 500 },
          ],
        },
      ],
    });
  } catch (e) {
    lanzadoGanador = e instanceof ContractError;
  }
  if (!lanzadoGanador) throw new Error('el guard no detectó ganador inconsistente');
  results.push('OK guard detecta violación (ganador != max)');

  return results;
}
