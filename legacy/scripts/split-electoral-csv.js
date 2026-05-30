#!/usr/bin/env node
/**
 * Split master electoral CSV into individual department files
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..');

// Department code to slug mapping
const DEPT_CODES = {
  'AR': 'artigas',
  'CA': 'canelones',
  'CL': 'cerro_largo',
  'CO': 'colonia',
  'DU': 'durazno',
  'FS': 'flores',
  'FD': 'florida',
  'LA': 'lavalleja',
  'MA': 'maldonado',
  'MO': 'montevideo',
  'PA': 'paysandu',
  'RN': 'rio_negro',
  'RV': 'rivera',
  'RO': 'rocha',
  'SA': 'salto',
  'SJ': 'san_jose',
  'SO': 'soriano',
  'TA': 'tacuarembo',
  'TT': 'treinta_y_tres'
};

console.log('\n📊 Splitting electoral CSV by department...\n');

const masterPath = path.join(projectRoot, 'data', 'raw', 'electoral', 'desglose-de-votos.csv');
const integracionPath = path.join(projectRoot, 'data', 'raw', 'electoral', 'integracion-hojas-de-votacion.csv');
const outputDir = path.join(projectRoot, 'data', 'raw', 'electoral');

// Read master CSV
console.log('Reading master CSV...');
const masterContent = fs.readFileSync(masterPath, 'utf-8');
const integracionContent = fs.readFileSync(integracionPath, 'utf-8');

// Parse master CSV
const masterLines = masterContent.split('\n');
const masterHeader = masterLines[0];
const masterRows = masterLines.slice(1).filter(line => line.trim());

// Parse integración CSV (has candidate names)
const integracionLines = integracionContent.split('\n');
const integracionHeader = integracionLines[0];
const integracionRows = integracionLines.slice(1).filter(line => line.trim());

console.log(`Master CSV: ${masterRows.length} rows`);
console.log(`Integración CSV: ${integracionRows.length} rows\n`);

// Group master data by department and type
const deptData = {};

masterRows.forEach((row, index) => {
  const columns = row.split(',');
  const tipoRegistro = columns[0];
  const deptCode = columns[1];

  if (!deptCode || !DEPT_CODES[deptCode]) return;

  const deptSlug = DEPT_CODES[deptCode];
  const type = tipoRegistro.includes('ODN') ? 'odn' : 'odd';

  const key = `${deptSlug}_${type}`;
  if (!deptData[key]) {
    deptData[key] = [];
  }
  deptData[key].push(row);
});

// Create a map of partido+hoja -> precandidato from integración CSV
const hojaInfo = {};
integracionRows.forEach(row => {
  const columns = row.split(',').map(c => c.trim().replace(/"/g, ''));
  const deptCode = columns[0];
  const partido = columns[1];
  const hoja = columns[3];
  const precandidato = columns[4] || '';

  if (deptCode && DEPT_CODES[deptCode] && hoja) {
    const key = `${deptCode}|${partido}|${hoja}`;
    hojaInfo[key] = precandidato;
  }
});

// Write individual department files
console.log('Creating department files...\n');

const newHeader = 'PARTIDO,DEPTO,CIRCUITO,SERIES,ESCRUTINIO,PRECANDIDATO,HOJA,CNT_VOTOS,ZONA';

let filesCreated = 0;

for (const [key, rows] of Object.entries(deptData)) {
  const [deptSlug, type] = key.split('_');
  const outputPath = path.join(outputDir, `${deptSlug}_${type}.csv`);

  // Convert rows to new format with PRECANDIDATO filled in
  const formattedRows = rows.map(row => {
    const columns = row.split(',').map(c => c.trim().replace(/"/g, ''));
    const tipoRegistro = columns[0];
    const deptCode = columns[1];
    const crv = columns[2];
    const series = columns[3];
    const lema = columns[4];  // PARTIDO
    const desc1 = columns[5];  // Tipo escrutinio
    const desc2 = columns[6];  // HOJA
    const votos = columns[7];

    // Parse CRV to get CIRCUITO and ZONA
    const circuito = crv ? crv.substring(2, 5) : '';
    const zona = crv || '';

    // Get precandidato from integración data
    const hojaKey = `${deptCode}|${lema}|${desc2}`;
    const precandidato = hojaInfo[hojaKey] || '';

    return `${lema},${deptCode},${circuito},${series},${desc1},${precandidato},${desc2},${votos},${zona}`;
  });

  const content = [newHeader, ...formattedRows].join('\n');
  fs.writeFileSync(outputPath, content, 'utf-8');

  const size = fs.statSync(outputPath).size;
  console.log(`✓ ${key.padEnd(25)} → ${(size / 1024).toFixed(1)} KB (${rows.length} rows)`);
  filesCreated++;
}

console.log(`\n✅ Split complete: ${filesCreated} files created\n`);
