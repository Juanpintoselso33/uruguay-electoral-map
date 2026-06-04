#!/usr/bin/env python3
"""Story 22.4 — Alcalde electo por municipio (municipales-2025).

Regla legal (Ley 19.272, art. 9): el Alcalde es el **primer titular de la lista (hoja) más
votada dentro del lema más votado** del municipio (acumulación por lema, sin sublema). NO es
"el candidato más votado del lema" — es la cabeza de la lista ganadora.

Produce `public/data/municipales-2025/_nacional/alcaldes.json` para que la ficha (ZoneSheet)
muestre "Alcalde electo: NOMBRE", keyeado por el geoId NACIONAL compuesto ("MUNICIPIO · Depto",
igual que la geometría/votos nacionales), con municipio/departamento para el lookup per-depto.

Montevideo se omite (caso especial).

Uso: python scripts/build-alcaldes.py
"""
import csv, json, os, unicodedata
from collections import defaultdict

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = "departamentales-2025"
DST = "municipales-2025"
SRC_DIR = os.path.join(ROOT, "public/data", SRC)
DST_DIR = os.path.join(ROOT, "public/data", DST)
MAP_DIR = os.path.join(ROOT, "public/data/mappings")
INTEGRACION = os.path.join(ROOT, "data/raw/electoral/departamentales-2025/integracion-de-hojas-full.csv")

CODE_DEPT = {"AR": "artigas", "CA": "canelones", "CL": "cerro_largo", "CO": "colonia", "DU": "durazno",
    "FD": "florida", "FS": "flores", "LA": "lavalleja", "MA": "maldonado", "MO": "montevideo",
    "PA": "paysandu", "RN": "rio_negro", "RO": "rocha", "RV": "rivera", "SA": "salto",
    "SJ": "san_jose", "SO": "soriano", "TA": "tacuarembo", "TT": "treinta_y_tres"}
DEPTOS = sorted(CODE_DEPT.values())


def hoja_municipio_dir(slug):
    # MVD: voto municipal por SERIE (build-montevideo-municipio-shards.py), dir aparte para no
    # pisar los shards barrio-keyed de la vista departamental.
    return os.path.join(SRC_DIR, slug, "hoja", "municipio-serie" if slug == "montevideo" else "municipio")


def muni_label(slug, raw):
    # En MVD el municipio es una letra (A..G, CH) → "Municipio X" (igual que el mapeo serie→municipio).
    return f"Municipio {raw}" if slug == "montevideo" else raw

# Empates de "lista más votada" se resuelven por SORTEO de la Junta Electoral (no calculable):
# geoId compuesto -> hoja del alcalde proclamado. Fuente: acta de proclamación oficial.
ALCALDE_SORTEO = {
    # San Bautista (Canelones): 1025-V y 900-V empatadas en 857; sorteo Junta 21/05/2025 → Farina (1025-V).
    "SAN BAUTISTA · Canelones": "1025-V",
}


def norm_muni(s): return " ".join((s or "").strip().split())
def hoja_num(h):
    """Número de hoja como int (desempate determinístico): '900-V'→900, '1025-V'→1025."""
    d = "".join(ch for ch in str(h).split("-")[0] if ch.isdigit())
    return int(d) if d else 10**9


def read_csv(path):
    for enc in ("utf-8-sig", "utf-8", "latin-1"):
        try:
            return list(csv.DictReader(open(path, encoding=enc)))
        except UnicodeDecodeError:
            continue
    raise SystemExit(f"no se pudo leer {path}")


def labels():
    deps = json.load(open(os.path.join(ROOT, "src/config/departments.json"), encoding="utf-8"))
    return {d["id"]: d["label"] for d in deps}


def main():
    DEPTO_LABEL = labels()
    SLUG_BY_CODE = CODE_DEPT
    # (municipio_norm, depto_slug, hoja) -> nombre del primer titular (ordinal 1, T)
    cabeza = {}
    for r in read_csv(INTEGRACION):
        if (r.get("Candidatura") or "").upper() != "MUNICIPIO":
            continue
        if str(r.get("Ordinal")).strip() != "1" or (r.get("TitularSuplente") or "").strip().upper() != "T":
            continue
        slug = SLUG_BY_CODE.get((r.get("Departamento") or "").strip().upper())
        if not slug:
            continue
        muni = muni_label(slug, norm_muni(r.get("Municipio")))
        key = (muni.upper(), slug, str(r.get("Numero")).strip())
        cabeza[key] = norm_muni(r.get("Nombre"))

    departamentos = {}
    sin_cabeza = 0
    for slug in DEPTOS:
        mpath = os.path.join(MAP_DIR, slug, f"serie-municipio.{SRC}.json")
        cpath = os.path.join(SRC_DIR, slug, "catalogo.json")
        hdir = hoja_municipio_dir(slug)
        if not (os.path.exists(mpath) and os.path.exists(cpath) and os.path.isdir(hdir)):
            continue
        serie_muni = {e["serie"].upper(): e["municipio"] for e in json.load(open(mpath, encoding="utf-8"))}
        cat = json.load(open(cpath, encoding="utf-8"))
        mc = next(c for c in cat["contiendas"] if c["contienda"] == "municipio")
        opc_hoja = {o["id"]: str(o["hoja"]) for o in mc["opciones"] if o.get("hoja") is not None}
        opc_lema = {o["id"]: o["lemaId"] for o in mc["opciones"] if o.get("lemaId")}

        # por municipio: votos por hoja y por lema
        por_hoja = defaultdict(lambda: defaultdict(int))   # muni -> opcionId -> votos
        por_lema = defaultdict(lambda: defaultdict(int))   # muni -> lema -> votos
        for fn in sorted(os.listdir(hdir)):
            if not fn.endswith(".json"):
                continue
            for z in json.load(open(os.path.join(hdir, fn), encoding="utf-8")).get("zonas", []):
                muni = serie_muni.get(z["geoId"].upper())
                if not muni:
                    continue
                for o in z.get("porOpcion", []):
                    por_hoja[muni][o["opcionId"]] += o.get("votos", 0)
                    lema = opc_lema.get(o["opcionId"])
                    if lema:
                        por_lema[muni][lema] += o.get("votos", 0)

        for muni, lemas in por_lema.items():
            lema_gan = max(lemas, key=lemas.get)
            # lista más votada DENTRO del lema ganador
            hojas_lema = {oid: v for oid, v in por_hoja[muni].items() if opc_lema.get(oid) == lema_gan}
            if not hojas_lema:
                continue
            # lista más votada; empate de votos → menor número de hoja (desempate determinístico)
            oid_gan = max(hojas_lema, key=lambda oid: (hojas_lema[oid], -hoja_num(opc_hoja.get(oid))))
            geo = f"{muni} · {DEPTO_LABEL.get(slug, slug)}"
            if geo in ALCALDE_SORTEO:  # empate real resuelto por sorteo → tomar la hoja del acta
                oid_gan = next((oid for oid in hojas_lema if opc_hoja.get(oid) == ALCALDE_SORTEO[geo]), oid_gan)
            hoja_gan = opc_hoja.get(oid_gan)
            nombre = cabeza.get((norm_muni(muni).upper(), slug, hoja_gan))
            if not nombre:
                sin_cabeza += 1
            geo = f"{muni} · {DEPTO_LABEL.get(slug, slug)}"
            departamentos[geo] = {
                "municipio": muni, "departamento": slug,
                "ganadorLema": lema_gan,
                "alcaldeElecto": ({"nombre": nombre, "lema": lema_gan, "hoja": hoja_gan,
                                   "votosLista": hojas_lema[oid_gan]} if nombre else None),
            }

    os.makedirs(os.path.join(DST_DIR, "_nacional"), exist_ok=True)
    out = os.path.join(DST_DIR, "_nacional", "alcaldes.json")
    with open(out, "w", encoding="utf-8") as f:
        json.dump({"fuente": "Corte Electoral — Integración de hojas (Municipio), escrutinio definitivo.",
                   "eleccion": DST, "regla": "Alcalde = primer titular de la lista más votada del lema más votado (Ley 19.272).",
                   "municipios": departamentos}, f, ensure_ascii=False)

    con = sum(1 for d in departamentos.values() if d["alcaldeElecto"])
    print(f"{DST}: {len(departamentos)} municipios · {con} con alcalde resuelto · {sin_cabeza} sin cabeza de lista")
    for geo, d in list(departamentos.items())[:6]:
        e = d["alcaldeElecto"]
        print(f"  {geo}: {e['nombre'] if e else '(sin cabeza)'} ({d['ganadorLema']})")


if __name__ == "__main__":
    main()
