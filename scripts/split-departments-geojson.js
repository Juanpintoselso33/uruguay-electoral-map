#!/usr/bin/env node
/**
 * Split Uruguay departmental boundaries GeoJSON into individual department files
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..');

// Department name mapping to slugs (handles variations with/without accents)
const DEPARTMENT_SLUGS = {
  'Artigas': 'artigas',
  'Canelones': 'canelones',
  'Cerro Largo': 'cerro_largo',
  'Colonia': 'colonia',
  'Durazno': 'durazno',
  'Flores': 'flores',
  'Florida': 'florida',
  'Lavalleja': 'lavalleja',
  'Maldonado': 'maldonado',
  'Montevideo': 'montevideo',
  'Paysandú': 'paysandu',
  'Paysandu': 'paysandu',  // Without accent
  'Río Negro': 'rio_negro',
  'Rio Negro': 'rio_negro', // Without accent
  'Rivera': 'rivera',
  'Rocha': 'rocha',
  'Salto': 'salto',
  'San José': 'san_jose',
  'San Jose': 'san_jose',  // Without accent
  'Soriano': 'soriano',
  'Tacuarembó': 'tacuarembo',
  'Tacuarembo': 'tacuarembo', // Without accent
  'Treinta y tres': 'treinta_y_tres',
  'Treinta y Tres': 'treinta_y_tres'
};

console.log('\n📍 Splitting departmental boundaries...\n');

// Read the master GeoJSON file
const inputPath = path.join(projectRoot, 'data', 'raw', 'geographic', 'uruguay-departamentos-oficial.geojson');
const outputDir = path.join(projectRoot, 'data', 'raw', 'geographic');

console.log(`Reading: ${inputPath}`);

let geojson;
try {
  const content = fs.readFileSync(inputPath, 'utf-8');
  geojson = JSON.parse(content);
} catch (error) {
  console.error('✗ Error reading GeoJSON:', error.message);
  process.exit(1);
}

console.log(`✓ Loaded GeoJSON with ${geojson.features?.length || 0} features\n`);

// Check if it has features
if (!geojson.features || geojson.features.length === 0) {
  console.error('✗ No features found in GeoJSON');
  process.exit(1);
}

// Group features by department
const departmentFeatures = {};

geojson.features.forEach((feature, index) => {
  // Try different property names for department name
  const deptName = feature.properties?.admlnm ||
                   feature.properties?.NOMBRE ||
                   feature.properties?.nombre ||
                   feature.properties?.NAME ||
                   feature.properties?.name;

  if (!deptName) {
    console.log(`⚠ Feature ${index} has no department name. Properties:`, feature.properties);
    return;
  }

  if (!departmentFeatures[deptName]) {
    departmentFeatures[deptName] = [];
  }
  departmentFeatures[deptName].push(feature);
});

console.log(`Found ${Object.keys(departmentFeatures).length} departments:\n`);
Object.keys(departmentFeatures).sort().forEach(name => {
  console.log(`  - ${name} (${departmentFeatures[name].length} features)`);
});
console.log();

// Create individual GeoJSON files for each department
let successCount = 0;
let skipCount = 0;

for (const [deptName, features] of Object.entries(departmentFeatures)) {
  const slug = DEPARTMENT_SLUGS[deptName];

  if (!slug) {
    console.log(`⚠ No slug mapping for "${deptName}", skipping`);
    skipCount++;
    continue;
  }

  const outputPath = path.join(outputDir, `${slug}_map.json`);

  // Create a GeoJSON FeatureCollection for this department
  const deptGeoJSON = {
    type: 'FeatureCollection',
    features: features.map((feature, index) => ({
      ...feature,
      properties: {
        ...feature.properties,
        BARRIO: `Zona ${index + 1}`, // Generic zone name
        zona: `Zona ${index + 1}`
      }
    }))
  };

  try {
    fs.writeFileSync(outputPath, JSON.stringify(deptGeoJSON));
    const size = fs.statSync(outputPath).size;
    console.log(`✓ ${deptName.padEnd(20)} → ${slug}_map.json (${(size / 1024 / 1024).toFixed(2)} MB)`);
    successCount++;
  } catch (error) {
    console.error(`✗ ${deptName}: ${error.message}`);
  }
}

console.log(`\n✅ Split complete: ${successCount} departments created, ${skipCount} skipped\n`);
