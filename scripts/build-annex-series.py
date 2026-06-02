"""Story 16.4 — Anexión de series nuevas a su "madre" histórica (fusión de polígonos grises).

La geometría de series está fijada al padrón ~2024. En elecciones viejas, las series que aún no
existían quedan grises (confirmado benigno: no están en el raw oficial). Lógica oficial de la Corte:
una serie nueva se crea para una localidad EXISTENTE → su "madre" es una hermana de la misma localidad.

Por elección×depto (nivel serie), para cada serie GRIS:
  1. vecinos espaciales que votaron (shapely: comparten borde),
  2. preferir HERMANA (misma localidad, serie-localidad.json); desempate = mayor borde compartido,
  3. fallback (localidad nueva, sin hermana): vecino espacial de cualquier localidad,
  4. sin vecino que votó → queda gris (se loguea).
Luego DISUELVE (shapely union) cada madre + sus grises anexadas → polígono fusionado.

Salidas por elección×depto (solo si hay anexiones):
  public/data/{eleccion}/{depto}/annex-series.json   {greyOriginal: madreOriginal}  (audit + ficha)
  public/data/{eleccion}/{depto}/serie-annexed.json  GeoJSON FC de los polígonos fusionados M′
     (properties: name=madre, replaces=[nombres a remover del FC base]) — el front reemplaza.
"""
import json, os, sys, subprocess, glob, re, unicodedata
from shapely.geometry import shape, mapping
from shapely.ops import unary_union
from raw_series import raw_series

DATA = 'public/data'
GEO = 'public/data/geo'
MAP = 'public/data/mappings'
DEPTS = [d['id'] for d in json.load(open('src/config/departments.json', encoding='utf-8'))]
NO_ELEC = {'geo', 'geographic', 'mappings', 'electoral', 'hoja-equivalencias'}
TMP = 'data/processed/_annex_tmp'

def norm(s):
    s = unicodedata.normalize('NFD', str(s))
    s = ''.join(c for c in s if unicodedata.category(c) != 'Mn')
    return re.sub(r'\s+', ' ', re.sub(r'[.,]', ' ', s.upper())).strip()

def round_coords(g, nd=5):
    """Redondea coords a nd decimales (~1m) para achicar el JSON del override sin pérdida visible."""
    if isinstance(g, (list, tuple)):
        if g and isinstance(g[0], (int, float)):
            return [round(g[0], nd), round(g[1], nd)]
        return [round_coords(x, nd) for x in g]
    return g

def decode_geo(depto):
    """topojson serie → {normName: (originalName, shapely)} vía mapshaper (resuelve arcos)."""
    topo = f'{GEO}/{depto}/serie.topo.json'
    if not os.path.exists(topo):
        return None
    os.makedirs(TMP, exist_ok=True)
    out = f'{TMP}/{depto}.geojson'
    r = subprocess.run(['npx', 'mapshaper', topo, '-o', 'format=geojson', out],
                       capture_output=True, text=True, shell=(os.name == 'nt'))
    if r.returncode != 0:
        sys.exit(f'mapshaper falló en {depto}: {r.stderr[-500:]}')
    fc = json.load(open(out, encoding='utf-8'))
    res = {}
    for f in fc['features']:
        nm = str(f['properties'].get('name', ''))
        if '-' in nm:   # polígono mergeado (16.3) — lo maneja la síntesis del merge, no se anexa
            continue
        try:
            res[norm(nm)] = (nm, shape(f['geometry']).buffer(0))
        except Exception:
            pass
    return res

def serie_localidad(depto):
    p = f'{MAP}/{depto}/serie-localidad.json'
    if not os.path.exists(p): return {}
    return {norm(e['serie']): e.get('localidad', '') for e in json.load(open(p, encoding='utf-8'))}

def adyacencia(polys):
    """{serieNorm: [(vecinoNorm, borde_compartido)]} — vecinos que comparten frontera."""
    keys = list(polys)
    adj = {k: [] for k in keys}
    for i, a in enumerate(keys):
        pa = polys[a][1]
        for b in keys[i+1:]:
            pb = polys[b][1]
            if pa.distance(pb) > 1e-6:
                continue
            inter = pa.buffer(1e-7).intersection(pb.buffer(1e-7))
            ln = inter.length if not inter.is_empty else 0.0
            if ln > 0:
                adj[a].append((b, ln)); adj[b].append((a, ln))
    return adj

def main():
    total_anex = total_grey = total_sin = total_bug = 0
    raw_cache = {}
    for depto in DEPTS:
        polys = decode_geo(depto)
        if not polys:
            continue
        s2l = serie_localidad(depto)
        adj = adyacencia(polys)
        elecciones = [e for e in sorted(os.listdir(DATA))
                      if e not in NO_ELEC and os.path.isdir(f'{DATA}/{e}')
                      and os.path.exists(f'{DATA}/{e}/{depto}/votes.json')]
        for e in elecciones:
            v = json.load(open(f'{DATA}/{e}/{depto}/votes.json', encoding='utf-8'))
            if v['nivel'] != 'serie':
                continue
            voto = {norm(z['geoId']) for z in v['zonas']}
            grey = [g for g in polys if g not in voto]
            if not grey:
                continue
            total_grey += len(grey)
            # Gate inline: una serie GRIS que SÍ está en el raw oficial votó y la perdimos = BUG, no
            # benigna → NO se anexa (queda gris, visible para arreglar). Solo anexamos las benignas.
            if e not in raw_cache:
                raw_cache[e] = raw_series(e)
            raw_e = (raw_cache[e] or {}).get(depto, set())
            annex = {}   # greyNorm -> madreNorm
            for g in grey:
                if g in raw_e:
                    total_bug += 1; continue   # bug de datos, no benigno → no anexar
                vecinos_voto = [(n, ln) for (n, ln) in adj[g] if n in voto]
                if not vecinos_voto:
                    total_sin += 1; continue
                hermanas = [(n, ln) for (n, ln) in vecinos_voto if s2l.get(n) and s2l.get(n) == s2l.get(g)]
                cands = hermanas or vecinos_voto
                madre = max(cands, key=lambda x: x[1])[0]
                annex[g] = madre
            if not annex:
                continue
            total_anex += len(annex)
            # fusionar: por madre, union(madre + sus grises)
            por_madre = {}
            for g, m in annex.items():
                por_madre.setdefault(m, []).append(g)
            feats = []
            for m, greys in por_madre.items():
                geoms = [polys[m][1]] + [polys[g][1] for g in greys]
                fused = unary_union(geoms).buffer(0).simplify(0.0002, preserve_topology=True)
                replaces = [polys[m][0]] + [polys[g][0] for g in greys]   # nombres ORIGINALES a remover
                geom = mapping(fused)
                geom['coordinates'] = round_coords(geom['coordinates'])
                feats.append({'type': 'Feature',
                              'properties': {'name': polys[m][0], 'replaces': replaces},
                              'geometry': geom})
            outdir = f'{DATA}/{e}/{depto}'
            json.dump({polys[g][0]: polys[m][0] for g, m in annex.items()},
                      open(f'{outdir}/annex-series.json', 'w', encoding='utf-8'), ensure_ascii=False)
            json.dump({'type': 'FeatureCollection', 'features': feats},
                      open(f'{outdir}/serie-annexed.json', 'w', encoding='utf-8'), ensure_ascii=False)
        print(f'  {depto}: procesado')
    print(f'\n✅ anexiones={total_anex} | grises={total_grey} | bug-no-anexado={total_bug} | sin vecino={total_sin}')
    if total_bug:
        print(f'  ⚠ {total_bug} grises son BUG (votaron en el raw) → quedan grises; correr scripts/gate-grises.py')

if __name__ == '__main__':
    sys.exit(main())
