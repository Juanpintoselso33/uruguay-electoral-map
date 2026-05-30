/**
 * Aggressive GeoJSON Simplifier
 * Applies heavy simplification to reduce file size
 */

import fs from 'fs';
import path from 'path';

/**
 * Douglas-Peucker algorithm for line simplification
 */
function douglasPeucker(points, tolerance) {
  if (points.length <= 2) return points;

  // Find the point with maximum distance
  let maxDist = 0;
  let maxIndex = 0;

  const end = points.length - 1;
  for (let i = 1; i < end; i++) {
    const dist = perpendicularDistance(points[i], points[0], points[end]);
    if (dist > maxDist) {
      maxDist = dist;
      maxIndex = i;
    }
  }

  // If max distance is greater than tolerance, recursively simplify
  if (maxDist > tolerance) {
    const left = douglasPeucker(points.slice(0, maxIndex + 1), tolerance);
    const right = douglasPeucker(points.slice(maxIndex), tolerance);
    return left.slice(0, -1).concat(right);
  }

  return [points[0], points[end]];
}

/**
 * Calculate perpendicular distance from point to line
 */
function perpendicularDistance(point, lineStart, lineEnd) {
  const [px, py] = point;
  const [x1, y1] = lineStart;
  const [x2, y2] = lineEnd;

  const dx = x2 - x1;
  const dy = y2 - y1;

  if (dx === 0 && dy === 0) {
    return Math.sqrt((px - x1) ** 2 + (py - y1) ** 2);
  }

  const t = ((px - x1) * dx + (py - y1) * dy) / (dx * dx + dy * dy);
  const clampedT = Math.max(0, Math.min(1, t));

  const closestX = x1 + clampedT * dx;
  const closestY = y1 + clampedT * dy;

  return Math.sqrt((px - closestX) ** 2 + (py - closestY) ** 2);
}

/**
 * Simplify coordinates recursively
 */
function simplifyCoordinates(coords, tolerance) {
  if (!coords || coords.length === 0) return coords;

  // Check if it's a point (2D coordinate)
  if (typeof coords[0] === 'number') {
    return coords;
  }

  // Check if it's a linear ring (array of points)
  if (typeof coords[0][0] === 'number') {
    return douglasPeucker(coords, tolerance);
  }

  // It's an array of rings or multi-geometry
  return coords.map(c => simplifyCoordinates(c, tolerance));
}

/**
 * Simplify GeoJSON geometry
 */
function simplifyGeometry(geometry, tolerance) {
  if (!geometry || !geometry.coordinates) return geometry;

  return {
    ...geometry,
    coordinates: simplifyCoordinates(geometry.coordinates, tolerance)
  };
}

/**
 * Simplify entire GeoJSON
 */
function simplifyGeoJSON(geojson, tolerance = 0.001) {
  if (geojson.type !== 'FeatureCollection') {
    throw new Error('Expected FeatureCollection');
  }

  return {
    ...geojson,
    features: geojson.features.map(feature => ({
      ...feature,
      geometry: simplifyGeometry(feature.geometry, tolerance)
    }))
  };
}

// Main execution
if (process.argv.length < 3) {
  console.log('Usage: node aggressive-simplifier.js <input_file> [tolerance]');
  console.log('  tolerance: higher = more aggressive (default: 0.001)');
  process.exit(1);
}

const inputPath = process.argv[2];
const tolerance = parseFloat(process.argv[3]) || 0.001;

console.log(`\nSimplifying: ${inputPath}`);
console.log(`Tolerance: ${tolerance}\n`);

const originalSize = fs.statSync(inputPath).size;
const geojson = JSON.parse(fs.readFileSync(inputPath, 'utf-8'));

// Count original vertices
let originalVertices = 0;
function countVertices(coords) {
  if (typeof coords[0] === 'number') return 1;
  return coords.reduce((sum, c) => sum + countVertices(c), 0);
}
geojson.features.forEach(f => {
  originalVertices += countVertices(f.geometry.coordinates);
});

// Simplify
const simplified = simplifyGeoJSON(geojson, tolerance);

// Count new vertices
let newVertices = 0;
simplified.features.forEach(f => {
  newVertices += countVertices(f.geometry.coordinates);
});

// Save
fs.writeFileSync(inputPath, JSON.stringify(simplified));
const newSize = fs.statSync(inputPath).size;

console.log('Results:');
console.log(`  Original: ${(originalSize / 1024 / 1024).toFixed(2)} MB, ${originalVertices.toLocaleString()} vertices`);
console.log(`  Simplified: ${(newSize / 1024 / 1024).toFixed(2)} MB, ${newVertices.toLocaleString()} vertices`);
console.log(`  Reduction: ${((1 - newSize / originalSize) * 100).toFixed(1)}%`);
console.log(`  Vertices reduced: ${((1 - newVertices / originalVertices) * 100).toFixed(1)}%\n`);

if (newSize / 1024 / 1024 > 3) {
  console.log(`⚠ Still exceeds 3MB. Try higher tolerance (e.g., ${(tolerance * 2).toFixed(4)})\n`);
} else {
  console.log(`✓ File is now under 3MB!\n`);
}
