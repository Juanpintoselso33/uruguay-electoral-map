#!/usr/bin/env python3
"""Epic 22.x — Desglose por HOJA (lista) por MUNICIPIO para municipales-{2025,2020}.

`public/data/municipales-{ciclo}/{depto}/votes.json` está a nivel municipio pero agregado solo
por LEMA. Su `catalogo.json` ya declara las opciones de HOJA (`municipio-{lema}-{hoja}`), pero
faltaba el shard que las lleve por municipio. Este builder genera ese consolidado, análogo a
`hoja-localidad.json` / `hoja-barrio.json` de otras elecciones:

  public/data/municipales-{ciclo}/{depto}/hoja-municipio.json
  public/data/municipales-{ciclo}/_nacional/hoja-municipio.json

Formato = VotosShard:
  {"zonas": [{"geoId": <municipio>, "ganadorOpcionId": <hoja>, "validos": N,
              "porOpcion": [{"opcionId": <hoja-opcionId>, "votos": V}, ...],
              "noPartidarios": {...}}]}
donde:
  - geoId  == el MISMO geoId de municipio de votes.json (per-depto: nombre del municipio /
    "Municipio X" en MVD; nacional: "<municipio> · <Depto>").
  - opcionId == el MISMO id de HOJA del catalogo.json de municipales (`municipio-{lema}-{hoja}`,
    incluye el pseudo-folio `vl` = VOTO_LEMA_EM en 2020).

Cada ciclo re-deriva el voto por (municipio, hoja) desde la MISMA fuente que usan
build-municipales.py (2025, desde las contiendas `hoja/municipio` de departamentales-2025;
MVD desde `hoja/municipio-serie`) y build-municipales-2020.py (2020, desde el crudo municipal
por CRV). Por construcción Σ(hojas por lema) por municipio == votes.json (lema), delta=0.

GATE de reconciliación OBLIGATORIO: por municipio, agrupando las hojas de cada lema, el total
por lema debe coincidir EXACTO con votes.json.porOpcion (lema-level). Falla → SystemExit.

Uso: python scripts/build-hoja-municipio.py
"""
import csv, json, os
from collections import defaultdict

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA = os.path.join(ROOT, "public/data")
MAP_DIR = os.path.join(DATA, "mappings")

DEPTOS = ["artigas", "canelones", "cerro_largo", "colonia", "durazno", "flores", "florida",
          "lavalleja", "maldonado", "montevideo", "paysandu", "rio_negro", "rivera", "rocha",
          "salto", "san_jose", "soriano", "tacuarembo", "treinta_y_tres"]

CODE_SLUG = {"AR": "artigas", "CA": "canelones", "CL": "cerro_largo", "CO": "colonia", "DU": "durazno",
    "FD": "florida", "FS": "flores", "LA": "lavalleja", "MA": "maldonado", "MO": "montevideo",
    "PA": "paysandu", "RN": "rio_negro", "RO": "rocha", "RV": "rivera", "SA": "salto",
    "SJ": "san_jose", "SO": "soriano", "TA": "tacuarembo", "TT": "treinta_y_tres"}

# 2020 — nombre de lema (crudo) → slug canónico (igual que build-municipales-2020.py).
LEMA_SLUG = {
    "FRENTE AMPLIO": "frente-amplio", "PARTIDO NACIONAL": "partido-nacional",
    "PARTIDO COLORADO": "partido-colorado", "PARTIDO INDEPENDIENTE": "partido-independiente",
    "PARTIDO CABILDO ABIERTO": "cabildo-abierto", "CABILDO ABIERTO": "cabildo-abierto",
    "PARTIDO ASAMBLEA POPULAR": "asamblea-popular", "ASAMBLEA POPULAR": "asamblea-popular",
    "PARTIDO DE LA GENTE": "partido-de-la-gente", "PARTIDO VERDE ANIMALISTA": "partido-verde-animalista",
    "PARTIDO ECOLOGISTA RADICAL INTRANSIGENTE": "partido-ecologista-radical-intransigente",
    "PARTIDO DIGITAL": "partido-digital", "PARTIDO POPULAR": "partido-popular",
}
SIN_MUNI = {"", "SIN MUNICIPIO", "NO APLICA"}


def labels():
    return {d["id"]: d["label"] for d in json.load(open(os.path.join(ROOT, "src/config/departments.json"), encoding="utf-8"))}


def write(path, obj):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(obj, f, ensure_ascii=False)


def read_csv(path):
    for enc in ("utf-8-sig", "cp1252", "latin-1"):
        try:
            with open(path, encoding=enc, errors="strict") as f:
                return list(csv.DictReader(f))
        except UnicodeDecodeError:
            continue
    with open(path, encoding="latin-1", errors="replace") as f:
        return list(csv.DictReader(f))


# ---------------------------------------------------------------------------
# Recolección del voto por (municipio, hoja-opcionId) y del catálogo lema/hoja.
# Devuelve por depto: (por_muni: {muni: {opcionId: votos}}, opc_lema: {opcionId: lemaId}).
# ---------------------------------------------------------------------------

def collect_2025(slug, src_dir, map_dir):
    mpath = os.path.join(map_dir, slug, "serie-municipio.departamentales-2025.json")
    cpath = os.path.join(src_dir, slug, "catalogo.json")
    hdir = os.path.join(src_dir, slug, "hoja",
                        "municipio-serie" if slug == "montevideo" else "municipio")
    if not (os.path.exists(mpath) and os.path.exists(cpath) and os.path.isdir(hdir)):
        return None
    serie_muni = {e["serie"].upper(): e["municipio"] for e in json.load(open(mpath, encoding="utf-8"))}
    cat = json.load(open(cpath, encoding="utf-8"))
    mc = next((c for c in cat.get("contiendas", []) if c.get("contienda") == "municipio"), None)
    if mc is None:
        return None
    opc_lema = {o["id"]: o["lemaId"] for o in mc.get("opciones", []) if o.get("lemaId")}

    por_muni = defaultdict(lambda: defaultdict(int))
    for fn in sorted(os.listdir(hdir)):
        if not fn.endswith(".json"):
            continue
        for z in json.load(open(os.path.join(hdir, fn), encoding="utf-8")).get("zonas", []):
            muni = serie_muni.get(z["geoId"].upper())
            if not muni:
                continue
            for o in z.get("porOpcion", []):
                if o["opcionId"] not in opc_lema:  # solo opciones de hoja del catálogo municipio
                    continue
                por_muni[muni][o["opcionId"]] += o.get("votos", 0)
    return por_muni, opc_lema


# 2020 — el voto por (municipio, hoja) sale del crudo municipal por CRV (igual que el builder 2020).
_CACHE_2020 = None

def _parse_2020():
    """Devuelve {slug: (por_muni, opc_lema)} parseando el crudo municipal una sola vez."""
    global _CACHE_2020
    if _CACHE_2020 is not None:
        return _CACHE_2020
    RAW = os.path.join(ROOT, "data/raw/electoral/departamentales-2020")
    PLAN = os.path.join(RAW, "plan-circuital.csv")
    DESGLOSE = os.path.join(RAW, "desglose-de-votos-elecci-n-municipal.csv")
    NAME_SLUG = {"ARTIGAS": "artigas", "CANELONES": "canelones", "CERRO LARGO": "cerro_largo",
        "COLONIA": "colonia", "DURAZNO": "durazno", "FLORES": "flores", "FLORIDA": "florida",
        "LAVALLEJA": "lavalleja", "MALDONADO": "maldonado", "MONTEVIDEO": "montevideo",
        "PAYSANDU": "paysandu", "PAYSANDÚ": "paysandu", "RIO NEGRO": "rio_negro", "RÍO NEGRO": "rio_negro",
        "RIVERA": "rivera", "ROCHA": "rocha", "SALTO": "salto", "SAN JOSE": "san_jose",
        "SAN JOSÉ": "san_jose", "SORIANO": "soriano", "TACUAREMBO": "tacuarembo",
        "TACUAREMBÓ": "tacuarembo", "TREINTA Y TRES": "treinta_y_tres"}

    serie_muni = {}
    for r in read_csv(PLAN):
        slug = NAME_SLUG.get((r.get("Departamento") or "").strip().upper())
        if not slug:
            continue
        m = (r.get("Municipio") or "").strip()
        s = (r.get("Serie") or "").strip().upper()
        if not s or m.strip().upper() in SIN_MUNI:
            continue
        serie_muni[(slug, s)] = m

    por_muni = defaultdict(lambda: defaultdict(lambda: defaultdict(int)))  # slug -> muni -> oid -> votos
    opc_lema = defaultdict(dict)                        # slug -> {oid -> lemaId}
    for r in read_csv(DESGLOSE):
        slug = CODE_SLUG.get((r.get("DEPARTAMENTO") or "").strip().upper())
        if not slug:
            continue
        tr = (r.get("TIPO_REGISTRO") or "").strip()
        if tr not in ("HOJA_EM", "VOTO_LEMA_EM"):
            continue
        lema = LEMA_SLUG.get((r.get("LEMA") or "").strip().upper())
        if not lema:
            continue
        serie = (r.get("SERIES") or "").strip().upper()
        muni = serie_muni.get((slug, serie))
        if not muni:
            continue
        hoja = (r.get("DESCRIPCION_1") or "").strip() if tr == "HOJA_EM" else "vl"
        oid = f"municipio-{lema}-{hoja}"
        try:
            v = int(r.get("CANTIDAD_VOTOS") or 0)
        except ValueError:
            continue
        por_muni[slug][muni][oid] += v
        opc_lema[slug][oid] = lema

    _CACHE_2020 = {slug: (por_muni[slug], opc_lema[slug]) for slug in por_muni}
    return _CACHE_2020


def collect_2020(slug, *_):
    return _parse_2020().get(slug)


CYCLES = {
    "municipales-2025": {"src": os.path.join(DATA, "departamentales-2025"), "collect": collect_2025},
    "municipales-2020": {"src": None, "collect": collect_2020},
}


def shard_zona(geoId, por_hoja):
    porOpcion = [{"opcionId": oid, "votos": v} for oid, v in sorted(por_hoja.items(), key=lambda kv: -kv[1]) if v]
    validos = sum(o["votos"] for o in porOpcion)
    ganador = porOpcion[0]["opcionId"] if porOpcion else None
    return {"geoId": geoId, "ganadorOpcionId": ganador, "validos": validos,
            "porOpcion": porOpcion,
            "noPartidarios": {"enBlanco": 0, "anulados": 0, "observados": 0}}


def reconcile(dst_eleccion, slug, por_muni, opc_lema):
    """Σ(hojas por lema) por municipio == votes.json.porOpcion (lema). Devuelve nº de mismatches."""
    vpath = os.path.join(DATA, dst_eleccion, slug, "votes.json")
    if not os.path.exists(vpath):
        print(f"    ! {slug}: no existe votes.json para reconciliar")
        return 1
    votes = json.load(open(vpath, encoding="utf-8"))
    expected = {z["geoId"]: {o["opcionId"]: o["votos"] for o in z["porOpcion"]} for z in votes["zonas"]}
    fails = 0
    for muni, por_hoja in por_muni.items():
        got = defaultdict(int)
        for oid, v in por_hoja.items():
            got[opc_lema[oid]] += v
        exp = expected.get(muni)
        if exp is None:
            print(f"    ✗ {slug}/{muni}: municipio ausente en votes.json (geoId no matchea)")
            fails += 1
            continue
        keys = set(got) | set(exp)
        for k in keys:
            if got.get(k, 0) != exp.get(k, 0):
                print(f"    ✗ {slug}/{muni} lema {k}: hoja-municipio {got.get(k,0)} ≠ votes {exp.get(k,0)}")
                fails += 1
    # municipios presentes en votes pero no en hoja-municipio
    for muni in expected:
        if muni not in por_muni:
            print(f"    ✗ {slug}/{muni}: en votes.json pero sin hojas en hoja-municipio")
            fails += 1
    return fails


def main():
    DEPTO_LABEL = labels()
    total_fail = 0
    grand_files = []
    for eleccion, cfg in CYCLES.items():
        print(f"\n=== {eleccion} ===")
        nacional_zonas = []
        for slug in DEPTOS:
            res = cfg["collect"](slug, cfg["src"], MAP_DIR)
            if not res:
                continue
            por_muni, opc_lema = res
            if not por_muni:
                continue

            zonas = [shard_zona(muni, por_hoja) for muni, por_hoja in por_muni.items()]
            fails = reconcile(eleccion, slug, por_muni, opc_lema)
            total_fail += fails
            status = "✓" if fails == 0 else "✗"
            nhojas = sum(len(z["porOpcion"]) for z in zonas)
            print(f"  {status} {slug}: {len(zonas)} municipios, {nhojas} (municipio×hoja), recon fails={fails}")

            path = os.path.join(DATA, eleccion, slug, "hoja-municipio.json")
            write(path, {"eleccionId": eleccion, "departamento": slug, "nivel": "municipio",
                         "escrutinio": "definitivo", "tipo": "municipales", "clase": "hoja",
                         "zonas": zonas})
            grand_files.append(path)

            for muni, por_hoja in por_muni.items():
                geo = f"{muni} · {DEPTO_LABEL.get(slug, slug)}"
                nacional_zonas.append(shard_zona(geo, por_hoja))

        npath = os.path.join(DATA, eleccion, "_nacional", "hoja-municipio.json")
        write(npath, {"eleccionId": eleccion, "departamento": "_nacional", "nivel": "municipio",
                      "escrutinio": "definitivo", "tipo": "municipales", "clase": "hoja",
                      "zonas": nacional_zonas})
        grand_files.append(npath)
        print(f"  nacional: {len(nacional_zonas)} municipios → {npath}")

    # Reporte de tamaños (≤3MB por archivo).
    print("\n--- tamaños ---")
    big = []
    for p in grand_files:
        kb = os.path.getsize(p) / 1024
        if kb > 3 * 1024:
            big.append((p, kb))
        print(f"  {kb:8.1f} KB  {os.path.relpath(p, ROOT)}")
    if big:
        print("  ⚠ archivos > 3MB (shardear):")
        for p, kb in big:
            print(f"    {kb/1024:.2f} MB {p}")

    if total_fail:
        raise SystemExit(f"\nGATE FALLÓ: {total_fail} mismatches de reconciliación hoja-municipio vs votes.json.")
    print("\nGATE OK: Σ(hojas por lema) == votes.json (lema) en todos los municipios, delta=0.")


if __name__ == "__main__":
    main()
