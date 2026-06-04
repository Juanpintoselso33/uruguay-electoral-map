#!/usr/bin/env python3
"""Pre-computa el desglose de candidatos a INTENDENTE por departamento para la
vista nacional de `departamentales-2025`.

La base nacional (`_nacional/votes.json`) es solo a nivel LEMA: alcanza para colorear
el mapa y para el listado de partidos de la ficha, pero no dice QUIÉN es el intendente
electo ni cuántos votos sacó cada candidato dentro de su partido. Ese detalle SÍ existe
por departamento en `{depto}/hoja/intendente/{lema}.json` (votos por candidato y serie).
Este script agrega esos votos a nivel departamento y los deja en un único archivo chico
para que la ficha de zona (ZoneSheet) lo consuma sin pedir 19×N shards.

Salida (se commitea — chica, desacopla el deploy igual que el resto de `_nacional/`):
  public/data/departamentales-2025/_nacional/intendentes.json

Forma:
  {
    "fuente": ..., "eleccion": "departamentales-2025",
    "departamentos": {
      "<geoId nacional>": {
        "ganadorLema": "<lemaId>",
        "intendenteElecto": { "candidato": "...", "votos": N, "lema": "<lemaId>" },
        "lemas": { "<lemaId>": [ { "candidato": "...", "votos": N }, ... ] }
      }, ...
    }
  }

El intendente electo = candidato más votado del LEMA ganador (excluyendo "Voto al lema",
que no es una persona). Las listas por lema vienen ordenadas desc e incluyen el "Voto al
lema" al final para que los totales reconcilien con el partido.

Uso: python scripts/build-intendentes-nacional.py
"""
import json
import os
import unicodedata
from collections import defaultdict

ELECCION = "departamentales-2025"
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BASE = os.path.join(ROOT, "public/data", ELECCION)
NACIONAL = os.path.join(BASE, "_nacional", "votes.json")
OUT = os.path.join(BASE, "_nacional", "intendentes.json")

VOTO_AL_LEMA = "Voto al lema"
FUENTE = "Corte Electoral del Uruguay — escrutinio definitivo (votos por candidato a intendente, HOJA_ED)."


def norm(s: str) -> str:
    s = unicodedata.normalize("NFD", s or "")
    return "".join(c for c in s if unicodedata.category(c) != "Mn")


def slug_depto(geo_id: str) -> str:
    """geoId nacional ('Cerro Largo', 'Río Negro') -> slug de carpeta ('cerro_largo', 'rio_negro')."""
    return norm(geo_id).lower().replace(" ", "_")


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


def main():
    if not os.path.exists(NACIONAL):
        raise SystemExit(f"ERROR: no existe {NACIONAL}")

    nac = json.load(open(NACIONAL, encoding="utf-8"))
    departamentos = {}

    for z in nac.get("zonas", []):
        geo = z.get("geoId")
        ganador_lema = z.get("ganadorOpcionId")
        slug = slug_depto(geo)
        dep_dir = os.path.join(BASE, slug)
        hoja_dir = os.path.join(dep_dir, "hoja", "intendente")
        cat_path = os.path.join(dep_dir, "catalogo.json")
        if not os.path.isdir(hoja_dir) or not os.path.exists(cat_path):
            print(f"  AVISO: {geo} ({slug}) sin hoja/intendente o catálogo — se omite")
            continue

        nombre_por_opcion = candidatos_por_opcion(json.load(open(cat_path, encoding="utf-8")))

        lemas = {}
        for fn in sorted(os.listdir(hoja_dir)):
            if not fn.endswith(".json"):
                continue
            lema_id = fn[:-5]
            shard = json.load(open(os.path.join(hoja_dir, fn), encoding="utf-8"))
            tot = defaultdict(int)
            for zona in shard.get("zonas", []):
                for o in zona.get("porOpcion", []):
                    tot[o["opcionId"]] += o.get("votos", 0)

            cands = []
            for opcion_id, votos in tot.items():
                nombre = nombre_por_opcion.get(opcion_id, opcion_id)
                cands.append({"candidato": nombre, "votos": votos})
            # Orden: personas por votos desc; "Voto al lema" siempre al final.
            cands.sort(key=lambda c: (c["candidato"] == VOTO_AL_LEMA, -c["votos"]))
            lemas[lema_id] = cands

        # Intendente electo = candidato más votado del lema ganador (sin "Voto al lema").
        electo = None
        for c in lemas.get(ganador_lema, []):
            if c["candidato"] != VOTO_AL_LEMA:
                electo = {"candidato": c["candidato"], "votos": c["votos"], "lema": ganador_lema}
                break

        departamentos[geo] = {
            "ganadorLema": ganador_lema,
            "intendenteElecto": electo,
            "lemas": lemas,
        }

    payload = {"fuente": FUENTE, "eleccion": ELECCION, "departamentos": departamentos}
    with open(OUT, "w", encoding="utf-8") as f:
        json.dump(payload, f, ensure_ascii=False)

    mb = os.path.getsize(OUT) / 1024 / 1024
    print(f"intendentes: {len(departamentos)} departamentos · {mb:.3f}MB → {OUT}")
    for geo, d in departamentos.items():
        e = d["intendenteElecto"]
        print(f"  {geo}: {e['candidato'] if e else '(sin electo)'} ({d['ganadorLema']})")


if __name__ == "__main__":
    main()
