/**
 * ETL Extractors
 * Download raw data from official sources
 */

import fs from 'fs';
import path from 'path';
import https from 'https';
import http from 'http';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load sources configuration
const sourcesPath = path.join(__dirname, '..', 'config', 'sources.json');
const sources = JSON.parse(fs.readFileSync(sourcesPath, 'utf-8'));

/**
 * Download a file from URL
 */
function downloadFile(url, destPath) {
  return new Promise((resolve, reject) => {
    const protocol = url.startsWith('https') ? https : http;

    console.log(`  Downloading: ${url}`);

    const file = fs.createWriteStream(destPath);

    protocol.get(url, (response) => {
      // Handle redirects
      if (response.statusCode === 301 || response.statusCode === 302) {
        const redirectUrl = response.headers.location;
        console.log(`  Redirecting to: ${redirectUrl}`);
        downloadFile(redirectUrl, destPath).then(resolve).catch(reject);
        return;
      }

      if (response.statusCode !== 200) {
        reject(new Error(`HTTP ${response.statusCode}: ${url}`));
        return;
      }

      response.pipe(file);

      file.on('finish', () => {
        file.close();
        const stats = fs.statSync(destPath);
        const sizeMB = (stats.size / (1024 * 1024)).toFixed(2);
        console.log(`  ✓ Saved: ${path.basename(destPath)} (${sizeMB} MB)`);
        resolve(destPath);
      });
    }).on('error', (err) => {
      fs.unlink(destPath, () => {}); // Delete partial file
      reject(err);
    });
  });
}

/**
 * Extract electoral data from Corte Electoral
 */
export async function extractElectoralData(config) {
  const rawElectoralDir = path.join(config.rawDir, 'electoral');

  console.log('\n📊 Extracting Electoral Data\n');
  console.log(`Source: ${sources.electoral.name}`);
  console.log(`Destination: ${rawElectoralDir}\n`);

  const { baseUrl, resources, downloadUrl } = sources.electoral;

  for (const [resourceName, resource] of Object.entries(resources)) {
    const url = downloadUrl
      .replace('{resourceId}', resource.id)
      .replace('{filename}', resource.filename);

    const destPath = path.join(rawElectoralDir, resource.filename);

    // Check if file already exists
    if (fs.existsSync(destPath)) {
      const stats = fs.statSync(destPath);
      const sizeMB = (stats.size / (1024 * 1024)).toFixed(2);
      console.log(`  ⏭ Skipping ${resource.filename} (already exists, ${sizeMB} MB)`);
      continue;
    }

    try {
      await downloadFile(url, destPath);
    } catch (error) {
      console.log(`  ✗ Failed to download ${resource.filename}: ${error.message}`);
    }
  }

  console.log('\n✓ Electoral data extraction complete\n');
}

/**
 * Extract geographic data from IDE Uruguay and alternative sources
 */
export async function extractGeographicData(config) {
  const rawGeoDir = path.join(config.rawDir, 'geographic');

  console.log('\n🗺️ Extracting Geographic Data\n');
  console.log(`Source: ${sources.geographic.name}`);
  console.log(`Destination: ${rawGeoDir}\n`);

  // Download alternative sources (GitHub repos with GeoJSON)
  const alternativeSources = sources.geographic.alternativeSources;

  for (const [sourceName, sourceInfo] of Object.entries(alternativeSources)) {
    const destPath = path.join(rawGeoDir, `${sourceName}.geojson`);

    // Check if file already exists
    if (fs.existsSync(destPath)) {
      const stats = fs.statSync(destPath);
      const sizeMB = (stats.size / (1024 * 1024)).toFixed(2);
      console.log(`  ⏭ Skipping ${sourceName}.geojson (already exists, ${sizeMB} MB)`);
      continue;
    }

    try {
      await downloadFile(sourceInfo.url, destPath);
    } catch (error) {
      console.log(`  ✗ Failed to download ${sourceName}: ${error.message}`);
    }
  }

  console.log('\n✓ Geographic data extraction complete\n');
}

/**
 * Copy existing local files to raw directory (for migration)
 */
export async function migrateExistingData(config) {
  const publicDir = config.publicDir;
  const rawElectoralDir = path.join(config.rawDir, 'electoral');
  const rawGeoDir = path.join(config.rawDir, 'geographic');

  console.log('\n📂 Migrating existing data to raw/\n');

  // Find CSV and GeoJSON files in public/
  const files = fs.readdirSync(publicDir);

  for (const file of files) {
    const srcPath = path.join(publicDir, file);

    if (file.endsWith('.csv')) {
      const destPath = path.join(rawElectoralDir, file);
      if (!fs.existsSync(destPath)) {
        fs.copyFileSync(srcPath, destPath);
        console.log(`  ✓ Copied ${file} to raw/electoral/`);
      }
    } else if (file.endsWith('_map.json')) {
      const destPath = path.join(rawGeoDir, file);
      if (!fs.existsSync(destPath)) {
        fs.copyFileSync(srcPath, destPath);
        console.log(`  ✓ Copied ${file} to raw/geographic/`);
      }
    }
  }

  console.log('\n✓ Migration complete\n');
}
