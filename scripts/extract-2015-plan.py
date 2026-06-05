#!/usr/bin/env python3
"""
Extrae el PLAN CIRCUITAL de las departamentales/municipales 2015 (PDFs de Wayback) →
data/raw/electoral/2015/plan-circuital.csv canónico.

Solo 6 LETRAS de serie archivadas (AB, C, D, G, I, Q). Cada letra = un departamento
(salvo AB = Montevideo, series A+B). Mapa letra→depto (derivado del crudo deptal-2015.xlsx):
  A,B=Montevideo · C=Canelones · D=Maldonado · G=Cerro Largo · I=Artigas · Q=Florida
Los 13 deptos restantes (E,F,H,J,K,L,M,N,O,P,R,S,T) NO se archivaron → quedan a nivel serie.

Formato de salida (= el que consumen build-*-local/circuito.py vía read_plan y
build-circuito-barrio-cycles.py):
    Departamento,NroCircuito,Serie,Desde,Hasta,Localidad,Direccion

Direccion = "VENUE - STREET" (igual que nacionales-2014). street_key()/venue_name()
parten por el primer/último '-'; el matcher de local usa los tokens del VENUE contra
data/processed/locales/{dept}.json (catálogo 2024, match por solapamiento de rango +
fuzzy de nombre).

Técnica: pdfplumber extract_words() + corte por coordenada-x (layout fijo de PDF de
gobierno), NO split naive por espacios. Cada PDF tiene SU layout (LAYOUT[pdf]).
Anclas: Circuito (entero en x0<col) + Serie (3 letras) + Desde/Hasta (dos enteros).
Filas continuación (sin ancla) → se adjuntan al VENUE/STREET de la fila previa.

Uso: python scripts/extract-2015-plan.py
"""
import csv, os, re, sys
from collections import defaultdict
import pdfplumber

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PDF_DIR = os.path.join(ROOT, "data/raw/electoral/2015/planes-pdf")
OUT = os.path.join(ROOT, "data/raw/electoral/2015/plan-circuital.csv")

SERIE_RE = re.compile(r"^[A-Z]{3}$")

# Letra inicial de serie → DEPARTAMENTO (UPPER, como lo espera read_plan/NAME_DIR).
LETTER_DEPT = {
    "A": "MONTEVIDEO", "B": "MONTEVIDEO", "C": "CANELONES", "D": "MALDONADO",
    "G": "CERRO LARGO", "I": "ARTIGAS", "Q": "FLORIDA",
}

# Layout por PDF. Columnas (x0). Campos:
#   circ_x_max : x0 máximo del nº de circuito (col Circuito).
#   serie_x    : (min,max) x0 de la columna SERIE (3 letras).
#   loc_x      : (min,max) x0 de la columna LOCALIDAD (None si MVD, localidad constante).
#   venue_x    : (min,max) x0 de la columna venue/nombre-del-local.
#   street_x   : (min, +inf) x0 de la columna DIRECCIÓN/calle (None si no hay col separada).
#   loc_const  : localidad fija (solo MVD).
# Para cada PDF se mira el probe de columnas (ver header). Se deja margen ±8px.
LAYOUT = {
    # AB: Circuito@16-48 | MUNICIPIO@60-81 | Serie@113 | DESDE@141-169 | HASTA@179-183 |
    #     Nombre(venue)@212 | DIRECCION@562
    "AB": {"circ_x_max": 75, "serie_x": (108, 125), "loc_x": None,
           "venue_x": (200, 558), "street_x": 558, "loc_const": "MONTEVIDEO"},
    # C: CIRC@78 | SERIE@100 | DESDE | HASTA | RURAL@270 | LOCALIDAD@294 | LOCAL@420 (venue+dir juntos)
    "C": {"circ_x_max": 95, "serie_x": (96, 112), "loc_x": (288, 415),
          "venue_x": (416, 1e9), "street_x": None, "loc_const": None, "skip_rural_x": (260, 288)},
    # D: CIRC@76 | SERIE@92 | DESDE | HASTA | R/U@209 | LOCALIDAD@252 | LOCAL@370 | DIRECCIÓN@540
    "D": {"circ_x_max": 90, "serie_x": (88, 104), "loc_x": (248, 365),
          "venue_x": (366, 535), "street_x": 535, "loc_const": None, "skip_rural_x": (205, 248)},
    # G: CIRCUITO@224 | RURAL@257 | SERIE@290 | DEL N°@346 | AL N°@360 | LUGAR(street)@388 |
    #    SEC.JUD@587-630 | LOCAL(venue)@631
    "G": {"circ_x_max": 240, "serie_x": (285, 305), "loc_x": None,
          "venue_x": (620, 1e9), "street_x": None, "loc_const": "CERRO LARGO",
          "g_street_x": (388, 585), "g_venue_x": (620, 1e9), "g_skip_x": (585, 620)},
    # I: CIRC.@72 | RURAL@113 | SERIE@134 | DESDE | HASTA | LOCALIDAD@265 | LOCAL@384 (venue+dir)
    "I": {"circ_x_max": 100, "serie_x": (130, 150), "loc_x": (260, 380),
          "venue_x": (381, 1e9), "street_x": None, "loc_const": None, "skip_rural_x": (108, 130)},
    # Q: CIRC.@72 | RURAL@115 | SERIE@158 | DESDE | HASTA | LOCALIDAD@280 | LOCAL@398 (venue+dir)
    "Q": {"circ_x_max": 100, "serie_x": (154, 174), "loc_x": (276, 394),
          "venue_x": (395, 1e9), "street_x": None, "loc_const": None, "skip_rural_x": (110, 154)},
}


def parse_rows(words):
    """Agrupa words en filas por su 'top' (y), tolerando jitter de ±2px."""
    rows = defaultdict(list)
    for w in words:
        rows[round(w["top"])].append(w)
    merged = {}
    for y in sorted(rows):
        placed = False
        for my in list(merged):
            if abs(my - y) <= 2:
                merged[my].extend(rows[y]); placed = True; break
        if not placed:
            merged[y] = list(rows[y])
    out = []
    for y in sorted(merged):
        out.append(sorted(merged[y], key=lambda w: w["x0"]))
    return out


def _is_header_or_title(toks):
    j = " ".join(toks).upper()
    if not toks:
        return True
    HEAD = ("PLAN CIRCUITAL", "CIRCUITO", "CIRC", "SERIE", "DESDE", "HASTA",
            "LOCALIDAD", "LOCAL", "MUNICIPIO", "DIRECCION", "DIRECCIÓN", "RURAL",
            "CORTE ELECTORAL", "DEPARTAMENTO")
    if any(j.startswith(h) for h in HEAD):
        return True
    if toks[0].upper() in ("PLAN", "CIRCUITO", "CIRC", "CIRC.", "SERIE"):
        return True
    return False


def _split_g(rest, lay):
    """G: street en [388,587), skip [585,631), venue en [631, inf)."""
    venue, street = [], []
    s0, s1 = lay["g_street_x"]; sk0, sk1 = lay["g_skip_x"]; v0, _ = lay["g_venue_x"]
    for w in rest:
        x = w["x0"]
        if s0 <= x < s1:
            street.append(w["text"])
        elif sk0 <= x < sk1:
            continue  # SEC.JUD
        elif x >= v0:
            venue.append(w["text"])
    return "", " ".join(venue).strip(), " ".join(street).strip()


def _split_text(rest, lay):
    """Devuelve (localidad, venue, street) según el layout del PDF."""
    if "g_venue_x" in lay:
        return _split_g(rest, lay)
    loc_x = lay["loc_x"]; street_x = lay["street_x"]; venue_lo, venue_hi = lay["venue_x"]
    skip = lay.get("skip_rural_x")
    loc_t, venue_t, street_t = [], [], []
    for w in rest:
        x = w["x0"]; t = w["text"]
        if skip and skip[0] <= x < skip[1]:
            continue  # columna RURAL/R-U (N/S/Urbano/Rural) — descartar
        if street_x is not None and x >= street_x:
            street_t.append(t)
        elif loc_x is not None and loc_x[0] <= x < loc_x[1]:
            loc_t.append(t)
        elif venue_lo <= x <= venue_hi:
            venue_t.append(t)
        else:
            # fuera de rango conocido: si está antes del venue y hay loc_x, es localidad; si no, venue
            if loc_x is not None and x < loc_x[1] and not venue_t:
                loc_t.append(t)
            else:
                venue_t.append(t)
    loc = lay["loc_const"] or " ".join(loc_t).strip()
    return loc, " ".join(venue_t).strip(), " ".join(street_t).strip()


def extract_pdf(pdf_name, lay):
    pdf_path = os.path.join(PDF_DIR, f"PLAN_CIRCUITAL_{pdf_name}.pdf")
    records = []
    skipped = 0
    with pdfplumber.open(pdf_path) as pdf:
        for pg in pdf.pages:
            for line in parse_rows(pg.extract_words()):
                toks = [w["text"] for w in line]
                if _is_header_or_title(toks):
                    continue
                first = line[0]
                # fila de datos: circuito (entero) en x0 < circ_x_max
                if first["text"].isdigit() and first["x0"] < lay["circ_x_max"]:
                    circ = first["text"]
                    # serie: token de 3 letras en la columna SERIE
                    serie = None; serie_idx = None
                    s0, s1 = lay["serie_x"]
                    for i, w in enumerate(line[1:], start=1):
                        if SERIE_RE.match(w["text"]) and s0 - 6 <= w["x0"] <= s1 + 6:
                            serie = w["text"]; serie_idx = i; break
                    if serie is None:
                        # ditto (")  en la col serie → reusar serie previa
                        for i, w in enumerate(line[1:], start=1):
                            if w["text"] in ('"', "''", "“", "”") and s0 - 10 <= w["x0"] <= s1 + 10:
                                serie = records[-1]["serie"] if records else None; serie_idx = i; break
                    if serie is None:
                        skipped += 1; continue
                    nums = [w for w in line[serie_idx + 1:] if re.fullmatch(r"\d+", w["text"])]
                    if len(nums) < 2:
                        skipped += 1; continue
                    desde, hasta = nums[0]["text"], nums[1]["text"]
                    hasta_x1 = nums[1]["x1"]
                    rest = sorted([w for w in line if w["x0"] > hasta_x1 - 1
                                   and w is not nums[0] and w is not nums[1]],
                                  key=lambda w: w["x0"])
                    loc, venue, street = _split_text(rest, lay)
                    records.append({"circuito": circ, "serie": serie, "desde": desde,
                                    "hasta": hasta, "localidad": loc, "venue": venue, "street": street})
                else:
                    # fila continuación → adjuntar texto al VENUE/STREET de la última fila
                    if not records:
                        skipped += 1; continue
                    cont_loc, cont_venue, cont_street = _split_text(
                        sorted(line, key=lambda w: w["x0"]), lay)
                    if cont_venue:
                        records[-1]["venue"] = (records[-1]["venue"] + " " + cont_venue).strip()
                    if cont_street:
                        records[-1]["street"] = (records[-1]["street"] + " " + cont_street).strip()
                    if cont_loc and not lay.get("loc_const") and not records[-1]["localidad"]:
                        records[-1]["localidad"] = cont_loc
    return records, skipped


def validate_contiguity(records):
    by_serie = defaultdict(list)
    for r in records:
        by_serie[r["serie"]].append(r)
    viol = []
    for serie, rs in by_serie.items():
        rs_sorted = sorted(rs, key=lambda r: int(r["desde"]))
        prev_hasta = None
        for r in rs_sorted:
            d, h = int(r["desde"]), int(r["hasta"])
            if h < d:
                viol.append(f"{serie} CRV{r['circuito']}: hasta {h} < desde {d}")
            if prev_hasta is not None and d <= prev_hasta:
                viol.append(f"{serie} CRV{r['circuito']}: desde {d} <= prev_hasta {prev_hasta}")
            prev_hasta = max(prev_hasta or 0, h)
    return viol


def main():
    all_rows = []
    dept_letters = defaultdict(set)
    for pdf_name, lay in LAYOUT.items():
        recs, skipped = extract_pdf(pdf_name, lay)
        viol = validate_contiguity(recs)
        series = sorted({r["serie"] for r in recs})
        letters = sorted({s[0] for s in series})
        depts = sorted({LETTER_DEPT.get(s[0], "??") for s in series})
        for s in series:
            dept_letters[LETTER_DEPT.get(s[0], "??")].add(s[0])
        for r in recs:
            dep = LETTER_DEPT.get(r["serie"][0])
            if not dep:
                continue
            venue = r["venue"].strip(); street = r["street"].strip()
            direccion = f"{venue} - {street}" if street else venue
            all_rows.append({
                "Departamento": dep, "NroCircuito": r["circuito"], "Serie": r["serie"],
                "Desde": r["desde"], "Hasta": r["hasta"],
                "Localidad": r["localidad"].strip(), "Direccion": direccion.strip(),
            })
        print(f"  {pdf_name:4} filas={len(recs):5} series={len(series):3} letras={letters} "
              f"depts={depts} skipped={skipped:4} viol={len(viol)}")
        for v in viol[:5]:
            print(f"       ⚠ {v}")

    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with open(OUT, "w", encoding="utf-8", newline="") as f:
        wr = csv.DictWriter(f, fieldnames=["Departamento", "NroCircuito", "Serie", "Desde",
                                           "Hasta", "Localidad", "Direccion"])
        wr.writeheader()
        for row in all_rows:
            wr.writerow(row)
    print(f"\n{len(all_rows)} filas → {OUT}")
    covered = sorted({r['Departamento'] for r in all_rows})
    print(f"DEPTOS CUBIERTOS ({len(covered)}): {covered}")


if __name__ == "__main__":
    main()
