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
        # decodificar + namespacear name con el label del depto + tirar props sobrantes
        expr = f'name = (name || "") + " · {label}"'
        run([topo, '-each', expr, '-each', f'depto="{did}"',
             '-filter-fields', 'name,depto', '-o', 'format=geojson', f'{PARTS}/{did}.geojson'])
        print(f'  {did}: {nivel} → namespaced')
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
