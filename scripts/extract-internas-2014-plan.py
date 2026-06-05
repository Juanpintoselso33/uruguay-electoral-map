#!/usr/bin/env python3
"""
Extrae el PLAN CIRCUITAL de internas-2014 (PDFs de Wayback) → plan-circuital.csv canónico.

Solo 3 deptos archivados (Montevideo, Canelones, Maldonado); los 16 interiores restantes NO
se archivaron y quedan como están (serie). Estos 3 = ~55% del padrón e incluyen Montevideo.

Formato de salida (= data/raw/electoral/nacionales-2014/plan-circuital.csv, el que consumen
build-votes-local.py/read_plan y build-circuito-barrio-cycles.py/build_mapping):
    Departamento,NroCircuito,Serie,Desde,Hasta,Localidad,Direccion

Direccion = "VENUE - STREET" (igual que nacionales-2014). street_key() de build-circuito-barrio
parte por el último '-' → STREET para geocoding; el matcher de local usa los tokens del VENUE.
Maldonado no tiene columna de calle separada → Direccion = el blob de LOCAL tal cual.

Técnica: pdfplumber extract_words() + corte por coordenada-x (layout fijo de PDF de gobierno),
NO split naive por espacios. Anclas numéricas: Circuito/Desde/Hasta + Serie (3 letras).
Filas continuación (MVD: el nombre del local sigue en la fila siguiente, sin anclas) → se
adjuntan al VENUE de la fila previa.

Uso: python scripts/extract-internas-2014-plan.py
"""
import csv, os, re, sys
from collections import defaultdict
import pdfplumber

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PDF_DIR = os.path.join(ROOT, "data/raw/electoral/internas-2014/planes-pdf")
OUT = os.path.join(ROOT, "data/raw/electoral/internas-2014/plan-circuital.csv")

SERIE_RE = re.compile(r"^[A-Z]{3}$")

# Cortes-x por depto (de extract_words sobre las filas de datos; ver header del script).
# venue_x0_max: x0 a partir del cual una palabra YA NO es del bloque numérico/serie inicial.
# street_x0_min: x0 a partir del cual la palabra es de la columna DIRECCIÓN (solo MVD/CA).
LAYOUT = {
    "Montevideo": {"dep": "MONTEVIDEO", "loc_const": "MONTEVIDEO",
                   "venue_x0_min": 200, "street_x0_min": 560, "loc_x0": None},
    "Canelones":  {"dep": "CANELONES", "loc_const": None,
                   "venue_x0_min": 200, "street_x0_min": 600, "loc_x0": 350},
    "Maldonado":  {"dep": "MALDONADO", "loc_const": None,
                   "venue_x0_min": 200, "street_x0_min": None, "loc_x0": 348},
}


def parse_rows(words):
    """Agrupa words en filas por su 'top' (y), tolerando jitter de ±2px."""
    rows = defaultdict(list)
    for w in words:
        rows[round(w["top"])].append(w)
    # merge tops que difieren en 1px (misma línea)
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


def extract_dept(pdf_name, lay):
    pdf_path = os.path.join(PDF_DIR, f"{pdf_name}.pdf")
    records = []          # list of dict
    skipped_lines = 0
    with pdfplumber.open(pdf_path) as pdf:
        for pg in pdf.pages:
            words = pg.extract_words()
            for line in parse_rows(words):
                toks = [w["text"] for w in line]
                if not toks:
                    continue
                # header / título
                joined = " ".join(toks)
                if joined.startswith("PLAN CIRCUITAL") or toks[0] in ("Circuito", "PLAN", lay["dep"], "MONTEVIDEO", "CANELONES", "MALDONADO"):
                    continue
                # ¿fila de datos? Circuito (int) en x0<70 + Serie (3 letras)
                first = line[0]
                circ = first["text"]
                if circ.isdigit() and first["x0"] < 75:
                    # buscar serie: primer token de 3 letras mayúsculas tras circuito
                    serie = None; serie_idx = None
                    for i, w in enumerate(line[1:], start=1):
                        if SERIE_RE.match(w["text"]):
                            serie = w["text"]; serie_idx = i; break
                        # ditto mark (") en la columna de serie → misma serie que la fila previa.
                        if w["text"] in ('"', "''", '“', '”') and 130 <= w["x0"] <= 200:
                            serie = records[-1]["serie"] if records else None; serie_idx = i; break
                    if serie is None:
                        skipped_lines += 1; continue
                    # Desde/Hasta = los dos primeros enteros tras la serie
                    nums = [w for w in line[serie_idx + 1:] if re.fullmatch(r"\d+", w["text"])]
                    if len(nums) < 2:
                        skipped_lines += 1; continue
                    desde, hasta = nums[0]["text"], nums[1]["text"]
                    hasta_x1 = nums[1]["x1"]
                    # palabras de texto = las que vienen DESPUÉS de Hasta (x0 > hasta_x1)
                    rest = [w for w in line if w["x0"] > hasta_x1 - 1 and w is not nums[0] and w is not nums[1]]
                    rest = sorted(rest, key=lambda w: w["x0"])
                    loc, venue, street = _split_text(rest, lay)
                    records.append({"circuito": circ, "serie": serie, "desde": desde, "hasta": hasta,
                                    "localidad": loc, "venue": venue, "street": street})
                elif first["text"] in ("Urbano", "Rural") and records:
                    # fila de MISMA CRV con OTRA serie (interior): reusa el NroCircuito previo.
                    # Ej. Maldonado CRV 330 con series DEA + DEB. Emite una fila extra propia.
                    serie = None; serie_idx = None
                    for i, w in enumerate(line[1:], start=1):
                        if SERIE_RE.match(w["text"]):
                            serie = w["text"]; serie_idx = i; break
                    nums = [w for w in line[serie_idx + 1:]] if serie_idx else []
                    nums = [w for w in nums if re.fullmatch(r"\d+", w["text"])]
                    if serie and len(nums) >= 2:
                        desde, hasta = nums[0]["text"], nums[1]["text"]
                        hasta_x1 = nums[1]["x1"]
                        rest = sorted([w for w in line if w["x0"] > hasta_x1 - 1], key=lambda w: w["x0"])
                        loc, venue, street = _split_text(rest, lay)
                        records.append({"circuito": records[-1]["circuito"], "serie": serie,
                                        "desde": desde, "hasta": hasta, "localidad": loc,
                                        "venue": venue, "street": street})
                    else:
                        skipped_lines += 1
                else:
                    # fila continuación → adjuntar a VENUE de la última fila de datos
                    if records and first["x0"] >= lay["venue_x0_min"] - 30:
                        cont_venue = " ".join(w["text"] for w in line
                                              if (lay["street_x0_min"] is None or w["x0"] < lay["street_x0_min"]))
                        cont_street = ""
                        if lay["street_x0_min"] is not None:
                            cont_street = " ".join(w["text"] for w in line if w["x0"] >= lay["street_x0_min"])
                        if cont_venue:
                            records[-1]["venue"] = (records[-1]["venue"] + " " + cont_venue).strip()
                        if cont_street:
                            records[-1]["street"] = (records[-1]["street"] + " " + cont_street).strip()
                    else:
                        skipped_lines += 1
    return records, skipped_lines


def _split_text(rest, lay):
    """rest = words tras Hasta. Devuelve (localidad, venue, street)."""
    loc_tokens, venue_tokens, street_tokens = [], [], []
    loc_x0 = lay["loc_x0"]; street_x0 = lay["street_x0_min"]
    for w in rest:
        x0 = w["x0"]; t = w["text"]
        if street_x0 is not None and x0 >= street_x0:
            street_tokens.append(t)
        elif loc_x0 is not None and x0 < loc_x0 + 60 and not venue_tokens:
            # LOCALIDAD: la primera columna de texto (antes de LOCAL@~434). Solo mientras no haya
            # empezado el venue (la localidad va primero).
            if x0 < (lay["street_x0_min"] or 1e9) and x0 < 432:
                loc_tokens.append(t)
            else:
                venue_tokens.append(t)
        else:
            venue_tokens.append(t)
    loc = lay["loc_const"] or " ".join(loc_tokens).strip()
    return loc, " ".join(venue_tokens).strip(), " ".join(street_tokens).strip()


def validate_contiguity(records):
    """Desde/Hasta crecientes y contiguos por serie. Reporta violaciones (no aborta)."""
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
                viol.append(f"{serie} CRV{r['circuito']}: hasta<{d}>{h}")
            if prev_hasta is not None and d != prev_hasta + 1:
                gap = d - prev_hasta - 1
                # gaps pequeños son normales (credenciales anuladas); reportar saltos grandes/negativos
                if d <= prev_hasta:
                    viol.append(f"{serie} CRV{r['circuito']}: desde {d} <= prev_hasta {prev_hasta} (solape/retro)")
            prev_hasta = max(prev_hasta or 0, h)
    return viol


def main():
    all_rows = []
    summary = {}
    for pdf_name, lay in LAYOUT.items():
        recs, skipped = extract_dept(pdf_name, lay)
        viol = validate_contiguity(recs)
        series = sorted({r["serie"] for r in recs})
        summary[pdf_name] = {"filas": len(recs), "skipped": skipped, "series": len(series),
                             "violaciones": len(viol)}
        # construir Direccion = "VENUE - STREET" (o solo VENUE si no hay street)
        for r in recs:
            venue = r["venue"].strip(); street = r["street"].strip()
            if street:
                direccion = f"{venue} - {street}"
            else:
                direccion = venue
            all_rows.append({
                "Departamento": lay["dep"], "NroCircuito": r["circuito"], "Serie": r["serie"],
                "Desde": r["desde"], "Hasta": r["hasta"],
                "Localidad": r["localidad"], "Direccion": direccion,
            })
        print(f"  {pdf_name:12} filas={len(recs):5} series={len(series):3} skipped={skipped:4} violaciones={len(viol)}")
        for v in viol[:6]:
            print(f"      ⚠ {v}")

    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with open(OUT, "w", encoding="utf-8", newline="") as f:
        wr = csv.DictWriter(f, fieldnames=["Departamento", "NroCircuito", "Serie", "Desde", "Hasta", "Localidad", "Direccion"])
        wr.writeheader()
        for row in all_rows:
            wr.writerow(row)
    print(f"\n{len(all_rows)} filas → {OUT}")
    return summary


if __name__ == "__main__":
    main()
