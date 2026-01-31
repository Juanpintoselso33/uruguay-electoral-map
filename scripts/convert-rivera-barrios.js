import shapefile from 'shapefile';
import fs from 'fs';
import proj4 from 'proj4';

// Define projections
const utm21s = '+proj=utm +zone=21 +south +datum=WGS84 +units=m +no_defs';
const wgs84 = '+proj=longlat +datum=WGS84 +no_defs';

// Reproject coordinates from UTM to WGS84
function reprojectCoordinates(coords) {
  if (typeof coords[0] === 'number') {
    // Single point [x, y]
    return proj4(utm21s, wgs84, coords);
  } else if (Array.isArray(coords[0])) {
    // Array of coordinates
    return coords.map(c => reprojectCoordinates(c));
  }
  return coords;
}

async function convertShapefileToGeoJSON() {
  try {
    const shpPath = 'data/raw/barrios/Barrios/barrios.shp';
    const dbfPath = 'data/raw/barrios/Barrios/barrios.dbf';

    const source = await shapefile.open(shpPath, dbfPath);
    const features = [];

    let result = await source.read();
    while (!result.done) {
      const feature = result.value;

      // Reproject geometry coordinates
      if (feature.geometry && feature.geometry.coordinates) {
        feature.geometry.coordinates = reprojectCoordinates(feature.geometry.coordinates);
      }

      features.push(feature);
      result = await source.read();
    }

    const geojson = {
      type: 'FeatureCollection',
      features: features
    };

    // Save to file
    const outputPath = 'data/raw/barrios/rivera_barrios.geojson';
    fs.writeFileSync(outputPath, JSON.stringify(geojson, null, 2));

    console.log(`✅ Converted shapefile to GeoJSON`);
    console.log(`   Output: ${outputPath}`);
    console.log(`   Features: ${features.length}`);

    // Show sample properties
    if (features.length > 0) {
      console.log('\n📋 Sample feature properties:');
      console.log(JSON.stringify(features[0].properties, null, 2));

      // List all barrios
      console.log('\n🏘️  Barrios encontrados:');
      features.forEach((f, i) => {
        console.log(`   ${i + 1}. ${f.properties.BARRIO || f.properties.nombre || f.properties.name || 'Sin nombre'}`);
      });
    }

  } catch (error) {
    console.error('❌ Error:', error);
  }
}

convertShapefileToGeoJSON();
