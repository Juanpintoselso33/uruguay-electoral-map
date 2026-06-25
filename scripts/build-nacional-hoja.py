"""Agregación nacional por HOJA/lista (feature pedida por Octavio): habilita el desglose por
sector/lista en la VISTA NACIONAL (`/{eleccion}`), no solo por departamento.

Para cada elección con contienda NACIONAL (presidencial/parlamentaria: 'unica' en nacionales,
'odn' en internas) que tenga catálogo + shards de hoja por departamento, genera:
  public/data/{eleccion}/_nacional/catalogo.json        (unión de los 19 catálogos por-depto)
  public/data/{eleccion}/_nacional/hoja/{cont}/{lema}.json
      (19 'zonas' = deptos, geoId = label del depto; porOpcion = Σ hojas del lema en ese depto)

El front es genérico: con catalogo.json + dir hoja/ presentes en _nacional, OpcionAccordion arma
el árbol lema→sublema→hoja y ChoroplethMap colorea los 19 departamentos por hoja/sublema (toggle
`gnivel`). Se agrega vía el mismo geoId = label del depto que usa _nacional/votes.json (Story 15.2),
así el join contra departamento.topo.json queda intacto.

EXCLUYE contiendas DEPARTAMENTALES (odd/intendente/junta/municipio): el intendente/junta son
carreras por-depto, agregarlas a nivel país no tiene sentido electoral.

NOTA de cobertura (consistente con el front): los shards de hoja son geo-joined, así que el total
nacional por lista es el mismo que ya se muestra al hacer drill-down por depto (p.ej. MPP/609 ≈
394k, no el ~438k oficial; la diferencia son votos sin ubicación geográfica, igual que en per-depto).

GATE de reconciliación: por cada lema, Σ_deptos(Σ hojas) debe == el total nacional del PARTIDO en
_nacional/votes.json (delta acotado: subcuenta ≤3% por placement upstream, nunca sobreconteo).
"""
import json, os, sys, time, unicodedata
from collections import defaultdict

DATA = 'public/data'
DEPTS_CFG = 'src/config/departments.json'

# Contiendas cuya lista/hoja es una entidad NACIONAL (la misma numeración aplica país-wide).
NATIONAL_CONTIENDAS = {'unica', 'odn'}

# Tolerancia del gate (igual criterio que build-nacional-votes.py).
TOL_UNDER, TOL_OVER = 0.03, 0.001


def norm(s):
    s = unicodedata.normalize('NFD', str(s))
    return ''.join(c for c in s if unicodedata.category(c) != 'Mn').lower().strip()


def write_json(path, obj):
    """Escritura con retry (Windows EINVAL bajo file-watcher), igual que build-nacional-votes."""
    os.makedirs(os.path.dirname(path), exist_ok=True)
    for attempt in range(5):
        try:
            with open(path, 'w', encoding='utf-8') as fh:
                json.dump(obj, fh, ensure_ascii=False)
            return
        except OSError:
            if attempt == 4:
                raise
            time.sleep(0.2)


def cargar_catalogos(base, deptos):
    """{depto: catalogo} para los deptos que lo tienen + dir hoja/."""
    out = {}
    for d in deptos:
        p = f'{base}/{d}/catalogo.json'
        if os.path.exists(p) and os.path.isdir(f'{base}/{d}/hoja'):
            out[d] = json.load(open(p, encoding='utf-8'))
    return out


def union_contienda(catalogos, contienda):
    """Unión de nodos/opciones/niveles de una contienda a través de los deptos.
    Dedup de nodos y opciones por id (primera aparición gana); niveles = la versión más profunda;
    degradado = OR. Devuelve None si ningún depto tiene esa contienda."""
    nodos, opciones, niveles, degradado = {}, {}, [], False
    visto = False
    for cat in catalogos.values():
        cont = next((c for c in cat['contiendas'] if c['contienda'] == contienda), None)
        if not cont:
            continue
        visto = True
        if len(cont.get('niveles', [])) > len(niveles):
            niveles = cont['niveles']
        degradado = degradado or bool(cont.get('degradado'))
        for n in cont['nodos']:
            nodos.setdefault(n['id'], n)
        for o in cont['opciones']:
            opciones.setdefault(o['id'], o)
    if not visto:
        return None
    return {
        'contienda': contienda,
        'niveles': niveles,
        'nodos': list(nodos.values()),
        'opciones': list(opciones.values()),
        **({'degradado': True} if degradado else {}),
    }


def totales_lema_por_depto(base, depto, contienda, lemaId):
    """Σ hojas del lema en un depto, a través de TODAS las zonas de su shard de hoja.
    → (porOpcion {opcionId: votos}, ganadorOpcionId, validos)."""
    p = f'{base}/{depto}/hoja/{contienda}/{lemaId}.json'
    if not os.path.exists(p):
        return None
    shard = json.load(open(p, encoding='utf-8'))
    po = defaultdict(int)
    for z in shard.get('zonas', []):
        for op in z.get('porOpcion', []):
            po[op['opcionId']] += op['votos']
    if not po:
        return None
    ganador = max(po.items(), key=lambda kv: kv[1])[0]
    return dict(po), ganador, sum(po.values())


def totales_nacionales_partido(base):
    """{opcionId(partido): total nacional} desde _nacional/votes.json (para el gate)."""
    p = f'{base}/_nacional/votes.json'
    if not os.path.exists(p):
        return {}
    v = json.load(open(p, encoding='utf-8'))
    tot = defaultdict(int)
    for z in v['zonas']:
        for op in z['porOpcion']:
            tot[op['opcionId']] += op['votos']
    return dict(tot)


def construir(eleccion, id2label):
    base = f'{DATA}/{eleccion}'
    if not os.path.exists(f'{base}/_nacional/votes.json'):
        return  # sin agregado nacional base (no aplica)
    deptos = sorted(d for d in id2label if os.path.isdir(f'{base}/{d}'))
    catalogos = cargar_catalogos(base, deptos)
    if not catalogos:
        return  # elección sin catálogo de hoja por-depto (balotaje/plebiscito) → nada que hacer
    # Contiendas presentes que son NACIONALES y tienen nivel 'hoja'.
    conts = set()
    for cat in catalogos.values():
        for c in cat['contiendas']:
            if c['contienda'] in NATIONAL_CONTIENDAS and 'hoja' in c.get('niveles', []):
                conts.add(c['contienda'])
    if not conts:
        print(f'  ⏭ {eleccion}: sin contienda nacional con hoja (solo departamentales) — se omite')
        return

    tipo = next(iter(catalogos.values())).get('tipo', 'nacionales')
    nac_partido = totales_nacionales_partido(base)
    cat_out = {'eleccionId': eleccion, 'departamento': '_nacional', 'contiendas': []}
    n_shards = 0
    gate_lineas = []

    for contienda in sorted(conts):
        cont_union = union_contienda(catalogos, contienda)
        cat_out['contiendas'].append(cont_union)
        lemas = [n for n in cont_union['nodos'] if n['nivel'] == 'lema']
        for lema in lemas:
            lemaId = lema['id']
            zonas = []
            nac_hoja_lema = 0
            for d in deptos:
                if d not in catalogos:
                    continue
                res = totales_lema_por_depto(base, d, contienda, lemaId)
                if not res:
                    continue
                po, ganador, validos = res
                zonas.append({
                    'geoId': id2label.get(d, d),
                    'ganadorOpcionId': ganador,
                    'validos': validos,
                    'porOpcion': [{'opcionId': k, 'votos': po[k]} for k in sorted(po, key=lambda k: -po[k])],
                    'noPartidarios': {'enBlanco': 0, 'anulados': 0, 'observados': 0},
                })
                nac_hoja_lema += validos
            if not zonas:
                continue
            write_json(f'{base}/_nacional/hoja/{contienda}/{lemaId}.json', {
                'eleccionId': eleccion, 'departamento': '_nacional', 'nivel': 'departamento',
                'escrutinio': 'definitivo', 'tipo': tipo, 'zonas': zonas,
            })
            n_shards += 1
            # GATE: Σ hojas del lema (nacional) vs total nacional del partido homónimo.
            oficial = nac_partido.get(lemaId)
            if oficial:
                frac = (nac_hoja_lema - oficial) / oficial
                assert frac <= TOL_OVER, (
                    f'{eleccion}/{contienda}/{lemaId}: SOBRECONTEO hojas={nac_hoja_lema:,} > '
                    f'partido={oficial:,} ({frac:+.2%}) → doble-suma')
                assert -frac <= TOL_UNDER, (
                    f'{eleccion}/{contienda}/{lemaId}: subcuenta {-frac:.2%} > {TOL_UNDER:.0%} '
                    f'hojas={nac_hoja_lema:,} vs partido={oficial:,} → placement upstream sospechoso')
                gate_lineas.append(f'{lemaId}={nac_hoja_lema:,}/{oficial:,} ({frac:+.2%})')

    write_json(f'{base}/_nacional/catalogo.json', cat_out)
    print(f'  ✓ {eleccion}: contiendas={sorted(conts)}, {n_shards} shards de hoja nacional')
    if gate_lineas:
        print(f'      gate (hoja vs partido): ' + ', '.join(gate_lineas[:6])
              + (f'  …(+{len(gate_lineas) - 6})' if len(gate_lineas) > 6 else ''))


def main():
    id2label = {d['id']: d['label'] for d in json.load(open(DEPTS_CFG, encoding='utf-8'))}
    elecciones = sorted(e for e in os.listdir(DATA)
                        if os.path.isdir(f'{DATA}/{e}') and not e.startswith('_')
                        and e not in {'geo', 'mappings', 'personas', 'api', 'hoja-equivalencias', 'electoral', 'geographic'})
    print(f'Agregando hoja nacional para {len(elecciones)} elecciones candidatas...')
    for e in elecciones:
        construir(e, id2label)
    print('✅ build-nacional-hoja completo')


if __name__ == '__main__':
    sys.exit(main())
