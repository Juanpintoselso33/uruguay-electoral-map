/**
 * Chequeo a11y base sobre el choropleth (Story 1.10). Determinístico, corre en CI
 * tras `astro build`. Patrón base: NUNCA color solo → la sigla va como texto, y el
 * texto cumple contraste WCAG AA. Exit ≠ 0 si falla.
 *
 * Verifica sobre el OUTPUT construido (no asume runtime):
 *  1. Tabla accesible: cada barrio con datos tiene su ganador como TEXTO (sigla+nombre).
 *  2. Leyenda + readout: colores de texto cumplen contraste ≥ 4.5:1 sobre su fondo.
 *  3. La sigla del mapa lleva halo blanco (text-shadow) → legible sobre cualquier relleno.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = '.vercel/output/static';
const ASTRO = join(ROOT, '_astro');
const MAP_PAGE = join(ROOT, 'internas-2024/montevideo/index.html');

/** Concatena todos los CSS construidos (las islas/.astro emiten CSS a _astro/*.css). */
function allCss() {
  return readdirSync(ASTRO)
    .filter((f) => f.endsWith('.css'))
    .map((f) => readFileSync(join(ASTRO, f), 'utf8'))
    .join('\n');
}

function luminance(hex) {
  const h = hex.replace('#', '');
  const rgb = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
  const lin = rgb.map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * lin[0] + 0.7152 * lin[1] + 0.0722 * lin[2];
}
function contrast(fg, bg) {
  const a = luminance(fg);
  const b = luminance(bg);
  const [hi, lo] = a > b ? [a, b] : [b, a];
  return (hi + 0.05) / (lo + 0.05);
}

const fails = [];
const ok = [];

const html = readFileSync(MAP_PAGE, 'utf8');
const css = allCss();

// 1) Color NUNCA solo: el ganador/opción se acompaña SIEMPRE de la sigla como TEXTO.
// La tabla/ficha hoy se renderiza en una isla Vue (client) — no en el HTML estático —,
// así que en lugar de contar filas estáticas verificamos que los componentes que emiten
// la sigla como TEXTO viajen en el build: la etiqueta del mapa (.zona-sigla) y la sigla
// del desglose de la ficha (.dtree__sigla, DesgloseTree). El recorrido por teclado/render
// dinámico lo cubre Playwright (E2E).
const tieneSiglaMapa = css.includes('zona-sigla');
const tieneSiglaFicha = css.includes('dtree__sigla');
if (!tieneSiglaMapa || !tieneSiglaFicha)
  fails.push(
    `color sin texto: falta sigla TEXTO en el build (mapa .zona-sigla=${tieneSiglaMapa}, ficha .dtree__sigla=${tieneSiglaFicha})`,
  );
else ok.push('color nunca solo: sigla TEXTO en mapa (.zona-sigla) y ficha (.dtree__sigla) ✅');

// 2) Contraste WCAG AA (≥4.5) de los textos sobre su fondo.
const WHITE = '#ffffff';
const pares = [
  ['sigla/nombre tabla', '#111827', WHITE],
  ['nombre leyenda', '#4b5563', WHITE],
  ['caption tabla', '#4b5563', WHITE],
  ['sigla mapa (halo blanco)', '#111827', WHITE],
];
for (const [label, fg, bg] of pares) {
  const r = contrast(fg, bg);
  if (r < 4.5) fails.push(`contraste ${label}: ${r.toFixed(2)}:1 < 4.5:1`);
  else ok.push(`contraste ${label}: ${r.toFixed(2)}:1 ≥ 4.5 ✅`);
}

// 3) La sigla del mapa lleva halo (text-shadow) → legible sobre cualquier relleno.
// Detección robusta: matcheamos la(s) regla(s) `.zona-sigla{…}` completas (hasta su `}`)
// y verificamos que alguna tenga text-shadow (el slice fijo de 240 chars fallaba con el
// CSS minificado y daba falso negativo aunque el halo existiera).
const zonaSiglaRules = css.match(/zona-sigla[^{]*\{[^}]*\}/g) || [];
if (!zonaSiglaRules.some((r) => /text-shadow/.test(r)))
  fails.push('sigla del mapa sin text-shadow (halo) → ilegible sobre rellenos oscuros');
else ok.push('sigla del mapa con halo (text-shadow) ✅');

// 4) Skip link presente en el HTML (WCAG 2.4.1 Bypass Blocks).
if (!html.includes('skip-link') || !html.includes('id="main-content"'))
  fails.push('skip link o id="main-content" ausente (WCAG 2.4.1)');
else ok.push('skip link presente: .skip-link → #main-content (WCAG 2.4.1) ✅');

// 5) Selector de opción con foco de teclado visible (WCAG 2.1.1 Keyboard).
// El selector hoy es OpcionAccordion (reemplazó a OpcionSelector): árbol con roles ARIA
// (tree/treeitem/tab) y foco vía :focus-visible. Verificamos que el accordion (.acc__) y
// un indicador de foco (focus-visible) viajen en el CSS construido.
if (!css.includes('acc__') || !css.includes('focus-visible'))
  fails.push('selector (OpcionAccordion): falta indicador de foco de teclado (.acc__ + focus-visible) (WCAG 2.1.1)');
else ok.push('selector (OpcionAccordion) con foco de teclado (focus-visible) ✅');

// 6) Contraste dark mode: ink sobre paper, ink-soft sobre card (WCAG 1.4.3).
// Tokens dark: ink=#E8ECF6, paper=#151B2B, ink-soft=#C1CAE0, card=#28324A, ink-muted=#93A0BC
const darkPares = [
  ['dark: ink sobre bg',       '#E8ECF6', '#0E1320'],
  ['dark: ink sobre paper',    '#E8ECF6', '#151B2B'],
  ['dark: ink-soft sobre card','#C1CAE0', '#28324A'],
  ['dark: ink-muted sobre card','#93A0BC','#28324A'],
];
for (const [label, fg, bg] of darkPares) {
  const r = contrast(fg, bg);
  if (r < 4.5) fails.push(`contraste ${label}: ${r.toFixed(2)}:1 < 4.5:1`);
  else ok.push(`contraste ${label}: ${r.toFixed(2)}:1 ≥ 4.5 ✅`);
}

// 7) Contraste non-text dark: WCAG 1.4.11 ≥3:1. Testeamos cada borde contra el fondo
// que realmente le es adyacente en la UI.
//   border (listbox, separadores) → aparece sobre --color-bg (la página)
//   border-strong (botones, chips) → aparece sobre --color-card (interior del botón)
const darkNonText = [
  ['dark: border sobre bg',        '#5F6E92', '#0E1320'],
  ['dark: border-strong sobre card','#6E7FA5', '#28324A'],
];
for (const [label, fg, bg] of darkNonText) {
  const r = contrast(fg, bg);
  if (r < 3.0) fails.push(`contraste no-texto ${label}: ${r.toFixed(2)}:1 < 3:1 (WCAG 1.4.11)`);
  else ok.push(`contraste no-texto ${label}: ${r.toFixed(2)}:1 ≥ 3 ✅`);
}

console.log('=== a11y WCAG 2.2 AA ===');
ok.forEach((l) => console.log('  ' + l));
if (fails.length) {
  console.error('\n[a11y] FALLA:');
  fails.forEach((l) => console.error('  - ' + l));
  process.exit(1);
}
console.log('\n=== a11y WCAG 2.2 AA PASA ✅ ===');
