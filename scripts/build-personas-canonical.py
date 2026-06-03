#!/usr/bin/env python3
"""Consolida public/data/personas/personas-hoja.*.json → public/data/personas/personas.json:
una persona por credencial (personaId), con sus apariciones por elección. Uso:
  python scripts/build-personas-canonical.py
"""
import json, os, glob
from collections import defaultdict

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DIR = os.path.join(ROOT, 'public/data/personas')

def main():
    files = sorted(glob.glob(os.path.join(DIR, 'personas-hoja.*.json')))
    if not files:
        raise SystemExit("no hay personas-hoja.*.json (corré etl:personas-hoja)")
    personas = {}
    for path in files:
        doc = json.load(open(path, encoding='utf-8'))
        eleccion = doc["eleccion"]
        for r in doc["registros"]:
            pid = r["personaId"]
            p = personas.setdefault(pid, {"personaId": pid, "nombres": [], "sexo": r.get("sexo"), "apariciones": []})
            if r["nombre"] and r["nombre"] not in p["nombres"]:
                p["nombres"].append(r["nombre"])
            p["apariciones"].append({
                "eleccion": eleccion, "departamento": r["departamento"], "hoja": r["hoja"],
                "partido": r["partido"], "sublema": r.get("sublema"), "cargo": r["cargo"],
                "ordinal": r.get("ordinal"), "titularSuplente": r.get("titularSuplente"),
            })
    out = sorted(personas.values(), key=lambda p: p["nombres"][0] if p["nombres"] else p["personaId"])
    dest = os.path.join(DIR, 'personas.json')
    with open(dest, 'w', encoding='utf-8') as f:
        json.dump({"total": len(out), "personas": out}, f, ensure_ascii=False)
    multi = sum(1 for p in out if len({a["eleccion"] for a in p["apariciones"]}) > 1)
    print(f"{len(out)} personas consolidadas ({multi} en >1 elección) → {dest}")

if __name__ == '__main__':
    main()
