import { describe, it, expect } from 'vitest';
import {
  isOpcionHoja, isOpcionCandidato, isOpcionBinaria, isEscrutinioDefinitivo,
  assertVotosShard, assertCatalogoConsistente, assertHojasEnCatalogo, ContractError,
} from './guards';
import { opcionIdHoja, type CatalogoOpciones } from './granularidad';
import type { VotosShard } from './votes';
import type { Opcion } from './election';

// ── type guards ────────────────────────────────────────────────────────────
describe('type guards de Opcion', () => {
  it('discriminan por clase', () => {
    const hoja = { clase: 'hoja', id: 'odd-pn-5', hoja: '5', lemaId: 'pn', contienda: 'odd' } as Opcion;
    const cand = { clase: 'candidato', id: 'c1', candidato: 'X', partidoId: 'pn', contienda: 'intendente' } as Opcion;
    const bin = { clase: 'binaria', id: 'si', etiqueta: 'si', nombre: 'Sí' } as Opcion;
    expect(isOpcionHoja(hoja)).toBe(true);
    expect(isOpcionCandidato(cand)).toBe(true);
    expect(isOpcionBinaria(bin)).toBe(true);
    expect(isOpcionHoja(cand)).toBe(false);
  });
  it('isEscrutinioDefinitivo', () => {
    expect(isEscrutinioDefinitivo({ escrutinio: 'definitivo' })).toBe(true);
    expect(isEscrutinioDefinitivo({ escrutinio: 'primario' })).toBe(false);
  });
});

// ── assertVotosShard ─────────────────────────────────────────────────────────
function shardValido(): VotosShard {
  return {
    eleccionId: 'internas-2024', departamento: 'montevideo', nivel: 'zona',
    escrutinio: 'definitivo', tipo: 'internas',
    zonas: [{
      geoId: 'Z1', ganadorOpcionId: 'odd-pn-5', validos: 100,
      porOpcion: [{ opcionId: 'odd-pn-5', votos: 60 }, { opcionId: 'odd-fa-9', votos: 40 }],
      noPartidarios: { enBlanco: 0, anulados: 0, observados: 0 },
    }],
  } as VotosShard;
}

describe('assertVotosShard', () => {
  it('un shard válido no lanza', () => {
    expect(() => assertVotosShard(shardValido())).not.toThrow();
  });
  it('escrutinio no definitivo lanza', () => {
    const s = { ...shardValido(), escrutinio: 'primario' } as VotosShard;
    expect(() => assertVotosShard(s)).toThrow(ContractError);
  });
  it('votos negativos lanzan', () => {
    const s = shardValido();
    (s.zonas[0].porOpcion as { opcionId: string; votos: number }[])[1].votos = -1;
    expect(() => assertVotosShard(s)).toThrow(/negativos/);
  });
  it('ganador que no es el de más votos lanza', () => {
    const s = shardValido();
    (s.zonas[0] as { ganadorOpcionId: string }).ganadorOpcionId = 'odd-fa-9'; // 40 < 60
    expect(() => assertVotosShard(s)).toThrow(/no es el de más votos/);
  });
  it('geoId duplicado lanza', () => {
    const s = shardValido();
    (s.zonas as unknown[]).push(JSON.parse(JSON.stringify(s.zonas[0])));
    expect(() => assertVotosShard(s)).toThrow(/duplicado/);
  });
});

// ── assertCatalogoConsistente (valida las invariantes del sublema/precandidato) ──
// Sin anotar el retorno → infiere arrays MUTABLES (los tipos del contrato son readonly).
// Se castea a CatalogoOpciones en cada call-site del assert.
function catValido() {
  return {
    eleccionId: 'internas-2024', departamento: 'montevideo',
    contiendas: [{
      contienda: 'odd', niveles: ['lema', 'sublema', 'hoja'],
      nodos: [
        { id: 'pn', nivel: 'lema', etiqueta: 'Partido Nacional' },
        { id: 'pn-sl-a', nivel: 'sublema', etiqueta: 'SUB A', parentId: 'pn' },
      ],
      opciones: [
        { clase: 'hoja', id: opcionIdHoja('odd', 'pn', '5'), hoja: '5', lemaId: 'pn', contienda: 'odd', sublemaId: 'pn-sl-a', grupoId: 'pn-sl-a' },
      ],
    }],
  };
}
const comoCat = (c: ReturnType<typeof catValido>): CatalogoOpciones => c as unknown as CatalogoOpciones;

describe('assertCatalogoConsistente', () => {
  it('catálogo con sublema válido no lanza', () => {
    expect(() => assertCatalogoConsistente(comoCat(catValido()))).not.toThrow();
  });
  it('sublemaId colgando de un nodo inexistente lanza', () => {
    const c = catValido();
    (c.contiendas[0].opciones[0] as { sublemaId?: string }).sublemaId = 'fantasma';
    expect(() => assertCatalogoConsistente(comoCat(c))).toThrow(/sublema inexistente/);
  });
  it('id de hoja que no deriva de opcionIdHoja lanza', () => {
    const c = catValido();
    (c.contiendas[0].opciones[0] as { id: string }).id = 'odd-pn-999'; // hoja sigue siendo '5'
    expect(() => assertCatalogoConsistente(comoCat(c))).toThrow(/≠ derivado/);
  });
  it('escalera con precandidato exige precandidatoId en la hoja', () => {
    const c = catValido();
    c.contiendas[0].niveles = ['lema', 'precandidato', 'sublema', 'hoja'];
    // la hoja no tiene precandidatoId → debe lanzar
    expect(() => assertCatalogoConsistente(comoCat(c))).toThrow(/sin precandidatoId/);
  });
  it('opcion_id duplicado entre contiendas lanza', () => {
    const c = catValido();
    c.contiendas.push(JSON.parse(JSON.stringify(c.contiendas[0])));
    expect(() => assertCatalogoConsistente(comoCat(c))).toThrow(/opcion_id duplicado/);
  });
});

// ── assertHojasEnCatalogo ─────────────────────────────────────────────────────
describe('assertHojasEnCatalogo', () => {
  it('lanza si un opcionId del shard no está en el catálogo', () => {
    const shard = shardValido(); // usa 'odd-pn-5' y 'odd-fa-9'
    const cat = catValido();     // solo tiene 'odd-pn-5'
    expect(() => assertHojasEnCatalogo(shard, comoCat(cat))).toThrow(/no está en el catálogo/);
  });
});
