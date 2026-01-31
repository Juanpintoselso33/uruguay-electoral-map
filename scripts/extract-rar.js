import { createExtractorFromFile } from 'node-unrar-js';
import fs from 'fs';
import path from 'path';

const rarPath = 'data/raw/barrios/rivera_barrios.zip';
const outputDir = 'data/raw/barrios/';

async function extractRar() {
  try {
    const extractor = await createExtractorFromFile({ filepath: rarPath, targetPath: outputDir });
    const extracted = extractor.extract();
    const files = [...extracted.files];

    console.log('Extracted files:');
    files.forEach(file => {
      console.log(`  - ${file.fileHeader.name}`);
    });

    console.log('\n✅ Extraction complete!');
  } catch (error) {
    console.error('Error extracting RAR:', error);
  }
}

extractRar();
