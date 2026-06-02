"""Story 15.2 — Geometría departamental nacional (19 deptos como polígonos).

Fuente: IDE Uruguay "Límites Departamentales" (CKAN ide-limites-departamentales).
El dato oficial viene como POLYLINE (bordes), no polígonos rellenables → poligonizamos
por-feature con shapely (cada feature = el borde cerrado de UN depto).

Salida intermedia: data/processed/geographic/_nacional/departamento.geojson
  feature.properties.name = label del depto (= geoId del votes.json nacional, join por norm()).
Después mapshaper la simplifica a public/data/geo/_nacional/departamento.topo.json (<150KB, NFR1).
"""
import json, os, sys, unicodedata
from shapely.geometry import shape, mapping, Polygon, MultiPolygon
from shapely.ops import linemerge

SRC = 'data/raw/geographic/uruguayDepartamentos.geojson'
OUT = 'data/processed/geographic/_nacional/departamento.geojson'
DEPTS = 'src/config/departments.json'

def norm_id(s: str) -> str:
    """admlnm IDE → id de departments.json (lower, sin acentos, espacios→_)."""
    s = unicodedata.normalize('NFD', s).encode('ascii', 'ignore').decode()
    return s.lower().strip().replace(' ', '_')

def poligonizar(geom):
    """Borde-de-depto (polyline) → Polygon/MultiPolygon. El dato IDE viene como líneas con
    gaps minúsculos (~1-20 m) en los extremos; forzamos el cierre del anillo y construimos
    el polígono directo (más robusto que shapely.polygonize, que descarta anillos no-cerrados)."""
    lm = linemerge(geom)
    partes = [lm] if lm.geom_type == 'LineString' else list(lm.geoms)
    polys = []
    for p in partes:
        c = list(p.coords)
        if c[0] != c[-1]:
            c = c + [c[0]]               # forzar cierre
        if len(c) >= 4:
            poly = Polygon(c).buffer(0)  # buffer(0) repara auto-intersecciones
            if not poly.is_empty:
                polys.append(poly)
    if not polys:
        return None
    polys.sort(key=lambda x: x.area, reverse=True)
    return polys[0] if len(polys) == 1 else MultiPolygon(
        [g for pp in polys for g in (pp.geoms if pp.geom_type == 'MultiPolygon' else [pp])])

def main():
    depts = {d['id']: d['label'] for d in json.load(open(DEPTS, encoding='utf-8'))}
    src = json.load(open(SRC, encoding='utf-8'))
    feats, faltan = [], []
    for f in src['features']:
        admlnm = f['properties']['admlnm']
        did = norm_id(admlnm)
        if did not in depts:
            faltan.append((admlnm, did)); continue
        geom = poligonizar(shape(f['geometry']))
        if geom is None:
            faltan.append((admlnm, 'sin-poligono')); continue
        feats.append({
            'type': 'Feature',
            'properties': {'id': did, 'name': depts[did]},   # name = label → join con geoId del votes nacional
            'geometry': mapping(geom),
        })
    assert not faltan, f'deptos sin mapear/poligonizar: {faltan}'
    assert len(feats) == 19, f'esperaba 19 deptos, hay {len(feats)}'
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    json.dump({'type': 'FeatureCollection', 'features': feats},
              open(OUT, 'w', encoding='utf-8'), ensure_ascii=False)
    print(f'✅ {len(feats)} deptos poligonizados → {OUT}')
    print('   ids:', ', '.join(sorted(f['properties']['id'] for f in feats)))

if __name__ == '__main__':
    sys.exit(main())
