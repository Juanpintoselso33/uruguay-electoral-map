#!/usr/bin/env python3
"""
Construye el mapeo serie de credencial -> municipio para municipales-2010, desde los PDFs
OFICIALES de la Corte (data/raw/electoral/municipales-2010/series-pdf/):
  - Series_y_Municipios.pdf          -> Montevideo (credencial -> letra, limpio, 1 par por celda)
  - series_electorales_municipios.pdf -> interior (municipio -> lista de series + letra)

Salida: public/data/mappings/{depto}/serie-municipio.municipales-2010.json  =  [{serie, municipio}]
El campo `municipio` es el NOMBRE CANONICO de juntas.json (== el "Municipio: X" del HTML de votos),
para que el geoId de geometria y el de votos joineen 1:1.

Decisiones de parseo robustas (PDF fragil, ver advisor):
  - El DEPARTAMENTO de cada municipio se deriva de la PRIMERA LETRA de su serie (prefijo oficial de
    depto en la credencial uruguaya: C=Canelones, D=Maldonado, ... A/B=Montevideo). No se depende del
    orden de bloques del PDF.
  - El NOMBRE canonico sale de juntas.json joineando por (depto, letra). El nombre del PDF es solo
    cross-check (difiere a veces, p.ej. "Juan A. Artigas (ex Barros Blancos)").
  - "CAA - CNA" (guion con espacios) se trata como SEPARADOR -> [CAA, CNA] (no es un rango).

GATE ESTRUCTURAL (aborta si falla): por depto, set(letras parseadas) == set(letras en juntas.json).
GATE GEOMETRIA (warn): cada serie asignada debe existir en la geometria del depto.
"""
import json, os, re, sys, glob

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PDF_DIR = os.path.join(ROOT, "data/raw/electoral/municipales-2010/series-pdf")
MAP_OUT = os.path.join(ROOT, "public/data/mappings")
GEO_DIR = os.path.join(ROOT, "public/data/geographic")
JUNTAS = os.path.join(ROOT, "data/raw/electoral/municipales-2010/juntas.json")

from pypdf import PdfReader

# juntas DEPTO (codigo) -> slug del repo
DEPTO_SLUG = {
    "MONTEVIDEO": "montevideo", "CANELONES": "canelones", "CERROLARGO": "cerro_largo",
    "COLONIA": "colonia", "DURAZNO": "durazno", "FLORES": "flores", "FLORIDA": "florida",
    "LAVALLEJA": "lavalleja", "MALDONADO": "maldonado", "PAYSANDU": "paysandu",
    "RIONEGRO": "rio_negro", "RIVERA": "rivera", "ROCHA": "rocha", "SALTO": "salto",
    "SANJOSE": "san_jose", "SORIANO": "soriano", "TACUAREMBO": "tacuarembo",
    "TREINTAYTRES": "treinta_y_tres", "ARTIGAS": "artigas",
}
# prefijo de serie (1ra letra, minuscula) -> slug de depto. A y B = Montevideo.
PREFIX_SLUG = {
    "a": "montevideo", "b": "montevideo", "c": "canelones", "d": "maldonado", "e": "rocha",
    "f": "treinta_y_tres", "g": "cerro_largo", "h": "rivera", "i": "artigas", "j": "salto",
    "k": "paysandu", "l": "rio_negro", "m": "soriano", "n": "colonia", "o": "san_jose",
    "p": "flores", "q": "florida", "r": "durazno", "s": "lavalleja", "t": "tacuarembo",
}
# letras de municipio validas (abecedario espanol con digrafos)
LETTERS = ["CH", "LL", "Ñ", "A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L",
           "M", "N", "O", "P", "Q", "R", "S", "T", "U", "V", "W", "X", "Y", "Z"]
LETTER_SET = set(LETTERS)
SERIE_RE = re.compile(r"^[A-Z]{3}$")


def load_juntas():
    j = json.load(open(JUNTAS, encoding="utf8"))
    # (slug, letra) -> {name, juntaId}
    out = {}
    for m in j:
        slug = DEPTO_SLUG[m["depto"]]
        out[(slug, m["code"].upper())] = {"name": m["name"], "juntaId": m["juntaId"]}
    return out, j


def load_geo_series():
    """slug -> set(series lower) que existen en la geometria."""
    geo = {}
    for f in glob.glob(os.path.join(GEO_DIR, "*_series_map.json")):
        slug = os.path.basename(f).replace("_series_map.json", "")
        g = json.load(open(f, encoding="utf8"))
        sk = [k for k in g["features"][0]["properties"] if k.lower() == "serie"][0]
        geo[slug] = {(ft["properties"].get(sk) or "").strip().lower()
                     for ft in g["features"] if ft["properties"].get(sk)}
    return geo


def parse_mvd():
    """Series_y_Municipios.pdf: pares (credencial, letra). Cada celda = 'AAA B'. 2 columnas/linea.
    Letras de MVD = {A..G, CH} (8 municipios). Restringir a ese set evita ruido del header."""
    MVD_LETTERS = {"A", "B", "C", "CH", "D", "E", "F", "G"}
    r = PdfReader(os.path.join(PDF_DIR, "Series_y_Municipios.pdf"))
    text = "\n".join((pg.extract_text() or "") for pg in r.pages)
    # tokens: runs de mayusculas (credenciales de 3 + letras de 1-2)
    toks = re.findall(r"[A-Z]+", text)
    pairs = []  # (serie_lower, letter)
    i = 0
    while i < len(toks) - 1:
        cred, nxt = toks[i], toks[i + 1]
        if SERIE_RE.match(cred) and nxt in MVD_LETTERS:
            pairs.append((cred.lower(), nxt))
            i += 2
        else:
            i += 1
    return pairs


def parse_interior():
    """series_electorales_municipios.pdf: filas '<nombre> <series> <letra>'. Depto via prefijo."""
    r = PdfReader(os.path.join(PDF_DIR, "series_electorales_municipios.pdf"))
    rows = []  # (serie_lower, slug, letter)
    skip_kw = ("corte electoral", "municipio", "elecciones municipales", "nota",
               "señor elector", "letras y series")
    depto_headers = set(DEPTO_SLUG.keys()) | {"RIO NEGRO", "SAN JOSE", "CERRO LARGO",
                                              "TREINTA Y TRES"}
    for pg in r.pages:
        for raw in (pg.extract_text() or "").splitlines():
            line = raw.strip()
            if not line:
                continue
            low = line.lower()
            if any(k in low for k in skip_kw):
                continue
            if line.upper() in depto_headers:
                continue
            toks = line.split()
            if len(toks) < 2 or toks[-1] not in LETTER_SET:
                continue
            letter = toks[-1]
            # caminar hacia atras juntando tokens de serie (3 letras, guiones, '-')
            series_toks = []
            k = len(toks) - 2
            while k >= 0:
                t = toks[k]
                if t == "-" or re.match(r"^[A-Z]{3}(-[A-Z]{3})*-?$", t) or re.match(r"^-?[A-Z]{3}$", t):
                    series_toks.append(t)
                    k -= 1
                else:
                    break
            if not series_toks:
                continue
            series_toks.reverse()
            blob = "-".join(series_toks)
            series = [s for s in re.split(r"-+", blob) if SERIE_RE.match(s)]
            if not series:
                continue
            slug = PREFIX_SLUG.get(series[0][0].lower())
            if not slug:
                continue
            for s in series:
                # un municipio nunca cruza depto; todas las series comparten prefijo
                rows.append((s.lower(), slug, letter))
    return rows


def main():
    juntas_map, _ = load_juntas()
    geo = load_geo_series()

    # juntar MVD + interior en: (slug) -> letra -> [series]
    by_depto = {}
    for serie, letter in parse_mvd():
        by_depto.setdefault("montevideo", {}).setdefault(letter, []).append(serie)
    for serie, slug, letter in parse_interior():
        by_depto.setdefault(slug, {}).setdefault(letter, []).append(serie)

    # GATE ESTRUCTURAL: letras parseadas == letras de juntas, por depto
    juntas_letters = {}
    for (slug, letter) in juntas_map:
        juntas_letters.setdefault(slug, set()).add(letter)

    failures = []
    for slug, jl in sorted(juntas_letters.items()):
        pl = set(by_depto.get(slug, {}).keys())
        if pl != jl:
            failures.append((slug, sorted(jl - pl), sorted(pl - jl)))
    if failures:
        print("❌ GATE ESTRUCTURAL FALLA (letras PDF != juntas):", file=sys.stderr)
        for slug, missing, extra in failures:
            print(f"   {slug}: faltan en PDF={missing}  sobran en PDF={extra}", file=sys.stderr)
        sys.exit(1)
    print(f"✅ Gate estructural OK: {len(juntas_letters)} deptos, letras PDF == juntas")

    # construir mapeos + gate geometria
    total_series = 0
    missing_geo = []
    written = 0
    for slug, letters in sorted(by_depto.items()):
        entries = []
        for letter, series in letters.items():
            jk = juntas_map.get((slug, letter))
            if not jk:
                continue
            name = jk["name"]
            for s in sorted(set(series)):
                entries.append({"serie": s, "municipio": name})
                total_series += 1
                if slug in geo and s not in geo[slug]:
                    missing_geo.append(f"{slug}/{s}->{name}")
        entries.sort(key=lambda e: e["serie"])
        out_dir = os.path.join(MAP_OUT, slug)
        os.makedirs(out_dir, exist_ok=True)
        out_path = os.path.join(out_dir, "serie-municipio.municipales-2010.json")
        with open(out_path, "w", encoding="utf8") as f:
            json.dump(entries, f, ensure_ascii=False)
        written += 1

    print(f"✅ {written} mapeos escritos, {total_series} series asignadas")
    if missing_geo:
        print(f"ℹ️  {len(missing_geo)} series SIN geometria (gris benigno): "
              f"{', '.join(missing_geo[:15])}{'…' if len(missing_geo) > 15 else ''}")
    else:
        print("✅ todas las series asignadas tienen geometria")


if __name__ == "__main__":
    main()
