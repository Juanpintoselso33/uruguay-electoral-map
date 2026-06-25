#!/usr/bin/env python3
"""Completa el nivel `localidad` del interior fusionando la CAPITAL (que no tiene polígono a nivel
localidad → quedaba como hueco con ~60-85% de votos sin join) con su subdivisión por BARRIO, que
SÍ tiene geometría. Resultado: localidad = pueblos (localidad) + capital subdividida (barrio),
sin huecos, reusando el nivel `localidad` ya cableado en front/API.

Solo aplica a los deptos del Grupo B (capital sin polígono localidad PERO con barrio.topo.json +
votes-barrio.json): salto, paysandu, rivera, cerro_largo, san_jose, artigas, durazno, treinta_y_tres.
Los del Grupo A (canelones, maldonado, colonia, …) ya joinean ~100% a nivel localidad → no se tocan.

Post-step IDEMPOTENTE sobre artefactos procesados (los generadores TS no son re-ejecutables sin los
CSV raw):
  - votos: por elección, si la localidad aún tiene la fila-hueco de la capital, la reemplaza por las
    filas de votes-barrio.json. Gate: Σ por opción IDÉNTICA (la capital == Σ de sus barrios).
  - geometría: una vez por depto, fusiona barrio.topo.json dentro de localidad.topo.json (mapshaper).
  Re-correr no duplica (detecta barrios ya presentes y saltea).

Uso: python scripts/build-localidad-completa.py            (todos los deptos del Grupo B, todas las elecciones)
"""
import json, os, subprocess, sys, unicodedata
from collections import defaultdict

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA = os.path.join(ROOT, "public/data")
GEO = os.path.join(DATA, "geo")


def norm(s):
    return "".join(c for c in unicodedata.normalize("NFD", str(s or "")) if unicodedata.category(c) != "Mn").upper().strip()


def load(p):
    return json.load(open(p, encoding="utf-8")) if os.path.exists(p) else None


def write(p, obj):
    json.dump(obj, open(p, "w", encoding="utf-8"), ensure_ascii=False)


def topo_names(p):
    t = load(p)
    if not t:
        return set()
    o = next(iter(t["objects"].values()))
    return {norm(g["properties"].get("name")) for g in o["geometries"]}


def por_opcion_total(zonas):
    tot = defaultdict(int)
    for z in zonas:
        for op in z.get("porOpcion", []):
            tot[op["opcionId"]] += op["votos"]
    return tot


def grupo_b():
    """Deptos con hueco de capital a nivel localidad + barrio disponible."""
    out = []
    for d in sorted(os.listdir(GEO)):
        if d.startswith("_") or not os.path.isdir(os.path.join(GEO, d)):
            continue
        if os.path.exists(os.path.join(GEO, d, "barrio.topo.json")) and os.path.exists(os.path.join(GEO, d, "localidad.topo.json")):
            out.append(d)
    return out


def merge_votos(eleccion, depto, town_names, barrio_geo, serie_barrio):
    """Reemplaza la fila-hueco de la capital por las filas de votes-barrio.json. Idempotente.
    LÍMITE: solo aplica donde EXISTE votes-barrio.json (≈6 elecciones modernas por depto). El mapeo
    `serie-barrio` usa OTRA taxonomía de barrios que NO matchea barrio.topo.json, así que NO se puede
    sintetizar votes-barrio para las demás elecciones (quedaría sin join). Esas se saltean."""
    lp = os.path.join(DATA, eleccion, depto, "votes-localidad.json")
    loc = load(lp)
    if not loc:
        return "skip(no-localidad)"
    bar = load(os.path.join(DATA, eleccion, depto, "votes-barrio.json"))
    if not bar:
        return "skip(sin-votes-barrio)"
    barrio_ids = {norm(z["geoId"]) for z in bar["zonas"]}
    # idempotencia: ya mergeado si alguna fila de barrio ya está en localidad.
    if any(norm(z["geoId"]) in barrio_ids for z in loc["zonas"]):
        return "ya-mergeado"
    # filas-hueco = geoIds de localidad que NO están en la geometría ORIGINAL de pueblos.
    holes = [z for z in loc["zonas"] if norm(z["geoId"]) not in town_names]
    if not holes:
        return "sin-hueco"
    # capital = el hueco más votado; el resto (rurales sin polígono) se dejan como están.
    capital = max(holes, key=lambda z: z.get("validos", 0))
    antes = por_opcion_total(loc["zonas"])
    nuevas = [z for z in loc["zonas"] if z is not capital] + bar["zonas"]
    despues = por_opcion_total(nuevas)
    # GATE: la suma por opción no cambia (la capital == Σ de sus barrios).
    if antes != despues:
        difs = {k: despues.get(k, 0) - antes.get(k, 0) for k in set(antes) | set(despues)}
        difs = {k: v for k, v in difs.items() if v}
        tot = sum(antes.values()) or 1
        delta = sum(abs(v) for v in difs.values())
        if delta / tot > 0.02:  # >2% → no reconcilia, abortar este depto/elección
            return f"NO-RECONCILIA delta={delta:,} ({delta/tot:.1%}) {dict(list(difs.items())[:3])}"
    loc["zonas"] = nuevas
    write(lp, loc)
    return f"ok(+{len(bar['zonas'])} barrios, -1 capital '{capital['geoId']}')"


def merge_geometria(depto):
    """Fusiona barrio.topo.json dentro de localidad.topo.json (mapshaper). Idempotente."""
    locp = os.path.join(GEO, depto, "localidad.topo.json")
    barp = os.path.join(GEO, depto, "barrio.topo.json")
    if topo_names(barp) <= topo_names(locp):  # ya están todos los barrios → idempotente
        return "ya-mergeado"
    cmd = ["npx", "mapshaper", "-i", locp, barp, "combine-files",
           "-merge-layers", "force", "-o", locp, "format=topojson"]
    r = subprocess.run(cmd, capture_output=True, text=True, shell=(os.name == "nt"), cwd=ROOT)
    if r.returncode != 0:
        return f"ERROR mapshaper: {r.stderr[:200]}"
    return f"ok ({len(topo_names(locp))} polígonos)"


def main():
    deptos = grupo_b()
    print(f"Grupo B (capital sin polígono localidad + barrio disponible): {deptos}\n")
    elecciones = sorted(e for e in os.listdir(DATA)
                        if os.path.isdir(os.path.join(DATA, e)) and not e.startswith("_")
                        and e not in {"geo", "mappings", "personas", "api", "hoja-equivalencias"})
    import glob
    for depto in deptos:
        town_names = topo_names(os.path.join(GEO, depto, "localidad.topo.json"))
        barrio_geo = topo_names(os.path.join(GEO, depto, "barrio.topo.json"))
        # los pueblos "originales" = localidad menos los barrios (por si ya se mergeó la geometría)
        town_names = town_names - barrio_geo
        sb_files = glob.glob(os.path.join(DATA, "mappings", depto, "*serie-barrio*.json"))
        serie_barrio = load(sb_files[0]) if sb_files else []
        n_ok = n_skip = 0; errs = []
        for e in elecciones:
            res = merge_votos(e, depto, town_names, barrio_geo, serie_barrio)
            if res.startswith("ok"):
                n_ok += 1
            elif "NO-RECONCILIA" in res or "ERROR" in res:
                errs.append(f"{e}: {res}")
            else:
                n_skip += 1
        geo_res = merge_geometria(depto)
        print(f"  {depto:16s} votos: {n_ok} mergeados, {n_skip} skip | geo: {geo_res}")
        for er in errs:
            print(f"      ⚠ {er}")
    print("\n✅ build-localidad-completa: nivel localidad completado para el Grupo B")


if __name__ == "__main__":
    sys.exit(main())
