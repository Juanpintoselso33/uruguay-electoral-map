#!/usr/bin/env node

/**
 * optimize-geojson.js
 * Optimizes GeoJSON map files by reducing coordinate precision and removing unnecessary properties
 *
 * Usage:
 *   node scripts/optimize-geojson.js <department> [--target-size <MB>]
 *   node scripts/optimize-geojson.js treinta_y_tres
 *   node scripts/optimize-geojson.js montevideo --target-size 2
 *
 * Note: For heavy geometry simplification, use mapshaper CLI:
 *   mapshaper input.json -simplify 15% -o output.json
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PUBLIC_DIR = path.join(__dirname, '..', 'public');
const BACKUP_DIR = path.join(PUBLIC_DIR, 'backups');

// Properties to keep in GeoJSON features
const KEEP_PROPERTIES = ['BARRIO', 'texto', 'zona', 'nombre', 'name'];

// Default settings
const DEFAULTS = {
  targetSizeMB: 3,
  coordinatePrecision: 5,  // ~1 meter precision
  minify: true
};

// Parse command line arguments
function parseArgs() {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.error('Usage: node optimize-geojson.js <department> [--target-size <MB>]');
    process.exit(1);
  }

  const department = args[0].toLowerCase().replace(/\s+/g, '_');
  let targetSizeMB = DEFAULTS.targetSizeMB;

  const sizeIndex = args.indexOf('--target-size');
  if (sizeIndex !== -1 && args[sizeIndex + 1]) {
    targetSizeMB = parseFloat(args[sizeIndex + 1]);
    if (isNaN(targetSizeMB) || targetSizeMB <= 0) {
      console.error('Invalid target size. Must be a positive number.');
      process.exit(1);
    }
  }

  return { department, targetSizeMB };
}

// Get file size in MB
function getFileSizeMB(filePath) {
  const stats = fs.statSync(filePath);
  return stats.size / (1024 * 1024);
}

// Create backup of original file
function createBackup(filePath) {
  if (!fs.existsSync(BACKUP_DIR)) {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
  }

  const filename = path.basename(filePath);
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupPath = path.join(BACKUP_DIR, `${filename}.${timestamp}.backup`);

  fs.copyFileSync(filePath, backupPath);
  return backupPath;
}

// Round coordinates to specified precision
function roundCoordinate(num, precision) {
  const factor = Math.pow(10, precision);
  return Math.round(num * factor) / factor;
}

// Process coordinates recursively
function processCoordinates(coords, precision) {
  if (typeof coords[0] === 'number') {
    // It's a coordinate pair [lng, lat] or [lng, lat, alt]
    return coords.slice(0, 2).map(c => roundCoordinate(c, precision));
  }
  // It's an array of coordinates
  return coords.map(c => processCoordinates(c, precision));
}

// Clean feature properties
function cleanProperties(properties) {
  if (!properties) return {};

  const cleaned = {};
  KEEP_PROPERTIES.forEach(prop => {
    if (properties[prop] !== undefined) {
      cleaned[prop] = properties[prop];
    }
  });

  // Ensure at least one zone identifier exists
  if (!cleaned.BARRIO && !cleaned.texto && !cleaned.zona) {
    // Try to find any property that looks like a zone name
    const zoneProp = Object.entries(properties).find(([key, value]) =>
      typeof value === 'string' && value.length > 0 && value.length < 100
    );
    if (zoneProp) {
      cleaned.zona = zoneProp[1];
    }
  }

  return cleaned;
}

// Optimize a single feature
function optimizeFeature(feature, precision) {
  return {
    type: 'Feature',
    geometry: {
      type: feature.geometry.type,
      coordinates: processCoordinates(feature.geometry.coordinates, precision)
    },
    properties: cleanProperties(feature.properties)
  };
}

// Optimize GeoJSON
function optimizeGeoJSON(geojson, precision) {
  if (geojson.type !== 'FeatureCollection') {
    throw new Error('Expected FeatureCollection');
  }

  return {
    type: 'FeatureCollection',
    features: geojson.features.map(f => optimizeFeature(f, precision))
  };
}

// Calculate bounds
function calculateBounds(geojson) {
  let minLng = Infinity, maxLng = -Infinity;
  let minLat = Infinity, maxLat = -Infinity;

  function processCoords(coords) {
    if (typeof coords[0] === 'number') {
      const [lng, lat] = coords;
      minLng = Math.min(minLng, lng);
      maxLng = Math.max(maxLng, lng);
      minLat = Math.min(minLat, lat);
      maxLat = Math.max(maxLat, lat);
    } else {
      coords.forEach(processCoords);
    }
  }

  geojson.features.forEach(feature => {
    processCoords(feature.geometry.coordinates);
  });

  return {
    north: maxLat,
    south: minLat,
    east: maxLng,
    west: minLng
  };
}

// Calculate center and zoom
function calculateMapParameters(geojson) {
  const bounds = calculateBounds(geojson);

  const centerLat = (bounds.north + bounds.south) / 2;
  const centerLng = (bounds.east + bounds.west) / 2;

  const width = Math.abs(bounds.east - bounds.west);
  const height = Math.abs(bounds.north - bounds.south);
  const maxSpan = Math.max(width, height);

  // Approximate zoom calculation
  const zoom = Math.min(13, Math.max(9, Math.round(8 - Math.log2(maxSpan))));

  return {
    center: [roundCoordinate(centerLat, 4), roundCoordinate(centerLng, 4)],
    zoom,
    bounds
  };
}

// Count total vertices
function countVertices(geojson) {
  let count = 0;

  function processCoords(coords) {
    if (typeof coords[0] === 'number') {
      count++;
    } else {
      coords.forEach(processCoords);
    }
  }

  geojson.features.forEach(feature => {
    processCoords(feature.geometry.coordinates);
  });

  return count;
}

// Print report
function printReport(result) {
  console.log('\n' + '═'.repeat(60));
  console.log('GeoJSON Optimization Report');
  console.log('═'.repeat(60) + '\n');

  console.log(`File: ${result.file}`);
  console.log(`Backup: ${result.backup}`);
  console.log('');

  console.log('Size Reduction:');
  console.log(`├── Original: ${result.originalSizeMB.toFixed(2)} MB`);
  console.log(`├── Optimized: ${result.optimizedSizeMB.toFixed(2)} MB`);
  console.log(`└── Reduction: ${result.reductionPercent.toFixed(1)}%`);
  console.log('');

  console.log('Geometry:');
  console.log(`├── Features: ${result.featureCount}`);
  console.log(`├── Original Vertices: ${result.originalVertices.toLocaleString()}`);
  console.log(`└── Optimized Vertices: ${result.optimizedVertices.toLocaleString()}`);
  console.log('');

  console.log('Map Parameters:');
  console.log(`├── Center: [${result.mapParameters.center.join(', ')}]`);
  console.log(`├── Zoom: ${result.mapParameters.zoom}`);
  console.log(`└── Bounds: N:${result.mapParameters.bounds.north.toFixed(4)}, ` +
              `S:${result.mapParameters.bounds.south.toFixed(4)}, ` +
              `E:${result.mapParameters.bounds.east.toFixed(4)}, ` +
              `W:${result.mapParameters.bounds.west.toFixed(4)}`);
  console.log('');

  if (result.optimizedSizeMB <= result.targetSizeMB) {
    console.log(`✓ File is under target size (${result.targetSizeMB} MB)`);
  } else {
    console.log(`⚠ File still exceeds target size (${result.targetSizeMB} MB)`);
    console.log('  Consider using mapshaper for geometry simplification:');
    console.log(`  mapshaper ${result.file} -simplify 15% -o ${result.file}`);
  }

  console.log('');
}

// Main execution
function main() {
  const { department, targetSizeMB } = parseArgs();
  const filePath = path.join(PUBLIC_DIR, `${department}_map.json`);

  console.log(`\nOptimizing ${department}_map.json...`);

  // Check if file exists
  if (!fs.existsSync(filePath)) {
    console.error(`✗ File not found: ${filePath}`);
    process.exit(1);
  }

  const originalSizeMB = getFileSizeMB(filePath);
  console.log(`Original size: ${originalSizeMB.toFixed(2)} MB`);

  // Create backup
  const backupPath = createBackup(filePath);
  console.log(`Backup created: ${backupPath}`);

  try {
    // Read and parse GeoJSON
    const content = fs.readFileSync(filePath, 'utf-8');
    const geojson = JSON.parse(content);

    const originalVertices = countVertices(geojson);

    // Optimize
    const optimized = optimizeGeoJSON(geojson, DEFAULTS.coordinatePrecision);
    const optimizedVertices = countVertices(optimized);

    // Calculate map parameters
    const mapParameters = calculateMapParameters(optimized);

    // Write optimized file
    const outputContent = DEFAULTS.minify
      ? JSON.stringify(optimized)
      : JSON.stringify(optimized, null, 2);

    fs.writeFileSync(filePath, outputContent, 'utf-8');

    const optimizedSizeMB = getFileSizeMB(filePath);
    const reductionPercent = ((1 - optimizedSizeMB / originalSizeMB) * 100);

    // Print report
    printReport({
      file: filePath,
      backup: backupPath,
      originalSizeMB,
      optimizedSizeMB,
      targetSizeMB,
      reductionPercent,
      featureCount: optimized.features.length,
      originalVertices,
      optimizedVertices,
      mapParameters
    });

  } catch (error) {
    console.error(`✗ Error: ${error.message}`);

    // Restore from backup
    console.log('Restoring from backup...');
    fs.copyFileSync(backupPath, filePath);

    process.exit(1);
  }
}

main();
