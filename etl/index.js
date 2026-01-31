#!/usr/bin/env node

/**
 * ETL Pipeline CLI
 * Uruguay Electoral Map
 *
 * Usage:
 *   node etl/index.js <command> [options]
 *
 * Commands:
 *   extract     - Download raw data from sources
 *   transform   - Process and normalize data
 *   load        - Copy processed data to public/
 *   run         - Execute full pipeline (extract + transform + load)
 *   validate    - Validate processed data
 *   clean       - Clean cache and temporary files
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { extractElectoralData, extractGeographicData } from './extractors/index.js';
import { transformElectoralData, transformGeographicData } from './transformers/index.js';
import { loadToPublic } from './loaders/data-loader.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuration
const CONFIG = {
  dataDir: path.join(__dirname, '..', 'data'),
  publicDir: path.join(__dirname, '..', 'public'),
  rawDir: path.join(__dirname, '..', 'data', 'raw'),
  processedDir: path.join(__dirname, '..', 'data', 'processed'),
  cacheDir: path.join(__dirname, '..', 'data', 'cache'),
  mappingsDir: path.join(__dirname, '..', 'data', 'mappings'),
};

// Ensure directories exist
function ensureDirectories() {
  const dirs = [
    CONFIG.dataDir,
    CONFIG.rawDir,
    path.join(CONFIG.rawDir, 'electoral'),
    path.join(CONFIG.rawDir, 'geographic'),
    CONFIG.processedDir,
    path.join(CONFIG.processedDir, 'electoral'),
    path.join(CONFIG.processedDir, 'geographic'),
    CONFIG.cacheDir,
    CONFIG.mappingsDir,
  ];

  dirs.forEach(dir => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
      console.log(`Created directory: ${dir}`);
    }
  });
}

// Parse command line arguments
function parseArgs() {
  const args = process.argv.slice(2);
  const command = args[0];
  const options = {};

  for (let i = 1; i < args.length; i++) {
    if (args[i].startsWith('--')) {
      const key = args[i].slice(2);
      const value = args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : true;
      options[key] = value;
      if (value !== true) i++;
    }
  }

  return { command, options };
}

// Commands
async function extract(options) {
  console.log('\n📥 EXTRACT: Downloading raw data...\n');

  const type = options.type || 'all';

  if (type === 'all' || type === 'electoral') {
    console.log('Downloading electoral data...');
    await extractElectoralData(CONFIG);
  }

  if (type === 'all' || type === 'geographic') {
    console.log('Downloading geographic data...');
    await extractGeographicData(CONFIG);
  }

  console.log('\n✅ Extract complete!\n');
}

async function transform(options) {
  console.log('\n🔄 TRANSFORM: Processing data...\n');

  const dept = options.dept;
  const all = options.all || !dept;

  if (all) {
    console.log('Transforming all departments...');
    await transformElectoralData(CONFIG, null);
    await transformGeographicData(CONFIG, null);
  } else {
    console.log(`Transforming department: ${dept}`);
    await transformElectoralData(CONFIG, dept);
    await transformGeographicData(CONFIG, dept);
  }

  console.log('\n✅ Transform complete!\n');
}

async function load(options) {
  console.log('\n📤 LOAD: Copying to public/...\n');

  await loadToPublic(CONFIG);

  console.log('\n✅ Load complete!\n');
}

async function run(options) {
  console.log('\n🚀 Running full ETL pipeline...\n');
  console.log('═'.repeat(50));

  await extract(options);
  await transform(options);
  await load(options);

  console.log('═'.repeat(50));
  console.log('\n✅ ETL Pipeline complete!\n');
}

async function validate(options) {
  console.log('\n🔍 VALIDATE: Checking processed data...\n');

  const processedElectoral = path.join(CONFIG.processedDir, 'electoral');
  const processedGeo = path.join(CONFIG.processedDir, 'geographic');

  let errors = 0;
  let warnings = 0;

  // Check electoral data
  if (fs.existsSync(processedElectoral)) {
    const depts = fs.readdirSync(processedElectoral).filter(f =>
      fs.statSync(path.join(processedElectoral, f)).isDirectory()
    );

    console.log(`Found ${depts.length} departments with electoral data:`);
    depts.forEach(dept => {
      const odnPath = path.join(processedElectoral, dept, 'odn.json');
      const oddPath = path.join(processedElectoral, dept, 'odd.json');

      const hasODN = fs.existsSync(odnPath);
      const hasODD = fs.existsSync(oddPath);

      const status = hasODN && hasODD ? '✓' : hasODN || hasODD ? '⚠' : '✗';
      console.log(`  ${status} ${dept}: ODN=${hasODN ? 'yes' : 'no'}, ODD=${hasODD ? 'yes' : 'no'}`);

      if (!hasODN || !hasODD) warnings++;
    });
  } else {
    console.log('⚠ No processed electoral data found');
    warnings++;
  }

  // Check geographic data
  if (fs.existsSync(processedGeo)) {
    const maps = fs.readdirSync(processedGeo).filter(f => f.endsWith('.json'));
    console.log(`\nFound ${maps.length} geographic files:`);

    maps.forEach(map => {
      const mapPath = path.join(processedGeo, map);
      const stats = fs.statSync(mapPath);
      const sizeMB = (stats.size / (1024 * 1024)).toFixed(2);
      const status = sizeMB <= 3 ? '✓' : '⚠';

      console.log(`  ${status} ${map}: ${sizeMB} MB`);
      if (sizeMB > 3) warnings++;
    });
  } else {
    console.log('⚠ No processed geographic data found');
    warnings++;
  }

  console.log(`\n${'─'.repeat(50)}`);
  console.log(`Validation complete: ${errors} errors, ${warnings} warnings`);

  if (errors > 0) process.exit(1);
}

async function clean(options) {
  console.log('\n🧹 CLEAN: Removing cache and temporary files...\n');

  if (fs.existsSync(CONFIG.cacheDir)) {
    fs.rmSync(CONFIG.cacheDir, { recursive: true });
    console.log('Removed cache directory');
  }

  fs.mkdirSync(CONFIG.cacheDir, { recursive: true });
  fs.writeFileSync(path.join(CONFIG.cacheDir, '.gitkeep'), '');

  console.log('\n✅ Clean complete!\n');
}

function showHelp() {
  console.log(`
Uruguay Electoral Map - ETL Pipeline
═════════════════════════════════════

Usage: node etl/index.js <command> [options]

Commands:
  extract     Download raw data from official sources
  transform   Process and normalize downloaded data
  load        Copy processed data to public/ directory
  run         Execute full pipeline (extract → transform → load)
  validate    Validate processed data integrity
  clean       Remove cache and temporary files

Options:
  --type <type>     For extract: 'electoral', 'geographic', or 'all' (default)
  --dept <name>     For transform: specific department (e.g., 'montevideo')
  --all             For transform: process all departments (default)
  --force           Overwrite existing files
  --verbose         Show detailed output

Examples:
  node etl/index.js extract --type electoral
  node etl/index.js transform --dept montevideo
  node etl/index.js run
  node etl/index.js validate
`);
}

// Main
async function main() {
  const { command, options } = parseArgs();

  if (!command || command === 'help' || command === '--help') {
    showHelp();
    return;
  }

  ensureDirectories();

  try {
    switch (command) {
      case 'extract':
        await extract(options);
        break;
      case 'transform':
        await transform(options);
        break;
      case 'load':
        await load(options);
        break;
      case 'run':
        await run(options);
        break;
      case 'validate':
        await validate(options);
        break;
      case 'clean':
        await clean(options);
        break;
      default:
        console.error(`Unknown command: ${command}`);
        showHelp();
        process.exit(1);
    }
  } catch (error) {
    console.error(`\n❌ Error: ${error.message}\n`);
    if (options.verbose) {
      console.error(error.stack);
    }
    process.exit(1);
  }
}

main();
