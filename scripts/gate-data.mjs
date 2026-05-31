/**
 * Gate de integridad de datos (Story 2.7).
 * Valida todos los shards votes.json publicados:
 *   - escrutinio === 'definitivo'
 *   - sin votos negativos
 *   - ganador presente en porOpcion y efectivamente el de más votos
 *   - sin geoId duplicados
 * Falla con exit 1 si algún shard no cumple → bloquea `astro build`.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const DATA_DIR = join(process.cwd(), 'public', 'data');

function findVotesFiles(base) {
  const results = [];
  let dirs;
  try { dirs = readdirSync(base); } catch { return results; }
  for (const eleccion of dirs) {
    const elecPath = join(base, eleccion);
    try { if (!statSync(elecPath).isDirectory()) continue; } catch { continue; }
    let deptos;
    try { deptos = readdirSync(elecPath); } catch { continue; }
    for (const depto of deptos) {
      const f = join(elecPath, depto, 'votes.json');
      try { statSync(f); results.push(f); } catch { /* no votes.json */ }
    }
  }
  return results;
}

function validateShard(shard, path) {
  const ctx = `${path}`;
  if (shard.escrutinio !== 'definitivo') {
    throw new Error(`${ctx}: escrutinio='${shard.escrutinio}' (debe ser 'definitivo')`);
  }
  const vistos = new Set();
  for (const z of shard.zonas ?? []) {
    if (!z.geoId || typeof z.geoId !== 'string') throw new Error(`${ctx}: geoId inválido`);
    if (vistos.has(z.geoId)) throw new Error(`${ctx}: geoId duplicado '${z.geoId}'`);
    vistos.add(z.geoId);
    if (z.validos < 0) throw new Error(`${ctx}/${z.geoId}: válidos negativos`);
    for (const v of z.porOpcion ?? []) {
      if (v.votos < 0) throw new Error(`${ctx}/${z.geoId}: votos negativos en ${v.opcionId}`);
    }
    const ganador = (z.porOpcion ?? []).find((v) => v.opcionId === z.ganadorOpcionId);
    if (!ganador) throw new Error(`${ctx}/${z.geoId}: ganador '${z.ganadorOpcionId}' no está en porOpcion`);
    const maxVotos = Math.max(...(z.porOpcion ?? []).map((v) => v.votos));
    if (ganador.votos < maxVotos) {
      throw new Error(`${ctx}/${z.geoId}: ganador '${z.ganadorOpcionId}' (${ganador.votos}) no es el de más votos (${maxVotos})`);
    }
  }
}

const files = findVotesFiles(DATA_DIR);
if (files.length === 0) {
  console.warn('[gate:data] Advertencia: no se encontraron shards votes.json en public/data/');
  process.exit(0);
}

let errCount = 0;
for (const f of files) {
  try {
    const shard = JSON.parse(readFileSync(f, 'utf8'));
    validateShard(shard, f.replace(process.cwd(), '.'));
    console.log(`  ✓ ${f.replace(process.cwd() + '\\', '').replace(process.cwd() + '/', '')}`);
  } catch (err) {
    console.error(`  ✗ ${err.message}`);
    errCount++;
  }
}

if (errCount > 0) {
  console.error(`\n[gate:data] FALLA: ${errCount} shard(s) inválido(s). Build bloqueado.`);
  process.exit(1);
}
console.log(`\n[gate:data] OK: ${files.length} shard(s) validado(s).`);
