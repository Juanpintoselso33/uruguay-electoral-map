/**
 * ETL Loader
 * Copy processed data to public directory for serving
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Load processed data to public directory
 */
export async function loadToPublic(config) {
  const processedElectoralDir = path.join(config.processedDir, 'electoral');
  const processedGeoDir = path.join(config.processedDir, 'geographic');
  const publicDataDir = path.join(config.publicDir, 'data');

  console.log('\n📤 Loading data to public/\n');

  // Ensure public/data directory exists
  if (!fs.existsSync(publicDataDir)) {
    fs.mkdirSync(publicDataDir, { recursive: true });
  }

  // Also create public/data/electoral and public/data/geographic
  const publicElectoralDir = path.join(publicDataDir, 'electoral');
  const publicGeoDir = path.join(publicDataDir, 'geographic');

  if (!fs.existsSync(publicElectoralDir)) {
    fs.mkdirSync(publicElectoralDir, { recursive: true });
  }
  if (!fs.existsSync(publicGeoDir)) {
    fs.mkdirSync(publicGeoDir, { recursive: true });
  }

  // Copy electoral data
  if (fs.existsSync(processedElectoralDir)) {
    const depts = fs.readdirSync(processedElectoralDir).filter(f =>
      fs.statSync(path.join(processedElectoralDir, f)).isDirectory()
    );

    console.log(`  Electoral data: ${depts.length} departments`);

    for (const dept of depts) {
      const srcDir = path.join(processedElectoralDir, dept);
      const destDir = path.join(publicElectoralDir, dept);

      if (!fs.existsSync(destDir)) {
        fs.mkdirSync(destDir, { recursive: true });
      }

      // Copy JSON files
      const files = fs.readdirSync(srcDir).filter(f => f.endsWith('.json'));
      for (const file of files) {
        fs.copyFileSync(
          path.join(srcDir, file),
          path.join(destDir, file)
        );
      }

      console.log(`    ✓ ${dept}`);
    }
  }

  // Copy geographic data
  if (fs.existsSync(processedGeoDir)) {
    const maps = fs.readdirSync(processedGeoDir).filter(f => f.endsWith('.json'));

    console.log(`\n  Geographic data: ${maps.length} maps`);

    for (const map of maps) {
      fs.copyFileSync(
        path.join(processedGeoDir, map),
        path.join(publicGeoDir, map)
      );

      // Also copy to root public/ for backwards compatibility
      fs.copyFileSync(
        path.join(processedGeoDir, map),
        path.join(config.publicDir, map)
      );

      console.log(`    ✓ ${map}`);
    }
  }

  // Generate regions.json from processed data
  await generateRegionsConfig(config);

  console.log('\n✓ Data loaded to public/\n');
}

/**
 * Generate regions.json configuration from processed data
 */
async function generateRegionsConfig(config) {
  const processedElectoralDir = path.join(config.processedDir, 'electoral');
  const regionsPath = path.join(config.publicDir, 'regions.json');

  console.log('\n  Generating regions.json...');

  const regions = [];

  if (fs.existsSync(processedElectoralDir)) {
    const depts = fs.readdirSync(processedElectoralDir).filter(f =>
      fs.statSync(path.join(processedElectoralDir, f)).isDirectory()
    );

    for (const dept of depts) {
      const metadataPath = path.join(processedElectoralDir, dept, 'metadata.json');

      if (fs.existsSync(metadataPath)) {
        const metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf-8'));

        // Try to load geographic metadata for center/zoom
        const geoPath = path.join(config.processedDir, 'geographic', `${dept}_map.json`);
        let mapCenter = [-34.8211, -56.225]; // Default: Montevideo
        let mapZoom = 11;

        if (fs.existsSync(geoPath)) {
          try {
            const geoData = JSON.parse(fs.readFileSync(geoPath, 'utf-8'));
            if (geoData.metadata) {
              mapCenter = geoData.metadata.center || mapCenter;
              mapZoom = geoData.metadata.zoom || mapZoom;
            }
          } catch (e) {
            // Use defaults
          }
        }

        regions.push({
          name: metadata.displayName || dept,
          slug: dept,
          odnCsvPath: `/${dept}_odn.csv`,   // Legacy paths
          oddCsvPath: `/${dept}_odd.csv`,
          geojsonPath: `/${dept}_map.json`,
          // New paths for processed JSON data
          odnJsonPath: `/data/electoral/${dept}/odn.json`,
          oddJsonPath: `/data/electoral/${dept}/odd.json`,
          mapJsonPath: `/data/geographic/${dept}_map.json`,
          mapCenter,
          mapZoom
        });
      }
    }
  }

  // Sort by name
  regions.sort((a, b) => a.name.localeCompare(b.name, 'es'));

  fs.writeFileSync(regionsPath, JSON.stringify(regions, null, 2));
  console.log(`    ✓ Generated with ${regions.length} regions`);
}

/**
 * Create zone mappings between CSV and GeoJSON
 */
export async function generateZoneMappings(config) {
  const processedElectoralDir = path.join(config.processedDir, 'electoral');
  const processedGeoDir = path.join(config.processedDir, 'geographic');
  const mappingsDir = config.mappingsDir;

  console.log('\n🔗 Generating zone mappings...\n');

  const mappings = {};

  if (!fs.existsSync(processedElectoralDir) || !fs.existsSync(processedGeoDir)) {
    console.log('  ⚠ Processed data not found. Run transform first.');
    return;
  }

  const depts = fs.readdirSync(processedElectoralDir).filter(f =>
    fs.statSync(path.join(processedElectoralDir, f)).isDirectory()
  );

  for (const dept of depts) {
    const odnPath = path.join(processedElectoralDir, dept, 'odn.json');
    const geoPath = path.join(processedGeoDir, `${dept}_map.json`);

    if (!fs.existsSync(odnPath) || !fs.existsSync(geoPath)) {
      console.log(`  ⚠ Skipping ${dept}: missing data files`);
      continue;
    }

    const odnData = JSON.parse(fs.readFileSync(odnPath, 'utf-8'));
    const geoData = JSON.parse(fs.readFileSync(geoPath, 'utf-8'));

    const csvZones = new Set(odnData.data.zoneList);
    const geoZones = new Set(geoData.features.map(f => f.properties.name));

    // Find matches and mismatches
    const matched = [];
    const unmatchedCSV = [];
    const unmatchedGeo = [];

    // Simple matching (exact)
    csvZones.forEach(csvZone => {
      if (geoZones.has(csvZone)) {
        matched.push({ csv: csvZone, geo: csvZone });
      } else {
        unmatchedCSV.push(csvZone);
      }
    });

    geoZones.forEach(geoZone => {
      if (!csvZones.has(geoZone)) {
        unmatchedGeo.push(geoZone);
      }
    });

    mappings[dept] = {
      matched: matched.length,
      unmatchedCSV,
      unmatchedGeo,
      csvToGeoJSON: Object.fromEntries(matched.map(m => [m.csv, m.geo])),
      geoJSONToCSV: Object.fromEntries(matched.map(m => [m.geo, m.csv]))
    };

    const matchRate = (matched.length / csvZones.size * 100).toFixed(1);
    console.log(`  ${dept}: ${matched.length}/${csvZones.size} zones matched (${matchRate}%)`);

    if (unmatchedCSV.length > 0) {
      console.log(`    ⚠ Unmatched CSV zones: ${unmatchedCSV.slice(0, 3).join(', ')}${unmatchedCSV.length > 3 ? '...' : ''}`);
    }
  }

  // Save mappings
  const outputPath = path.join(mappingsDir, 'zone-mappings.json');
  fs.writeFileSync(outputPath, JSON.stringify(mappings, null, 2));
  console.log(`\n✓ Zone mappings saved to ${outputPath}\n`);
}
