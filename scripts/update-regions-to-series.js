import fs from 'fs';

console.log('🔄 Updating regions.json to use series maps...\n');

const regionsPath = 'public/regions.json';
const regions = JSON.parse(fs.readFileSync(regionsPath, 'utf8'));

// Update each region to use series map
regions.forEach(region => {
  const slug = region.slug;

  // For Montevideo, keep using the barrios map
  if (slug === 'montevideo') {
    console.log(`  ✓ ${region.name.padEnd(20)} keeping barrios map`);
    return;
  }

  // For all other departments, use series map
  region.mapJsonPath = `/data/geographic/${slug}_series_map.json`;
  console.log(`  ✓ ${region.name.padEnd(20)} → ${slug}_series_map.json`);
});

// Save updated regions.json
fs.writeFileSync(regionsPath, JSON.stringify(regions, null, 2));

console.log('\n✅ Updated regions.json');
