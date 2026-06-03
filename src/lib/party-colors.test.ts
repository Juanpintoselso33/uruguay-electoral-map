import { describe, it, expect } from 'vitest';
import { getPartyColor } from './party-colors';

const esHex6 = (s: string): boolean => /^#[0-9a-fA-F]{6}$/.test(s);

describe('getPartyColor', () => {
  it('nombre vacío → gris default', () => {
    expect(getPartyColor('')).toBe('#999999');
  });

  it('partido conocido → hex de 6 dígitos', () => {
    expect(esHex6(getPartyColor('Frente Amplio'))).toBe(true);
    expect(esHex6(getPartyColor('Partido Nacional'))).toBe(true);
  });

  it('es determinístico (mismo nombre → mismo color)', () => {
    expect(getPartyColor('Partido Colorado')).toBe(getPartyColor('Partido Colorado'));
  });

  it('fuzzy: variaciones del mismo lema resuelven al mismo color', () => {
    expect(getPartyColor('el frente amplio')).toBe(getPartyColor('Frente Amplio'));
    expect(getPartyColor('los blancos')).toBe(getPartyColor('Partido Nacional')); // 'blanco' → PN
  });
});
