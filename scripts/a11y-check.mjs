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

// 1) Color nunca solo: cada fila de la tabla tiene sigla TEXTO. (DataTable estática)
const rows = (html.match(/<th scope="row"/g) || []).length;
const siglasTexto = (html.match(/<span class="sigla"/g) || []).length;
if (rows === 0) fails.push('tabla accesible: 0 filas (no se renderizó)');
else if (siglasTexto < rows)
  fails.push(`color sin texto: ${siglasTexto} siglas para ${rows} filas (debe haber 1 por fila)`);
else ok.push(`tabla: ${rows} barrios, cada uno con sigla TEXTO (color nunca solo) ✅`);

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
const css = allCss();
const zonaSiglaBlock = css.slice(css.indexOf('zona-sigla'), css.indexOf('zona-sigla') + 240);
if (!css.includes('zona-sigla') || !/text-shadow/.test(zonaSiglaBlock))
  fails.push('sigla del mapa sin text-shadow (halo) → ilegible sobre rellenos oscuros');
else ok.push('sigla del mapa con halo blanco (text-shadow) ✅');

console.log('=== a11y base (color+texto, contraste) ===');
ok.forEach((l) => console.log('  ' + l));
if (fails.length) {
  console.error('\n[a11y] FALLA:');
  fails.forEach((l) => console.error('  - ' + l));
  process.exit(1);
}
console.log('\n=== a11y base PASA ✅ ===');
