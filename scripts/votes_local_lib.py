#!/usr/bin/env python3
"""
Epic 17 — librería común: agregar votos por CIRCUITO a nivel LOCAL.

`aggregate_to_local()` toma:
  - circ_votes: dict geoId(circuito,str) -> {opcionId: votos, "_np": {enBlanco,anulados,observados}}
  - circ2local: dict geoId(circuito,str) -> localId
y emite un VotosShard nivel='local' (mismo shape que votes-circuito.json), más un
reporte de losslessness (Σ por local == Σ por circuito) y de circuitos sin local.
"""
import json, os

def load_circ2local(cat_path):
    """circuito(int,str) -> localId, desde data/processed/locales/{dept}.json (ciclo 2024)."""
    with open(cat_path, encoding="utf-8") as f:
        cat = json.load(f)
    m = {}
    for lo in cat["locales"]:
        for c in lo["circuitos"]:
            m[str(c)] = lo["localId"]
    return m, cat

def aggregate_to_local(circ_votes, circ2local, eleccion, dept, tipo, local_order=None, cat_meta=None):
    """Devuelve (shard_dict, report_dict).

    cat_meta (opcional): {localId: {nombre, direccion, habilitados}} → enriquece cada local con su
    metadata. Además cada local lleva `circuitos: [{circuito, ganadorOpcionId, validos}]` (desglose
    de los circuitos que votan ahí, para la ficha — Epic "ficha por circuito/local")."""
    by_local = {}          # localId -> {opcionId: votos}
    np_local = {}          # localId -> {enBlanco,anulados,observados}
    circ_local = {}        # localId -> [{circuito, ganadorOpcionId, validos}]
    sin_local = []         # circuitos sin localId
    tot_circ = {}          # opcionId -> votos (control)
    for geoId, votos in circ_votes.items():
        lid = circ2local.get(str(geoId))
        np = votos.get("_np", {"enBlanco": 0, "anulados": 0, "observados": 0})
        cv = {op: v for op, v in votos.items() if op != "_np"}
        for op, v in cv.items():
            tot_circ[op] = tot_circ.get(op, 0) + v
        if lid is None:
            sin_local.append(str(geoId))
            continue
        d = by_local.setdefault(lid, {})
        for op, v in cv.items():
            d[op] = d.get(op, 0) + v
        n = np_local.setdefault(lid, {"enBlanco": 0, "anulados": 0, "observados": 0})
        for k in ("enBlanco", "anulados", "observados"):
            n[k] += np.get(k, 0)
        # desglose por circuito dentro del local (ganador + válidos de cada circuito)
        circ_local.setdefault(lid, []).append({
            "circuito": str(geoId),
            "ganadorOpcionId": max(cv.items(), key=lambda kv: kv[1])[0] if cv else "",
            "validos": sum(cv.values()),
        })

    # ordenar locales (por el orden del catálogo si se pasa)
    order = local_order or sorted(by_local.keys())
    zonas = []
    tot_local = {}
    for lid in order:
        if lid not in by_local:
            continue
        lemas = by_local[lid]
        ranking = sorted(lemas.items(), key=lambda kv: -kv[1])
        validos = sum(v for _, v in ranking)
        for op, v in lemas.items():
            tot_local[op] = tot_local.get(op, 0) + v
        zona = {
            "geoId": lid,
            "ganadorOpcionId": ranking[0][0] if ranking else "",
            "validos": validos,
            "porOpcion": [{"opcionId": op, "votos": v} for op, v in ranking],
            "noPartidarios": np_local.get(lid, {"enBlanco": 0, "anulados": 0, "observados": 0}),
            # Ficha por local: circuitos que votan acá (ordenados por válidos desc).
            "circuitos": sorted(circ_local.get(lid, []), key=lambda c: -c["validos"]),
        }
        meta = (cat_meta or {}).get(lid)
        if meta:
            zona["local"] = {"nombre": meta.get("nombre"), "direccion": meta.get("direccion"),
                             "habilitados": meta.get("habilitados")}
        zonas.append(zona)

    shard = {
        "eleccionId": eleccion, "departamento": dept, "nivel": "local",
        "escrutinio": "definitivo", "tipo": tipo, "zonas": zonas,
    }
    # gate de losslessness: cada opcion suma igual en circuito y en local (menos lo sin_local)
    diffs = {}
    for op, v in tot_circ.items():
        got = tot_local.get(op, 0)
        # restar lo perdido por circuitos sin local
        if got != v:
            diffs[op] = {"circuito": v, "local": got}
    report = {
        "dept": dept, "locales": len(zonas), "circuitos_in": len(circ_votes),
        "sin_local": sin_local, "lossless": len(diffs) == 0 or len(sin_local) > 0,
        "diffs": diffs,
    }
    return shard, report
