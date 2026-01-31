/**
 * Official party colors for Uruguay political parties
 *
 * IMPORTANT: Partido Nacional is CELESTE (light blue), NOT white!
 *
 * Source: tailwind.config.js (single source of truth)
 */

export const PARTY_COLORS = {
  // Full names
  'FRENTE AMPLIO': '#E63946',          // Rojo/Rosado (Tricolor de Artigas)
  'PARTIDO NACIONAL': '#55B5E5',       // Celeste (NOT white!)
  'PARTIDO COLORADO': '#E52828',       // Rojo
  'PARTIDO INDEPENDIENTE': '#7B2CBF',  // Morado
  'CABILDO ABIERTO': '#2D7D3E',        // Verde

  // Abbreviations (case-insensitive key variants)
  'FA': '#E63946',
  'PN': '#55B5E5',
  'PC': '#E52828',
  'PI': '#7B2CBF',
  'CA': '#2D7D3E',

  // Lowercase variants for flexible matching
  'frente amplio': '#E63946',
  'partido nacional': '#55B5E5',
  'partido colorado': '#E52828',
  'partido independiente': '#7B2CBF',
  'cabildo abierto': '#2D7D3E',
  'fa': '#E63946',
  'pn': '#55B5E5',
  'pc': '#E52828',
  'pi': '#7B2CBF',
  'ca': '#2D7D3E',
} as const;

/**
 * Get party color by name (case-insensitive)
 * @param partyName - Party name or abbreviation
 * @returns Hex color string or default gray if not found
 */
export function getPartyColor(partyName: string): string {
  if (!partyName) return '#999999'; // Default gray for unknown parties

  // Try exact match first
  if (partyName in PARTY_COLORS) {
    return PARTY_COLORS[partyName as keyof typeof PARTY_COLORS];
  }

  // Try case-insensitive match
  const normalized = partyName.toLowerCase();
  if (normalized in PARTY_COLORS) {
    return PARTY_COLORS[normalized as keyof typeof PARTY_COLORS];
  }

  // Fuzzy match for common variations
  if (normalized.includes('frente') || normalized.includes('amplio')) {
    return PARTY_COLORS.FA;
  }
  if (normalized.includes('nacional') || normalized.includes('blanco')) {
    return PARTY_COLORS.PN;
  }
  if (normalized.includes('colorado')) {
    return PARTY_COLORS.PC;
  }
  if (normalized.includes('independiente')) {
    return PARTY_COLORS.PI;
  }
  if (normalized.includes('cabildo')) {
    return PARTY_COLORS.CA;
  }

  return '#999999'; // Default gray
}

/**
 * Tailwind CSS color names for party colors
 * Use these in Tailwind classes like: bg-party-fa, text-party-pn, etc.
 */
export const PARTY_TAILWIND_CLASSES = {
  'FRENTE AMPLIO': 'party-fa',
  'PARTIDO NACIONAL': 'party-pn',
  'PARTIDO COLORADO': 'party-pc',
  'PARTIDO INDEPENDIENTE': 'party-pi',
  'CABILDO ABIERTO': 'party-ca',
  'FA': 'party-fa',
  'PN': 'party-pn',
  'PC': 'party-pc',
  'PI': 'party-pi',
  'CA': 'party-ca',
} as const;
