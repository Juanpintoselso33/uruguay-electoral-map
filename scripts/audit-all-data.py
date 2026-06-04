#!/usr/bin/env python3
"""QA exhaustivo de TODOS los datos: barre cada elección × (_nacional + deptos) × shard de votos y
valida invariantes que romperían el mapa o el resultado. Reporta TODO lo sospechoso. Read-only.

Checks por zona/shard:
  1. ganadorOpcionId == opción más votada realmente (bug de coloreo si no).
  2. validos coherente: sin negativos/NaN; Σ porOpcion (partidarios) ≤ validos; reportar gaps grandes.
  3. opcionId referencial: cada opcionId de votos existe en opciones.json (si está).
  4. join geo↔votos: cada geoId de votos tiene polígono (y reporta huérfanos por ambos lados).
  5. municipales: cada municipio con alcalde resuelto + Concejo de 5 (1 alcalde + 4 concejales).
Uso: python scripts/audit-all-data.py
"""
import json, os, sys, unicodedata
from collections import defaultdict

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA = os.path.join(ROOT, "public/data")
GEO = os.path.join(DATA, "geo")

def norm(s):
    return "".join(c for c in unicodedata.normalize("NFD", str(s or "")) if unicodedata.category(c) != "Mn").upper().strip()

def load(p):
    try:
        return json.load(open(p, encoding="utf-8"))
    except Exception as e:
        return {"__error__": str(e)}

def deps():
    return json.load(open(os.path.join(ROOT, "src/config/departments.json"), encoding="utf-8"))

issues = []
def flag(sev, eleccion, depto, msg):
    issues.append((sev, eleccion, depto, msg))

# geometría: geoIds disponibles por (depto, nivel) — election-aware para municipio
_geo_cache = {}
def geo_ids(depto, nivel, eleccion):
    fname = nivel
    if nivel == "municipio" and eleccion != "municipales-2025":
        y = "".join(ch for ch in eleccion if ch.isdigit())[:4]
        fname = f"municipio.{y}"
    key = (depto, fname)
    if key in _geo_cache:
        return _geo_cache[key]
    path = os.path.join(GEO, depto, f"{fname}.topo.json")
    ids = None
    if os.path.exists(path):
        t = load(path)
        if "__error__" not in t and t.get("objects"):
            obj = next(iter(t["objects"].values()))
            ids = {norm(g.get("properties", {}).get("name")) for g in obj.get("geometries", [])}
    _geo_cache[key] = ids
    return ids

SHARDS = ["votes.json", "votes-zona.json", "votes-circuito.json", "votes-local.json",
          "votes-barrio.json", "votes-localidad.json"]

def audit_shard(eleccion, depto, fname, opciones_ok):
    doc = load(os.path.join(DATA, eleccion, depto, fname))
    if "__error__" in doc:
        flag("ERROR", eleccion, depto, f"{fname}: no parsea ({doc['__error__']})")
        return
    nivel = doc.get("nivel")
    zonas = doc.get("zonas", [])
    if not zonas:
        flag("WARN", eleccion, depto, f"{fname}: 0 zonas")
        return
    geoset = geo_ids(depto, nivel, eleccion) if nivel else None
    vote_geoids = set()
    for z in zonas:
        gid = z.get("geoId")
        vote_geoids.add(norm(gid))
        por = z.get("porOpcion", [])
        # 1 + 2: votos válidos
        votos = [o.get("votos", 0) for o in por]
        if any((not isinstance(v, (int, float)) or v < 0) for v in votos):
            flag("ERROR", eleccion, depto, f"{fname}/{gid}: voto negativo/no-numérico {votos[:3]}")
        suma = sum(v for v in votos if isinstance(v, (int, float)))
        val = z.get("validos", 0)
        if isinstance(val, (int, float)) and suma > val + 1:
            flag("WARN", eleccion, depto, f"{fname}/{gid}: Σ porOpcion {suma} > validos {val}")
        # ganador correcto
        if por:
            real = max(por, key=lambda o: o.get("votos", 0))
            gan = z.get("ganadorOpcionId")
            if gan is not None and gan != real["opcionId"] and real.get("votos", 0) > 0:
                # solo si hay diferencia REAL de votos (no empate)
                gv = next((o["votos"] for o in por if o["opcionId"] == gan), None)
                if gv is None or gv < real["votos"]:
                    flag("ERROR", eleccion, depto, f"{fname}/{gid}: ganador={gan} pero más votada={real['opcionId']} ({real['votos']})")
        # 3: opcionId referencial
        if opciones_ok is not None:
            for o in por:
                if o["opcionId"] not in opciones_ok:
                    flag("WARN", eleccion, depto, f"{fname}/{gid}: opcionId '{o['opcionId']}' no está en opciones.json")
                    break
    # 4: join geo
    if geoset is not None:
        orphan_votes = vote_geoids - geoset
        orphan_geo = geoset - vote_geoids
        if orphan_votes:
            sev = "ERROR" if len(orphan_votes) > len(vote_geoids) * 0.2 else "WARN"
            flag(sev, eleccion, depto, f"{fname} ({nivel}): {len(orphan_votes)}/{len(vote_geoids)} geoIds de votos SIN polígono: {sorted(orphan_votes)[:4]}")
        if orphan_geo and len(orphan_geo) > 2:
            flag("WARN", eleccion, depto, f"{fname} ({nivel}): {len(orphan_geo)} polígonos sin votos: {sorted(orphan_geo)[:4]}")

def audit_municipales(eleccion):
    alc = load(os.path.join(DATA, eleccion, "_nacional", "alcaldes.json"))
    con = load(os.path.join(DATA, eleccion, "_nacional", "concejos.json"))
    if "__error__" in alc:
        flag("ERROR", eleccion, "_nacional", "alcaldes.json no parsea"); return
    if "__error__" in con:
        flag("ERROR", eleccion, "_nacional", "concejos.json no parsea"); return
    am = alc.get("municipios", {}); cm = con.get("municipios", {})
    nv = load(os.path.join(DATA, eleccion, "_nacional", "votes.json"))
    vgeo = {z["geoId"] for z in nv.get("zonas", [])}
    sin_alc = [g for g in vgeo if not (am.get(g, {}).get("alcaldeElecto"))]
    if sin_alc:
        flag("WARN", eleccion, "_nacional", f"{len(sin_alc)} municipios sin alcalde resuelto: {sin_alc[:4]}")
    for g in vgeo:
        c = cm.get(g, {}).get("concejo")
        if not c:
            flag("ERROR", eleccion, "_nacional", f"municipio sin Concejo: {g}"); continue
        if len(c) != 5:
            flag("ERROR", eleccion, "_nacional", f"Concejo de {g} tiene {len(c)} cargos (esperado 5)")
        nalc = sum(1 for x in c if x.get("cargo") == "alcalde")
        if nalc != 1:
            flag("ERROR", eleccion, "_nacional", f"Concejo de {g}: {nalc} alcaldes (esperado 1)")
        if any(not x.get("nombre") or "sin nómina" in str(x.get("nombre")).lower() for x in c):
            flag("WARN", eleccion, "_nacional", f"Concejo de {g}: algún cargo sin nombre")

def main():
    ds = deps()
    elecciones = sorted({e for d in ds for e in d["elecciones"]})
    deptos_de = {e: [d["id"] for d in ds if e in d["elecciones"]] for e in elecciones}
    print(f"Auditando {len(elecciones)} elecciones…\n")
    for e in elecciones:
        targets = (["_nacional"] if os.path.isdir(os.path.join(DATA, e, "_nacional")) else []) + deptos_de[e]
        for depto in targets:
            base = os.path.join(DATA, e, depto)
            if not os.path.isdir(base):
                continue
            opc = load(os.path.join(base, "opciones.json"))
            opciones_ok = {o["opcionId"] for o in opc.get("opciones", [])} if "__error__" not in opc and opc.get("opciones") else None
            for fname in SHARDS:
                if os.path.exists(os.path.join(base, fname)):
                    audit_shard(e, depto, fname, opciones_ok)
        if e.startswith("municipales"):
            audit_municipales(e)

    errs = [i for i in issues if i[0] == "ERROR"]
    warns = [i for i in issues if i[0] == "WARN"]
    print(f"=== RESULTADO: {len(errs)} ERRORES, {len(warns)} WARNINGS ===\n")
    for sev in ("ERROR", "WARN"):
        grp = [i for i in issues if i[0] == sev]
        if grp:
            print(f"--- {sev} ({len(grp)}) ---")
            for _, e, d, m in grp[:80]:
                print(f"  [{e} · {d}] {m}")
            if len(grp) > 80:
                print(f"  … y {len(grp)-80} más")
            print()
    return 1 if errs else 0

if __name__ == "__main__":
    sys.exit(main())
