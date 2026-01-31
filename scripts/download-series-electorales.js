import fs from 'fs';
import path from 'path';

const BASE_URL = 'https://sit.mvot.gub.uy/arcgis/rest/services/07_EXTERNO/LIMITES_ADMINISTRATIVOS/MapServer/7/query';

async function downloadSeriesElectorales() {
  console.log('📥 Downloading Series Electorales from MVOT...\n');

  const allFeatures = [];
  let offset = 0;
  const limit = 500; // Reduced batch size to avoid server errors
  let hasMore = true;

  while (hasMore) {
    const params = new URLSearchParams({
      where: '1=1',
      outFields: '*',
      returnGeometry: 'true',
      f: 'geojson',
      resultRecordCount: limit.toString(),
      resultOffset: offset.toString()
    });

    const url = `${BASE_URL}?${params}`;
    console.log(`  Fetching records ${offset} to ${offset + limit}...`);

    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();

      if (!data.features || data.features.length === 0) {
        hasMore = false;
        break;
      }

      allFeatures.push(...data.features);
      console.log(`    ✓ Got ${data.features.length} features (total: ${allFeatures.length})`);

      if (data.features.length < limit) {
        hasMore = false;
      } else {
        offset += limit;
      }
    } catch (error) {
      console.error(`  ✗ Error fetching data: ${error.message}`);
      hasMore = false;
    }
  }

  // Create GeoJSON
  const geojson = {
    type: 'FeatureCollection',
    features: allFeatures
  };

  // Save to file
  const outputPath = path.join('data', 'raw', 'geographic', 'uruguay_series_electorales.json');
  fs.writeFileSync(outputPath, JSON.stringify(geojson, null, 2));

  console.log(`\n✅ Downloaded ${allFeatures.length} electoral series`);
  console.log(`   Saved to: ${outputPath}`);
  console.log(`   File size: ${(fs.statSync(outputPath).size / 1024 / 1024).toFixed(2)} MB`);

  // Show sample by department
  const byDept = {};
  allFeatures.forEach(f => {
    const dept = f.properties.depto;
    if (!byDept[dept]) byDept[dept] = 0;
    byDept[dept]++;
  });

  console.log('\n📊 Series by department:');
  Object.entries(byDept).sort().forEach(([dept, count]) => {
    console.log(`   ${dept.padEnd(20)} ${count} series`);
  });
}

downloadSeriesElectorales().catch(console.error);
