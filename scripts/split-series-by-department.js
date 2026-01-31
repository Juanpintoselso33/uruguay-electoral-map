import fs from 'fs';
import path from 'path';

console.log('📂 Splitting series electorales by department...\n');

// Read the full GeoJSON
const inputPath = 'data/raw/geographic/uruguay_series_electorales.json';
const fullData = JSON.parse(fs.readFileSync(inputPath, 'utf8'));

console.log(`Total features: ${fullData.features.length}`);

// Department name mapping (fix encoding issues and typos)
const deptMapping = {
  'ARTIGAS': 'artigas',
  'CANELONES': 'canelones',
  'CERRO LARGO': 'cerro_largo',
  'COLONIA': 'colonia',
  'DURAZNO': 'durazno',
  'FLORES': 'flores',
  'FLORIDA': 'florida',
  'LAVALLEJA': 'lavalleja',
  'MALDONADO': 'maldonado',
  'MONTEVIDEO': 'montevideo',
  'PAYSANDD': 'paysandu',  // Fix typo
  'PAYSANDÚ': 'paysandu',
  'RAO NEGRO': 'rio_negro',  // Fix encoding issue
  'RBO NEGRO': 'rio_negro',
  'RCO NEGRO': 'rio_negro',
  'RIO NEGRO': 'rio_negro',
  'RÍO NEGRO': 'rio_negro',
  'RIVERA': 'rivera',
  'ROCHA': 'rocha',
  'SALTO': 'salto',
  'SAN JOSE': 'san_jose',
  'SAN JOSÉ': 'san_jose',
  'SORIANO': 'soriano',
  'TACUAREMB': 'tacuarembo',  // Fix truncated name
  'TACUAREMBÓ': 'tacuarembo',
  'TREINTA Y TRES': 'treinta_y_tres'
};

// Group by department
const byDept = {};

fullData.features.forEach(feature => {
  const rawDept = feature.properties.depto;
  const dept = deptMapping[rawDept] || rawDept.toLowerCase().replace(/ /g, '_');

  if (!byDept[dept]) {
    byDept[dept] = [];
  }

  byDept[dept].push(feature);
});

// Save each department
const outputDir = 'data/raw/geographic';
let totalSaved = 0;

Object.entries(byDept).forEach(([dept, features]) => {
  const geojson = {
    type: 'FeatureCollection',
    features: features
  };

  const filename = `${dept}_series_map.json`;
  const filepath = path.join(outputDir, filename);

  fs.writeFileSync(filepath, JSON.stringify(geojson));

  const sizeMB = (fs.statSync(filepath).size / 1024 / 1024).toFixed(2);
  console.log(`  ✓ ${dept.padEnd(20)} ${features.length.toString().padStart(3)} series (${sizeMB} MB)`);

  totalSaved++;
});

console.log(`\n✅ Saved ${totalSaved} department files`);
