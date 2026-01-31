#!/usr/bin/env node

/**
 * validate-csv.js
 * Validates electoral CSV data files against the required schema
 *
 * Usage:
 *   node scripts/validate-csv.js <department> [--type odn|odd|both]
 *   node scripts/validate-csv.js montevideo
 *   node scripts/validate-csv.js canelones --type odn
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PUBLIC_DIR = path.join(__dirname, '..', 'public');

// Required CSV columns
const REQUIRED_COLUMNS = [
  'PARTIDO',
  'DEPTO',
  'CIRCUITO',
  'SERIES',
  'ESCRUTINIO',
  'PRECANDIDATO',
  'HOJA',
  'CNT_VOTOS',
  'ZONA'
];

// Parse command line arguments
function parseArgs() {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.error('Usage: node validate-csv.js <department> [--type odn|odd|both]');
    process.exit(1);
  }

  const department = args[0].toLowerCase().replace(/\s+/g, '_');
  let type = 'both';

  const typeIndex = args.indexOf('--type');
  if (typeIndex !== -1 && args[typeIndex + 1]) {
    type = args[typeIndex + 1].toLowerCase();
    if (!['odn', 'odd', 'both'].includes(type)) {
      console.error('Invalid type. Use: odn, odd, or both');
      process.exit(1);
    }
  }

  return { department, type };
}

// Simple CSV parser (basic implementation)
function parseCSV(content) {
  const lines = content.split('\n').filter(line => line.trim());
  if (lines.length === 0) return { headers: [], data: [] };

  const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
  const data = lines.slice(1).map((line, index) => {
    const values = line.split(',').map(v => v.trim().replace(/"/g, ''));
    const row = {};
    headers.forEach((header, i) => {
      row[header] = values[i] || '';
    });
    row._rowIndex = index + 2; // 1-indexed, accounting for header
    return row;
  });

  return { headers, data };
}

// Validate CSV schema
function validateSchema(headers) {
  const missing = REQUIRED_COLUMNS.filter(col => !headers.includes(col));
  const extra = headers.filter(col => !REQUIRED_COLUMNS.includes(col) && col);

  return {
    valid: missing.length === 0,
    missing,
    extra
  };
}

// Validate individual rows
function validateRows(data) {
  const issues = [];
  const seen = new Map();

  data.forEach(row => {
    const rowNum = row._rowIndex;

    // Validate CNT_VOTOS
    const votes = parseInt(row.CNT_VOTOS, 10);
    if (isNaN(votes)) {
      issues.push({
        severity: 'error',
        code: 'E005',
        message: `Invalid vote count: "${row.CNT_VOTOS}"`,
        row: rowNum
      });
    } else if (votes < 0) {
      issues.push({
        severity: 'warning',
        code: 'W001',
        message: `Negative vote count: ${votes}`,
        row: rowNum
      });
    }

    // Validate HOJA
    if (row.HOJA && !/^\d+$/.test(row.HOJA)) {
      issues.push({
        severity: 'warning',
        code: 'W005',
        message: `Non-numeric list number: "${row.HOJA}"`,
        row: rowNum
      });
    }

    // Validate required non-empty fields
    ['PARTIDO', 'ZONA'].forEach(field => {
      if (!row[field] || row[field].trim() === '') {
        issues.push({
          severity: 'error',
          code: 'E006',
          message: `Empty required field: ${field}`,
          row: rowNum
        });
      }
    });

    // Check for duplicates
    const key = `${row.HOJA}|${row.ZONA}`;
    if (seen.has(key)) {
      issues.push({
        severity: 'warning',
        code: 'W002',
        message: `Duplicate HOJA+ZONA: Lista ${row.HOJA}, ${row.ZONA}`,
        rows: [seen.get(key), rowNum]
      });
    } else {
      seen.set(key, rowNum);
    }
  });

  return issues;
}

// Calculate statistics
function calculateStats(data) {
  const votesByList = {};
  const votesByZone = {};
  const partiesByList = {};
  const precandidatosByList = {};

  data.forEach(row => {
    const votes = parseInt(row.CNT_VOTOS, 10) || 0;

    votesByList[row.HOJA] = (votesByList[row.HOJA] || 0) + votes;
    votesByZone[row.ZONA] = (votesByZone[row.ZONA] || 0) + votes;

    if (!partiesByList[row.HOJA]) {
      partiesByList[row.HOJA] = row.PARTIDO;
    }
    if (!precandidatosByList[row.HOJA]) {
      precandidatosByList[row.HOJA] = row.PRECANDIDATO;
    }
  });

  return {
    totalRows: data.length,
    uniqueLists: Object.keys(votesByList).length,
    uniqueZones: Object.keys(votesByZone).length,
    uniqueParties: new Set(Object.values(partiesByList)).size,
    uniquePrecandidatos: new Set(Object.values(precandidatosByList).filter(Boolean)).size,
    totalVotes: Object.values(votesByList).reduce((a, b) => a + b, 0),
    avgVotesPerList: Math.round(
      Object.values(votesByList).reduce((a, b) => a + b, 0) /
      Object.keys(votesByList).length
    )
  };
}

// Validate a single CSV file
function validateFile(filePath) {
  const result = {
    file: filePath,
    exists: false,
    valid: false,
    schema: null,
    statistics: null,
    issues: []
  };

  // Check if file exists
  if (!fs.existsSync(filePath)) {
    result.issues.push({
      severity: 'error',
      code: 'E004',
      message: 'File not found'
    });
    return result;
  }

  result.exists = true;

  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    const { headers, data } = parseCSV(content);

    // Validate schema
    result.schema = validateSchema(headers);
    if (!result.schema.valid) {
      result.issues.push({
        severity: 'error',
        code: 'E001',
        message: `Missing columns: ${result.schema.missing.join(', ')}`
      });
    }

    // Validate rows
    if (result.schema.valid) {
      const rowIssues = validateRows(data);
      result.issues.push(...rowIssues);
      result.statistics = calculateStats(data);
    }

    // Determine overall validity
    result.valid = result.issues.filter(i => i.severity === 'error').length === 0;

  } catch (error) {
    result.issues.push({
      severity: 'error',
      code: 'E003',
      message: `Parse error: ${error.message}`
    });
  }

  return result;
}

// Print validation report
function printReport(department, results) {
  console.log('\n' + '═'.repeat(60));
  console.log(`Validation Report: ${department}`);
  console.log('═'.repeat(60) + '\n');

  Object.entries(results).forEach(([type, result]) => {
    const typeLabel = type.toUpperCase();
    console.log(`${typeLabel} CSV: ${result.file}`);

    if (!result.exists) {
      console.log(`├── Status: ✗ File not found\n`);
      return;
    }

    const status = result.valid ? '✓ Valid' : (
      result.issues.some(i => i.severity === 'error') ? '✗ Error' : '⚠ Warning'
    );
    console.log(`├── Status: ${status}`);

    if (result.statistics) {
      console.log(`├── Rows: ${result.statistics.totalRows.toLocaleString()}`);
      console.log(`├── Lists: ${result.statistics.uniqueLists}`);
      console.log(`├── Zones: ${result.statistics.uniqueZones}`);
      console.log(`├── Parties: ${result.statistics.uniqueParties}`);
      console.log(`└── Total Votes: ${result.statistics.totalVotes.toLocaleString()}`);
    }

    if (result.issues.length > 0) {
      console.log(`\n    Issues (${result.issues.length}):`);
      result.issues.slice(0, 10).forEach(issue => {
        const icon = issue.severity === 'error' ? '✗' : '⚠';
        const rowInfo = issue.row ? ` (row ${issue.row})` : '';
        console.log(`    ${icon} [${issue.code}] ${issue.message}${rowInfo}`);
      });
      if (result.issues.length > 10) {
        console.log(`    ... and ${result.issues.length - 10} more issues`);
      }
    }

    console.log('');
  });

  // Overall status
  const hasErrors = Object.values(results).some(r =>
    r.issues.some(i => i.severity === 'error')
  );
  const hasWarnings = Object.values(results).some(r =>
    r.issues.some(i => i.severity === 'warning')
  );

  console.log('─'.repeat(60));
  if (hasErrors) {
    console.log('Overall: ✗ FAILED - Fix errors before proceeding\n');
    process.exit(1);
  } else if (hasWarnings) {
    console.log('Overall: ⚠ PASSED WITH WARNINGS\n');
  } else {
    console.log('Overall: ✓ PASSED\n');
  }
}

// Main execution
function main() {
  const { department, type } = parseArgs();

  console.log(`\nValidating ${department} (${type})...`);

  const results = {};

  if (type === 'odn' || type === 'both') {
    const odnPath = path.join(PUBLIC_DIR, `${department}_odn.csv`);
    results.odn = validateFile(odnPath);
  }

  if (type === 'odd' || type === 'both') {
    const oddPath = path.join(PUBLIC_DIR, `${department}_odd.csv`);
    results.odd = validateFile(oddPath);
  }

  printReport(department, results);
}

main();
