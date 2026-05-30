import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { geoMercator, geoPath } from "d3-geo";
import { Resvg } from "@resvg/resvg-js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const t0 = performance.now();

// ---- Config ----
const WIDTH = 1200;
const HEIGHT = 630;
const GEOJSON_PATH =
  "E:/Proyectos VS CODE/Uruguay Electoral Map/uruguay-electoral-map/public/montevideo_map.json";
const OUT_PATH = join(__dirname, "out", "montevideo-og.png");

// Solid winner colors (OG style: one solid fill per zone, no flag patterns)
const PARTIES = [
  { code: "FA", color: "#A569BD" },
  { code: "PN", color: "#55B5E5" },
  { code: "PC", color: "#E52828" },
  { code: "CA", color: "#2D7D3E" },
  { code: "PI", color: "#7B2CBF" },
];
const PAPER = "#F7F4EE";

// ---- Load GeoJSON ----
const geo = JSON.parse(readFileSync(GEOJSON_PATH, "utf8"));
const features = geo.features;

// ---- Projection: fit into a box leaving room for title bar at top ----
const projection = geoMercator().fitExtent(
  [
    [40, 90],
    [1160, 540],
  ],
  geo
);
const path = geoPath(projection);

// ---- Assign fake winners (cycle) ----
function escapeXml(s) {
  return String(s).replace(/[<>&'"]/g, (c) =>
    ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", "'": "&apos;", '"': "&quot;" }[c])
  );
}

const zonePaths = features
  .map((f, i) => {
    const d = path(f);
    if (!d) return ""; // skip un-projectable geometry
    const party = PARTIES[i % PARTIES.length];
    return `<path d="${d}" fill="${party.color}" stroke="${PAPER}" stroke-width="1" stroke-linejoin="round"/>`;
  })
  .filter(Boolean)
  .join("\n");

// ---- Legend ----
const legendItems = PARTIES.map((p, i) => {
  const x = 60 + i * 130;
  const y = 588;
  return (
    `<rect x="${x}" y="${y - 14}" width="18" height="18" rx="3" fill="${p.color}"/>` +
    `<text x="${x + 26}" y="${y}" font-family="Arial" font-size="20" fill="#3A3A3A">${p.code}</text>`
  );
}).join("\n");

// ---- SVG string ----
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}">
  <rect width="${WIDTH}" height="${HEIGHT}" fill="${PAPER}"/>
  <text x="60" y="56" font-family="Arial" font-size="40" font-weight="bold" fill="#1A1A1A">${escapeXml("Montevideo · Internas 2024")}</text>
  <text x="60" y="84" font-family="Arial" font-size="20" fill="#6B6B6B">${escapeXml("Corte Electoral — escrutinio definitivo")}</text>
  ${zonePaths}
  ${legendItems}
</svg>`;

writeFileSync(join(__dirname, "out", "montevideo-og.svg"), svg, "utf8");

// ---- Rasterize ----
const fontCandidates = ["C:/Windows/Fonts/arial.ttf", "C:/Windows/Fonts/segoeui.ttf"];
const fontFiles = fontCandidates.filter((f) => existsSync(f));

let png;
let fontNote = "";
try {
  const resvg = new Resvg(svg, {
    fitTo: { mode: "width", value: WIDTH },
    background: PAPER,
    font: {
      fontFiles,
      loadSystemFonts: true,
      defaultFontFamily: "Arial",
    },
  });
  png = resvg.render().asPng();
  fontNote = fontFiles.length
    ? `fonts loaded: ${fontFiles.join(", ")}`
    : "no explicit font files; relied on loadSystemFonts";
} catch (e) {
  // Text is the only risk — retry without fonts so the MAP still renders.
  fontNote = `FONT FAILURE (${e.message}); retried with loadSystemFonts only`;
  const resvg = new Resvg(svg, {
    fitTo: { mode: "width", value: WIDTH },
    background: PAPER,
    font: { loadSystemFonts: true },
  });
  png = resvg.render().asPng();
}

writeFileSync(OUT_PATH, png);

const t1 = performance.now();
console.log("OK");
console.log("PNG:", OUT_PATH);
console.log("bytes:", png.length);
console.log("features projected:", features.length, "paths emitted:", (svg.match(/<path /g) || []).length);
console.log("font note:", fontNote);
console.log("time ms:", (t1 - t0).toFixed(1));
