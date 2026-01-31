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
export async function loadToPublic(config, electionId = null) {
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
    // Check if we have election-specific subdirectories
    const items = fs.readdirSync(processedElectoralDir);

    // Check if items include election IDs (e.g., internas-2024, nacionales-2019)
    const hasElectionDirs = items.some(item => {
      const itemPath = path.join(processedElectoralDir, item);
      if (!fs.statSync(itemPath).isDirectory()) return false;
      return item.includes('-20'); // Election ID pattern
    });

    if (hasElectionDirs) {
      // New structure: data/processed/electoral/{election}/{dept}/
      console.log('  Detected election-specific structure');

      const elections = items.filter(item => {
        const itemPath = path.join(processedElectoralDir, item);
        return fs.statSync(itemPath).isDirectory() && item.includes('-20');
      });

      // If specific election requested, only process that one
      const electionsToProcess = electionId
        ? elections.filter(e => e === electionId || e === `internas-${electionId}`)
        : elections;

      for (const election of electionsToProcess) {
        const electionSrcDir = path.join(processedElectoralDir, election);
        const electionDestDir = path.join(publicElectoralDir, election);

        if (!fs.existsSync(electionDestDir)) {
          fs.mkdirSync(electionDestDir, { recursive: true });
        }

        const depts = fs.readdirSync(electionSrcDir).filter(f =>
          fs.statSync(path.join(electionSrcDir, f)).isDirectory()
        );

        console.log(`  ${election}: ${depts.length} departments`);

        for (const dept of depts) {
          const srcDir = path.join(electionSrcDir, dept);
          const destDir = path.join(electionDestDir, dept);

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
    } else {
      // Old structure: data/processed/electoral/{dept}/
      const depts = items.filter(f =>
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
  await generateRegionsConfig(config, electionId);

  console.log('\n✓ Data loaded to public/\n');
}

/**
 * Generate regions.json configuration from processed data
 */
async function generateRegionsConfig(config, electionId = null) {
  const processedElectoralDir = path.join(config.processedDir, 'electoral');
  const regionsPath = path.join(config.publicDir, 'regions.json');

  console.log('\n  Generating regions.json...');

  const regions = [];
  const electionsByDept = {};

  if (fs.existsSync(processedElectoralDir)) {
    const items = fs.readdirSync(processedElectoralDir);

    // Check for election-specific structure
    const hasElectionDirs = items.some(item => {
      const itemPath = path.join(processedElectoralDir, item);
      return fs.statSync(itemPath).isDirectory() && item.includes('-20');
    });

    if (hasElectionDirs) {
      // New structure: data/processed/electoral/{election}/{dept}/
      const elections = items.filter(item => {
        const itemPath = path.join(processedElectoralDir, item);
        return fs.statSync(itemPath).isDirectory() && item.includes('-20');
      });

      // Build department -> elections mapping
      for (const election of elections) {
        const electionDir = path.join(processedElectoralDir, election);
        const depts = fs.readdirSync(electionDir).filter(f =>
          fs.statSync(path.join(electionDir, f)).isDirectory()
        );

        for (const dept of depts) {
          if (!electionsByDept[dept]) {
            electionsByDept[dept] = [];
          }
          electionsByDept[dept].push(election);
        }
      }

      // Use internas-2024 as base (or first election with most departments)
      const baseElection = electionId || elections.find(e => e === 'internas-2024') || elections[0];
      const baseDeptDir = path.join(processedElectoralDir, baseElection);

      const depts = fs.readdirSync(baseDeptDir).filter(f =>
        fs.statSync(path.join(baseDeptDir, f)).isDirectory()
      );

      for (const dept of depts) {
        const metadataPath = path.join(baseDeptDir, dept, 'metadata.json');

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
            // Legacy paths (for backwards compatibility)
            odnCsvPath: `/${dept}_odn.csv`,
            oddCsvPath: `/${dept}_odd.csv`,
            geojsonPath: `/${dept}_map.json`,
            // Default election paths
            odnJsonPath: `/data/electoral/${baseElection}/${dept}/odn.json`,
            oddJsonPath: `/data/electoral/${baseElection}/${dept}/odd.json`,
            mapJsonPath: `/data/geographic/${dept}_map.json`,
            // Available elections for this department
            availableElections: electionsByDept[dept] || [baseElection],
            defaultElection: baseElection,
            mapCenter,
            mapZoom
          });
        }
      }
    } else {
      // Old structure: data/processed/electoral/{dept}/
      const depts = items.filter(f =>
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
            availableElections: ['internas-2024'],
            defaultElection: 'internas-2024',
            mapCenter,
            mapZoom
          });
        }
      }
    }
  }

  // Sort by name
  regions.sort((a, b) => a.name.localeCompare(b.name, 'es'));

  fs.writeFileSync(regionsPath, JSON.stringify(regions, null, 2));
  console.log(`    ✓ Generated with ${regions.length} regions`);

  // Also generate elections metadata file
  if (electionsByDept && Object.keys(electionsByDept).length > 0) {
    const allElections = [...new Set(Object.values(electionsByDept).flat())].sort();
    const electionsMetaPath = path.join(config.publicDir, 'data', 'elections-meta.json');

    fs.writeFileSync(electionsMetaPath, JSON.stringify({
      availableElections: allElections,
      departmentsByElection: Object.entries(electionsByDept).reduce((acc, [dept, elections]) => {
        elections.forEach(election => {
          if (!acc[election]) acc[election] = [];
          acc[election].push(dept);
        });
        return acc;
      }, {}),
      generatedAt: new Date().toISOString()
    }, null, 2));

    console.log(`    ✓ Generated elections-meta.json with ${allElections.length} elections`);
  }
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
