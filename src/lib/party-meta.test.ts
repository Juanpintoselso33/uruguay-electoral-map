import { describe, it, expect } from 'vitest';
import { resolveParty } from './party-meta';

const esHex = (s: string): boolean => /^#[0-9a-fA-F]{3,8}$/.test(s);

describe('resolveParty — sigla/color/flag', () => {
  it('partido conocido: sigla canónica + bandera + color hex', () => {
    const fa = resolveParty('Frente Amplio');
    expect(fa.sigla).toBe('FA');
    expect(fa.flagUrl).toBe('/flags/fa.svg');
    expect(esHex(fa.color)).toBe(true);
  });

  it('tolera el prefijo "PARTIDO " que varía entre elecciones', () => {
    expect(resolveParty('PARTIDO NACIONAL').sigla).toBe('PN');
    expect(resolveParty('Nacional').sigla).toBe('PN');
    expect(resolveParty('Partido Colorado').sigla).toBe('PC');
  });

  it('acrónimo determinístico como fallback (ignora DE/LA/…)', () => {
    expect(resolveParty('Movimiento Tres Banderas').sigla).toBe('MTB');
  });
});

describe('resolveParty — Sí/No por papeleta', () => {
  it('usa el color de la papeleta de la iniciativa', () => {
    const si = resolveParty('Si', 'plebiscito-allanamientos-2024');
    expect(si.sigla).toBe('Sí');
    expect(si.color.toUpperCase()).toBe('#F2C200'); // papeleta amarilla
    expect(resolveParty('No', 'plebiscito-allanamientos-2024').sigla).toBe('No');
  });

  it('sin elección → fallback Sí verde / No gris', () => {
    expect(resolveParty('Sí').color).toBe('#16a34a');
    expect(resolveParty('No').color).toBe('#94a3b8');
  });

  it('normaliza acentos: "Sí" y "SI" resuelven igual', () => {
    expect(resolveParty('Sí').sigla).toBe(resolveParty('SI').sigla);
  });
});
