/**
 * Metadata de presentación de partidos: sigla + color (Story 1.8).
 * El color reusa `party-colors.ts` (fuente de verdad de colores oficiales). La sigla
 * es conocimiento de presentación: mapa explícito para los partidos principales,
 * acrónimo determinístico como fallback. NUNCA solo color → la sigla va como texto.
 */
import { getPartyColor } from './party-colors';

function norm(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9 ]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Siglas canónicas (nombre normalizado → sigla). Cubre los partidos relevantes de Uruguay. */
const SIGLAS: Record<string, string> = {
  'FRENTE AMPLIO': 'FA',
  NACIONAL: 'PN',
  'PARTIDO NACIONAL': 'PN',
  COLORADO: 'PC',
  'PARTIDO COLORADO': 'PC',
  'CABILDO ABIERTO': 'CA',
  'PARTIDO INDEPENDIENTE': 'PI',
  INDEPENDIENTE: 'PI',
  'ASAMBLEA POPULAR': 'AP',
  'AVANZAR REPUBLICANO': 'AR',
  'COALICION REPUBLICANA': 'CR',
  'IDENTIDAD SOBERANA': 'IS',
  LIBERTARIO: 'LIB',
  'VERDE ANIMALISTA': 'PVA',
  'CONSTITUCIONAL AMBIENTALISTA': 'PCA',
  'BASTA YA': 'BY',
  DEVOLUCION: 'DEV',
  'PATRIA ALTERNATIVA': 'PA',
  'PARTIDO DE LA ARMONIA': 'PAR',
  'POR LOS CAMBIOS NECESARIOS': 'PCN',
  'POR LOS CAMBIOS NECESARIOS PCN': 'PCN', // el nombre a veces trae "(PCN)" al final
  PERI: 'PERI',
  'ECOLOGISTA RADICAL INTRANSIGENTE': 'PERI', // PERI aparece así en varias elecciones
  'PARTIDO DE LA GENTE': 'PG',
  'DE LA GENTE': 'PG', // nacionales-2019 trae "de la Gente" sin "Partido"
  'PARTIDO DIGITAL': 'PD',
  DIGITAL: 'PD',
  'PARTIDO DE LOS TRABAJADORES': 'PT',
  'DE LOS TRABAJADORES': 'PT',
};

const PALABRAS_IGNORADAS = new Set(['DE', 'LA', 'LOS', 'LAS', 'EL', 'Y', 'DEL']);

/** Acrónimo determinístico: iniciales de palabras significativas (máx 4). */
function acronimo(nombre: string): string {
  const limpio = norm(nombre).replace(/[^A-Z0-9 ]/g, '');
  const palabras = limpio.split(' ').filter((w) => w && !PALABRAS_IGNORADAS.has(w));
  if (palabras.length === 0) return limpio.slice(0, 4) || '?';
  if (palabras.length === 1) return palabras[0].slice(0, 3);
  return palabras.map((w) => w[0]).join('').slice(0, 4);
}

/** Mapa de sigla canónica → ruta del SVG de bandera/logo en /flags/. */
const FLAGS: Record<string, string> = {
  FA:  '/flags/fa.svg',
  PN:  '/flags/pn.svg',
  PC:  '/flags/pc.svg',
  CA:  '/flags/ca.svg',
  PI:  '/flags/pi.svg',
  CR:  '/flags/cr.svg',
  IS:  '/flags/is.svg',
  AP:  '/flags/ap.svg',
  PERI: '/flags/peri.svg',
  PCA: '/flags/pca.svg',
  AR:  '/flags/ar.svg',
  PCN: '/flags/pcn.svg',
  PVA: '/flags/pva.svg',
  PG:  '/flags/pg.svg',
  PD:  '/flags/pd.svg',
  PT:  '/flags/pt.svg',
};

export interface PartyMeta {
  readonly sigla: string;
  readonly color: string;
  /** URL relativa al SVG de bandera/logo del partido, si existe. */
  readonly flagUrl: string | null;
}

/** Resuelve la sigla tolerando el prefijo "PARTIDO " que varía entre elecciones
 *  (p. ej. "Partido Avanzar Republicano" vs "Avanzar Republicano"). */
function siglaDe(key: string): string | undefined {
  return SIGLAS[key] ?? (key.startsWith('PARTIDO ') ? SIGLAS[key.slice(8)] : undefined);
}

/** Resuelve sigla + color + flagUrl para un nombre de partido/opción (nombre original del ETL). */
export function resolveParty(nombre: string): PartyMeta {
  const key = norm(nombre);
  // Opción binaria de plebiscito/referéndum (Sí/No): Sí verde, No gris neutro (status quo).
  if (key === 'SI') return { sigla: 'Sí', color: '#16a34a', flagUrl: null };
  if (key === 'NO') return { sigla: 'No', color: '#94a3b8', flagUrl: null };
  const sigla = siglaDe(key) ?? acronimo(nombre);
  return { sigla, color: getPartyColor(nombre), flagUrl: FLAGS[sigla] ?? null };
}
