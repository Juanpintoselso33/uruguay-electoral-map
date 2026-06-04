#!/usr/bin/env python3
"""Consolida los shards de persona → public/data/personas/personas.json: una persona por
credencial (personaId), con sus apariciones por elección.

Lee DOS patrones de shard:
  - personas-hoja.*.json       → nativos (id = credencial real). match = "credencial".
  - personas-historico.*.json  → puente 2019/2020 sin credencial, linkeado por nombre
                                  unívoco (ver [[build-personas-historico]]). match = "nombre".
Los nativos se procesan PRIMERO para fijar el sexo real (los históricos traen sexo=None).
Cada aparición lleva `match` para que aguas abajo se pueda filtrar por confianza.

Uso: python scripts/build-personas-canonical.py
"""
import json, os, glob
from collections import defaultdict

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DIR = os.path.join(ROOT, 'public/data/personas')

def main():
    # Nativos PRIMERO (fijan sexo y crean la persona); históricos DESPUÉS (solo extienden).
    files = (sorted(glob.glob(os.path.join(DIR, 'personas-hoja.*.json')))
             + sorted(glob.glob(os.path.join(DIR, 'personas-historico.*.json'))))
    if not files:
        raise SystemExit("no hay shards (corré etl:personas-hoja / etl:personas-historico)")
    personas = {}
    n_hist = 0
    for path in files:
        doc = json.load(open(path, encoding='utf-8'))
        eleccion = doc["eleccion"]
        for r in doc["registros"]:
            pid = r["personaId"]
            p = personas.setdefault(pid, {"personaId": pid, "nombres": [], "sexo": r.get("sexo"), "apariciones": []})
            if not p["sexo"] and r.get("sexo"):
                p["sexo"] = r["sexo"]
            if r["nombre"] and r["nombre"] not in p["nombres"]:
                p["nombres"].append(r["nombre"])
            match = r.get("match", "credencial")
            if match == "nombre":
                n_hist += 1
            p["apariciones"].append({
                "eleccion": eleccion, "departamento": r["departamento"], "hoja": r["hoja"],
                "partido": r["partido"], "sublema": r.get("sublema"), "cargo": r["cargo"],
                "ordinal": r.get("ordinal"), "titularSuplente": r.get("titularSuplente"),
                "match": match,
            })
    out = sorted(personas.values(), key=lambda p: p["nombres"][0] if p["nombres"] else p["personaId"])
    dest = os.path.join(DIR, 'personas.json')
    with open(dest, 'w', encoding='utf-8') as f:
        json.dump({"total": len(out), "personas": out}, f, ensure_ascii=False)
    multi = sum(1 for p in out if len({a["eleccion"] for a in p["apariciones"]}) > 1)
    print(f"{len(out)} personas consolidadas ({multi} en >1 elección, {n_hist:,} apariciones por nombre) → {dest}")

if __name__ == '__main__':
    main()
