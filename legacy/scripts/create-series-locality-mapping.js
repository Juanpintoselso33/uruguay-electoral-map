import fs from 'fs';
import { parse } from 'csv-parse/sync';

console.log('📍 Creating Series → Locality mapping from Plan Circuital...\n');

// Read plan circuital
const planCircuitalPath = 'data/raw/geographic/plan_circuital_2024.csv';
const csvContent = fs.readFileSync(planCircuitalPath, 'utf-8');
const records = parse(csvContent, {
  columns: true,
  skip_empty_lines: true,
  trim: true
});

// Department code mapping
const deptCodes = {
  'AR': 'artigas',
  'CA': 'canelones',
  'CL': 'cerro_largo',
  'CO': 'colonia',
  'DU': 'durazno',
  'FL': 'flores',
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

// Group by department and serie
const mappingByDept = {};

records.forEach(record => {
  const deptCode = record.Departamento;
  const serie = record.Serie;
  const localidad = record.Localidad;

  if (!deptCode || !serie || !localidad) return;

  const deptName = deptCodes[deptCode];
  if (!deptName) return;

  if (!mappingByDept[deptName]) {
    mappingByDept[deptName] = {};
  }

  // Store the locality for this series (use first occurrence)
  if (!mappingByDept[deptName][serie]) {
    mappingByDept[deptName][serie] = localidad;
  }
});

// Save individual files per department
const outputDir = 'data/mappings';
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

let totalMappings = 0;

Object.entries(mappingByDept).forEach(([dept, mapping]) => {
  const filename = `${dept}-series-locality.json`;
  const filepath = `${outputDir}/${filename}`;

  fs.writeFileSync(filepath, JSON.stringify(mapping, null, 2));

  const count = Object.keys(mapping).length;
  totalMappings += count;
  console.log(`  ✓ ${dept.padEnd(20)} ${count.toString().padStart(3)} series`);
});

console.log(`\n✅ Created mappings for ${Object.keys(mappingByDept).length} departments`);
console.log(`   Total series mapped: ${totalMappings}`);

// Create a summary showing unique localities per department
console.log('\n📊 Unique localities per department:');
Object.entries(mappingByDept).forEach(([dept, mapping]) => {
  const localities = new Set(Object.values(mapping));
  const localityCount = localities.size;
  console.log(`  ${dept.padEnd(20)} ${localityCount.toString().padStart(3)} localities`);

  // Show sample localities
  if (localityCount <= 10) {
    console.log(`    → ${Array.from(localities).join(', ')}`);
  }
});
