#!/usr/bin/env python3
"""Genera dumps NDJSON por elección: una fila por (nivel, departamento, zona, opción) con sus votos,
a partir de TODOS los votes-*.json (todos los niveles geográficos + agregado nacional). + manifest.
El desglose por HOJA (lista) NO va acá (otra forma, con hojaId) — está en /api/v1/results/hoja-*.
Uso: python scripts/build-api-dumps.py nacionales-2024
"""
import json, os, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA = os.path.join(ROOT, 'public/data')
OUT = os.path.join(ROOT, 'public/api/v1/dumps')

# Cada archivo trae su propio `nivel` en el doc; los listamos para barrerlos por (depto incl. _nacional).
LEVEL_FILES = ['votes.json', 'votes-circuito.json', 'votes-local.json',
               'votes-barrio.json', 'votes-localidad.json', 'votes-zona.json']

def depts_de(eleccion):
    ds = json.load(open(os.path.join(ROOT, 'src/config/departments.json'), encoding='utf-8'))
    return [d['id'] for d in ds if eleccion in d['elecciones']]

def main():
    if len(sys.argv) < 2:
        raise SystemExit("uso: build-api-dumps.py <eleccion>")
    eleccion = sys.argv[1]
    os.makedirs(OUT, exist_ok=True)
    ndjson_path = os.path.join(OUT, f'{eleccion}.ndjson')
    n = 0
    niveles = set()
    with open(ndjson_path, 'w', encoding='utf-8') as out:
        for depto in ['_nacional'] + depts_de(eleccion):  # _nacional = agregados nacionales (depto/zona)
            for fname in LEVEL_FILES:
                vp = os.path.join(DATA, eleccion, depto, fname)
                if not os.path.exists(vp):
                    continue
                doc = json.load(open(vp, encoding='utf-8'))
                nivel = doc.get('nivel')
                niveles.add(nivel)
                for z in doc.get('zonas', []):
                    for o in z.get('porOpcion', []):
                        out.write(json.dumps({
                            "eleccion": eleccion, "nivel": nivel, "departamento": depto,
                            "geoId": z["geoId"], "opcionId": o["opcionId"],
                            "votos": o["votos"], "validos": z.get("validos"),
                        }, ensure_ascii=False) + "\n")
                        n += 1
    manifest = {"eleccion": eleccion, "registros": n, "formato": "ndjson",
                "niveles": sorted(x for x in niveles if x),
                "campos": ["eleccion", "nivel", "departamento", "geoId", "opcionId", "votos", "validos"],
                "nota": "Resultado por (nivel, zona). Desglose por hoja en /api/v1/results/hoja-*.",
                "fuente": "Corte Electoral del Uruguay", "version": "v1"}
    json.dump(manifest, open(os.path.join(OUT, f'{eleccion}.manifest.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    print(f"{eleccion}: {n} filas, niveles={sorted(x for x in niveles if x)} → {ndjson_path}")

if __name__ == '__main__':
    main()
