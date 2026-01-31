/**
 * Official party colors for Uruguay political parties
 *
 * IMPORTANT: Partido Nacional is CELESTE (light blue), NOT white!
 * IMPORTANT: Frente Amplio uses a lighter violet/purple color
 *
 * Source: tailwind.config.js (single source of truth)
 */

export const PARTY_COLORS = {
  // Main parties - Full names
  'FRENTE AMPLIO': '#A569BD',          // Violeta claro
  'PARTIDO NACIONAL': '#55B5E5',       // Celeste (NOT white!)
  'PARTIDO COLORADO': '#E52828',       // Rojo
  'PARTIDO INDEPENDIENTE': '#7B2CBF',  // Morado oscuro
  'CABILDO ABIERTO': '#2D7D3E',        // Verde

  // Other parties with assigned colors
  'ASAMBLEA POPULAR': '#C0392B',       // Rojo oscuro
  'AVANZAR REPUBLICANO': '#1ABC9C',    // Turquesa
  'BASTA YA': '#F39C12',               // Naranja dorado
  'COALICIÓN REPUBLICANA': '#3498DB',  // Azul
  'CONSTITUCIONAL AMBIENTALISTA': '#27AE60', // Verde claro
  'DEVOLUCIÓN': '#8E44AD',             // Púrpura
  'IDENTIDAD SOBERANA': '#D35400',     // Naranja oscuro
  'INDEPENDIENTE': '#95A5A6',          // Gris
  'LIBERTARIO': '#F1C40F',             // Amarillo
  'P.E.R.I.': '#E74C3C',               // Coral
  'PARTIDO DE LA ARMONÍA': '#9B59B6',  // Lila
  'PATRIA ALTERNATIVA': '#16A085',     // Verde azulado
  'POR LOS CAMBIOS NECESARIOS': '#2980B9', // Azul medio
  'VERDE ANIMALISTA': '#2ECC71',       // Verde brillante

  // Main parties - Abbreviations
  'FA': '#A569BD',
  'PN': '#55B5E5',
  'PC': '#E52828',
  'PI': '#7B2CBF',
  'CA': '#2D7D3E',

  // Other parties - Abbreviations
  'AP': '#C0392B',
  'AR': '#1ABC9C',
  'BY': '#F39C12',
  'CR': '#3498DB',
  'COA': '#27AE60',
  'DEV': '#8E44AD',
  'IS': '#D35400',
  'IND': '#95A5A6',
  'LIB': '#F1C40F',
  'PERI': '#E74C3C',
  'PA': '#9B59B6',
  'PAL': '#16A085',
  'PCN': '#2980B9',
  'PVA': '#2ECC71',

  // Lowercase variants for flexible matching (main parties)
  'frente amplio': '#A569BD',
  'partido nacional': '#55B5E5',
  'partido colorado': '#E52828',
  'partido independiente': '#7B2CBF',
  'cabildo abierto': '#2D7D3E',
  'fa': '#A569BD',
  'pn': '#55B5E5',
  'pc': '#E52828',
  'pi': '#7B2CBF',
  'ca': '#2D7D3E',

  // Lowercase variants for other parties
  'asamblea popular': '#C0392B',
  'avanzar republicano': '#1ABC9C',
  'basta ya': '#F39C12',
  'coalición republicana': '#3498DB',
  'constitucional ambientalista': '#27AE60',
  'devolución': '#8E44AD',
  'identidad soberana': '#D35400',
  'independiente': '#95A5A6',
  'libertario': '#F1C40F',
  'p.e.r.i.': '#E74C3C',
  'partido de la armonía': '#9B59B6',
  'patria alternativa': '#16A085',
  'por los cambios necesarios': '#2980B9',
  'verde animalista': '#2ECC71',
  'ap': '#C0392B',
  'ar': '#1ABC9C',
  'by': '#F39C12',
  'cr': '#3498DB',
  'coa': '#27AE60',
  'dev': '#8E44AD',
  'is': '#D35400',
  'ind': '#95A5A6',
  'lib': '#F1C40F',
  'peri': '#E74C3C',
  'pa': '#9B59B6',
  'pal': '#16A085',
  'pcn': '#2980B9',
  'pva': '#2ECC71',
} as const;

// Generate a deterministic "random" color for unknown parties based on party name
function hashStringToColor(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }

  // Generate hue from hash (0-360), use fixed saturation/lightness for nice colors
  const hue = Math.abs(hash % 360);
  const saturation = 65; // Nice saturation
  const lightness = 45;  // Good contrast

  return `hsl(${hue}, ${saturation}%, ${lightness}%)`;
}

/**
 * Get party color by name (case-insensitive)
 * @param partyName - Party name or abbreviation
 * @returns Hex color string or deterministic color based on party name
 */
export function getPartyColor(partyName: string): string {
  if (!partyName) return '#999999'; // Default gray for empty names

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
  if (normalized.includes('asamblea') || normalized.includes('popular')) {
    return PARTY_COLORS.AP;
  }
  if (normalized.includes('republicano')) {
    return PARTY_COLORS.AR;
  }
  if (normalized.includes('basta')) {
    return PARTY_COLORS.BY;
  }
  if (normalized.includes('coalición') || normalized.includes('coalicion')) {
    return PARTY_COLORS.CR;
  }
  if (normalized.includes('ambientalista')) {
    return PARTY_COLORS.COA;
  }
  if (normalized.includes('devolución') || normalized.includes('devolucion')) {
    return PARTY_COLORS.DEV;
  }
  if (normalized.includes('soberana')) {
    return PARTY_COLORS.IS;
  }
  if (normalized.includes('libertario')) {
    return PARTY_COLORS.LIB;
  }
  if (normalized.includes('peri') || normalized.includes('p.e.r.i')) {
    return PARTY_COLORS.PERI;
  }
  if (normalized.includes('armonía') || normalized.includes('armonia')) {
    return PARTY_COLORS.PA;
  }
  if (normalized.includes('alternativa')) {
    return PARTY_COLORS.PAL;
  }
  if (normalized.includes('cambios') || normalized.includes('necesarios')) {
    return PARTY_COLORS.PCN;
  }
  if (normalized.includes('verde') || normalized.includes('animalista')) {
    return PARTY_COLORS.PVA;
  }

  // Generate deterministic color for unknown parties
  return hashStringToColor(normalized);
}

/**
 * Tailwind CSS color names for party colors
 * Use these in Tailwind classes like: bg-party-fa, text-party-pn, etc.
 */
export const PARTY_TAILWIND_CLASSES = {
  // Main parties
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

  // Other parties
  'ASAMBLEA POPULAR': 'party-ap',
  'AVANZAR REPUBLICANO': 'party-ar',
  'BASTA YA': 'party-by',
  'COALICIÓN REPUBLICANA': 'party-cr',
  'CONSTITUCIONAL AMBIENTALISTA': 'party-coa',
  'DEVOLUCIÓN': 'party-dev',
  'IDENTIDAD SOBERANA': 'party-is',
  'INDEPENDIENTE': 'party-ind',
  'LIBERTARIO': 'party-lib',
  'P.E.R.I.': 'party-peri',
  'PARTIDO DE LA ARMONÍA': 'party-pa',
  'PATRIA ALTERNATIVA': 'party-pal',
  'POR LOS CAMBIOS NECESARIOS': 'party-pcn',
  'VERDE ANIMALISTA': 'party-pva',
  'AP': 'party-ap',
  'AR': 'party-ar',
  'BY': 'party-by',
  'CR': 'party-cr',
  'COA': 'party-coa',
  'DEV': 'party-dev',
  'IS': 'party-is',
  'IND': 'party-ind',
  'LIB': 'party-lib',
  'PERI': 'party-peri',
  'PA': 'party-pa',
  'PAL': 'party-pal',
  'PCN': 'party-pcn',
  'PVA': 'party-pva',
} as const;
