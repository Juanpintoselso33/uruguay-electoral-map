#!/usr/bin/env node

/**
 * add-department.js
 * Automates the process of adding a new department to the Uruguay Electoral Map
 *
 * Usage:
 *   node scripts/add-department.js <department>
 *   node scripts/add-department.js canelones
 *   node scripts/add-department.js san_jose --force
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.join(__dirname, '..');
const PUBLIC_DIR = path.join(ROOT_DIR, 'public');

// Parse command line arguments
function parseArgs() {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.error('Usage: node add-department.js <department> [--force]');
    process.exit(1);
  }

  const department = args[0].toLowerCase().replace(/\s+/g, '_');
  const force = args.includes('--force');

  return { department, force };
}

// Format department name for display
function formatDisplayName(snakeName) {
  const specialCases = {
    'treinta_y_tres': 'Treinta y Tres',
    'rio_negro': 'Río Negro',
    'san_jose': 'San José',
    'cerro_largo': 'Cerro Largo'
  };

  if (specialCases[snakeName]) {
    return specialCases[snakeName];
  }

  return snakeName
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

// Check if required files exist
function checkRequiredFiles(department) {
  const files = {
    odn: path.join(PUBLIC_DIR, `${department}_odn.csv`),
    odd: path.join(PUBLIC_DIR, `${department}_odd.csv`),
    map: path.join(PUBLIC_DIR, `${department}_map.json`)
  };

  const missing = [];
  const found = [];

  Object.entries(files).forEach(([type, filePath]) => {
    if (fs.existsSync(filePath)) {
      found.push({ type, path: filePath });
    } else {
      missing.push({ type, path: filePath });
    }
  });

  return { files, missing, found };
}

// Get file size in MB
function getFileSizeMB(filePath) {
  const stats = fs.statSync(filePath);
  return stats.size / (1024 * 1024);
}

// Validate CSV file (simplified version)
function validateCSV(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n').filter(line => line.trim());

  if (lines.length < 2) {
    return { valid: false, error: 'File is empty or has no data rows' };
  }

  const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
  const requiredColumns = ['PARTIDO', 'DEPTO', 'CIRCUITO', 'SERIES', 'ESCRUTINIO', 'PRECANDIDATO', 'HOJA', 'CNT_VOTOS', 'ZONA'];

  const missing = requiredColumns.filter(col => !headers.includes(col));
  if (missing.length > 0) {
    return { valid: false, error: `Missing columns: ${missing.join(', ')}` };
  }

  // Count unique lists and zones
  const lists = new Set();
  const zones = new Set();

  lines.slice(1).forEach(line => {
    const values = line.split(',').map(v => v.trim().replace(/"/g, ''));
    const hojaIndex = headers.indexOf('HOJA');
    const zonaIndex = headers.indexOf('ZONA');

    if (values[hojaIndex]) lists.add(values[hojaIndex]);
    if (values[zonaIndex]) zones.add(values[zonaIndex]);
  });

  return {
    valid: true,
    stats: {
      rows: lines.length - 1,
      lists: lists.size,
      zones: zones.size
    }
  };
}

// Calculate map parameters from GeoJSON
function calculateMapParameters(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const geojson = JSON.parse(content);

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

  const centerLat = (minLat + maxLat) / 2;
  const centerLng = (minLng + maxLng) / 2;

  const width = Math.abs(maxLng - minLng);
  const height = Math.abs(maxLat - minLat);
  const maxSpan = Math.max(width, height);

  const zoom = Math.min(13, Math.max(9, Math.round(8 - Math.log2(maxSpan))));

  return {
    center: [Math.round(centerLat * 10000) / 10000, Math.round(centerLng * 10000) / 10000],
    zoom,
    featureCount: geojson.features.length
  };
}

// Update regions.json
function updateRegionsConfig(department, mapParams) {
  const regionsPath = path.join(PUBLIC_DIR, 'regions.json');
  let regions = [];

  // Try to read existing regions.json
  if (fs.existsSync(regionsPath)) {
    try {
      regions = JSON.parse(fs.readFileSync(regionsPath, 'utf-8'));
    } catch (e) {
      console.log('Creating new regions.json...');
    }
  }

  // Check if department already exists
  const existingIndex = regions.findIndex(r =>
    r.name.toLowerCase().replace(/\s+/g, '_') === department
  );

  const newRegion = {
    name: formatDisplayName(department),
    odnCsvPath: `/${department}_odn.csv`,
    oddCsvPath: `/${department}_odd.csv`,
    geojsonPath: `/${department}_map.json`,
    mapCenter: mapParams.center,
    mapZoom: mapParams.zoom
  };

  if (existingIndex >= 0) {
    regions[existingIndex] = newRegion;
  } else {
    regions.push(newRegion);
  }

  fs.writeFileSync(regionsPath, JSON.stringify(regions, null, 2), 'utf-8');
  return regionsPath;
}

// Update CLAUDE.md
function updateClaudeMd(department) {
  const claudePath = path.join(ROOT_DIR, 'CLAUDE.md');

  if (!fs.existsSync(claudePath)) {
    console.log('CLAUDE.md not found, skipping update');
    return null;
  }

  let content = fs.readFileSync(claudePath, 'utf-8');
  const displayName = formatDisplayName(department);

  // Check if department is already in the implemented list
  if (content.includes(`| ${displayName} |`)) {
    console.log(`${displayName} already in CLAUDE.md`);
    return claudePath;
  }

  // Find the implemented departments table and add the new one
  // This is a simplified implementation - in production, you'd want more robust parsing
  content = content.replace(
    /### Implemented \(\d+\)/,
    `### Implemented (${content.match(/\| \w+ \| ✅/g)?.length + 1 || 5})`
  );

  fs.writeFileSync(claudePath, content, 'utf-8');
  return claudePath;
}

// Update .claude/settings.json
function updateClaudeSettings(department) {
  const settingsPath = path.join(ROOT_DIR, '.claude', 'settings.json');

  if (!fs.existsSync(settingsPath)) {
    console.log('.claude/settings.json not found, skipping update');
    return null;
  }

  const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf-8'));

  if (!settings.departments.implemented.includes(department)) {
    settings.departments.implemented.push(department);

    // Remove from pending lists if present
    ['priority_high', 'priority_medium', 'priority_low'].forEach(priority => {
      const index = settings.departments[priority]?.indexOf(department);
      if (index >= 0) {
        settings.departments[priority].splice(index, 1);
      }
    });

    fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2), 'utf-8');
  }

  return settingsPath;
}

// Main execution
function main() {
  const { department, force } = parseArgs();
  const displayName = formatDisplayName(department);

  console.log('\n' + '═'.repeat(60));
  console.log(`Adding Department: ${displayName}`);
  console.log('═'.repeat(60) + '\n');

  // Step 1: Check required files
  console.log('Step 1: Checking required files...');
  const { files, missing, found } = checkRequiredFiles(department);

  if (missing.length > 0) {
    console.log('\n✗ Missing required files:');
    missing.forEach(f => console.log(`  - ${f.path}`));
    console.log('\nPlease add the missing files and try again.');
    process.exit(1);
  }

  console.log('✓ All required files found');
  found.forEach(f => console.log(`  - ${f.type}: ${path.basename(f.path)}`));

  // Step 2: Validate CSV files
  console.log('\nStep 2: Validating CSV files...');

  const odnResult = validateCSV(files.odn);
  if (!odnResult.valid) {
    console.log(`✗ ODN CSV validation failed: ${odnResult.error}`);
    process.exit(1);
  }
  console.log(`✓ ODN CSV valid (${odnResult.stats.lists} lists, ${odnResult.stats.zones} zones)`);

  const oddResult = validateCSV(files.odd);
  if (!oddResult.valid) {
    console.log(`✗ ODD CSV validation failed: ${oddResult.error}`);
    process.exit(1);
  }
  console.log(`✓ ODD CSV valid (${oddResult.stats.lists} lists, ${oddResult.stats.zones} zones)`);

  // Step 3: Check GeoJSON size
  console.log('\nStep 3: Checking GeoJSON file...');
  const mapSize = getFileSizeMB(files.map);
  console.log(`  Size: ${mapSize.toFixed(2)} MB`);

  if (mapSize > 3) {
    console.log('⚠ GeoJSON file exceeds 3MB limit');

    if (!force) {
      console.log('\nRunning optimization...');
      try {
        execSync(`node ${path.join(__dirname, 'optimize-geojson.js')} ${department}`, {
          stdio: 'inherit'
        });
      } catch (e) {
        console.log('Optimization failed. Consider using mapshaper for heavy simplification.');
        process.exit(1);
      }
    }
  } else {
    console.log('✓ GeoJSON size is within limits');
  }

  // Step 4: Calculate map parameters
  console.log('\nStep 4: Calculating map parameters...');
  const mapParams = calculateMapParameters(files.map);
  console.log(`  Center: [${mapParams.center.join(', ')}]`);
  console.log(`  Zoom: ${mapParams.zoom}`);
  console.log(`  Features: ${mapParams.featureCount}`);

  // Step 5: Update configuration files
  console.log('\nStep 5: Updating configuration files...');

  const regionsPath = updateRegionsConfig(department, mapParams);
  console.log(`✓ Updated ${path.basename(regionsPath)}`);

  const claudePath = updateClaudeMd(department);
  if (claudePath) {
    console.log(`✓ Updated CLAUDE.md`);
  }

  const settingsPath = updateClaudeSettings(department);
  if (settingsPath) {
    console.log(`✓ Updated .claude/settings.json`);
  }

  // Summary
  console.log('\n' + '═'.repeat(60));
  console.log(`✓ Department '${displayName}' added successfully!`);
  console.log('═'.repeat(60));
  console.log('\nSummary:');
  console.log(`  ODN Lists: ${odnResult.stats.lists}`);
  console.log(`  ODD Lists: ${oddResult.stats.lists}`);
  console.log(`  Zones: ${odnResult.stats.zones}`);
  console.log(`  Map Center: [${mapParams.center.join(', ')}]`);
  console.log(`  Map Zoom: ${mapParams.zoom}`);
  console.log('\nFiles updated:');
  console.log('  - public/regions.json');
  if (claudePath) console.log('  - CLAUDE.md');
  if (settingsPath) console.log('  - .claude/settings.json');
  console.log('\nRun `npm run dev` to test the new department.');
  console.log('');
}

main();
