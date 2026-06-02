#!/usr/bin/env python3
"""
Epic 17 · Story 17.2 (caso directo) — votes-local.json desde un votes-circuito.json
existente (mismo ciclo, circuito→local directo del catálogo 2024). Sin fuzzy matching.

Uso: python scripts/votes-local-from-circuito.py <eleccion> <tipo>
  ej: python scripts/votes-local-from-circuito.py internas-2024 internas
"""
import json, os, sys
from votes_local_lib import load_circ2local, aggregate_to_local

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(ROOT, "scripts"))

DEPTS = ["artigas","canelones","cerro_largo","colonia","durazno","flores","florida",
         "lavalleja","maldonado","montevideo","paysandu","rio_negro","rivera","rocha",
         "salto","san_jose","soriano","tacuarembo","treinta_y_tres"]

def main():
    eleccion = sys.argv[1] if len(sys.argv) > 1 else "internas-2024"
    tipo = sys.argv[2] if len(sys.argv) > 2 else "internas"
    tot_lossless = 0; tot_dept = 0; tot_sinlocal = 0
    for dept in DEPTS:
        circ_path = os.path.join(ROOT, f"public/data/{eleccion}/{dept}/votes-circuito.json")
        cat_path = os.path.join(ROOT, f"data/processed/locales/{dept}.json")
        if not os.path.exists(circ_path) or not os.path.exists(cat_path):
            continue
        with open(circ_path, encoding="utf-8") as f:
            circ = json.load(f)
        circ_votes = {}
        for z in circ["zonas"]:
            d = {p["opcionId"]: p["votos"] for p in z["porOpcion"]}
            d["_np"] = z.get("noPartidarios", {"enBlanco":0,"anulados":0,"observados":0})
            circ_votes[str(z["geoId"])] = d
        circ2local, cat = load_circ2local(cat_path)
        order = [lo["localId"] for lo in cat["locales"]]
        shard, rep = aggregate_to_local(circ_votes, circ2local, eleccion, dept, tipo, local_order=order)
        out = os.path.join(ROOT, f"public/data/{eleccion}/{dept}/votes-local.json")
        with open(out, "w", encoding="utf-8") as f:
            json.dump(shard, f, ensure_ascii=False)
        tot_dept += 1
        tot_lossless += 1 if not rep["diffs"] else 0
        tot_sinlocal += len(rep["sin_local"])
        flag = "OK" if not rep["diffs"] else f"DIFF={rep['diffs']}"
        sl = f" sin_local={len(rep['sin_local'])}({rep['sin_local'][:5]})" if rep["sin_local"] else ""
        print(f"  {dept:16} locales={rep['locales']:4} circ_in={rep['circuitos_in']:5} {flag}{sl}")
    print(f"\n{eleccion}: {tot_dept} deptos · lossless(sin perder por circuito) {tot_lossless}/{tot_dept} · circuitos sin local total={tot_sinlocal}")

if __name__ == "__main__":
    main()
