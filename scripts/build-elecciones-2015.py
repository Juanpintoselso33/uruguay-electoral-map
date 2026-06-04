#!/usr/bin/env python3
"""Issue #39 — Elecciones Departamentales y Municipales 2015 (10/05/2015).

Datos: XLSX por circuito de la Corte (NO están en CKAN), esquema propio (sin TIPO_REGISTRO):
  data/raw/electoral/2015/deptal-2015.xlsx     → ACTO,CONVOCATORIA,DEPTO,CIRCUITO,SERIES,ESCRUTINIO,LEMA,HOJA,CNT_VOTOS
  data/raw/electoral/2015/municipal-2015.xlsx  → + columna MUNICIPIO ; HOJA sufijada
Escrutinio "Departamental" = definitivo (exportado 2015-05-19).

ALCANCE (pedido de Juan: "cargos electos nada más"):
  - departamentales-2015: mapa por LEMA ganador. NACIONAL (19 deptos) + INTERIOR por SERIE.
    + intendentes electos (investigados, 19). Montevideo NO tiene vista por-depto (su detalle
    departamental usa barrios/CRV→barrio, sin mapeo 2015) → queda en la vista nacional.
  - municipales-2015: mapa por LEMA ganador, NACIONAL + 19 deptos (serie→municipio de la
    columna MUNICIPIO). SIN nombres de alcaldes/concejos (no hay nómina abierta 2015).

Uso: python scripts/build-elecciones-2015.py
"""
import json, os, unicodedata
from collections import defaultdict
import openpyxl

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RAW = os.path.join(ROOT, "data/raw/electoral/2015")
DATA = os.path.join(ROOT, "public/data")
MAP_DIR = os.path.join(ROOT, "public/data/mappings")

NAME_SLUG = {"ARTIGAS": "artigas", "CANELONES": "canelones", "CERRO LARGO": "cerro_largo",
    "COLONIA": "colonia", "DURAZNO": "durazno", "FLORES": "flores", "FLORIDA": "florida",
    "LAVALLEJA": "lavalleja", "MALDONADO": "maldonado", "MONTEVIDEO": "montevideo",
    "PAYSANDU": "paysandu", "RIO NEGRO": "rio_negro", "RIVERA": "rivera", "ROCHA": "rocha",
    "SALTO": "salto", "SAN JOSE": "san_jose", "SORIANO": "soriano", "TACUAREMBO": "tacuarembo",
    "TREINTA Y TRES": "treinta_y_tres"}
INTERIOR = [s for s in set(NAME_SLUG.values()) if s != "montevideo"]

LEMA_SLUG = {
    "FRENTE AMPLIO": "frente-amplio", "PARTIDO NACIONAL": "nacional", "PARTIDO COLORADO": "colorado",
    "PARTIDO DE LA CONCERTACION": "concertacion", "PARTIDO INDEPENDIENTE": "independiente",
    "PARTIDO ECOLOGISTA RADICAL INTRANSIGENTE": "ecologista-radical-intransigente",
    "PARTIDO ASAMBLEA POPULAR": "asamblea-popular", "PARTIDO DE LOS TRABAJADORES": "trabajadores",
}
LEMA_NOMBRE = {
    "frente-amplio": "Frente Amplio", "nacional": "Partido Nacional", "colorado": "Partido Colorado",
    "concertacion": "Partido de la Concertación", "independiente": "Partido Independiente",
    "ecologista-radical-intransigente": "Partido Ecologista Radical Intransigente",
    "asamblea-popular": "Asamblea Popular", "trabajadores": "Partido de los Trabajadores",
}

# Intendentes electos 2015 (investigado + cruzado: Presidencia/gub.uy + Cuadro Ágora/Corte). 12 PN, 6 FA, 1 PC.
INTENDENTES = {
    "artigas": "Pablo Caram", "canelones": "Yamandú Orsi", "cerro_largo": "Luis Sergio Botana",
    "colonia": "Carlos Moreira", "durazno": "Carmelo Vidalín", "flores": "Fernando Echeverría",
    "florida": "Carlos Enciso", "lavalleja": "Adriana Peña", "maldonado": "Enrique Antía",
    "montevideo": "Daniel Martínez", "paysandu": "Guillermo Caraballo", "rio_negro": "Oscar Terzaghi",
    "rivera": "Marne Osorio", "rocha": "Aníbal Pereyra", "salto": "Andrés Lima",
    "san_jose": "José Luis Falero", "soriano": "Agustín Bascou", "tacuarembo": "Eber Da Rosa",
    "treinta_y_tres": "Dardo Sánchez",
}


def normU(s):
    return "".join(c for c in unicodedata.normalize("NFD", str(s or "")) if unicodedata.category(c) != "Mn").upper().strip()


def labels():
    return {d["id"]: d["label"] for d in json.load(open(os.path.join(ROOT, "src/config/departments.json"), encoding="utf-8"))}


def write(path, obj):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    json.dump(obj, open(path, "w", encoding="utf-8"), ensure_ascii=False)


def read_xlsx(path, with_muni):
    """Devuelve filas (depto_slug, municipio|None, serie, lema_slug, votos), saltando preámbulo."""
    wb = openpyxl.load_workbook(path, read_only=True)
    ws = wb[wb.sheetnames[0]]
    out = []
    started = False
    for r in ws.iter_rows(values_only=True):
        if not started:
            if r and r[0] == "ACTO":
                started = True
            continue
        if not r or r[0] is None:
            continue
        if with_muni:
            _, _, dep, muni, _, serie, _, lema, _, votos = r[:10]
        else:
            _, _, dep, _, serie, _, lema, _, votos = r[:9]
            muni = None
        slug = NAME_SLUG.get(normU(dep))
        ls = LEMA_SLUG.get(normU(lema))
        if not slug or not ls:
            continue
        try:
            v = int(votos or 0)
        except (ValueError, TypeError):
            continue
        out.append((slug, (muni or "").strip() or None, (serie or "").strip().lower(), ls, v))
    wb.close()
    return out


def zona(geoId, por_lema):
    porOpcion = [{"opcionId": l, "votos": v} for l, v in sorted(por_lema.items(), key=lambda kv: -kv[1])]
    return {"geoId": geoId, "ganadorOpcionId": porOpcion[0]["opcionId"] if porOpcion else None,
            "validos": sum(por_lema.values()), "porOpcion": porOpcion,
            "noPartidarios": {"enBlanco": 0, "anulados": 0, "observados": 0}}


def main():
    LBL = labels()

    # ---------- DEPARTAMENTALES 2015 ----------
    dep_rows = read_xlsx(os.path.join(RAW, "deptal-2015.xlsx"), with_muni=False)
    por_depto = defaultdict(lambda: defaultdict(int))         # slug -> lema -> votos
    por_serie = defaultdict(lambda: defaultdict(lambda: defaultdict(int)))  # slug -> serie -> lema -> votos
    for slug, _m, serie, lema, v in dep_rows:
        por_depto[slug][lema] += v
        if serie:
            por_serie[slug][serie][lema] += v

    opc_dep = {}
    nac_zonas = []
    intend = {}
    for slug, lemas in por_depto.items():
        for l in lemas: opc_dep[l] = LEMA_NOMBRE[l]
        nac_zonas.append(zona(LBL[slug], lemas))
        gan = max(lemas, key=lemas.get)
        intend[LBL[slug]] = {"ganadorLema": gan,
                             "intendenteElecto": {"candidato": INTENDENTES[slug], "votos": lemas[gan], "lema": gan},
                             "lemas": {}}  # sin desglose por candidato en 2015 (cargos electos nada más)
    write(os.path.join(DATA, "departamentales-2015", "_nacional", "votes.json"),
          {"eleccionId": "departamentales-2015", "departamento": "_nacional", "nivel": "departamento",
           "escrutinio": "definitivo", "tipo": "departamentales", "zonas": nac_zonas})
    write(os.path.join(DATA, "departamentales-2015", "_nacional", "opciones.json"),
          {"opciones": [{"opcionId": k, "nombre": v} for k, v in sorted(opc_dep.items())]})
    write(os.path.join(DATA, "departamentales-2015", "_nacional", "intendentes.json"),
          {"fuente": "Corte Electoral (XLSX por circuito, escrutinio definitivo); intendentes electos investigados y cruzados.",
           "eleccion": "departamentales-2015", "departamentos": intend})
    # Interior por SERIE (MVD usa barrios → se omite su vista por-depto; queda en la nacional).
    for slug in INTERIOR:
        if slug not in por_serie: continue
        zonas = [zona(s, lemas) for s, lemas in sorted(por_serie[slug].items())]
        op = {}
        for s, lemas in por_serie[slug].items():
            for l in lemas: op[l] = LEMA_NOMBRE[l]
        write(os.path.join(DATA, "departamentales-2015", slug, "votes.json"),
              {"eleccionId": "departamentales-2015", "departamento": slug, "nivel": "serie",
               "escrutinio": "definitivo", "tipo": "departamentales", "zonas": zonas})
        write(os.path.join(DATA, "departamentales-2015", slug, "opciones.json"),
              {"opciones": [{"opcionId": k, "nombre": v} for k, v in sorted(op.items())]})
    print(f"departamentales-2015: nacional {len(nac_zonas)} deptos + interior por serie ({len(INTERIOR)})")

    # ---------- MUNICIPALES 2015 ----------
    mun_rows = read_xlsx(os.path.join(RAW, "municipal-2015.xlsx"), with_muni=True)
    serie_muni = {}                                          # (slug, serie) -> municipio
    por_muni = defaultdict(lambda: defaultdict(int))         # (slug, muni) -> lema -> votos
    for slug, muni, serie, lema, v in mun_rows:
        if not muni: continue
        if serie: serie_muni[(slug, serie)] = muni
        por_muni[(slug, muni)][lema] += v

    # serie→municipio por depto (para la geometría: build-municipio-geo.ts departamentales-2015)
    for slug in set(s for s, _ in serie_muni):
        entries = sorted({s: m for (sl, s), m in serie_muni.items() if sl == slug}.items())
        write(os.path.join(MAP_DIR, slug, "serie-municipio.departamentales-2015.json"),
              [{"serie": s, "municipio": m} for s, m in entries])

    nac_mun, opc_mun = [], {}
    depto_zonas = defaultdict(list)
    for (slug, muni), lemas in sorted(por_muni.items()):
        for l in lemas: opc_mun[l] = LEMA_NOMBRE[l]
        z = zona(muni, lemas)
        depto_zonas[slug].append(z)
        nac_mun.append({**z, "geoId": f"{muni} · {LBL[slug]}"})
    for slug, zonas in depto_zonas.items():
        op = {l: LEMA_NOMBRE[l] for z in zonas for l in [o["opcionId"] for o in z["porOpcion"]]}
        write(os.path.join(DATA, "municipales-2015", slug, "votes.json"),
              {"eleccionId": "municipales-2015", "departamento": slug, "nivel": "municipio",
               "escrutinio": "definitivo", "tipo": "municipales", "zonas": zonas})
        write(os.path.join(DATA, "municipales-2015", slug, "opciones.json"),
              {"opciones": [{"opcionId": k, "nombre": v} for k, v in sorted(op.items())]})
    write(os.path.join(DATA, "municipales-2015", "_nacional", "votes.json"),
          {"eleccionId": "municipales-2015", "departamento": "_nacional", "nivel": "municipio",
           "escrutinio": "definitivo", "tipo": "municipales", "zonas": nac_mun})
    write(os.path.join(DATA, "municipales-2015", "_nacional", "opciones.json"),
          {"opciones": [{"opcionId": k, "nombre": v} for k, v in sorted(opc_mun.items())]})
    print(f"municipales-2015: nacional {len(nac_mun)} municipios + {len(depto_zonas)} deptos · {len(serie_muni)} series mapeadas")


if __name__ == "__main__":
    main()
