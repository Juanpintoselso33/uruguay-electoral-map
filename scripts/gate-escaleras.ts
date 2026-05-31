/**
 * Gate de escalera (Story 10.10, AC3/AC4) — la red de seguridad de Epic 10.
 *
 * Garantiza que ningún tipo de elección quede sin su escalera de granularidad y que
 * la UI nunca ofrezca un nivel que la escalera no declara ("no hay selector de HOJA en
 * un balotaje"). Dos chequeos:
 *
 *  A) Consistencia interna de ESCALERAS: cada `EleccionTipo` declara ≥1 escalera, sin
 *     duplicados (tipo,contienda), terminal = unidad de voto (hoja/candidato/binaria),
 *     y los tipos planos (balotaje/plebiscito) tienen escalera de 1 nivel.
 *  B) Gate dirigido por dato: para cada `catalogo.json` emitido, leer el `tipo` del
 *     `votes.json` hermano y verificar que cada contienda declara `niveles ===
 *     escaleraDe(tipo, contienda)`. Si una (tipo,contienda) USADA falta en ESCALERAS,
 *     o sus niveles difieren, el build falla (exit≠0).
 *
 * Ejecuta en `npm run build` (antes de `astro build`). Standalone: `npm run gate:escaleras`.
 */
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import type { EleccionTipo } from '../src/lib/contracts';
import { ESCALERAS, escaleraDe } from '../src/lib/contracts/granularidad';

const DATA_ROOT = 'public/data';
const TIPOS: EleccionTipo[] = ['internas', 'nacionales', 'balotaje', 'departamentales', 'plebiscito'];
const UNIDAD_VOTO = new Set(['hoja', 'candidato', 'binaria']);

const errores: string[] = [];

// ── A) Consistencia interna de ESCALERAS ────────────────────────────────────────
function gateEscalerasInternas(): void {
  for (const t of TIPOS) {
    if (!ESCALERAS.some((e) => e.tipo === t)) errores.push(`A: el tipo '${t}' no declara ninguna escalera`);
  }
  const vistos = new Set<string>();
  for (const e of ESCALERAS) {
    const k = `${e.tipo}/${e.contienda}`;
    if (vistos.has(k)) errores.push(`A: escalera duplicada (${k})`);
    vistos.add(k);
    if (e.niveles.length === 0) { errores.push(`A: escalera (${k}) vacía`); continue; }
    const terminal = e.niveles[e.niveles.length - 1];
    if (!UNIDAD_VOTO.has(terminal)) errores.push(`A: escalera (${k}) no termina en unidad de voto (${terminal})`);
    if ((e.tipo === 'balotaje' || e.tipo === 'plebiscito') && e.niveles.length !== 1) {
      errores.push(`A: tipo plano '${e.tipo}' debe tener escalera de 1 nivel (${k} = ${e.niveles.join('>')})`);
    }
  }
}

// ── B) Gate dirigido por los catalogo.json emitidos ──────────────────────────────
function listarCatalogos(dir: string, out: string[]): void {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) listarCatalogos(p, out);
    else if (name === 'catalogo.json') out.push(p);
  }
}

/** `sub` es subsecuencia de `full` (mismo orden, sin agregar niveles ajenos). */
function esSubsecuencia(sub: readonly string[], full: readonly string[]): boolean {
  let i = 0;
  for (const n of full) if (i < sub.length && sub[i] === n) i++;
  return i === sub.length;
}

function gateCatalogos(): number {
  const catalogos: string[] = [];
  if (existsSync(DATA_ROOT)) listarCatalogos(DATA_ROOT, catalogos);
  for (const ruta of catalogos) {
    const dir = ruta.slice(0, -'catalogo.json'.length);
    const votesPath = join(dir, 'votes.json');
    if (!existsSync(votesPath)) { errores.push(`B: ${ruta} sin votes.json hermano (no se puede inferir tipo)`); continue; }
    const tipo = (JSON.parse(readFileSync(votesPath, 'utf8')) as { tipo: EleccionTipo }).tipo;
    const cat = JSON.parse(readFileSync(ruta, 'utf8')) as {
      contiendas: { contienda: string; niveles: string[]; degradado?: boolean }[];
    };
    for (const c of cat.contiendas) {
      const esc = escaleraDe(tipo, c.contienda as never);
      if (!esc) {
        errores.push(`B: ${ruta} usa (tipo='${tipo}', contienda='${c.contienda}') que NO está en ESCALERAS`);
        continue;
      }
      // Catálogo degradado (falta dato de un nivel intermedio, p. ej. nacionales sin sublema):
      // sus niveles deben ser SUBSECUENCIA de la escalera (solo se omiten niveles, nunca se agregan)
      // y conservar el terminal. Así la UI nunca ofrece un nivel fuera de la escalera (AC4).
      const ok = c.degradado
        ? esSubsecuencia(c.niveles, esc) && c.niveles[c.niveles.length - 1] === esc[esc.length - 1]
        : JSON.stringify(c.niveles) === JSON.stringify([...esc]);
      if (!ok) {
        errores.push(
          `B: ${ruta} contienda '${c.contienda}'${c.degradado ? ' (degradado)' : ''}: ` +
            `niveles [${c.niveles.join('>')}] no conforman la escalera [${esc.join('>')}]`,
        );
      }
    }
  }
  return catalogos.length;
}

function main(): void {
  console.log('=== Gate de escalera (Story 10.10) ===');
  gateEscalerasInternas();
  const n = gateCatalogos();
  if (errores.length > 0) {
    console.error(`✗ ${errores.length} violación(es) de escalera:`);
    for (const e of errores) console.error(`  - ${e}`);
    process.exit(1);
  }
  console.log(`✓ ESCALERAS consistente (${ESCALERAS.length} escaleras, ${TIPOS.length} tipos) y ${n} catálogo(s) conformes.`);
}

main();
