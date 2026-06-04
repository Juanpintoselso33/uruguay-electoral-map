// Valida que los recursos servidos cumplen los JSON-Schema publicados (contrato v1).
// Uso: node scripts/gate-api-contract.mjs
import { readFileSync, existsSync } from 'node:fs';
import Ajv from 'ajv/dist/2020.js';

const ajv = new Ajv({ allErrors: true, strict: false });
const load = (p) => JSON.parse(readFileSync(p, 'utf-8'));

const checks = [
  ['public/api/v1/index.json', 'public/api/v1/schema/index.schema.json'],
  ['public/data/nacionales-2024/montevideo/votes.json', 'public/api/v1/schema/votes.schema.json'],
  ['public/data/nacionales-2024/montevideo/catalogo.json', 'public/api/v1/schema/catalogo.schema.json'],
  ['public/api/v1/candidatos/index.json', 'public/api/v1/schema/candidatos-index.schema.json'],
  ['public/api/v1/candidatos/legisladores.json', 'public/api/v1/schema/legisladores.schema.json'],
];

let failed = false;
for (const [data, schema] of checks) {
  if (!existsSync(data) || !existsSync(schema)) {
    console.error(`[gate:api] falta ${existsSync(data) ? schema : data}`); failed = true; continue;
  }
  const validate = ajv.compile(load(schema));
  if (!validate(load(data))) {
    console.error(`[gate:api] ${data} NO cumple ${schema}:`, validate.errors?.slice(0, 5));
    failed = true;
  } else {
    console.log(`[gate:api] OK ${data}`);
  }
}
if (failed) process.exit(1);
console.log('[gate:api] contrato v1 OK');
