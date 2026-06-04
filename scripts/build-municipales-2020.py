#!/usr/bin/env python3
"""Epic 22.6 — ETL de la elección `municipales-2020` (nivel municipio).

A diferencia de 2025 (donde el voto municipal venía embebido en departamentales y MVD era caso
especial), el ciclo 2020 trae un CRUDO MUNICIPAL DEDICADO que cubre TODO el país a nivel CRV:
  - data/raw/electoral/departamentales-2020/desglose-de-votos-elecci-n-municipal.csv
    (TIPO_REGISTRO HOJA_EM / VOTO_LEMA_EM; DESCRIPCION_1 = hoja sufijada; DESCRIPCION_2 = municipio)
  - plan-circuital.csv  (Serie → Municipio, oficial; 0 series ambiguas)
  - integraci-n-de-las-hojas-de-votaci-n.csv  (nóminas; sistema PREFERENCIAL → orden = Ordinal,
    nombres en formato "APELLIDOS, Nombres", encoding cp1252)

Por eso el flujo 2020 es UNIFORME para los 19 deptos (no necesita el camino serie-keyed de 2025).
Produce, igual que municipales-2025:
  - public/data/municipales-2020/{depto,_nacional}/{votes,opciones,catalogo}.json
  - public/data/municipales-2020/_nacional/{alcaldes,concejos}.json
  - public/data/mappings/{depto}/serie-municipio.departamentales-2020.json  (para la geometría)

Reglas (Ley 19.272): idénticas a 2025 — D'Hondt lema→sublema→lista→ordinal; alcalde = 1er titular
de la lista más votada del lema más votado. Sin mayoría automática.

Uso: python scripts/build-municipales-2020.py
"""
import csv, json, os, unicodedata
from collections import defaultdict

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = "departamentales-2020"
DST = "municipales-2020"
RAW = os.path.join(ROOT, "data/raw/electoral", SRC)
PLAN = os.path.join(RAW, "plan-circuital.csv")
DESGLOSE = os.path.join(RAW, "desglose-de-votos-elecci-n-municipal.csv")
INTEGRACION = os.path.join(RAW, "integraci-n-de-las-hojas-de-votaci-n.csv")
DST_DIR = os.path.join(ROOT, "public/data", DST)
MAP_DIR = os.path.join(ROOT, "public/data/mappings")
SEATS = 5

# Código de depto (plan-circuital usa nombre completo; desglose/integración usan sigla de 2 letras).
NAME_SLUG = {"ARTIGAS": "artigas", "CANELONES": "canelones", "CERRO LARGO": "cerro_largo",
    "COLONIA": "colonia", "DURAZNO": "durazno", "FLORES": "flores", "FLORIDA": "florida",
    "LAVALLEJA": "lavalleja", "MALDONADO": "maldonado", "MONTEVIDEO": "montevideo",
    "PAYSANDU": "paysandu", "PAYSANDÚ": "paysandu", "RIO NEGRO": "rio_negro", "RÍO NEGRO": "rio_negro",
    "RIVERA": "rivera", "ROCHA": "rocha", "SALTO": "salto", "SAN JOSE": "san_jose",
    "SAN JOSÉ": "san_jose", "SORIANO": "soriano", "TACUAREMBO": "tacuarembo",
    "TACUAREMBÓ": "tacuarembo", "TREINTA Y TRES": "treinta_y_tres"}
CODE_SLUG = {"AR": "artigas", "CA": "canelones", "CL": "cerro_largo", "CO": "colonia", "DU": "durazno",
    "FD": "florida", "FS": "flores", "LA": "lavalleja", "MA": "maldonado", "MO": "montevideo",
    "PA": "paysandu", "RN": "rio_negro", "RO": "rocha", "RV": "rivera", "SA": "salto",
    "SJ": "san_jose", "SO": "soriano", "TA": "tacuarembo", "TT": "treinta_y_tres"}

# Nombre de lema (crudo) → slug canónico (coalición se mantiene por partido en 2020: no había CR).
LEMA_SLUG = {
    "FRENTE AMPLIO": "frente-amplio", "PARTIDO NACIONAL": "partido-nacional",
    "PARTIDO COLORADO": "partido-colorado", "PARTIDO INDEPENDIENTE": "partido-independiente",
    "PARTIDO CABILDO ABIERTO": "cabildo-abierto", "CABILDO ABIERTO": "cabildo-abierto",
    "PARTIDO ASAMBLEA POPULAR": "asamblea-popular", "ASAMBLEA POPULAR": "asamblea-popular",
    "PARTIDO DE LA GENTE": "partido-de-la-gente", "PARTIDO VERDE ANIMALISTA": "partido-verde-animalista",
    "PARTIDO ECOLOGISTA RADICAL INTRANSIGENTE": "partido-ecologista-radical-intransigente",
    "PARTIDO DIGITAL": "partido-digital", "PARTIDO POPULAR": "partido-popular",
}
LEMA_NOMBRE = {
    "frente-amplio": "Frente Amplio", "partido-nacional": "Partido Nacional",
    "partido-colorado": "Partido Colorado", "partido-independiente": "Partido Independiente",
    "cabildo-abierto": "Cabildo Abierto", "asamblea-popular": "Asamblea Popular",
    "partido-de-la-gente": "Partido de la Gente", "partido-verde-animalista": "Partido Verde Animalista",
    "partido-ecologista-radical-intransigente": "Partido Ecologista Radical Intransigente",
    "partido-digital": "Partido Digital", "partido-popular": "Partido Popular",
}
VACIO_SUB = {"", "NO APLICA", "NO APLICA.", "SIN SUBLEMA"}
SIN_MUNI = {"", "SIN MUNICIPIO", "NO APLICA"}


def read_csv(path):
    for enc in ("utf-8-sig", "cp1252", "latin-1"):
        try:
            with open(path, encoding=enc, errors="strict") as f:
                return list(csv.DictReader(f))
        except UnicodeDecodeError:
            continue
    with open(path, encoding="latin-1", errors="replace") as f:
        return list(csv.DictReader(f))


def normU(s):
    return "".join(c for c in unicodedata.normalize("NFD", s or "") if unicodedata.category(c) != "Mn").upper().strip()


def slug_lema(nombre):
    return LEMA_SLUG.get((nombre or "").strip().upper())


def reformat_name(s):
    """'APELLIDOS, Nombres' (Corte 2020) → 'NOMBRES APELLIDOS' (orden de 2025, en mayúsculas)."""
    s = (s or "").strip()
    if "," in s:
        apellidos, nombres = s.split(",", 1)
        s = f"{nombres.strip()} {apellidos.strip()}"
    return " ".join(s.upper().split())


def hoja_num(h):
    d = "".join(ch for ch in str(h).split("-")[0] if ch.isdigit())
    return int(d) if d else 10**9


def dhondt(votes, seats):
    q = []
    for k, v in votes.items():
        for s in range(1, seats + 1):
            q.append((v / s, v, k))
    q.sort(reverse=True)
    res = defaultdict(int)
    for i in range(min(seats, len(q))):
        res[q[i][2]] += 1
    return dict(res)


def labels():
    return {d["id"]: d["label"] for d in json.load(open(os.path.join(ROOT, "src/config/departments.json"), encoding="utf-8"))}


def write(path, obj):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(obj, f, ensure_ascii=False)


def main():
    DEPTO_LABEL = labels()

    # 1) serie → municipio (plan-circuital). Excluye "Sin Municipio".
    serie_muni = {}          # (slug, serie) -> municipio
    muni_por_depto = defaultdict(set)
    for r in read_csv(PLAN):
        slug = NAME_SLUG.get((r.get("Departamento") or "").strip().upper())
        if not slug:
            continue
        m = (r.get("Municipio") or "").strip()
        s = (r.get("Serie") or "").strip().upper()
        if not s or normU(m) in SIN_MUNI:
            continue
        serie_muni[(slug, s)] = m
        muni_por_depto[slug].add(m)
    for slug in sorted(muni_por_depto):
        entries = sorted({s: m for (sl, s), m in serie_muni.items() if sl == slug}.items())
        write(os.path.join(MAP_DIR, slug, f"serie-municipio.{SRC}.json"),
              [{"serie": s, "municipio": m} for s, m in entries])
    print(f"serie→municipio: {len(serie_muni)} series, {sum(len(v) for v in muni_por_depto.values())} municipios en {len(muni_por_depto)} deptos")

    # 2) integración municipal: nómina (slug,hoja)->[nombres por ordinal]; sublema (slug,hoja)->sublema|None
    nomina = defaultdict(list)
    sublema = {}
    for r in read_csv(INTEGRACION):
        if (r.get("Candidatura") or "").strip().lower() != "municipio":
            continue
        slug = CODE_SLUG.get((r.get("Departamento") or "").strip().upper())
        if not slug:
            continue
        hoja = str(r.get("Numero_de_hoja")).strip()
        try:
            ordn = float(r.get("Ordinal") or 0)
        except ValueError:
            ordn = 0.0
        nomina[(slug, hoja)].append((ordn, reformat_name(r.get("Nombre"))))
        sb = (r.get("Sublema") or "").strip()
        sublema[(slug, hoja)] = None if normU(sb) in VACIO_SUB else sb
    nomina = {k: [n for _, n in sorted(v)] for k, v in nomina.items()}
    print(f"integración: {len(nomina)} listas municipales con nómina")

    # 3) desglose municipal: votos por (slug, serie, opcionId); registro de opciones (hoja, lema, sublema)
    votos = defaultdict(lambda: defaultdict(int))   # (slug, muni) -> opcionId -> votos
    opc_meta = {}                                   # opcionId -> {hoja, lemaId, lemaNombre}
    sin_muni_votos = defaultdict(int)
    for r in read_csv(DESGLOSE):
        slug = CODE_SLUG.get((r.get("DEPARTAMENTO") or "").strip().upper())
        if not slug:
            continue
        tr = (r.get("TIPO_REGISTRO") or "").strip()
        if tr not in ("HOJA_EM", "VOTO_LEMA_EM"):
            continue
        lema = slug_lema(r.get("LEMA"))
        if not lema:
            continue
        serie = (r.get("SERIES") or "").strip().upper()
        muni = serie_muni.get((slug, serie))
        if not muni:
            sin_muni_votos[slug] += int(r.get("CANTIDAD_VOTOS") or 0)
            continue
        if tr == "HOJA_EM":
            hoja = (r.get("DESCRIPCION_1") or "").strip()
        else:
            hoja = "vl"
        oid = f"municipio-{lema}-{hoja}"
        try:
            v = int(r.get("CANTIDAD_VOTOS") or 0)
        except ValueError:
            continue
        votos[(slug, muni)][oid] += v
        if oid not in opc_meta:
            opc_meta[oid] = {"hoja": hoja, "lemaId": lema, "lemaNombre": LEMA_NOMBRE.get(lema, lema)}
    print(f"desglose: {sum(sum(d.values()) for d in votos.values()):,} votos en {len(votos)} municipios; "
          f"sin municipio: {sum(sin_muni_votos.values())} votos")

    # ---- builders: votes/opciones/catalogo + alcaldes + concejos ----
    opc_lema = {oid: m["lemaId"] for oid, m in opc_meta.items()}
    opc_hoja = {oid: m["hoja"] for oid, m in opc_meta.items()}

    def opc_sublema(slug, oid):
        return sublema.get((slug, opc_hoja[oid]))

    def concejo_de(slug, muni, por_hoja):
        lema_votes = defaultdict(int); list_votes = defaultdict(int); lists_of_lema = defaultdict(list)
        for oid, v in por_hoja.items():
            lema = opc_lema.get(oid)
            if not lema:
                continue
            lema_votes[lema] += v; list_votes[oid] += v; lists_of_lema[lema].append(oid)
        lema_seats = dhondt(lema_votes, SEATS)
        asign = []  # (lema_votes, list_votes, ord_in_list, nombre, lema, hoja)
        for lema, nseats in lema_seats.items():
            sub_lists = defaultdict(list); sub_votes = defaultdict(int)
            for oid in lists_of_lema[lema]:
                sub = opc_sublema(slug, oid); key = sub if sub else f"__{oid}"
                sub_lists[key].append(oid); sub_votes[key] += list_votes[oid]
            for key, sseats in dhondt(sub_votes, nseats).items():
                for oid, k in dhondt({o: list_votes[o] for o in sub_lists[key]}, sseats).items():
                    hoja = opc_hoja.get(oid)
                    cands = nomina.get((slug, str(hoja)), [])
                    for i in range(k):
                        nombre = cands[i] if i < len(cands) else f"(sin nómina #{i+1} hoja {hoja})"
                        asign.append((lema_votes[lema], list_votes[oid], i + 1, nombre, lema, hoja))
        asign.sort(key=lambda x: (-x[0], -x[1], hoja_num(x[5]), x[2]))
        return [{"cargo": "alcalde" if i == 0 else "concejal", "nombre": n, "lema": le, "hoja": h}
                for i, (_, _, _, n, le, h) in enumerate(asign)]

    nacional_zonas, nacional_opc = [], {}
    depto_zonas = defaultdict(list)
    alcaldes, concejos = {}, {}
    for (slug, muni), por_hoja in sorted(votos.items()):
        # voto por lema (votes.json a nivel lema)
        por_lema = defaultdict(int)
        for oid, v in por_hoja.items():
            le = opc_lema.get(oid)
            if le:
                por_lema[le] += v
        porOpcion = [{"opcionId": l, "votos": v} for l, v in sorted(por_lema.items(), key=lambda kv: -kv[1])]
        validos = sum(por_lema.values())
        ganador = porOpcion[0]["opcionId"] if porOpcion else None
        for l in por_lema:
            nacional_opc[l] = LEMA_NOMBRE.get(l, l)
        geo = f"{muni} · {DEPTO_LABEL.get(slug, slug)}"
        zona = {"geoId": muni, "ganadorOpcionId": ganador, "validos": validos, "porOpcion": porOpcion,
                "noPartidarios": {"enBlanco": 0, "anulados": 0, "observados": 0}}
        depto_zonas[slug].append(zona)
        nacional_zonas.append({**zona, "geoId": geo})
        # alcalde = 1er titular de la lista más votada del lema ganador
        hojas_gan = {oid: v for oid, v in por_hoja.items() if opc_lema.get(oid) == ganador and opc_hoja[oid] != "vl"}
        alc = None
        if hojas_gan:
            oid_gan = max(hojas_gan, key=lambda o: (hojas_gan[o], -hoja_num(opc_hoja[o])))
            cands = nomina.get((slug, str(opc_hoja[oid_gan])), [])
            alc = {"nombre": cands[0] if cands else None, "lema": ganador,
                   "hoja": opc_hoja[oid_gan], "votosLista": hojas_gan[oid_gan]}
        alcaldes[geo] = {"municipio": muni, "departamento": slug, "ganadorLema": ganador,
                         "alcaldeElecto": alc if alc and alc["nombre"] else None}
        concejos[geo] = {"municipio": muni, "departamento": slug, "concejo": concejo_de(slug, muni, por_hoja)}

    # per-depto: votes + opciones + catálogo
    opc_por_depto = defaultdict(set)
    for (slug, muni), por_hoja in votos.items():
        opc_por_depto[slug].update(por_hoja.keys())
    for slug, zonas in depto_zonas.items():
        write(os.path.join(DST_DIR, slug, "votes.json"),
              {"eleccionId": DST, "departamento": slug, "nivel": "municipio",
               "escrutinio": "definitivo", "tipo": "municipales", "zonas": zonas})
        lemas_depto = {}; opciones = []
        for oid in sorted(opc_por_depto[slug]):
            m = opc_meta[oid]; lemas_depto[m["lemaId"]] = m["lemaNombre"]
            opciones.append({"id": oid, "contienda": "municipio", "clase": "hoja", "hoja": m["hoja"],
                             "lemaId": m["lemaId"], "partidoId": m["lemaId"], "grupoId": m["lemaId"]})
        # niveles [lema, hoja] = subsecuencia de la escalera [lema, alcalde, hoja] (sin agrupador
        # de alcalde en 2020) → degradado:true para que el gate de escaleras lo acepte.
        contienda = {"contienda": "municipio", "niveles": ["lema", "hoja"], "degradado": True, "opciones": opciones,
                     "nodos": [{"id": l, "nivel": "lema", "etiqueta": n} for l, n in sorted(lemas_depto.items())]}
        write(os.path.join(DST_DIR, slug, "catalogo.json"),
              {"eleccionId": DST, "departamento": slug, "contiendas": [contienda]})
        write(os.path.join(DST_DIR, slug, "opciones.json"),
              {"opciones": [{"opcionId": l, "nombre": n} for l, n in sorted(lemas_depto.items())]})

    write(os.path.join(DST_DIR, "_nacional", "votes.json"),
          {"eleccionId": DST, "departamento": "_nacional", "nivel": "municipio",
           "escrutinio": "definitivo", "tipo": "municipales", "zonas": nacional_zonas})
    write(os.path.join(DST_DIR, "_nacional", "opciones.json"),
          {"opciones": [{"opcionId": k, "nombre": v} for k, v in sorted(nacional_opc.items())]})
    write(os.path.join(DST_DIR, "_nacional", "alcaldes.json"),
          {"fuente": "Corte Electoral — desglose municipal + integración de hojas 2020 (escrutinio definitivo).",
           "eleccion": DST, "regla": "Alcalde = primer titular de la lista más votada del lema más votado (Ley 19.272).",
           "municipios": alcaldes})
    write(os.path.join(DST_DIR, "_nacional", "concejos.json"),
          {"fuente": "Adjudicación D'Hondt sobre el desglose municipal 2020; nombres de la integración (sistema preferencial).",
           "regla": f"Concejo de 5: D'Hondt lema→sublema→lista→ordinal. mayoriaAutomatica=False.",
           "municipios": concejos})

    con = sum(1 for d in alcaldes.values() if d["alcaldeElecto"])
    print(f"\n{DST}: {len(nacional_zonas)} municipios (nacional) · {len(nacional_opc)} lemas · {con}/{len(alcaldes)} con alcalde resuelto")


if __name__ == "__main__":
    main()
