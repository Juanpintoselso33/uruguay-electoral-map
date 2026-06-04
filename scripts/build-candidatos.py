#!/usr/bin/env python3
"""Pre-computa el recurso candidate-centric de la API (Epic 21.3) a partir de la
dimensión persona↔hoja (`public/data/personas/personas.json`) y los votos por hoja
(`hoja-local.json` por depto). Para cada persona suma los votos de la(s) lista(s)
que integra, por departamento y elección (métrica = voto a la LISTA, no voto personal).

Diseño (datasets únicos, NO un archivo por persona): lo más eficiente para el
consumidor analítico (una descarga, índice por id en memoria, consultas O(1)) y sin
inflar git ni el build. Salidas en public/api/v1/candidatos/ (SÍ se commitean:
desacoplan el deploy de CKAN; el raw de personas ~340MB sigue gitignored):

  - index.json           — índice de búsqueda de LEGISLADORES (id, nombre, cargos, partidos, elecciones).
  - legisladores.json    — LEGISLADORES con resultados completos (porDepto + total por elección).
  - personas-index.json  — índice slim de TODAS las personas (sin resultados), para cobertura/descubrimiento.

Reusa la lógica verificada de scripts/query-persona.py (hoja_opcion con desambiguación
por partido, dedup por (eleccion,depto,opcionId), votos desde hoja-local.json).

Uso: python scripts/build-candidatos.py
"""
import json
import os
import unicodedata
from collections import defaultdict

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PERSONAS = os.path.join(ROOT, "public/data/personas/personas.json")
OUT = os.path.join(ROOT, "public/api/v1/candidatos")

CARGOS_LEGISLATIVOS = {"SENADOR", "REPRESENTANTE"}
METRICA = ("votos de la(s) lista(s) que integra la persona (hoja), por departamento. "
           "No es voto personal: el voto legislativo en Uruguay es a la LISTA.")
FUENTE = "Corte Electoral del Uruguay — Integración de hojas de votación (catalogodatos.gub.uy)."


def norm(s: str) -> str:
    s = unicodedata.normalize("NFD", s or "")
    return "".join(c for c in s if unicodedata.category(c) != "Mn").upper()


def hoja_opcion(cat_doc, hoja, partido=None):
    """hoja -> opcionId vía catalogo.json ya cargado; desambigua por partido si hay varios."""
    hoja_str = str(hoja)
    candidates = [
        o["id"]
        for c in cat_doc.get("contiendas", [])
        for o in c.get("opciones", [])
        if str(o.get("hoja")) == hoja_str
    ]
    if not candidates:
        return None
    if len(candidates) == 1:
        return candidates[0]
    if partido:
        slug = norm(partido).lower().replace(" ", "-")
        slug_np = slug[len("partido-"):] if slug.startswith("partido-") else slug
        for oid in candidates:
            ol = oid.lower()
            if slug in ol or slug_np in ol:
                return oid
    return candidates[0]


def main():
    if not os.path.exists(PERSONAS):
        raise SystemExit(f"ERROR: no existe {PERSONAS} (corré etl:personas)")
    os.makedirs(OUT, exist_ok=True)

    doc = json.load(open(PERSONAS, encoding="utf-8"))
    personas = doc["personas"]

    cat_cache = {}
    tot_cache = {}

    def get_cat(e, d):
        k = (e, d)
        if k not in cat_cache:
            p = os.path.join(ROOT, "public/data", e, d, "catalogo.json")
            cat_cache[k] = json.load(open(p, encoding="utf-8")) if os.path.exists(p) else {}
        return cat_cache[k]

    def get_totals(e, d):
        k = (e, d)
        if k not in tot_cache:
            p = os.path.join(ROOT, "public/data", e, d, "hoja-local.json")
            t = defaultdict(int)
            if os.path.exists(p):
                hl = json.load(open(p, encoding="utf-8"))
                for z in hl.get("zonas", []):
                    for o in z.get("porOpcion", []):
                        t[o["opcionId"]] += o.get("votos", 0)
            tot_cache[k] = dict(t)
        return tot_cache[k]

    legisladores = []      # con resultados completos
    index = []             # legisladores slim (búsqueda)
    personas_index = []    # todas, slim (sin resultados)

    for p in personas:
        pid = p["personaId"]
        nombres = p["nombres"]
        nombre = nombres[0] if nombres else pid
        cargos = sorted({a["cargo"].upper() for a in p["apariciones"] if a.get("cargo")})
        elecciones = sorted({a["eleccion"] for a in p["apariciones"]})

        personas_index.append({"id": pid, "nombre": nombre, "cargos": cargos, "elecciones": elecciones})

        if not (set(cargos) & CARGOS_LEGISLATIVOS):
            continue

        partidos = sorted({a["partido"] for a in p["apariciones"] if a.get("partido")})

        # Candidaturas compactas (deduped por eleccion+cargo+partido+sublema).
        cand_seen = set()
        candidaturas = []
        # Resultados: dedup de listas por (eleccion, depto, opcionId) → votos por depto.
        dedup_listas = set()
        por_eleccion = defaultdict(lambda: defaultdict(int))

        for a in p["apariciones"]:
            e, d, hoja = a["eleccion"], a["departamento"], str(a["hoja"])
            cargo, partido, sublema = a.get("cargo"), a.get("partido"), a.get("sublema")

            ck = (e, cargo, partido, sublema)
            if ck not in cand_seen:
                cand_seen.add(ck)
                candidaturas.append({"eleccion": e, "cargo": cargo, "partido": partido, "sublema": sublema})

            cat = get_cat(e, d)
            if not cat:
                continue
            oid = hoja_opcion(cat, hoja, partido)
            if not oid:
                continue
            lk = (e, d, oid)
            if lk in dedup_listas:
                continue
            dedup_listas.add(lk)
            por_eleccion[e][d] += get_totals(e, d).get(oid, 0)

        resultados = {
            e: {"porDepto": dict(dd), "total": sum(dd.values())}
            for e, dd in por_eleccion.items()
        }

        legisladores.append({
            "id": pid,
            "nombres": nombres,
            "cargos": cargos,
            "partidos": partidos,
            "elecciones": elecciones,
            "candidaturas": candidaturas,
            "resultados": resultados,
        })
        index.append({
            "id": pid, "nombre": nombre, "cargos": cargos,
            "partidos": partidos, "elecciones": elecciones,
        })

    index.sort(key=lambda c: norm(c["nombre"]))
    legisladores.sort(key=lambda c: norm(c["nombres"][0] if c["nombres"] else c["id"]))
    personas_index.sort(key=lambda c: norm(c["nombre"]))

    def dump(name, payload):
        path = os.path.join(OUT, name)
        with open(path, "w", encoding="utf-8") as f:
            json.dump(payload, f, ensure_ascii=False)
        return os.path.getsize(path) / 1024 / 1024

    base = {"fuente": FUENTE, "metrica": METRICA}
    mb_idx = dump("index.json", {**base, "total": len(index),
                  "detalle": "/api/v1/candidatos/legisladores.json", "candidatos": index})
    mb_leg = dump("legisladores.json", {**base, "total": len(legisladores), "candidatos": legisladores})
    mb_all = dump("personas-index.json", {**base, "total": len(personas_index),
                  "nota": "Resultados (por depto) solo para legisladores en legisladores.json.",
                  "personas": personas_index})

    print(f"legisladores: {len(legisladores)} · personas (índice): {len(personas_index)}")
    print(f"  index.json {mb_idx:.1f}MB · legisladores.json {mb_leg:.1f}MB · personas-index.json {mb_all:.1f}MB")
    print(f"  → {OUT}")


if __name__ == "__main__":
    main()
