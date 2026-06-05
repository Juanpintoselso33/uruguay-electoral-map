#!/usr/bin/env python3
"""Pre-computa el desglose de candidatos a INTENDENTE POR SERIE (zona) dentro de cada
departamento, para la ficha de la vista por-departamento de `departamentales-2025`.

Es el gemelo por-serie de `build-intendentes-nacional.py`: ese agrega los votos por
candidato a nivel DEPARTAMENTO (para la vista nacional); este los deja DESAGREGADOS por
serie, de modo que al clickear un polígono (serie) en la vista por-depto la ficha muestre
los candidatos a intendente y cuántos votos sacó cada uno EN ESA ZONA — igual que la
nacional, pero a la granularidad de la serie.

Fuente: `{depto}/hoja/intendente/{lema}.json` (votos por candidato y serie; ya está en
disco, es el mismo insumo del builder nacional → consistencia garantizada). Reusa el mapeo
opcionId→candidato del catálogo, incluyendo el "Voto al lema" (clase candidato, sin persona).

NO se incluye `intendenteElecto` a nivel serie: el intendente se elige a nivel departamento,
no por serie. Mostrar el electo departamental junto al ganador LOCAL de cada serie sería
engañoso (una serie donde gana otro lema marcaría "electo" al candidato equivocado). La ficha
por-serie muestra solo el desglose de candidatos "como les fue en esa zona".

Salida (una por depto, chica, se commitea):
  public/data/{eleccion}/{depto}/intendentes-zona.json

Procesa TODAS las elecciones `departamentales-*` que tengan los insumos por candidato
(`{depto}/hoja/intendente/` + `catalogo.json`). 2025 y 2020 los tienen; 2015 solo tiene
lema (sin candidatos) → se omite y la ficha degrada al ranking por partido.

Forma:
  {
    "fuente": ..., "eleccion": "<eleccion>",
    "zonas": {
      "<serie>": { "lemas": { "<lemaId>": [ { "candidato": "...", "votos": N }, ... ] } },
      ...
    }
  }

Uso: python scripts/build-intendentes-zona.py            # todas las departamentales-*
     python scripts/build-intendentes-zona.py 2020 2025  # solo esos años
"""
import glob
import json
import os
import sys
import unicodedata
from collections import defaultdict

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA = os.path.join(ROOT, "public/data")

VOTO_AL_LEMA = "Voto al lema"
FUENTE = "Corte Electoral del Uruguay — escrutinio definitivo (votos por candidato a intendente y serie, HOJA_ED)."


def norm(s: str) -> str:
    s = unicodedata.normalize("NFD", s or "")
    return "".join(c for c in s if unicodedata.category(c) != "Mn")


def candidatos_por_opcion(cat_doc) -> dict:
    """opcionId -> nombre del candidato, desde la contienda 'intendente' del catálogo."""
    out = {}
    for c in cat_doc.get("contiendas", []):
        if c.get("contienda") != "intendente":
            continue
        for o in c.get("opciones", []):
            if o.get("clase") == "candidato" and o.get("candidato"):
                out[o["id"]] = o["candidato"]
    return out


def build_depto(base: str, slug: str, eleccion: str) -> dict | None:
    dep_dir = os.path.join(base, slug)
    hoja_dir = os.path.join(dep_dir, "hoja", "intendente")
    cat_path = os.path.join(dep_dir, "catalogo.json")
    if not os.path.isdir(hoja_dir) or not os.path.exists(cat_path):
        return None

    nombre_por_opcion = candidatos_por_opcion(json.load(open(cat_path, encoding="utf-8")))

    # serie -> lemaId -> {candidato: votos}
    por_serie: dict[str, dict[str, defaultdict]] = defaultdict(lambda: defaultdict(lambda: defaultdict(int)))
    for fn in sorted(os.listdir(hoja_dir)):
        if not fn.endswith(".json"):
            continue
        lema_id = fn[:-5]
        shard = json.load(open(os.path.join(hoja_dir, fn), encoding="utf-8"))
        for zona in shard.get("zonas", []):
            serie = zona.get("geoId")
            if not serie:
                continue
            tot = por_serie[serie][lema_id]
            for o in zona.get("porOpcion", []):
                tot[o["opcionId"]] += o.get("votos", 0)

    zonas = {}
    for serie, lemas_raw in por_serie.items():
        lemas = {}
        for lema_id, tot in lemas_raw.items():
            cands = [
                {"candidato": nombre_por_opcion.get(oid, oid), "votos": v}
                for oid, v in tot.items()
            ]
            # Personas por votos desc; "Voto al lema" siempre al final (igual que el builder nacional).
            cands.sort(key=lambda c: (c["candidato"] == VOTO_AL_LEMA, -c["votos"]))
            lemas[lema_id] = cands
        zonas[serie] = {"lemas": lemas}

    return {"fuente": FUENTE, "eleccion": eleccion, "zonas": zonas}


def build_eleccion(eleccion: str) -> int:
    base = os.path.join(DATA, eleccion)
    if not os.path.isdir(base):
        return 0
    total = 0
    for slug in sorted(os.listdir(base)):
        if slug.startswith("_") or not os.path.isdir(os.path.join(base, slug)):
            continue
        payload = build_depto(base, slug, eleccion)
        if payload is None:
            continue
        out = os.path.join(base, slug, "intendentes-zona.json")
        with open(out, "w", encoding="utf-8") as f:
            json.dump(payload, f, ensure_ascii=False)
        total += 1
        print(f"  {eleccion}/{slug}: {len(payload['zonas'])} series")
    return total


def main():
    args = sys.argv[1:]
    if args:
        elecciones = [a if a.startswith("departamentales") else f"departamentales-{a}" for a in args]
    else:
        elecciones = sorted(
            os.path.basename(p) for p in glob.glob(os.path.join(DATA, "departamentales-*"))
            if os.path.isdir(p)
        )

    for eleccion in elecciones:
        n = build_eleccion(eleccion)
        print(f"intendentes-zona [{eleccion}]: {n} departamentos")


if __name__ == "__main__":
    main()
