/**
 * Harness de validación del Data Contract (compile-time + runtime de guards).
 * Compila bajo `astro check` (valida tipos + polimorfia de los 3 fixtures).
 * Ejecutable con un runner cuando exista (Story 1.10); por ahora el valor es
 * el typecheck + la lógica de guards verificable.
 */
import { assertVotosShard, isOpcionHoja, isOpcionCandidato, isOpcionBinaria, ContractError } from '../guards';
import { assertCatalogoConsistente, assertHojasEnCatalogo } from '../guards';
import { escaleraDe, opcionIdHoja, ESCALERAS } from '../granularidad';
import type { EleccionTipo } from '../election';
import { shardInternas, opcionesInternas } from './internas-2024.fixture';
import { shardNacionales, opcionesNacionales } from './nacionales-2019.fixture';
import { shardBalotaje, opcionesBalotaje } from './balotaje.fixture';
import { shardPlebiscito, opcionesPlebiscito } from './plebiscito.fixture';
import { catalogoInternasHoja, shardInternasHoja } from './internas-hoja.fixture';

export function runContractSelfTest(): string[] {
  const results: string[] = [];

  // Positivos: los 4 shards válidos no deben lanzar.
  for (const shard of [shardInternas, shardNacionales, shardBalotaje, shardPlebiscito]) {
    assertVotosShard(shard);
    results.push(`OK shard ${shard.eleccionId}/${shard.departamento}`);
  }

  // Guards de opción: internas = hoja; nacionales = hoja; balotaje = candidato; plebiscito = binaria.
  if (!isOpcionHoja(opcionesInternas[0])) throw new Error('esperaba hoja en internas');
  if (!isOpcionHoja(opcionesNacionales[0])) throw new Error('esperaba hoja en nacionales');
  if (isOpcionCandidato(opcionesNacionales[0])) throw new Error('nacionales NO debe ser candidato');
  if (isOpcionBinaria(opcionesNacionales[0])) throw new Error('nacionales NO debe ser binaria');
  if (!isOpcionCandidato(opcionesBalotaje[0])) throw new Error('esperaba candidato en balotaje');
  if (!isOpcionBinaria(opcionesPlebiscito[0])) throw new Error('esperaba binaria en plebiscito');
  if (isOpcionHoja(opcionesPlebiscito[0])) throw new Error('plebiscito NO debe ser hoja');
  if (isOpcionCandidato(opcionesPlebiscito[0])) throw new Error('plebiscito NO debe ser candidato');
  results.push('OK guards de opción (hoja/nacionales-hoja/candidato/binaria)');

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

  // --- v3 (Epic 10): escalera de granularidad + catálogo jerárquico ---

  // Escaleras declaradas por (tipo, contienda).
  const escOdn = escaleraDe('internas', 'odn');
  const escOdd = escaleraDe('internas', 'odd');
  const escBal = escaleraDe('balotaje', 'unica');
  if (JSON.stringify(escOdn) !== JSON.stringify(['lema', 'precandidato', 'hoja'])) {
    throw new Error('escalera internas/odn inesperada');
  }
  if (JSON.stringify(escOdd) !== JSON.stringify(['lema', 'hoja'])) {
    throw new Error('escalera internas/odd inesperada');
  }
  if (JSON.stringify(escBal) !== JSON.stringify(['candidato'])) {
    throw new Error('escalera balotaje/unica inesperada');
  }
  if (escaleraDe('nacionales', 'odn') !== undefined) {
    throw new Error('escalera inexistente debería ser undefined');
  }
  results.push('OK escaleras de granularidad (odn/odd/balotaje + inexistente)');

  // opcion_id de hoja compuesto y estable.
  if (opcionIdHoja('odn', 'Frente Amplio', '609') !== 'odn-frente-amplio-609') {
    throw new Error('opcionIdHoja no genera el id compuesto esperado');
  }
  results.push('OK opcionIdHoja compone contienda+lema+hoja');

  // Catálogo jerárquico consistente + hojas del shard presentes en el catálogo.
  assertCatalogoConsistente(catalogoInternasHoja);
  assertVotosShard(shardInternasHoja);
  assertHojasEnCatalogo(shardInternasHoja, catalogoInternasHoja);
  results.push('OK catálogo jerárquico (ODN 3 niveles + ODD 2 niveles) y hojas-en-catálogo');

  // Negativo: catálogo con parentId colgante debe lanzar ContractError.
  let lanzadoCat = false;
  try {
    assertCatalogoConsistente({
      eleccionId: 'internas-2024',
      departamento: 'montevideo',
      contiendas: [
        {
          contienda: 'odn',
          niveles: ['lema', 'precandidato', 'hoja'],
          nodos: [{ id: 'p1', nivel: 'precandidato', etiqueta: 'X', parentId: 'lema-fantasma' }],
          opciones: [],
        },
      ],
    });
  } catch (e) {
    lanzadoCat = e instanceof ContractError;
  }
  if (!lanzadoCat) throw new Error('el guard no detectó parentId colgante');
  results.push('OK guard detecta violación (catálogo parentId colgante)');

  // Negativo: opción cuya `clase` no coincide con el nivel terminal de la contienda.
  let lanzadoClase = false;
  try {
    assertCatalogoConsistente({
      eleccionId: 'internas-2024',
      departamento: 'montevideo',
      contiendas: [
        {
          contienda: 'odn',
          niveles: ['lema', 'hoja'],
          nodos: [{ id: 'fa', nivel: 'lema', etiqueta: 'FA' }],
          opciones: [{ clase: 'binaria', id: 'x-si', etiqueta: 'si' }],
        },
      ],
    });
  } catch (e) {
    lanzadoClase = e instanceof ContractError;
  }
  if (!lanzadoClase) throw new Error('el guard no detectó clase != nivel terminal');
  results.push('OK guard detecta violación (clase != nivel terminal)');

  // --- v3 / Story 10.10: gate de escalera (consistencia interna de ESCALERAS) ---
  // Toda elección declara su escalera; sin ella la UI no sabe qué niveles ofrecer.
  const TIPOS: EleccionTipo[] = ['internas', 'nacionales', 'balotaje', 'departamentales', 'plebiscito'];
  const UNIDAD_VOTO = new Set(['hoja', 'candidato', 'binaria']);
  for (const t of TIPOS) {
    if (!ESCALERAS.some((e) => e.tipo === t)) throw new Error(`tipo '${t}' sin escalera declarada`);
  }
  const vistosEsc = new Set<string>();
  for (const e of ESCALERAS) {
    const k = `${e.tipo}/${e.contienda}`;
    if (vistosEsc.has(k)) throw new Error(`escalera duplicada (${k})`);
    vistosEsc.add(k);
    if (e.niveles.length === 0) throw new Error(`escalera (${k}) vacía`);
    if (!UNIDAD_VOTO.has(e.niveles[e.niveles.length - 1])) {
      throw new Error(`escalera (${k}) no termina en unidad de voto`);
    }
    if ((e.tipo === 'balotaje' || e.tipo === 'plebiscito') && e.niveles.length !== 1) {
      throw new Error(`tipo plano '${e.tipo}' debe tener escalera de 1 nivel`);
    }
  }
  results.push('OK gate de escalera (todo tipo declara escalera; terminal=unidad de voto; planos=1 nivel)');

  return results;
}
