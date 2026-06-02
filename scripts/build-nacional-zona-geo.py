"""Story 15.4/15.5 — Geometría de ZONA nacional (combina los 19 deptos en un solo mapa).

Cada depto aporta su nivel-base (MVD=zona/barrios, interior=serie). Los nombres de zona NO son
únicos entre deptos (las series 'jaa','iaa'… se repiten) → se NAMESPACEA cada feature con el label
del depto: name = "{nombreOriginal} · {DeptoLabel}". El mismo namespacing se aplica al geoId del
votes-zona.json (build-nacional-votes.py) para que el join geometría↔votos (norm(name==geoId)) ande.

Combinado crudo ≈ 8,7 MB → excede NFR1 (~3 MB). Se simplifica con mapshaper y se carga LAZY (solo al
togglear a 'zona'; el default nacional es 'departamento', 146 KB). Pipeline (vía npm etl:nacional-zona-geo):
por depto decodifica+namespacea con mapshaper, luego combina + simplifica todo a un topojson.

Final: public/data/geo/_nacional/zona.topo.json   ·   tmp: data/processed/geographic/_nacional/parts/
"""
import json, os, sys, subprocess, glob
from nacional_labels import build_label_map, label_for

DATA = 'public/data'
GEO = 'public/data/geo'
DEPTS = 'src/config/departments.json'
REF_ELECCION = 'nacionales-2024'          # presente en los 19, define el nivel-base por depto
PARTS = 'data/processed/geographic/_nacional/parts'
OUT = 'public/data/geo/_nacional/zona.topo.json'
SIMPLIFY = os.environ.get('ZONA_SIMPLIFY', '18%')   # 0,50 MB (<< budget NFR1 3MB); buena calidad a zoom nacional

def base_nivel(depto):
    return json.load(open(f'{DATA}/{REF_ELECCION}/{depto}/votes.json', encoding='utf-8'))['nivel']

def run(args):
    r = subprocess.run(['npx', 'mapshaper', *args], capture_output=True, text=True, shell=(os.name == 'nt'))
    if r.returncode != 0:
        sys.exit(f'mapshaper falló: {" ".join(args)}\n{r.stderr[-800:]}')

def main():
    depts = {d['id']: d['label'] for d in json.load(open(DEPTS, encoding='utf-8'))}
    os.makedirs(PARTS, exist_ok=True)
    for f in glob.glob(f'{PARTS}/*.geojson'):
        os.remove(f)
    for did, label in depts.items():
        nivel = base_nivel(did)
        topo = f'{GEO}/{did}/{nivel}.topo.json'
        if not os.path.exists(topo):
            print(f'  ⚠ {did}: falta {topo}'); continue
        # 1) decodificar topojson → geojson con el name CRUDO (mapshaper resuelve los arcos)
        run([topo, '-filter-fields', 'name', '-o', 'format=geojson', f'{PARTS}/{did}.geojson'])
        # 2) reescribir name al label legible (MVD=barrio; interior="Localidad · SERIE")
        lmap = build_label_map(did, nivel)
        fc = json.load(open(f'{PARTS}/{did}.geojson', encoding='utf-8'))
        for f in fc['features']:
            raw = f['properties'].get('name', '')
            f['properties'] = {'name': label_for(raw, lmap), 'depto': did}
        json.dump(fc, open(f'{PARTS}/{did}.geojson', 'w', encoding='utf-8'), ensure_ascii=False)
        print(f'  {did}: {nivel} → {len(fc["features"])} zonas ({"mapeo localidad" if lmap else "barrio"})')
    # combinar todas las partes + simplificar + un solo topojson
    parts = sorted(glob.glob(f'{PARTS}/*.geojson'))
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    run(['-i', *parts, 'combine-files', '-merge-layers', 'force',
         '-simplify', SIMPLIFY, 'keep-shapes', '-clean',
         '-o', 'force', 'format=topojson', OUT])
    mb = os.path.getsize(OUT) / 1e6
    print(f'✅ zona nacional combinada → {OUT} ({mb:.2f} MB, simplify={SIMPLIFY})')
    if mb > 3.0:
        print(f'  ⚠ excede NFR1 (3 MB); subir ZONA_SIMPLIFY (p.ej. 4%, 3%)')

if __name__ == '__main__':
    sys.exit(main())
