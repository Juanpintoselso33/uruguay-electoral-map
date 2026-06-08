#!/usr/bin/env python3
"""Genera el descubrimiento de la API: public/api/v1/index.json + elections.json + elections/{e}.json
a partir de src/config/departments.json y de los archivos presentes en public/data/. Uso:
  python scripts/build-api-index.py
"""
import json, os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA = os.path.join(ROOT, 'public/data')
OUT = os.path.join(ROOT, 'public/api/v1')
RESULT_FILES = ['catalogo.json', 'opciones.json', 'votes.json',
                # Granularidad por nivel geográfico (la que ya sirve /data; antes sub-advertida).
                'votes-local.json', 'votes-circuito.json', 'votes-barrio.json',
                'votes-localidad.json', 'votes-zona.json',
                # Desglose por hoja (lista) re-agregado por nivel.
                'hoja-local.json', 'hoja-circuito.json', 'hoja-barrio.json',
                'hoja-localidad.json', 'hoja-municipio.json',
                # Municipales (Epic 22): alcalde electo + Concejo Municipal por municipio.
                'alcaldes.json', 'concejos.json',
                # Departamentales: candidatos a intendente (nacional por depto y por serie).
                'intendentes.json', 'intendentes-zona.json']
                # NB: se excluyen a propósito serie-annexed/zona-annexed/annex-series/localidad-meta
                # (plumbing interno de joins/anexión, no resultados públicos).

def depts():
    return json.load(open(os.path.join(ROOT, 'src/config/departments.json'), encoding='utf-8'))

# La superficie pública v1 está desacoplada del layout de archivos: las rutas
# /api/v1/results|geo se reescriben a /data en el deploy (ver scripts/vercel-cors-headers.mjs).
def resources_for(eleccion, depto):
    base = os.path.join(DATA, eleccion, depto)
    files = [f for f in RESULT_FILES if os.path.exists(os.path.join(base, f))]
    return {f.replace('.json', ''): f"/api/v1/results/{eleccion}/{depto}/{f}" for f in files}

def geo_for(depto):
    gdir = os.path.join(DATA, 'geo', depto)
    if not os.path.isdir(gdir):
        return {}
    return {os.path.splitext(f)[0]: f"/api/v1/geo/{depto}/{f}"
            for f in sorted(os.listdir(gdir)) if f.endswith('.json')}

def main():
    ds = depts()
    os.makedirs(os.path.join(OUT, 'elections'), exist_ok=True)
    elections = {}
    for d in ds:
        for e in d['elecciones']:
            elections.setdefault(e, []).append(d['id'])
    index = {
        "version": "v1",
        "fuente": "Corte Electoral del Uruguay (catalogodatos.gub.uy)",
        "licencia": "Datos abiertos con atribución a la Corte Electoral.",
        "docs": "/api/v1/docs",
        "openapi": "/api/v1/openapi.json",
        "elections": "/api/v1/elections.json",
        "candidatos": "/api/v1/candidatos/index.json",
        "departamentos": sorted(d['id'] for d in ds),
        "elecciones": sorted(elections),
    }
    json.dump(index, open(os.path.join(OUT, 'index.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    elist = [{"id": e, "departamentos": sorted(set(elections[e])), "detalle": f"/api/v1/elections/{e}.json"}
             for e in sorted(elections)]
    json.dump({"elecciones": elist}, open(os.path.join(OUT, 'elections.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    for e in sorted(elections):
        detalle = {"id": e, "departamentos": []}
        # Vista nacional: agregados + recursos solo-nacionales (alcaldes/concejos en municipales).
        if os.path.isdir(os.path.join(DATA, e, '_nacional')):
            detalle["departamentos"].append({"id": "_nacional", "results": resources_for(e, '_nacional'), "geo": geo_for('_nacional')})
        for depto in sorted(set(elections[e])):
            detalle["departamentos"].append({"id": depto, "results": resources_for(e, depto), "geo": geo_for(depto)})
        json.dump(detalle, open(os.path.join(OUT, 'elections', f'{e}.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    print(f"índice generado: {len(elections)} elecciones, {len(ds)} departamentos → public/api/v1/")

if __name__ == '__main__':
    main()
