#!/usr/bin/env python3
"""Story 22.1/22.3 (Montevideo) — habilita MVD en el pipeline municipal "igual que el resto del país".

MVD es el caso especial: su ETL departamental agrega los votos a BARRIO (los shards
`departamentales-2025/montevideo/hoja/municipio/*.json` están keyed por barrio y los consume
la contienda municipio de la vista departamental — NO se tocan). Pero los municipios de MVD se
arman como en el interior: disolviendo SERIES (Story 22.2) y agregando votos serie→municipio.

Este builder produce los dos insumos que faltan para que MVD fluya por los builders del interior
(build-municipales / build-alcaldes / build-concejos) sin special-casing de lógica:

1. `public/data/mappings/montevideo/serie-municipio.departamentales-2025.json`
   serie→municipio OFICIAL desde `plan-circuital.csv` (cada serie de MO está en un único municipio).

2. `public/data/departamentales-2025/montevideo/hoja/municipio-serie/{lema}.json`
   los votos municipales por SERIE (no barrio), reagregados del crudo `desglose-de-votos.csv`
   (registros HOJA_EM + VOTO_LEMA_EM), con los MISMOS opcionId del catálogo MVD municipio.
   (Dir aparte `municipio-serie/` para no pisar los shards barrio-keyed de la vista departamental.)

Uso: python scripts/build-montevideo-municipio-shards.py
"""
import csv, json, os, unicodedata
from collections import defaultdict

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = "departamentales-2025"
RAW = os.path.join(ROOT, "data/raw/electoral", SRC)
PLAN = os.path.join(RAW, "plan-circuital.csv")
DESGLOSE = os.path.join(RAW, "desglose-de-votos.csv")
CAT = os.path.join(ROOT, "public/data", SRC, "montevideo", "catalogo.json")
MAP_OUT = os.path.join(ROOT, "public/data/mappings/montevideo", f"serie-municipio.{SRC}.json")
SHARD_DIR = os.path.join(ROOT, "public/data", SRC, "montevideo", "hoja", "municipio-serie")

# Los lemas que compiten en la municipal de MVD (nombre crudo → slug del catálogo).
LEMA_SLUG = {
    "FRENTE AMPLIO": "frente-amplio",
    "PARTIDO ASAMBLEA POPULAR": "asamblea-popular",
    "ASAMBLEA POPULAR": "asamblea-popular",
    "PARTIDO COALICIÓN REPUBLICANA": "coalicion-republicana",
    "COALICIÓN REPUBLICANA": "coalicion-republicana",
}


def read_csv(path):
    for enc in ("utf-8-sig", "utf-8", "latin-1"):
        try:
            with open(path, encoding=enc, errors="strict") as f:
                return list(csv.DictReader(f))
        except UnicodeDecodeError:
            continue
    with open(path, encoding="latin-1", errors="replace") as f:
        return list(csv.DictReader(f))


def slug_lema(nombre):
    return LEMA_SLUG.get((nombre or "").strip().upper())


def main():
    # 1) serie → municipio (plan-circuital, MO). Cada serie en un único municipio (validado).
    serie_muni = {}
    conflict = 0
    for r in read_csv(PLAN):
        if (r.get("Departamento") or "").strip() != "MO":
            continue
        s = (r.get("Serie") or "").strip().upper()
        m = (r.get("Municipio") or "").strip()
        if not s or not m:
            continue
        if s in serie_muni and serie_muni[s] != m:
            conflict += 1
            print(f"  ✗ serie {s} en >1 municipio: {serie_muni[s]} y {m}")
        serie_muni[s] = m
    print(f"serie→municipio (plan-circuital): {len(serie_muni)} series, {conflict} conflictos")

    # 2) catálogo MVD municipio: (lemaId, hoja) → opcionId ; set de opcionId válidos.
    cat = json.load(open(CAT, encoding="utf-8"))
    mc = next(c for c in cat["contiendas"] if c["contienda"] == "municipio")
    opc_por_lema_hoja = {}
    opc_validos = set()
    for o in mc["opciones"]:
        opc_validos.add(o["id"])
        if o.get("lemaId") is not None and o.get("hoja") is not None:
            opc_por_lema_hoja[(o["lemaId"], str(o["hoja"]))] = o["id"]
    print(f"catálogo municipio: {len(opc_validos)} opciones")

    # 3) votos municipales por (serie, opcionId) desde el crudo (HOJA_EM + VOTO_LEMA_EM).
    por_serie_lema = defaultdict(lambda: defaultdict(lambda: defaultdict(int)))  # lemaId -> serie -> opcionId -> votos
    sin_opcion = defaultdict(int)
    muni_mismatch = 0
    total_votos = 0
    for r in read_csv(DESGLOSE):
        if (r.get("DEPARTAMENTO") or "").strip() != "MO":
            continue
        tr = (r.get("TIPO_REGISTRO") or "").strip()
        if tr not in ("HOJA_EM", "VOTO_LEMA_EM"):
            continue
        lema = slug_lema(r.get("LEMA"))
        if not lema:
            sin_opcion[("lema?", (r.get("LEMA") or "").strip())] += 1
            continue
        serie = (r.get("SERIES") or "").strip().upper()
        muni_row = (r.get("DESCRIPCION_2") or "").strip()
        # Sanidad: el municipio de la lista debe coincidir con el municipio de la serie.
        if serie in serie_muni and muni_row and serie_muni[serie] != muni_row:
            muni_mismatch += 1
        if tr == "HOJA_EM":
            hoja = (r.get("DESCRIPCION_1") or "").strip()          # ya sufijada, p.ej. "53-B"
            opcion = opc_por_lema_hoja.get((lema, hoja))
        else:  # VOTO_LEMA_EM → opción "vl" del lema
            opcion = opc_por_lema_hoja.get((lema, "vl"))
        if not opcion or opcion not in opc_validos:
            sin_opcion[(lema, r.get("DESCRIPCION_1"))] += int(r.get("CANTIDAD_VOTOS") or 0)
            continue
        try:
            v = int(r.get("CANTIDAD_VOTOS") or 0)
        except ValueError:
            continue
        por_serie_lema[lema][serie][opcion] += v
        total_votos += v

    print(f"votos municipales mapeados: {total_votos:,} · muni-mismatch(serie vs lista): {muni_mismatch}")
    if sin_opcion:
        drop = sum(v for v in sin_opcion.values())
        print(f"  ⚠ sin opcionId (descartados {drop} votos / {len(sin_opcion)} claves): {list(sin_opcion.items())[:8]}")

    # Resolver series FUSIONADAS del desglose ("ALA ALB") que no están en plan-circuital:
    # si todas las partes caen en el mismo municipio, se asigna ese municipio a la serie fusionada.
    todas_series = {s for por in por_serie_lema.values() for s in por}
    resueltas = sin_muni = 0
    sin_muni_votos = 0
    serie_votos = defaultdict(int)
    for lema, por in por_serie_lema.items():
        for s, opc in por.items():
            serie_votos[s] += sum(opc.values())
    for s in sorted(todas_series):
        if s in serie_muni:
            continue
        partes = [p for p in s.split() if p]
        munis = {serie_muni.get(p) for p in partes}
        munis.discard(None)
        if len(munis) == 1 and len(partes) > 1:
            serie_muni[s] = next(iter(munis)); resueltas += 1
        else:
            sin_muni += 1; sin_muni_votos += serie_votos[s]
    print(f"series fusionadas resueltas: {resueltas} · sin municipio (especiales A1-A8): {sin_muni} "
          f"({sin_muni_votos} votos, {100*sin_muni_votos/total_votos:.2f}%)")

    # Mapeo serie→municipio (incluye fusionadas resueltas) para los builders del interior.
    # El municipio de MVD se identifica por letra (A..G, CH); se muestra como "Municipio X".
    os.makedirs(os.path.dirname(MAP_OUT), exist_ok=True)
    with open(MAP_OUT, "w", encoding="utf-8") as f:
        json.dump([{"serie": s, "municipio": f"Municipio {m}"} for s, m in sorted(serie_muni.items())],
                  f, ensure_ascii=False, indent=0)
    print(f"  → {MAP_OUT} ({len(serie_muni)} series)")

    # 4) escribir shards serie-keyed por lema (mismo esquema que el interior).
    os.makedirs(SHARD_DIR, exist_ok=True)
    for fn in os.listdir(SHARD_DIR):
        if fn.endswith(".json"):
            os.remove(os.path.join(SHARD_DIR, fn))
    for lema, por_serie in por_serie_lema.items():
        zonas = []
        for serie, opciones in sorted(por_serie.items()):
            zonas.append({"geoId": serie,
                          "porOpcion": [{"opcionId": oid, "votos": v} for oid, v in sorted(opciones.items())]})
        out = {"eleccionId": SRC, "departamento": "montevideo", "nivel": "serie",
               "escrutinio": "definitivo", "tipo": "municipio", "zonas": zonas}
        with open(os.path.join(SHARD_DIR, f"{lema}.json"), "w", encoding="utf-8") as f:
            json.dump(out, f, ensure_ascii=False)
        print(f"  ✓ {lema}: {len(zonas)} series → {SHARD_DIR}/{lema}.json")


if __name__ == "__main__":
    main()
