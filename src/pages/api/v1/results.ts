import type { APIRoute } from 'astro';
import { readFileSync } from 'node:fs';

export const prerender = false; // → función serverless en Vercel

interface Zona { geoId: string; validos?: number; porOpcion: { opcionId: string; votos: number }[]; }

export function filtrarPorOpcion(zonas: Zona[], opcionId: string | null): Zona[] {
  if (!opcionId) return zonas;
  return zonas.map((z) => ({ ...z, porOpcion: z.porOpcion.filter((o) => o.opcionId === opcionId) }));
}

export const GET: APIRoute = ({ url }) => {
  const eleccion = url.searchParams.get('eleccion');
  const departamento = url.searchParams.get('departamento');
  const opcion = url.searchParams.get('opcion');
  if (!eleccion || !departamento) {
    return new Response(JSON.stringify({ error: { code: 'bad_request', message: 'faltan eleccion y departamento' } }),
      { status: 400, headers: { 'content-type': 'application/json', 'access-control-allow-origin': '*' } });
  }
  try {
    const doc = JSON.parse(readFileSync(`public/data/${eleccion}/${departamento}/votes.json`, 'utf-8'));
    const zonas = filtrarPorOpcion(doc.zonas ?? [], opcion);
    return new Response(JSON.stringify({ eleccion, departamento, opcion, zonas }), {
      headers: { 'content-type': 'application/json', 'access-control-allow-origin': '*',
        'cache-control': 'public, max-age=3600, s-maxage=31536000, immutable' },
    });
  } catch {
    return new Response(JSON.stringify({ error: { code: 'not_found', message: 'recurso inexistente' } }),
      { status: 404, headers: { 'content-type': 'application/json', 'access-control-allow-origin': '*' } });
  }
};
