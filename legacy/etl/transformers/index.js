/**
 * ETL Transformers
 * Process and normalize raw data
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load configuration
const sourcesPath = path.join(__dirname, '..', 'config', 'sources.json');
const schemasPath = path.join(__dirname, '..', 'config', 'schemas.json');
const sources = JSON.parse(fs.readFileSync(sourcesPath, 'utf-8'));
const schemas = JSON.parse(fs.readFileSync(schemasPath, 'utf-8'));

/**
 * Simple CSV parser
 */
function parseCSV(content) {
  // Remove BOM if present
  if (content.charCodeAt(0) === 0xFEFF) {
    content = content.slice(1);
  }

  const lines = content.split('\n').filter(line => line.trim());
  if (lines.length === 0) return { headers: [], data: [] };

  // Parse header, handling empty first column (Maldonado issue)
  let headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));

  // Remove empty first column if present
  if (headers[0] === '') {
    headers = headers.slice(1);
  }

  const data = lines.slice(1).map((line, index) => {
    let values = line.split(',').map(v => v.trim().replace(/"/g, ''));

    // Handle empty first column
    if (values.length > headers.length && values[0] === '') {
      values = values.slice(1);
    }

    const row = {};
    headers.forEach((header, i) => {
      row[header] = values[i] || '';
    });
    row._rowIndex = index + 2;
    return row;
  });

  return { headers, data };
}

/**
 * Detect election schema from CSV headers
 */
function detectElectionSchema(headers) {
  const headerSet = new Set(headers);

  // Check for internas schema (PARTIDO, DEPTO, HOJA, CNT_VOTOS, ZONA)
  if (headerSet.has('PARTIDO') && headerSet.has('HOJA') && headerSet.has('CNT_VOTOS') && headerSet.has('ZONA')) {
    return 'internas';
  }

  // Check for nacionales schema (TipoRegistro, Departamento, Lema, Descripcion1, CantidadVotos)
  if (headerSet.has('TipoRegistro') && headerSet.has('Lema') && headerSet.has('Descripcion1') && headerSet.has('CantidadVotos')) {
    return 'nacionales';
  }

  // Default to internas
  return 'internas';
}

/**
 * Normalize row data based on schema
 */
function normalizeRow(row, schemaType) {
  if (schemaType === 'nacionales') {
    return {
      HOJA: row.Descripcion1 || '',
      ZONA: row.CRV || row.Series || '', // Use CRV or Series as zone
      PARTIDO: row.Lema || '',
      PRECANDIDATO: '',
      CNT_VOTOS: row.CantidadVotos || '0'
    };
  }

  // internas schema (default)
  return {
    HOJA: row.HOJA || '',
    ZONA: row.ZONA || '',
    PARTIDO: row.PARTIDO || '',
    PRECANDIDATO: row.PRECANDIDATO || '',
    CNT_VOTOS: row.CNT_VOTOS || '0'
  };
}

/**
 * Process electoral CSV data for a department
 */
function processElectoralCSV(csvContent, type) {
  const { headers, data } = parseCSV(csvContent);

  // Detect schema type
  const schemaType = detectElectionSchema(headers);

  const votosPorListas = {};
  const maxVotosPorListas = {};
  const partiesByList = {};
  const precandidatosByList = {};
  const zones = new Set();
  const parties = new Set();
  const lists = new Set();

  let totalVotes = 0;

  data.forEach(row => {
    // Skip VOTO_LEMA records in nacionales (only process HOJA_EN)
    if (schemaType === 'nacionales' && row.TipoRegistro && row.TipoRegistro !== 'HOJA_EN') {
      return;
    }

    // Normalize row based on schema
    const normalized = normalizeRow(row, schemaType);

    if (!normalized.HOJA) return;

    const hoja = normalized.HOJA;
    const zona = normalized.ZONA || '';
    const partido = normalized.PARTIDO || '';
    const precandidato = normalized.PRECANDIDATO || '';
    const votos = parseInt(normalized.CNT_VOTOS, 10) || 0;

    // Initialize structures
    if (!votosPorListas[hoja]) {
      votosPorListas[hoja] = {};
      maxVotosPorListas[hoja] = 0;
      partiesByList[hoja] = partido;
      if (precandidato) {
        precandidatosByList[hoja] = precandidato;
      }
    }

    // Aggregate votes
    votosPorListas[hoja][zona] = (votosPorListas[hoja][zona] || 0) + votos;
    maxVotosPorListas[hoja] = Math.max(maxVotosPorListas[hoja], votosPorListas[hoja][zona]);
    totalVotes += votos;

    // Track unique values
    if (zona) zones.add(zona);
    if (partido) parties.add(partido);
    lists.add(hoja);
  });

  return {
    metadata: {
      type,
      schemaType,
      processedAt: new Date().toISOString(),
      stats: {
        totalRows: data.length,
        uniqueLists: lists.size,
        uniqueZones: zones.size,
        uniqueParties: parties.size,
        totalVotes
      }
    },
    data: {
      votosPorListas,
      maxVotosPorListas,
      partiesByList,
      precandidatosByList: type === 'odn' ? precandidatosByList : {},
      zoneList: Array.from(zones).sort(),
      partyList: Array.from(parties).sort()
    }
  };
}

/**
 * Transform electoral data
 */
export async function transformElectoralData(config, department = null, electionId = null) {
  let rawDir = path.join(config.rawDir, 'electoral');
  let processedDir = path.join(config.processedDir, 'electoral');

  console.log('\n📊 Transforming Electoral Data\n');

  // If specific election, use election subdirectory
  if (electionId) {
    const electionKey = electionId.includes('-') ? electionId : `internas-${electionId}`;
    console.log(`Election: ${electionKey}`);
    rawDir = path.join(rawDir, electionKey);
    processedDir = path.join(processedDir, electionKey);

    if (!fs.existsSync(processedDir)) {
      fs.mkdirSync(processedDir, { recursive: true });
    }

    // If election has master CSV, need to split it first
    const masterCSV = path.join(rawDir, 'desglose-de-votos.csv');
    if (fs.existsSync(masterCSV)) {
      console.log('  Master CSV found, splitting by department...\n');
      await splitMasterCSV(masterCSV, rawDir);
    }
  }

  // Find CSV files to process
  const files = fs.readdirSync(rawDir).filter(f => f.endsWith('.csv') && !f.startsWith('desglose-de-votos'));

  // Group by department
  const deptFiles = {};
  files.forEach(file => {
    const match = file.match(/^(.+)_(odn|odd)\.csv$/);
    if (match) {
      const [, dept, type] = match;
      if (!deptFiles[dept]) deptFiles[dept] = {};
      deptFiles[dept][type] = file;
    }
  });

  // Process each department
  for (const [dept, types] of Object.entries(deptFiles)) {
    // Skip if specific department requested and this isn't it
    if (department && dept !== department) continue;

    console.log(`  Processing: ${dept}`);

    const deptDir = path.join(processedDir, dept);
    if (!fs.existsSync(deptDir)) {
      fs.mkdirSync(deptDir, { recursive: true });
    }

    // Process ODN
    if (types.odn) {
      const csvPath = path.join(rawDir, types.odn);
      const csvContent = fs.readFileSync(csvPath, 'utf-8');
      const processed = processElectoralCSV(csvContent, 'odn');
      processed.metadata.department = dept;
      if (electionId) processed.metadata.election = electionId;

      const outputPath = path.join(deptDir, 'odn.json');
      fs.writeFileSync(outputPath, JSON.stringify(processed, null, 2));
      console.log(`    ✓ ODN: ${processed.metadata.stats.uniqueLists} lists, ${processed.metadata.stats.uniqueZones} zones`);
    }

    // Process ODD
    if (types.odd) {
      const csvPath = path.join(rawDir, types.odd);
      const csvContent = fs.readFileSync(csvPath, 'utf-8');
      const processed = processElectoralCSV(csvContent, 'odd');
      processed.metadata.department = dept;
      if (electionId) processed.metadata.election = electionId;

      const outputPath = path.join(deptDir, 'odd.json');
      fs.writeFileSync(outputPath, JSON.stringify(processed, null, 2));
      console.log(`    ✓ ODD: ${processed.metadata.stats.uniqueLists} lists, ${processed.metadata.stats.totalVotes.toLocaleString()} votes`);
    }

    // Create metadata file
    const metadataPath = path.join(deptDir, 'metadata.json');
    fs.writeFileSync(metadataPath, JSON.stringify({
      department: dept,
      displayName: sources.departments.codes[dept.toUpperCase()] ||
                   dept.charAt(0).toUpperCase() + dept.slice(1).replace(/_/g, ' '),
      election: electionId || 'internas-2024',
      processedAt: new Date().toISOString(),
      files: {
        odn: types.odn ? 'odn.json' : null,
        odd: types.odd ? 'odd.json' : null
      }
    }, null, 2));
  }

  console.log('\n✓ Electoral data transformation complete\n');
}

/**
 * Split master CSV by department (helper for elections with single master file)
 */
async function splitMasterCSV(masterPath, outputDir) {
  const content = fs.readFileSync(masterPath, 'utf-8');
  const lines = content.split('\n');
  const header = lines[0];

  const deptData = {};

  // Group by department and type
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const parts = line.split(',');
    const tipoRegistro = parts[0];
    const deptCode = parts[1];

    if (!deptCode) continue;

    const deptName = sources.departments.codes[deptCode];
    if (!deptName) continue;

    const deptSlug = sources.departments.slugs[deptName];
    if (!deptSlug) continue;

    const type = tipoRegistro.includes('ODN') ? 'odn' : 'odd';
    const key = `${deptSlug}_${type}`;

    if (!deptData[key]) {
      deptData[key] = [header];
    }

    deptData[key].push(line);
  }

  // Write files
  for (const [key, lines] of Object.entries(deptData)) {
    const filePath = path.join(outputDir, `${key}.csv`);
    fs.writeFileSync(filePath, lines.join('\n'));
  }

  console.log(`  Split into ${Object.keys(deptData).length / 2} departments\n`);
}

/**
 * Normalize GeoJSON properties
 */
function normalizeGeoJSON(geojson, department) {
  const zoneIdentifiers = schemas.geojson.featureProperties.zoneIdentifiers;

  const normalized = {
    type: 'FeatureCollection',
    metadata: {
      department,
      processedAt: new Date().toISOString(),
      featureCount: geojson.features.length
    },
    features: geojson.features.map((feature, index) => {
      // Find zone name from various possible properties
      let zoneName = '';
      let originalProp = '';

      for (const prop of zoneIdentifiers) {
        if (feature.properties && feature.properties[prop]) {
          zoneName = feature.properties[prop];
          originalProp = prop;
          break;
        }
      }

      // Preserve serie property separately for electoral data matching
      // Convert to lowercase for consistent matching with electoral data
      const serieValue = feature.properties?.serie || feature.properties?.SERIE || '';
      const normalizedSerie = serieValue ? serieValue.toLowerCase() : '';

      return {
        type: 'Feature',
        geometry: feature.geometry,
        properties: {
          id: `${department}_${index}`,
          name: zoneName,
          originalName: zoneName,
          originalProperty: originalProp,
          department,
          // Include serie in lowercase for direct matching with electoral data
          serie: normalizedSerie,
          // Also include BARRIO and zona if they exist for backwards compatibility
          BARRIO: feature.properties?.BARRIO || feature.properties?.barrio || normalizedSerie || zoneName,
          zona: feature.properties?.zona || normalizedSerie || zoneName
        }
      };
    })
  };

  // Calculate bounds and center
  let minLng = Infinity, maxLng = -Infinity;
  let minLat = Infinity, maxLat = -Infinity;

  function processCoords(coords) {
    if (typeof coords[0] === 'number') {
      const [lng, lat] = coords;
      minLng = Math.min(minLng, lng);
      maxLng = Math.max(maxLng, lng);
      minLat = Math.min(minLat, lat);
      maxLat = Math.max(maxLat, lat);
    } else {
      coords.forEach(processCoords);
    }
  }

  normalized.features.forEach(f => processCoords(f.geometry.coordinates));

  normalized.metadata.bounds = {
    north: maxLat,
    south: minLat,
    east: maxLng,
    west: minLng
  };

  normalized.metadata.center = [
    (minLat + maxLat) / 2,
    (minLng + maxLng) / 2
  ];

  // Calculate appropriate zoom
  const maxSpan = Math.max(maxLng - minLng, maxLat - minLat);
  normalized.metadata.zoom = Math.min(13, Math.max(9, Math.round(8 - Math.log2(maxSpan))));

  return normalized;
}

/**
 * Reduce coordinate precision
 */
function reduceCoordinatePrecision(coords, precision = 5) {
  const factor = Math.pow(10, precision);
  const round = (num) => Math.round(num * factor) / factor;

  if (typeof coords[0] === 'number') {
    return coords.map(round);
  }
  return coords.map(c => reduceCoordinatePrecision(c, precision));
}

/**
 * Transform geographic data
 */
export async function transformGeographicData(config, department = null) {
  const rawDir = path.join(config.rawDir, 'geographic');
  const processedDir = path.join(config.processedDir, 'geographic');

  console.log('\n🗺️ Transforming Geographic Data\n');

  if (!fs.existsSync(processedDir)) {
    fs.mkdirSync(processedDir, { recursive: true });
  }

  // Find GeoJSON files
  const files = fs.readdirSync(rawDir).filter(f =>
    f.endsWith('.json') || f.endsWith('.geojson')
  );

  for (const file of files) {
    const match = file.match(/^(.+?)(?:_map|_raw)?\.(?:geo)?json$/);
    if (!match) continue;

    const dept = match[1];

    // Skip if specific department requested and this isn't it
    if (department && dept !== department) continue;

    console.log(`  Processing: ${file}`);

    const inputPath = path.join(rawDir, file);
    const originalSize = fs.statSync(inputPath).size;

    try {
      const content = fs.readFileSync(inputPath, 'utf-8');
      const geojson = JSON.parse(content);

      // Normalize
      const normalized = normalizeGeoJSON(geojson, dept);

      // Reduce precision
      normalized.features = normalized.features.map(f => ({
        ...f,
        geometry: {
          ...f.geometry,
          coordinates: reduceCoordinatePrecision(f.geometry.coordinates)
        }
      }));

      // Save
      const outputPath = path.join(processedDir, `${dept}_map.json`);
      const output = JSON.stringify(normalized);
      fs.writeFileSync(outputPath, output);

      const newSize = fs.statSync(outputPath).size;
      const reduction = ((1 - newSize / originalSize) * 100).toFixed(1);

      console.log(`    ✓ ${normalized.metadata.featureCount} features`);
      console.log(`    ✓ Size: ${(originalSize / 1024 / 1024).toFixed(2)} MB → ${(newSize / 1024 / 1024).toFixed(2)} MB (${reduction}% reduction)`);

      if (newSize / 1024 / 1024 > 3) {
        console.log(`    ⚠ Warning: Still exceeds 3MB limit. Consider using mapshaper for simplification.`);
      }
    } catch (error) {
      console.log(`    ✗ Error: ${error.message}`);
    }
  }

  console.log('\n✓ Geographic data transformation complete\n');
}
