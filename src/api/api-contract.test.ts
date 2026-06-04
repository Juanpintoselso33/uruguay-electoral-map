/**
 * Tests de contrato de la API pública v1.
 *
 * Validan los artefactos servidos bajo public/api/v1/** (y los /data detrás de los
 * rewrites) leyéndolos del disco: forma (JSON-Schema), integridad referencial
 * (los links resuelven), e invariantes de dominio (el join persona→hoja→votos
 * produce votos reales). Complementan a `gate:api` (que solo valida schemas).
 *
 * Nota: los endpoints HTTP en vivo (CORS, 200) se prueban aparte contra producción;
 * estos tests cubren el contrato del contenido sin depender de la red.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import Ajv from 'ajv/dist/2020.js';

const ROOT = process.cwd();
const read = (p: string) => JSON.parse(readFileSync(join(ROOT, p), 'utf-8'));
const has = (p: string) => existsSync(join(ROOT, p));
const ajv = new Ajv({ allErrors: true, strict: false });
const validateWith = (schemaPath: string, data: unknown) => {
  const v = ajv.compile(read(schemaPath));
  return { ok: v(data) as boolean, errors: v.errors };
};

describe('API v1 — descubrimiento (index.json)', () => {
  const index = read('public/api/v1/index.json');

  it('expone los links de descubrimiento esperados', () => {
    expect(index.version).toBe('v1');
    for (const k of ['docs', 'openapi', 'elections', 'candidatos']) {
      expect(String(index[k]), k).toMatch(/^\/api\/v1\//);
    }
    expect(index.departamentos).toHaveLength(19);
    expect(index.elecciones.length).toBeGreaterThan(10);
  });

  it('valida contra index.schema.json', () => {
    const { ok, errors } = validateWith('public/api/v1/schema/index.schema.json', index);
    expect(ok, JSON.stringify(errors?.slice(0, 3))).toBe(true);
  });
});

describe('API v1 — elecciones (integridad referencial)', () => {
  const elections = read('public/api/v1/elections.json');

  it('cada elección listada tiene su detalle en disco y coincide el id', () => {
    expect(elections.elecciones.length).toBeGreaterThan(10);
    for (const e of elections.elecciones) {
      const p = `public/api/v1/elections/${e.id}.json`;
      expect(has(p), p).toBe(true);
      const det = read(p);
      expect(det.id).toBe(e.id);
      expect(det.departamentos.length).toBeGreaterThan(0);
    }
  });

  it('los URLs results/geo usan la superficie /api/v1 y el archivo /data detrás existe', () => {
    const det = read('public/api/v1/elections/nacionales-2024.json');
    const mvd = det.departamentos.find((d: { id: string }) => d.id === 'montevideo');
    expect(mvd).toBeTruthy();

    // results: /api/v1/results/{e}/{d}/votes.json  ->  rewrite a /data/{e}/{d}/votes.json
    expect(mvd.results.votes).toMatch(/^\/api\/v1\/results\//);
    const votesData = mvd.results.votes.replace('/api/v1/results/', 'public/data/');
    expect(has(votesData), votesData).toBe(true);

    // geo: /api/v1/geo/{d}/{nivel}.topo.json  ->  rewrite a /data/geo/{d}/{nivel}.topo.json
    const geoUrl = Object.values(mvd.geo)[0] as string;
    expect(geoUrl).toMatch(/^\/api\/v1\/geo\//);
    const geoData = geoUrl.replace('/api/v1/geo/', 'public/data/geo/');
    expect(has(geoData), geoData).toBe(true);
  });
});

describe('API v1 — OpenAPI', () => {
  const oa = read('public/api/v1/openapi.json');

  it('documenta todos los grupos de endpoints', () => {
    const paths = Object.keys(oa.paths);
    for (const p of [
      '/api/v1/index.json',
      '/api/v1/elections.json',
      '/api/v1/elections/{eleccion}.json',
      '/api/v1/results/{eleccion}/{departamento}/votes.json',
      '/api/v1/geo/{departamento}/{nivel}.topo.json',
      '/api/v1/candidatos/index.json',
      '/api/v1/candidatos/legisladores.json',
    ]) {
      expect(paths, p).toContain(p);
    }
  });

  it('el server apunta al dominio de producción', () => {
    expect(oa.servers[0].url).toBe('https://uruguay-electoral-map.vercel.app');
  });
});

describe('API v1 — votos servidos (forma)', () => {
  it('un votes.json detrás del rewrite valida su schema', () => {
    const { ok, errors } = validateWith(
      'public/api/v1/schema/votes.schema.json',
      read('public/data/nacionales-2024/montevideo/votes.json'),
    );
    expect(ok, JSON.stringify(errors?.slice(0, 3))).toBe(true);
  });
});

describe('API v1 — candidatos', () => {
  const index = read('public/api/v1/candidatos/index.json');
  const legis = read('public/api/v1/candidatos/legisladores.json');
  const personas = read('public/api/v1/candidatos/personas-index.json');

  it('index: valida schema, total coincide, ids únicos', () => {
    const { ok, errors } = validateWith('public/api/v1/schema/candidatos-index.schema.json', index);
    expect(ok, JSON.stringify(errors?.slice(0, 3))).toBe(true);
    expect(index.total).toBe(index.candidatos.length);
    expect(new Set(index.candidatos.map((c: { id: string }) => c.id)).size).toBe(index.total);
  });

  it('index: todo candidato es legislador (SENADOR o REPRESENTANTE)', () => {
    const noLegis = index.candidatos.filter(
      (c: { cargos: string[] }) => !c.cargos.some((x) => x === 'SENADOR' || x === 'REPRESENTANTE'),
    );
    expect(noLegis.map((c: { id: string }) => c.id)).toEqual([]);
  });

  it('legisladores: valida schema, total coincide con index, cada uno tiene resultados', () => {
    const { ok, errors } = validateWith('public/api/v1/schema/legisladores.schema.json', legis);
    expect(ok, JSON.stringify(errors?.slice(0, 3))).toBe(true);
    expect(legis.total).toBe(legis.candidatos.length);
    expect(legis.total).toBe(index.total);
    for (const c of legis.candidatos) expect(c.resultados, c.id).toBeTypeOf('object');
  });

  it('el join produce votos: >80% de legisladores tienen al menos una elección con total > 0', () => {
    const conVotos = legis.candidatos.filter((c: { resultados: Record<string, { total: number }> }) =>
      Object.values(c.resultados).some((r) => r.total > 0),
    ).length;
    expect(conVotos / legis.total).toBeGreaterThan(0.8);
  });

  it('senador conocido (Bergara, BNB-42702) suma votos plausibles en nacionales-2024', () => {
    const b = legis.candidatos.find((c: { id: string }) => c.id === 'BNB-42702');
    expect(b, 'BNB-42702 ausente').toBeTruthy();
    expect(b.resultados['nacionales-2024'].total).toBeGreaterThan(50_000);
    // los votos por depto suman el total declarado
    const suma = Object.values(b.resultados['nacionales-2024'].porDepto as Record<string, number>)
      .reduce((a, n) => a + n, 0);
    expect(suma).toBe(b.resultados['nacionales-2024'].total);
  });

  it('cobertura: personas-index es superconjunto de los legisladores', () => {
    expect(personas.total).toBeGreaterThan(index.total);
    const all = new Set(personas.personas.map((p: { id: string }) => p.id));
    const faltan = index.candidatos
      .slice(0, 1000)
      .filter((c: { id: string }) => !all.has(c.id))
      .map((c: { id: string }) => c.id);
    expect(faltan).toEqual([]);
  });
});
