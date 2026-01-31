#!/usr/bin/env node

/**
 * Creates CRV → BARRIO mapping for Montevideo
 *
 * Strategy:
 * 1. Build CRV → SERIES from plan_circuital_2024.csv
 * 2. Build SERIES → BARRIO using spatial intersection of polygons
 * 3. Chain them: CRV → SERIES → BARRIO
 */

import fs from 'fs';
import path from 'path';
import Papa from 'papaparse';
import intersect from '@turf/intersect';
import area from '@turf/area';
import booleanIntersects from '@turf/boolean-intersects';
import { featureCollection } from '@turf/helpers';

// Paths
const PLAN_CIRCUITAL_PATH = 'plan_circuital_2024.csv';
const SERIES_GEOJSON_PATH = 'public/montevideo_series_electorales.json';
const BARRIOS_GEOJSON_PATH = 'public/v_sig_barrios.json';
const OUTPUT_PATH = 'data/mappings/montevideo-crv-barrio.json';

console.log('🗺️  Creating Montevideo CRV → BARRIO mapping...\n');

// Step 1: Build CRV → SERIES mapping
console.log('Step 1: Building CRV → SERIES mapping from plan circuital...');
const planCircuitalCSV = fs.readFileSync(PLAN_CIRCUITAL_PATH, 'utf-8');
const planCircuitalData = Papa.parse(planCircuitalCSV, {
  header: true,
  skipEmptyLines: true
});

const crvToSeries = {};
let montevideoCircuits = 0;

planCircuitalData.data.forEach(row => {
  if (row.Departamento === 'MO') {
    const crv = row.NroCircuito;
    const serie = row.Serie;
    if (crv && serie) {
      crvToSeries[crv] = serie;
      montevideoCircuits++;
    }
  }
});

console.log(`✓ Found ${montevideoCircuits} circuits in Montevideo`);
console.log(`✓ Mapping to ${Object.values(crvToSeries).filter((v, i, a) => a.indexOf(v) === i).length} unique series\n`);

// Step 2: Build SERIES → BARRIO mapping using spatial intersection
console.log('Step 2: Building SERIES → BARRIO mapping using spatial intersection...');
const seriesGeoJSON = JSON.parse(fs.readFileSync(SERIES_GEOJSON_PATH, 'utf-8'));
const barriosGeoJSON = JSON.parse(fs.readFileSync(BARRIOS_GEOJSON_PATH, 'utf-8'));

console.log(`✓ Loaded ${seriesGeoJSON.features.length} series polygons`);
console.log(`✓ Loaded ${barriosGeoJSON.features.length} barrio polygons`);

const seriesToBarrio = {};
let seriesMapped = 0;
let seriesWithoutMatch = 0;

seriesGeoJSON.features.forEach((serieFeature, index) => {
  const serieCode = serieFeature.properties.serie;

  if (!serieCode) {
    console.warn(`⚠️  Series at index ${index} has no 'serie' property`);
    return;
  }

  let maxIntersectionArea = 0;
  let bestBarrio = null;

  // Find the barrio with the largest intersection
  barriosGeoJSON.features.forEach(barrioFeature => {
    const barrioName = barrioFeature.properties.BARRIO;

    try {
      // Check if they intersect
      if (booleanIntersects(serieFeature, barrioFeature)) {
        // Calculate intersection area using featureCollection for v7
        const intersection = intersect(featureCollection([serieFeature, barrioFeature]));
        if (intersection) {
          const intersectionArea = area(intersection);

          if (intersectionArea > maxIntersectionArea) {
            maxIntersectionArea = intersectionArea;
            bestBarrio = barrioName;
          }
        }
      }
    } catch (error) {
      // Some polygons might have geometry issues, skip them
      // Only log the first few errors to avoid spam
      if (index < 3) {
        console.warn(`⚠️  Error intersecting serie ${serieCode} with barrio ${barrioName}:`, error.message);
      }
    }
  });

  if (bestBarrio) {
    seriesToBarrio[serieCode] = bestBarrio;
    seriesMapped++;
  } else {
    console.warn(`⚠️  No barrio found for serie ${serieCode}`);
    seriesWithoutMatch++;
  }
});

console.log(`✓ Mapped ${seriesMapped} series to barrios`);
if (seriesWithoutMatch > 0) {
  console.log(`⚠️  ${seriesWithoutMatch} series had no barrio match\n`);
} else {
  console.log('');
}

// Step 3: Chain CRV → SERIES → BARRIO
console.log('Step 3: Creating final CRV → BARRIO mapping...');
const crvToBarrio = {};
let circuitsMapped = 0;
let circuitsWithoutMatch = 0;
const barrioStats = {};

Object.entries(crvToSeries).forEach(([crv, serie]) => {
  const barrio = seriesToBarrio[serie];

  if (barrio) {
    crvToBarrio[crv] = barrio;
    circuitsMapped++;

    // Track stats
    barrioStats[barrio] = (barrioStats[barrio] || 0) + 1;
  } else {
    console.warn(`⚠️  No barrio mapping for CRV ${crv} (serie ${serie})`);
    circuitsWithoutMatch++;
  }
});

console.log(`✓ Mapped ${circuitsMapped} circuits to barrios`);
if (circuitsWithoutMatch > 0) {
  console.log(`⚠️  ${circuitsWithoutMatch} circuits had no barrio match`);
}

// Show top barrios by circuit count
console.log('\nTop 10 barrios by circuit count:');
const topBarrios = Object.entries(barrioStats)
  .sort((a, b) => b[1] - a[1])
  .slice(0, 10);
topBarrios.forEach(([barrio, count]) => {
  console.log(`  ${barrio}: ${count} circuits`);
});

// Step 4: Save the mapping
console.log('\nStep 4: Saving mapping file...');
const outputDir = path.dirname(OUTPUT_PATH);
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

const output = {
  metadata: {
    description: 'Montevideo CRV (Circuit) to BARRIO (Neighborhood) mapping',
    generatedAt: new Date().toISOString(),
    source: 'Created by chaining CRV→SERIES (from plan_circuital_2024.csv) and SERIES→BARRIO (from spatial intersection)',
    stats: {
      totalCircuits: montevideoCircuits,
      mappedCircuits: circuitsMapped,
      uniqueBarrios: Object.keys(barrioStats).length,
      uniqueSeries: Object.keys(seriesToBarrio).length
    }
  },
  crvToBarrio,
  seriesToBarrio,
  barrioStats
};

fs.writeFileSync(OUTPUT_PATH, JSON.stringify(output, null, 2), 'utf-8');
console.log(`✓ Saved mapping to ${OUTPUT_PATH}`);

console.log('\n✅ Mapping complete!');
console.log(`\nSummary:`);
console.log(`  - Total circuits: ${montevideoCircuits}`);
console.log(`  - Mapped circuits: ${circuitsMapped} (${(circuitsMapped/montevideoCircuits*100).toFixed(1)}%)`);
console.log(`  - Unique barrios: ${Object.keys(barrioStats).length}`);
console.log(`  - Unique series: ${Object.keys(seriesToBarrio).length}`);
