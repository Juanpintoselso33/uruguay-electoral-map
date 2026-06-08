// Valida que los recursos servidos cumplen los JSON-Schema publicados (contrato v1).
// Uso: node scripts/gate-api-contract.mjs
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
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
// --- Completitud: la API debe advertir TODA elección que existe en /data ---
// (build-api-index/build-api-dumps son manuales; sin este gate la API deriva en silencio).
const NO_ELEC = new Set(['geo', 'geographic', 'mappings', 'electoral', 'hoja-equivalencias', 'personas']);
const dataElecs = readdirSync('public/data')
  .filter((e) => !NO_ELEC.has(e) && statSync(`public/data/${e}`).isDirectory());

const elections = load('public/api/v1/elections.json').elecciones.map((e) => e.id);
const detail = readdirSync('public/api/v1/elections').filter((f) => f.endsWith('.json')).map((f) => f.slice(0, -5));
const dumps = readdirSync('public/api/v1/dumps').filter((f) => f.endsWith('.ndjson')).map((f) => f.slice(0, -7));

for (const [label, listed] of [['elections.json', elections], ['elections/*.json', detail], ['dumps/*.ndjson', dumps]]) {
  const missing = dataElecs.filter((e) => !listed.includes(e));
  if (missing.length) {
    console.error(`[gate:api] ${label} no advierte ${missing.length} elección(es) que existen en /data: ${missing.join(', ')} → corré 'npm run etl:api-index' y 'etl:api-dumps'`);
    failed = true;
  } else {
    console.log(`[gate:api] OK completitud ${label} (${listed.length}/${dataElecs.length})`);
  }
}

// openapi: el enum del path-param `eleccion` debe cubrir todas las elecciones de /data.
const openapi = load('public/api/v1/openapi.json');
const enums = [];
const collect = (n) => {
  if (Array.isArray(n)) n.forEach(collect);
  else if (n && typeof n === 'object') {
    if (n.name === 'eleccion' && Array.isArray(n.schema?.enum)) enums.push(n.schema.enum);
    Object.values(n).forEach(collect);
  }
};
collect(openapi);
const enumMissing = [...new Set(enums.flatMap((en) => dataElecs.filter((e) => !en.includes(e))))];
if (enums.length && enumMissing.length) {
  console.error(`[gate:api] openapi.json: el enum 'eleccion' no cubre ${enumMissing.length} elección(es): ${enumMissing.join(', ')}`);
  failed = true;
} else {
  console.log(`[gate:api] OK openapi enum 'eleccion' (${enums.length} param(s))`);
}

if (failed) process.exit(1);
console.log('[gate:api] contrato v1 OK');
