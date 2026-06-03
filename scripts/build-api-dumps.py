#!/usr/bin/env python3
"""Genera dumps NDJSON por elección: una fila por (departamento, zona, opcion) con sus votos, a partir
de los votes.json existentes. + manifest.json con conteos/versión. Uso:
  python scripts/build-api-dumps.py nacionales-2024
"""
import json, os, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA = os.path.join(ROOT, 'public/data')
OUT = os.path.join(ROOT, 'public/api/v1/dumps')

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
    with open(ndjson_path, 'w', encoding='utf-8') as out:
        for depto in depts_de(eleccion):
            vp = os.path.join(DATA, eleccion, depto, 'votes.json')
            if not os.path.exists(vp):
                continue
            doc = json.load(open(vp, encoding='utf-8'))
            for z in doc.get('zonas', []):
                for o in z.get('porOpcion', []):
                    out.write(json.dumps({
                        "eleccion": eleccion, "departamento": depto, "geoId": z["geoId"],
                        "opcionId": o["opcionId"], "votos": o["votos"], "validos": z.get("validos"),
                    }, ensure_ascii=False) + "\n")
                    n += 1
    manifest = {"eleccion": eleccion, "registros": n, "formato": "ndjson",
                "campos": ["eleccion", "departamento", "geoId", "opcionId", "votos", "validos"],
                "fuente": "Corte Electoral del Uruguay", "version": "v1"}
    json.dump(manifest, open(os.path.join(OUT, f'{eleccion}.manifest.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    print(f"{eleccion}: {n} filas → {ndjson_path}")

if __name__ == '__main__':
    main()
