/**
 * Self-test del contrato de URL (Story 1.7). Patrón del proyecto: typechequea bajo
 * `astro check` y es ejecutable con esbuild+node hasta el runner (Story 1.10).
 * Cubre: round-trip identidad, defaults, params vacíos, desconocidos, forward-compat.
 */
import { parseUrl, toHref, toUrl, NIVEL_DEFAULT, type MapView } from './url-state';

function eq(a: unknown, b: unknown, label: string): void {
  const sa = JSON.stringify(a);
  const sb = JSON.stringify(b);
  if (sa !== sb) throw new Error(`FALLA ${label}: ${sa} !== ${sb}`);
}

export function runUrlStateSelfTest(): string[] {
  const out: string[] = [];

  // Round-trip: parse(toHref(view)) == view  (identidad sobre el estado).
  const casos: MapView[] = [
    { eleccion: 'internas-2024', departamento: 'montevideo', zona: null, opcion: null, level: 'zona', vs: null, a: null, b: null, contienda: null, seleccion: [], modo: null, circ: false },
    { eleccion: 'internas-2024', departamento: 'montevideo', zona: 'Ciudad Vieja', opcion: 'frente-amplio', level: 'zona', vs: null, a: null, b: null, contienda: null, seleccion: [], modo: null, circ: false },
    { eleccion: 'internas-2024', departamento: 'canelones', zona: null, opcion: null, level: 'serie', vs: null, a: null, b: null, contienda: null, seleccion: [], modo: null, circ: false },
    { eleccion: 'internas-2024', departamento: 'montevideo', zona: 'Centro', opcion: null, level: 'circuito', vs: 'nacionales-2024', a: null, b: null, contienda: null, seleccion: [], modo: null, circ: false },
    { eleccion: 'balotaje-2024', departamento: 'montevideo', zona: null, opcion: null, level: 'zona', vs: null, a: 'opcion-x', b: 'opcion-y', contienda: null, seleccion: [], modo: null, circ: false },
    // Epic 10: contienda + selección múltiple de hojas.
    { eleccion: 'internas-2024', departamento: 'montevideo', zona: null, opcion: null, level: 'zona', vs: null, a: null, b: null, contienda: 'odn', seleccion: ['odn-frente-amplio-609', 'odn-frente-amplio-90'], modo: 'share', circ: false },
  ];
  for (const v of casos) {
    const href = toHref(v);
    const [path, search] = href.split('?');
    const parsed = parseUrl(path, search ? `?${search}` : '');
    eq(parsed, v, `round-trip ${href}`);
  }
  out.push(`OK round-trip identidad (${casos.length} casos)`);

  // Default level=zona se omite en la URL.
  const base = casos[0];
  eq(toUrl(base).search, '', 'level=zona no emite search');
  out.push('OK default level=zona omitido');

  // Params vacíos no se serializan.
  const conVacios: MapView = { ...base, zona: '', opcion: '' } as MapView;
  eq(toUrl(conVacios).search, '', 'params vacíos no se serializan');
  out.push('OK params vacíos no serializados');

  // Params desconocidos se ignoran; level inválido → default.
  const p = parseUrl('/internas-2024/montevideo', '?zona=Centro&foo=bar&level=galaxia');
  eq(p.zona, 'Centro', 'lee zona con param desconocido presente');
  eq(p.level, NIVEL_DEFAULT, 'level inválido → default');
  out.push('OK desconocidos ignorados + level inválido → default');

  // Forward-compat: ?eleccion= override del path; ?a=&b= comparación.
  const q = parseUrl('/x/montevideo', '?eleccion=internas-2024&a=op1&b=op2');
  eq(q.eleccion, 'internas-2024', '?eleccion= override');
  eq([q.a, q.b], ['op1', 'op2'], '?a=&b= comparación');
  out.push('OK forward-compat ?eleccion= y ?a=&b=');

  // Epic 10: ?cont= y ?sel= (multi, separado por coma; vacíos filtrados).
  const g = parseUrl('/internas-2024/montevideo', '?cont=odn&sel=odn-fa-609,,odn-fa-90');
  eq(g.contienda, 'odn', '?cont= contienda');
  eq(g.seleccion, ['odn-fa-609', 'odn-fa-90'], '?sel= multi con vacío filtrado');
  eq(parseUrl('/x/y', '').seleccion, [], 'sel ausente → []');
  out.push('OK granularidad ?cont= y ?sel= (multi)');

  return out;
}

runUrlStateSelfTest().forEach((l) => console.log(l));
console.log('\n=== url-state self-test: TODO OK ✅ ===');
