import fs from 'fs';
import * as turf from '@turf/turf';

console.log('🗺️  Creating Rivera: Series → Barrio mapping...\n');

// Load data
const seriesMapPath = 'public/data/geographic/rivera_series_map.json';
const barriosPath = 'data/raw/barrios/rivera_barrios.geojson';

const seriesMap = JSON.parse(fs.readFileSync(seriesMapPath, 'utf-8'));
const barriosGeoJSON = JSON.parse(fs.readFileSync(barriosPath, 'utf-8'));

// Filter only Rivera city series
const riveraCitySeries = ['HAA', 'HAB', 'HBA', 'HBB', 'HBC', 'HBD', 'HBE', 'HBF', 'HBG'];

// Create mapping: series -> [barrios]
const seriesBarrioMapping = {};

seriesMap.features.forEach(serieFeature => {
  const serieCode = serieFeature.properties.BARRIO?.toUpperCase();

  if (!serieCode || !riveraCitySeries.includes(serieCode)) {
    return; // Skip non-Rivera-city series
  }

  if (!seriesBarrioMapping[serieCode]) {
    seriesBarrioMapping[serieCode] = [];
  }

  // Find which barrios are within or overlap this serie
  barriosGeoJSON.features.forEach(barrioFeature => {
    const barrioName = barrioFeature.properties.nombre;

    try {
      // Check if barrio centroid is within serie
      const barrioCentroid = turf.centroid(barrioFeature);
      const isWithin = turf.booleanPointInPolygon(barrioCentroid, serieFeature);

      if (isWithin && !seriesBarrioMapping[serieCode].includes(barrioName)) {
        seriesBarrioMapping[serieCode].push(barrioName);
      }
    } catch (error) {
      // If centroid fails, try intersection area
      try {
        const intersection = turf.intersect(
          turf.featureCollection([serieFeature, barrioFeature])
        );

        if (intersection) {
          const intersectionArea = turf.area(intersection);
          const barrioArea = turf.area(barrioFeature);

          // If more than 30% of barrio is in serie, include it
          if (intersectionArea / barrioArea > 0.3 && !seriesBarrioMapping[serieCode].includes(barrioName)) {
            seriesBarrioMapping[serieCode].push(barrioName);
          }
        }
      } catch (e) {
        console.warn(`  ⚠️  Could not process ${barrioName} with ${serieCode}`);
      }
    }
  });
});

// Save mapping
const outputPath = 'data/mappings/rivera-series-barrio.json';
fs.writeFileSync(outputPath, JSON.stringify(seriesBarrioMapping, null, 2));

// Print summary
console.log('📊 Mapping summary:');
console.log(`   Total series mapped: ${Object.keys(seriesBarrioMapping).length}`);

Object.entries(seriesBarrioMapping).forEach(([serie, barrios]) => {
  console.log(`\n   ${serie}: ${barrios.length} barrios`);
  barrios.forEach(b => console.log(`     - ${b}`));
});

console.log(`\n✅ Mapping saved to: ${outputPath}`);
