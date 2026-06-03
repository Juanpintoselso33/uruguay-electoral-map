import type { APIRoute } from 'astro';
import { readFileSync, existsSync } from 'node:fs';
import deptsRaw from '../../../../../config/departments.json';

export const prerender = false;

type ByDepto = Record<string, { opcionId: string; votos: number }[]>;
const depts = deptsRaw as { id: string; elecciones: string[] }[];

export function agregarPorDepto(
  porDepto: ByDepto,
  opcionId: string,
): { departamento: string; votos: number }[] {
  return Object.entries(porDepto)
    .map(([departamento, ops]) => ({
      departamento,
      votos: ops
        .filter((o) => o.opcionId === opcionId)
        .reduce((s, o) => s + o.votos, 0),
    }))
    .filter((r) => r.votos > 0)
    .sort((a, b) => b.votos - a.votos);
}

export const GET: APIRoute = ({ params, url }) => {
  const opcionId = params.id!;
  const eleccion = url.searchParams.get('eleccion');
  if (!eleccion) {
    return new Response(
      JSON.stringify({ error: { code: 'bad_request', message: 'falta ?eleccion=' } }),
      { status: 400, headers: { 'content-type': 'application/json', 'access-control-allow-origin': '*' } },
    );
  }
  const porDepto: ByDepto = {};
  for (const d of depts.filter((d) => d.elecciones.includes(eleccion))) {
    const p = `public/data/${eleccion}/${d.id}/votes.json`;
    if (!existsSync(p)) continue;
    const doc = JSON.parse(readFileSync(p, 'utf-8'));
    porDepto[d.id] = (doc.zonas ?? []).flatMap(
      (z: { porOpcion: { opcionId: string; votos: number }[] }) => z.porOpcion,
    );
  }
  const ranking = agregarPorDepto(porDepto, opcionId);
  return new Response(
    JSON.stringify({ candidato: opcionId, eleccion, metrica: 'votos de la opción', ranking }),
    {
      headers: {
        'content-type': 'application/json',
        'access-control-allow-origin': '*',
        'cache-control': 'public, max-age=3600, s-maxage=31536000, immutable',
      },
    },
  );
};
