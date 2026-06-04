#!/usr/bin/env python3
"""Story 22.7 — Concejos Municipales (alcalde + 4 concejales) por adjudicación de bancas.

Las actas de proclamación de la Corte son PDFs ESCANEADOS (sin texto) → parsearlas requiere
OCR ruidoso. En cambio los NOMBRES salen limpios de la integración de hojas (texto exacto).
Por eso calculamos la adjudicación (D'Hondt) sobre votos por lista/lema y tomamos los nombres
ordenados de la nómina. La regla se VALIDA leyendo algunas actas (visual) — ver 22.7.

Regla (Ley 19.272): Concejo = 5 miembros. Alcalde = 1er titular de la lista más votada del
lema más votado. Los 5 cargos se reparten por representación proporcional (D'Hondt) entre
LEMAS (acumulación por lema) → dentro del lema entre SUBLEMAS (acumulación) → entre LISTAS →
dentro de la lista por ordinal. Mayoría automática: NO existe (MAYORIA_AUTOMATICA=False),
confirmado empíricamente (San Bautista: CR 79% de los votos → 4/5 bancas, D'Hondt puro).

VALIDADO contra el acta de proclamación oficial de Canelones (32 municipios con texto):
  - 31/31 con composición por partido exacta;
  - 29/31 con los 5 nombres exactos;
  - 1 empate real (San Bautista, dos listas 857-857) resuelto por SORTEO de la Junta → override;
  - 2 (Pando, Parque del Plata) con el ÚLTIMO concejal distinto. El total POR LEMA coincide EXACTO
    con el acta (Pando CR 6645=6645; Parque CR 1979=1979): los votos no faltan, difiere su
    atribución a nivel SUBLEMA. Causa probable: la fuente no separa el "voto al sublema" (voto a
    un sublema sin lista) del "voto al lema" — ambos caen en el pseudo-folio 'vl' y no se imputan
    al sublema en el D'Hondt interno, subvaluando los sublemas grandes en un puñado de votos
    (Pando necesita +21 de su vl=72; Parque +2 de su vl=11). Solo cambia el ÚLTIMO asiento y solo
    cuando dos sublemas quedan en cuasi-empate (Pando 1668.5 vs 1679; Parque 570 vs 571). La
    composición por partido y el alcalde son robustos. (Limitación de granularidad de la fuente,
    no del método.) Validación adicional a mano: Young, San Javier, Sarandí del Yí, Villa del Carmen.

Uso: python scripts/build-concejos.py [--depto durazno]  (sin --depto: todos + escribe JSON)
"""
import csv, json, os, sys, unicodedata
from collections import defaultdict

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = "departamentales-2025"
SRC_DIR = os.path.join(ROOT, "public/data", SRC)
MAP_DIR = os.path.join(ROOT, "public/data/mappings")
INTEGRACION = os.path.join(ROOT, "data/raw/electoral/departamentales-2025/integracion-de-hojas-full.csv")
DST = os.path.join(ROOT, "public/data/municipales-2025/_nacional/concejos.json")

CODE_DEPT = {"AR": "artigas", "CA": "canelones", "CL": "cerro_largo", "CO": "colonia", "DU": "durazno",
    "FD": "florida", "FS": "flores", "LA": "lavalleja", "MA": "maldonado", "MO": "montevideo",
    "PA": "paysandu", "RN": "rio_negro", "RO": "rocha", "RV": "rivera", "SA": "salto",
    "SJ": "san_jose", "SO": "soriano", "TA": "tacuarembo", "TT": "treinta_y_tres"}
DEPTOS = sorted(CODE_DEPT.values())
SEATS = 5
MAYORIA_AUTOMATICA = False  # se ajusta tras validar contra actas

# Empates de "lista más votada" para el ALCALDE se resuelven por SORTEO de la Junta (no calculable):
# geoId compuesto -> hoja del alcalde proclamado en el acta oficial. El reparto de bancas (D'Hondt)
# NO cambia, solo cuál de los 5 miembros es el alcalde.
ALCALDE_SORTEO = {
    "SAN BAUTISTA · Canelones": "1025-V",  # 1025-V y 900-V empatadas en 857; sorteo 21/05/2025 → Farina.
}

# FUENTE DE VERDAD = la PROCLAMACIÓN. Donde el cálculo difiere del acta oficial (validado a mano),
# se fija el Concejo del acta verbatim. Casos detectados en la validación:
#  - Pando / Parque del Plata (Canelones): el último concejal cae en un cuasi-empate de sublema y
#    el voto-al-sublema (no separado en la fuente) lo vuelca distinto → se fija el reparto del acta.
#  - Municipio CH (Montevideo): el 2º cargo es una SUSTITUCIÓN de candidato post-registro (el acta
#    proclama a Llanes Santana donde la nómina registrada tiene a Nóvoa Campo).
PROCLAMACION_OVERRIDE = {
    "PANDO · Canelones": [
        {"cargo": "alcalde",  "nombre": "LEONARDO MAURICIO CHIESA CURBELO", "lema": "frente-amplio", "hoja": "609-C"},
        {"cargo": "concejal", "nombre": "LAURA ARACELI PIRIZ PELLEJERO",    "lema": "frente-amplio", "hoja": "609-C"},
        {"cargo": "concejal", "nombre": "WASHINGTON CESAR CAYAFFA FERNANDEZ", "lema": "frente-amplio", "hoja": "190-C"},
        {"cargo": "concejal", "nombre": "DIMAR FABIAN PEREZ FIGUEREDO",      "lema": "coalicion-republicana", "hoja": "3340-C"},
        {"cargo": "concejal", "nombre": "EMILIANO NICOLÁS QUINTERO PIOVENE", "lema": "coalicion-republicana", "hoja": "33340-C"},
    ],
    "PARQUE DEL PLATA · Canelones": [
        {"cargo": "alcalde",  "nombre": "TANIA SUSANA VECCHIO CABAN",     "lema": "frente-amplio", "hoja": "609-LL"},
        {"cargo": "concejal", "nombre": "VICKY KARINA KRAUSE DA ROSA",    "lema": "frente-amplio", "hoja": "609-LL"},
        {"cargo": "concejal", "nombre": "GABRIELLA MARINA GESTAL MARTIN", "lema": "frente-amplio", "hoja": "1764-LL"},
        {"cargo": "concejal", "nombre": "EDUARDO SERGIO SOSA VAZQUEZ",    "lema": "coalicion-republicana", "hoja": "400-LL"},
        {"cargo": "concejal", "nombre": "RICARDO PONCE AZARI",            "lema": "coalicion-republicana", "hoja": "400-LL"},
    ],
    "Municipio CH · Montevideo": [
        {"cargo": "alcalde",  "nombre": "MATILDE ANTIA ADAMI",            "lema": "coalicion-republicana", "hoja": "40-CH"},
        {"cargo": "concejal", "nombre": "JOSE FELIX LLANES SANTANA",      "lema": "coalicion-republicana", "hoja": "40-CH"},  # sustitución vs Nóvoa Campo
        {"cargo": "concejal", "nombre": "JORGE VICTOR BAYLEY MARCOS",     "lema": "coalicion-republicana", "hoja": "40-CH"},
        {"cargo": "concejal", "nombre": "JAVIER ENRIQUE BARRIOS BOVE",    "lema": "coalicion-republicana", "hoja": "11-CH"},
        {"cargo": "concejal", "nombre": "MONICA SILVANA CAFFA REYES",     "lema": "frente-amplio", "hoja": "79-CH"},
    ],
}


def norm(s): return " ".join((s or "").strip().split())
def hoja_num(h):
    """Número de hoja como int (para desempate determinístico): '900-V'→900, '1025-V'→1025."""
    d = "".join(ch for ch in str(h).split("-")[0] if ch.isdigit())
    return int(d) if d else 10**9
def normU(s): return "".join(c for c in unicodedata.normalize("NFD", s or "") if unicodedata.category(c) != "Mn").upper().strip()
def hoja_municipio_dir(slug):
    # MVD: voto municipal por SERIE (build-montevideo-municipio-shards.py), dir aparte para no
    # pisar los shards barrio-keyed de la vista departamental.
    return os.path.join(SRC_DIR, slug, "hoja", "municipio-serie" if slug == "montevideo" else "municipio")
def muni_label(slug, raw):
    # En MVD el municipio es una letra (A..G, CH) → "Municipio X" (igual que el mapeo serie→municipio).
    return f"Municipio {raw}" if slug == "montevideo" else raw


def read_csv(path):
    for enc in ("utf-8-sig", "utf-8", "latin-1"):
        try:
            return list(csv.DictReader(open(path, encoding=enc)))
        except UnicodeDecodeError:
            continue
    raise SystemExit(f"no se pudo leer {path}")


def labels():
    return {d["id"]: d["label"] for d in json.load(open(os.path.join(ROOT, "src/config/departments.json"), encoding="utf-8"))}


def dhondt(votes, seats):
    """votes: {clave: votos} → {clave: bancas} por D'Hondt."""
    q = []
    for k, v in votes.items():
        for s in range(1, seats + 1):
            q.append((v / s, v, k))  # desempate por votos totales del lema/lista
    q.sort(reverse=True)
    res = defaultdict(int)
    for i in range(min(seats, len(q))):
        res[q[i][2]] += 1
    return dict(res)


VACIO_SUB = {"", "SIN SUBLEMA", "NO APLICA", "NO APLICA."}


def sublema_por_hoja(rows):
    """(depto, hoja) -> sublema (None si SIN SUBLEMA), de la integración (contienda MUNICIPIO)."""
    out = {}
    for r in rows:
        if (r.get("Candidatura") or "").upper() != "MUNICIPIO":
            continue
        slug = CODE_DEPT.get((r.get("Departamento") or "").strip().upper())
        if not slug:
            continue
        s = (r.get("Sublema") or "").strip()
        out[(slug, str(r.get("Numero")).strip())] = None if normU(s) in VACIO_SUB else s
    return out


def nomina(rows):
    """(municipioU, depto, hoja) -> [nombres titulares por ordinal]."""
    tmp = defaultdict(list)
    for r in rows:
        if (r.get("Candidatura") or "").upper() != "MUNICIPIO":
            continue
        if (r.get("TitularSuplente") or "").strip().upper() != "T":
            continue
        slug = CODE_DEPT.get((r.get("Departamento") or "").strip().upper())
        if not slug:
            continue
        key = (normU(muni_label(slug, norm(r.get("Municipio")))), slug, str(r.get("Numero")).strip())
        try:
            ordn = int(str(r.get("Ordinal")).strip())
        except ValueError:
            continue
        tmp[key].append((ordn, norm(r.get("Nombre"))))
    return {k: [n for _, n in sorted(v)] for k, v in tmp.items()}


def concejo_de_municipio(municipio, slug, por_hoja, opc_hoja, opc_lema, opc_sublema, nom):
    """Devuelve los 5 cargos (alcalde + 4 concejales) ordenados.
    Adjudicación: D'Hondt entre LEMAS → dentro del lema D'Hondt entre SUBLEMAS (acumulación;
    las listas SIN SUBLEMA son cada una su propia 'sublema') → dentro del sublema D'Hondt entre
    LISTAS → dentro de la lista por orden de titulares."""
    lema_votes = defaultdict(int)
    list_votes = defaultdict(int)            # opcionId -> votos
    lists_of_lema = defaultdict(list)        # lema -> [opcionId]
    for oid, v in por_hoja.items():
        lema = opc_lema.get(oid)
        if not lema:
            continue
        lema_votes[lema] += v
        list_votes[oid] += v
        lists_of_lema[lema].append(oid)

    lema_seats = dhondt(lema_votes, SEATS)

    asignados = []  # (lema_votes, list_votes, ordinal, nombre, lema, hoja)
    for lema, nseats in lema_seats.items():
        # Agrupar listas del lema por sublema (None → la lista es su propia 'sublema': no acumula).
        sub_lists = defaultdict(list); sub_votes = defaultdict(int)
        for oid in lists_of_lema[lema]:
            sub = opc_sublema.get(oid)
            subkey = sub if sub else f"__{oid}"
            sub_lists[subkey].append(oid); sub_votes[subkey] += list_votes[oid]
        sub_seats = dhondt(sub_votes, nseats)
        for subkey, sseats in sub_seats.items():
            seats_por_lista = dhondt({oid: list_votes[oid] for oid in sub_lists[subkey]}, sseats)
            for oid, k in seats_por_lista.items():
                hoja = opc_hoja.get(oid)
                cands = nom.get((normU(municipio), slug, str(hoja)), [])
                for i in range(k):
                    nombre = cands[i] if i < len(cands) else f"(sin nómina #{i+1} hoja {hoja})"
                    asignados.append((lema_votes[lema], list_votes[oid], i + 1, nombre, lema, hoja))

    # Orden: lema más votado primero, dentro lista más votada, empate → menor nº de hoja, luego ordinal.
    asignados.sort(key=lambda x: (-x[0], -x[1], hoja_num(x[5]), x[2]))
    concejo = []
    for idx, (_, _, ordn, nombre, lema, hoja) in enumerate(asignados):
        concejo.append({"cargo": "alcalde" if idx == 0 else "concejal",
                        "nombre": nombre, "lema": lema, "hoja": hoja})
    return concejo


def main():
    only = None
    if "--depto" in sys.argv:
        only = sys.argv[sys.argv.index("--depto") + 1]
    DEPTO_LABEL = labels()
    rows = read_csv(INTEGRACION)
    nom = nomina(rows)
    subhoja = sublema_por_hoja(rows)   # (slug, hoja) -> sublema|None

    out = {}
    for slug in (DEPTOS if not only else [only]):
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
        opc_sublema = {oid: subhoja.get((slug, h)) for oid, h in opc_hoja.items()}

        por_muni = defaultdict(lambda: defaultdict(int))
        for fn in sorted(os.listdir(hdir)):
            if not fn.endswith(".json"):
                continue
            for z in json.load(open(os.path.join(hdir, fn), encoding="utf-8")).get("zonas", []):
                muni = serie_muni.get(z["geoId"].upper())
                if not muni:
                    continue
                for o in z.get("porOpcion", []):
                    por_muni[muni][o["opcionId"]] += o.get("votos", 0)

        for muni, por_hoja in por_muni.items():
            geo = f"{muni} · {DEPTO_LABEL.get(slug, slug)}"
            if geo in PROCLAMACION_OVERRIDE:  # fuente de verdad = acta: se fija el Concejo proclamado
                out[geo] = {"municipio": muni, "departamento": slug,
                            "concejo": [dict(c) for c in PROCLAMACION_OVERRIDE[geo]]}
                continue
            concejo = concejo_de_municipio(muni, slug, por_hoja, opc_hoja, opc_lema, opc_sublema, nom)
            if geo in ALCALDE_SORTEO:  # reasignar alcalde a la hoja sorteada (titular #1 de esa hoja)
                forced = ALCALDE_SORTEO[geo]
                idx_alc = next((i for i, c in enumerate(concejo) if c["hoja"] == forced), None)
                if idx_alc is not None:
                    for c in concejo:
                        c["cargo"] = "concejal"
                    concejo[idx_alc]["cargo"] = "alcalde"
                    concejo.insert(0, concejo.pop(idx_alc))  # alcalde primero
            out[geo] = {"municipio": muni, "departamento": slug, "concejo": concejo}
            if only:
                print(f"\n=== {geo} ===")
                for c in concejo:
                    print(f"  {c['cargo']:9} {c['nombre']:38} {c['lema']:18} hoja {c['hoja']}")

    if not only:
        os.makedirs(os.path.dirname(DST), exist_ok=True)
        with open(DST, "w", encoding="utf-8") as f:
            json.dump({"fuente": "Adjudicación D'Hondt sobre votos de la Corte (escrutinio definitivo); nombres de la Integración de hojas.",
                       "regla": f"Concejo de 5: D'Hondt lema→sublema→lista→ordinal. mayoriaAutomatica={MAYORIA_AUTOMATICA}.",
                       "validacion": "Validado vs acta oficial de proclamación: Canelones (31/31 composición por partido) y Montevideo (8/8 alcaldes). La PROCLAMACIÓN es la fuente de verdad: los 3 casos donde el cálculo difería del acta (Pando y Parque del Plata por voto-al-sublema en cuasi-empate; Municipio CH por sustitución de candidato post-registro) se fijan al Concejo proclamado vía PROCLAMACION_OVERRIDE. El resto se computa por D'Hondt (método validado).",
                       "municipios": out}, f, ensure_ascii=False)
        print(f"concejos: {len(out)} municipios → {DST}")


if __name__ == "__main__":
    main()
