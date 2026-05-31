/**
 * ETL — Tabla de normalización de opciones entre elecciones (Story 6.4, FR32).
 *
 * Genera una tabla que mapea opcionIds equivalentes entre dos elecciones del mismo
 * departamento. La equivalencia se determina por sigla canónica (resolveParty).
 * Esto resuelve casos como "Partido Colorado" (internas-2024) ↔ "Colorado" (nacionales-2019)
 * que tienen distinto nombre pero son la misma entidad política (sigla PC).
 *
 * Output por par de elecciones × departamento:
 *   public/data/hoja-equivalencias/{dept}/{eleccionA}-{eleccionB}.json
 *
 * Formato:
 *   { eleccionA, eleccionB, departamento, mappings: [{ aId, bId, sigla, nombre }] }
 */
import { mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { dirname } from 'node:path';

function norm(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9 ]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

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
  'PARTIDO AVANZAR REPUBLICANO': 'AR',
  'COALICION REPUBLICANA': 'CR',
  'PARTIDO COALICION REPUBLICANA': 'CR',
  'IDENTIDAD SOBERANA': 'IS',
  'PARTIDO IDENTIDAD SOBERANA': 'IS',
  LIBERTARIO: 'LIB',
  'PARTIDO LIBERTARIO': 'LIB',
  'VERDE ANIMALISTA': 'PVA',
  'PARTIDO VERDE ANIMALISTA': 'PVA',
  'CONSTITUCIONAL AMBIENTALISTA': 'PCA',
  'PARTIDO CONSTITUCIONAL AMBIENTALISTA': 'PCA',
  'BASTA YA': 'BY',
  'PARTIDO BASTA YA': 'BY',
  DEVOLUCION: 'DEV',
  'PARTIDO DEVOLUCION': 'DEV',
  'PATRIA ALTERNATIVA': 'PA',
  'PARTIDO DE LA ARMONIA': 'PAR',
  'POR LOS CAMBIOS NECESARIOS': 'PCN',
  PERI: 'PERI',
  'ECOLOGISTA RADICAL INTRANSIGENTE': 'PERI',
  'PARTIDO ECOLOGISTA RADICAL INTRANSIGENTE': 'PERI',
  'DE LOS TRABAJADORES': 'PT',
  'DE LA GENTE': 'PDG',
  DIGITAL: 'PD',
};

const PALABRAS_IGNORADAS = new Set(['DE', 'LA', 'LOS', 'LAS', 'EL', 'Y', 'DEL', 'PARTIDO']);

function acronimo(nombre: string): string {
  const limpio = norm(nombre);
  const palabras = limpio.split(' ').filter((w) => w && !PALABRAS_IGNORADAS.has(w));
  if (palabras.length === 0) return limpio.slice(0, 4) || '?';
  if (palabras.length === 1) return palabras[0].slice(0, 3);
  return palabras.map((w) => w[0]).join('').slice(0, 4);
}

function siglaFor(nombre: string): string {
  const key = norm(nombre);
  return SIGLAS[key] ?? acronimo(nombre);
}

interface OpcionEntry { opcionId: string; nombre: string }
interface OpcionesDoc { opciones: OpcionEntry[] }
interface EquivalenciaEntry { aId: string; bId: string; sigla: string; nombreA: string; nombreB: string }
interface EquivalenciasDoc {
  eleccionA: string;
  eleccionB: string;
  departamento: string;
  mappings: EquivalenciaEntry[];
  /** Opciones en A sin equivalencia en B */
  soloA: string[];
  /** Opciones en B sin equivalencia en A */
  soloB: string[];
}

function loadOpciones(path: string): OpcionEntry[] {
  if (!existsSync(path)) return [];
  const doc = JSON.parse(readFileSync(path, 'utf8')) as OpcionesDoc;
  return doc.opciones;
}

/** Genera la tabla de equivalencias para un par de elecciones × departamento. */
function buildEquivalencias(
  dept: string,
  eleccionA: string,
  eleccionB: string,
): EquivalenciasDoc | null {
  const opcionesA = loadOpciones(`public/data/${eleccionA}/${dept}/opciones.json`);
  const opcionesB = loadOpciones(`public/data/${eleccionB}/${dept}/opciones.json`);
  if (opcionesA.length === 0 || opcionesB.length === 0) return null;

  // Agrupar B por sigla → opcionId preferido (el más corto, sin "partido-" prefix, gana)
  const bBySigla = new Map<string, OpcionEntry>();
  for (const opc of opcionesB) {
    const s = siglaFor(opc.nombre);
    const prev = bBySigla.get(s);
    // Preferir el id más corto (sin prefijo "partido-") como representante canónico
    if (!prev || opc.opcionId.length < prev.opcionId.length) {
      bBySigla.set(s, opc);
    }
  }

  // Para A, también construir mapa sigla → opcionId preferido
  const aBySigla = new Map<string, OpcionEntry>();
  for (const opc of opcionesA) {
    const s = siglaFor(opc.nombre);
    const prev = aBySigla.get(s);
    if (!prev || opc.opcionId.length < prev.opcionId.length) {
      aBySigla.set(s, opc);
    }
  }

  const mappings: EquivalenciaEntry[] = [];
  const matchedBSiglas = new Set<string>();

  for (const [sigla, aOpc] of aBySigla) {
    const bOpc = bBySigla.get(sigla);
    if (bOpc) {
      mappings.push({ aId: aOpc.opcionId, bId: bOpc.opcionId, sigla, nombreA: aOpc.nombre, nombreB: bOpc.nombre });
      matchedBSiglas.add(sigla);
    }
  }

  const soloA = [...aBySigla.entries()]
    .filter(([s]) => !bBySigla.has(s))
    .map(([, o]) => o.opcionId);

  const soloB = [...bBySigla.entries()]
    .filter(([s]) => !matchedBSiglas.has(s))
    .map(([, o]) => o.opcionId);

  return { eleccionA, eleccionB, departamento: dept, mappings, soloA, soloB };
}

// Detectar todos los deptos con múltiples elecciones a partir de la estructura de carpetas
import deptsConfig from '../src/config/departments.json';

interface DeptEntry { id: string; label: string; elecciones: string[] }
const depts = deptsConfig as DeptEntry[];

let generated = 0;
for (const dept of depts) {
  if (dept.elecciones.length < 2) continue;
  const elecciones = dept.elecciones;
  // Generar tabla para cada par ordenado
  for (let i = 0; i < elecciones.length; i++) {
    for (let j = i + 1; j < elecciones.length; j++) {
      const doc = buildEquivalencias(dept.id, elecciones[i], elecciones[j]);
      if (!doc) {
        console.warn(`  ⚠ Sin datos para ${dept.id}: ${elecciones[i]} ↔ ${elecciones[j]}`);
        continue;
      }
      const out = `public/data/hoja-equivalencias/${dept.id}/${elecciones[i]}-${elecciones[j]}.json`;
      mkdirSync(dirname(out), { recursive: true });
      writeFileSync(out, JSON.stringify(doc, null, 2), 'utf8');
      console.log(`  ✓ ${out}`);
      console.log(`    ${doc.mappings.length} equivalencias | soloA: ${doc.soloA.length} | soloB: ${doc.soloB.length}`);
      doc.mappings.forEach((m) => console.log(`    ${m.sigla}: ${m.aId} ↔ ${m.bId}`));
      generated++;
    }
  }
}

console.log(`\n=== hoja-equivalencias: ${generated} archivo(s) generado(s) ===`);
