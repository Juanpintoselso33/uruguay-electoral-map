#!/usr/bin/env node
/**
 * Process electoral data for all missing departments
 */

import { exec as execCallback } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import { fileURLToPath } from 'url';

const exec = promisify(execCallback);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..');

// Missing departments (15 total)
const MISSING_DEPARTMENTS = [
  'canelones',
  'san_jose',
  'rocha',
  'florida',
  'lavalleja',
  'durazno',
  'flores',
  'soriano',
  'rio_negro',
  'paysandu',
  'salto',
  'artigas',
  'rivera',
  'tacuarembo',
  'cerro_largo'
];

console.log('\n📊 Processing electoral data for all departments...\n');
console.log(`Total departments to process: ${MISSING_DEPARTMENTS.length}\n`);

let successCount = 0;
let errorCount = 0;
const errors = [];

for (const dept of MISSING_DEPARTMENTS) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`Processing: ${dept}`);
  console.log('='.repeat(60));

  try {
    // Run ETL transform for this department
    const { stdout, stderr } = await exec(`npm run etl:transform -- --dept ${dept}`, {
      cwd: projectRoot,
      maxBuffer: 10 * 1024 * 1024 // 10MB buffer
    });

    if (stdout) console.log(stdout);
    if (stderr && !stderr.includes('npm run')) console.error(stderr);

    successCount++;
    console.log(`✓ ${dept} processed successfully`);
  } catch (error) {
    errorCount++;
    errors.push({ dept, error: error.message });
    console.error(`✗ ${dept} failed:`, error.message);
  }
}

console.log(`\n${'='.repeat(60)}`);
console.log('Summary');
console.log('='.repeat(60));
console.log(`✓ Successful: ${successCount}/${MISSING_DEPARTMENTS.length}`);
console.log(`✗ Failed: ${errorCount}/${MISSING_DEPARTMENTS.length}`);

if (errors.length > 0) {
  console.log('\nErrors:');
  errors.forEach(({ dept, error }) => {
    console.log(`  - ${dept}: ${error}`);
  });
}

console.log('\n✅ Processing complete!\n');

if (successCount === MISSING_DEPARTMENTS.length) {
  console.log('Next step: Run `npm run etl:load` to copy all data to public/\n');
}
