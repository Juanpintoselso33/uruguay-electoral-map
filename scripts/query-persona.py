#!/usr/bin/env python3
"""Verificación standalone de la dimensión personas↔hoja (previo a la API).
Dado un nombre (substring, case/accent-insensitive) o credencial exacta,
imprime las hojas que integra la persona y los votos de esas listas por
departamento (ordenado desc). Métrica: votos de la LISTA, no votos personales.

NOTA TÉCNICA: los votos se leen de hoja-local.json (nivel circuito/local),
NO de votes.json (que solo tiene totales a nivel partido/lema sin desglose
por hoja). La deduplicación por (eleccion, depto, opcionId) evita el doble
conteo cuando la misma hoja aparece bajo múltiples cargos (senador + representante).

Uso:
  python scripts/query-persona.py "BERGARA"
  python scripts/query-persona.py "BNB-42702"
  python scripts/query-persona.py "ORSI"
"""
import json
import os
import sys
import unicodedata
from collections import defaultdict

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def norm(s: str) -> str:
    """Normaliza a mayúsculas sin acentos para búsqueda case/accent-insensitive."""
    s = unicodedata.normalize("NFD", s or "")
    return "".join(c for c in s if unicodedata.category(c) != "Mn").upper()


def find_persona(q: str):
    """Busca por credencial exacta o substring de nombre (accent-insensitive)."""
    path = os.path.join(ROOT, "public/data/personas/personas.json")
    if not os.path.exists(path):
        raise SystemExit(f"ERROR: no existe {path}")
    doc = json.load(open(path, encoding="utf-8"))
    qn = norm(q)
    for p in doc["personas"]:
        if p["personaId"] == q or any(qn in norm(n) for n in p["nombres"]):
            return p
    return None


def hoja_opcion(cat_doc, hoja: str, partido: str | None = None) -> str | None:
    """Resuelve hoja -> opcionId usando el documento de catalogo.json ya cargado.

    Si se pasa partido, intenta priorizar el match del partido en el opcionId
    (guarda contra el caso improbable de hoja compartida entre lemas en un depto).
    Retorna None si no hay match.
    """
    hoja_str = str(hoja)
    # Candidatos: todos los opciones con esa hoja
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
    # Si hay varios (improbable) intentar usar partido como desambiguador
    if partido:
        partido_slug = norm(partido).lower().replace(" ", "-")
        for oid in candidates:
            if partido_slug in oid.lower():
                return oid
    return candidates[0]


def build_oid_totals(eleccion: str, depto: str) -> dict[str, int]:
    """Carga hoja-local.json y construye un dict opcionId -> votos totales del depto.

    Suma todas las zonas (circuitos/locales) para obtener el total departamental.
    Cachea en memoria durante la ejecución (el dict se construye una sola vez por
    combinación eleccion+depto).
    """
    hl_path = os.path.join(ROOT, "public/data", eleccion, depto, "hoja-local.json")
    if not os.path.exists(hl_path):
        return {}
    doc = json.load(open(hl_path, encoding="utf-8"))
    totals: dict[str, int] = defaultdict(int)
    for z in doc.get("zonas", []):
        for o in z.get("porOpcion", []):
            totals[o["opcionId"]] += o.get("votos", 0)
    return dict(totals)


def main() -> None:
    if len(sys.argv) < 2:
        raise SystemExit('Uso: query-persona.py "<nombre|credencial>"')

    query = sys.argv[1]
    p = find_persona(query)
    if not p:
        raise SystemExit(f"Persona no encontrada para '{query}'")

    nombre_display = p["nombres"][0] if p["nombres"] else p["personaId"]
    print(f"Persona : {nombre_display}")
    print(f"ID      : {p['personaId']}")
    print(f"Total apariciones: {len(p['apariciones'])}")
    print()

    # Cargar catálogos y totales de hojas (cacheados por eleccion+depto)
    cat_cache: dict[str, dict] = {}
    oid_cache: dict[str, dict[str, int]] = {}

    def get_cat(eleccion: str, depto: str):
        key = f"{eleccion}/{depto}"
        if key not in cat_cache:
            path = os.path.join(ROOT, "public/data", eleccion, depto, "catalogo.json")
            cat_cache[key] = json.load(open(path, encoding="utf-8")) if os.path.exists(path) else {}
        return cat_cache[key]

    def get_totals(eleccion: str, depto: str) -> dict[str, int]:
        key = f"{eleccion}/{depto}"
        if key not in oid_cache:
            oid_cache[key] = build_oid_totals(eleccion, depto)
        return oid_cache[key]

    # Resolver apariciones a (eleccion, depto, opcionId) — deduplicado para no
    # contar la misma lista dos veces cuando la persona aparece como SENADOR y
    # también como REPRESENTANTE en la misma hoja del mismo depto.
    deduped: dict[tuple[str, str, str], dict] = {}  # (eleccion,depto,opcionId) -> info

    lineas_sin_desglose: list[str] = []

    for a in p["apariciones"]:
        eleccion = a["eleccion"]
        depto = a["departamento"]
        hoja = str(a["hoja"])
        cargo = a["cargo"]
        partido = a.get("partido", "")

        cat_doc = get_cat(eleccion, depto)
        if not cat_doc:
            lineas_sin_desglose.append(
                f"  {eleccion} · {depto} · hoja {hoja} ({cargo}): sin catalogo.json"
            )
            continue

        oid = hoja_opcion(cat_doc, hoja, partido)
        if not oid:
            lineas_sin_desglose.append(
                f"  {eleccion} · {depto} · hoja {hoja} ({cargo}): hoja no encontrada en catálogo"
            )
            continue

        key = (eleccion, depto, oid)
        if key not in deduped:
            deduped[key] = {
                "eleccion": eleccion,
                "depto": depto,
                "hoja": hoja,
                "cargo": cargo,
                "partido": partido,
                "opcionId": oid,
            }
        # Si ya existe la key, simplemente ignoramos (misma lista, otro cargo)

    # Sumar votos
    print("Detalle por elección / departamento / hoja:")
    print("-" * 70)
    por_depto: dict[str, int] = defaultdict(int)

    for key, info in sorted(deduped.items()):
        eleccion, depto, oid = key
        totals = get_totals(eleccion, depto)
        v = totals.get(oid, 0)
        sin_dato = "" if v > 0 else "  ← 0 votos (hoja sin datos en hoja-local)"
        print(
            f"  {info['eleccion']} · {info['cargo']} · hoja {info['hoja']}"
            f" · {info['depto']}: {v:,} votos de la lista{sin_dato}"
        )
        por_depto[depto] += v

    if lineas_sin_desglose:
        print()
        print("Apariciones sin desglose por hoja:")
        for l in lineas_sin_desglose:
            print(l)

    print()
    print("Ranking de departamentos (votos totales de las listas que integra):")
    print("-" * 70)
    grand_total = 0
    for depto, v in sorted(por_depto.items(), key=lambda kv: -kv[1]):
        print(f"  {depto:<20} {v:>10,}")
        grand_total += v
    print(f"  {'TOTAL PAÍS':<20} {grand_total:>10,}")

    print()
    print(
        "NOTA: es el voto a la LISTA (hoja), no voto personal "
        "— así funciona el voto legislativo en UY."
    )
    print(
        "Las listas están deduplicadas por (eleccion, depto, opcionId): "
        "la misma hoja bajo múltiples cargos se cuenta una sola vez."
    )


if __name__ == "__main__":
    main()
