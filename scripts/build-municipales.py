#!/usr/bin/env python3
"""Story 22.3 — ETL de la elección `municipales-2025` (nivel municipio).

Deriva una elección PROPIA a partir de la contienda `municipio` de `departamentales-2025`:
agrega los votos serie→municipio (mapeo Story 22.1) a nivel LEMA y produce el dataset que
consume el app como cualquier otra elección (votes.json + opciones.json + catalogo.json),
nacional + per-depto. La geometría la aporta la Story 22.2 (geo/{depto}/municipio.topo.json).

geoId per-depto = nombre del municipio. geoId NACIONAL = "MUNICIPIO · Depto" (mismo nombre
compuesto que la geometría nacional — hay 3 nombres repetidos entre deptos + da contexto).

Montevideo se omite (caso especial, ver Story 22.1/22.2).

Uso: python scripts/build-municipales.py
"""
import json, os, unicodedata
from collections import defaultdict

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = "departamentales-2025"
DST = "municipales-2025"
SRC_DIR = os.path.join(ROOT, "public/data", SRC)
DST_DIR = os.path.join(ROOT, "public/data", DST)
MAP_DIR = os.path.join(ROOT, "public/data/mappings")

DEPTOS = ["artigas", "canelones", "cerro_largo", "colonia", "durazno", "flores", "florida",
          "lavalleja", "maldonado", "montevideo", "paysandu", "rio_negro", "rivera", "rocha",
          "salto", "san_jose", "soriano", "tacuarembo", "treinta_y_tres"]

# MVD reusa el catálogo + el voto municipal por SERIE generado por build-montevideo-municipio-shards.py
# (dir aparte para no pisar los shards barrio-keyed de la vista departamental).
def hoja_municipio_dir(slug):
    return os.path.join(SRC_DIR, slug, "hoja", "municipio-serie" if slug == "montevideo" else "municipio")


def labels():
    deps = json.load(open(os.path.join(ROOT, "src/config/departments.json"), encoding="utf-8"))
    return {d["id"]: d["label"] for d in deps}


def municipio_contienda(cat):
    return next((c for c in cat.get("contiendas", []) if c.get("contienda") == "municipio"), None)


def write(path, obj):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(obj, f, ensure_ascii=False)


def main():
    DEPTO_LABEL = labels()
    nacional_zonas = []
    nacional_opciones = {}   # lemaId -> nombre
    recon_fail = 0

    for slug in DEPTOS:
        mpath = os.path.join(MAP_DIR, slug, f"serie-municipio.{SRC}.json")
        cpath = os.path.join(SRC_DIR, slug, "catalogo.json")
        hdir = hoja_municipio_dir(slug)
        if not (os.path.exists(mpath) and os.path.exists(cpath) and os.path.isdir(hdir)):
            continue

        serie_muni = {e["serie"].upper(): e["municipio"] for e in json.load(open(mpath, encoding="utf-8"))}
        cat = json.load(open(cpath, encoding="utf-8"))
        mc = municipio_contienda(cat)
        opc_lema = {o["id"]: o["lemaId"] for o in mc.get("opciones", []) if o.get("lemaId")}
        lema_nombre = {n["id"]: n.get("etiqueta", n["id"]) for n in mc.get("nodos", []) if n.get("nivel") == "lema"}

        # voto por (municipio, lema), agregando series
        por_muni = defaultdict(lambda: defaultdict(int))
        serie_muni_total = defaultdict(int)  # control de reconciliación: total por serie
        for fn in sorted(os.listdir(hdir)):
            if not fn.endswith(".json"):
                continue
            for z in json.load(open(os.path.join(hdir, fn), encoding="utf-8")).get("zonas", []):
                muni = serie_muni.get(z["geoId"].upper())
                if not muni:
                    continue
                for o in z.get("porOpcion", []):
                    lema = opc_lema.get(o["opcionId"])
                    if not lema:
                        continue
                    v = o.get("votos", 0)
                    por_muni[muni][lema] += v
                    serie_muni_total[z["geoId"].upper()] += v

        if not por_muni:
            continue

        opciones_depto = {}
        zonas = []
        for muni, lemas in por_muni.items():
            porOpcion = [{"opcionId": l, "votos": v} for l, v in sorted(lemas.items(), key=lambda kv: -kv[1])]
            validos = sum(lemas.values())
            ganador = porOpcion[0]["opcionId"] if porOpcion else None
            for l in lemas:
                nombre = lema_nombre.get(l, l.replace("-", " ").title())
                opciones_depto[l] = nombre
                nacional_opciones[l] = nombre
            zona = {"geoId": muni, "ganadorOpcionId": ganador, "validos": validos,
                    "porOpcion": porOpcion,
                    "noPartidarios": {"enBlanco": 0, "anulados": 0, "observados": 0}}
            zonas.append(zona)
            # nacional: geoId compuesto (igual que la geometría nacional)
            nac = dict(zona); nac["geoId"] = f"{muni} · {DEPTO_LABEL.get(slug, slug)}"
            nacional_zonas.append(nac)

        # Reconciliación: Σ validos municipios == Σ votos de las series (lema) del depto
        suma_muni = sum(z["validos"] for z in zonas)
        suma_serie = sum(serie_muni_total.values())
        if suma_muni != suma_serie:
            print(f"  ✗ {slug}: reconciliación FALLÓ (municipios {suma_muni} ≠ series {suma_serie})")
            recon_fail += 1

        write(os.path.join(DST_DIR, slug, "votes.json"),
              {"eleccionId": DST, "departamento": slug, "nivel": "municipio",
               "escrutinio": "definitivo", "tipo": "municipales", "zonas": zonas})
        write(os.path.join(DST_DIR, slug, "opciones.json"),
              {"opciones": [{"opcionId": k, "nombre": v} for k, v in sorted(opciones_depto.items())]})
        # Catálogo: reusa la contienda municipio (habilita drill-down por lista más adelante).
        write(os.path.join(DST_DIR, slug, "catalogo.json"),
              {"eleccionId": DST, "departamento": slug, "contiendas": [mc]})
        print(f"  ✓ {slug}: {len(zonas)} municipios, {len(opciones_depto)} lemas")

    # Nacional
    write(os.path.join(DST_DIR, "_nacional", "votes.json"),
          {"eleccionId": DST, "departamento": "_nacional", "nivel": "municipio",
           "escrutinio": "definitivo", "tipo": "municipales", "zonas": nacional_zonas})
    write(os.path.join(DST_DIR, "_nacional", "opciones.json"),
          {"opciones": [{"opcionId": k, "nombre": v} for k, v in sorted(nacional_opciones.items())]})

    print(f"\n{DST}: {len(nacional_zonas)} municipios (nacional) · {len(nacional_opciones)} lemas")
    if recon_fail:
        raise SystemExit(f"GATE FALLÓ: {recon_fail} deptos no reconcilian.")
    print("GATE OK: reconciliación municipios == series en todos los deptos.")


if __name__ == "__main__":
    main()
