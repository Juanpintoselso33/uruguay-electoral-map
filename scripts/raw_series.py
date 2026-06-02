"""Helper compartido (Epic 16.4): carga las series que votaron en el RAW oficial por elección.

Usado por gate-grises.py (detectar grises-bug) y build-annex-series.py (no anexar bugs, solo benignas).
Tolera encoding Latin-1 (varios CSV de la Corte no son UTF-8) y formatos de columna heterogéneos.
"""
import csv, glob, re, unicodedata

CODE2ID = {'MO': 'montevideo', 'CA': 'canelones', 'MA': 'maldonado', 'CO': 'colonia', 'SA': 'salto',
 'PA': 'paysandu', 'RV': 'rivera', 'CL': 'cerro_largo', 'TA': 'tacuarembo', 'SJ': 'san_jose',
 'SO': 'soriano', 'RO': 'rocha', 'FD': 'florida', 'AR': 'artigas', 'DU': 'durazno',
 'TT': 'treinta_y_tres', 'LA': 'lavalleja', 'RN': 'rio_negro', 'FS': 'flores'}
RAW_DIR = {
    'balotaje-2014': 'balotaje-2014', 'balotaje-2019': 'balotaje-2019', 'balotaje-2024': 'balotaje-2024',
    'nacionales-2014': 'nacionales-2014', 'nacionales-2019': 'nacionales-2019-full',
    'nacionales-2024': 'nacionales-2024', 'internas-2019': 'internas-2019', 'internas-2024': 'internas-2024',
    'referendum-luc-2022': 'referendum-2022', 'plebiscito-vivir-sin-miedo-2019': 'plebiscito-2019',
    'departamentales-2020': 'departamentales-2020', 'departamentales-2025': 'departamentales-2025',
}

def norm(s):
    s = unicodedata.normalize('NFD', str(s)); s = ''.join(c for c in s if unicodedata.category(c) != 'Mn')
    return re.sub(r'\s+', ' ', re.sub(r'[.,]', ' ', s.upper())).strip()

def _read(f):
    for enc in ('utf-8', 'latin-1'):
        try:
            with open(f, encoding=enc) as fh:
                return list(csv.DictReader(fh)), fh
        except (UnicodeDecodeError, Exception):
            continue
    return None, None

def _rows(f):
    """Filas del CSV tolerando utf-8/latin-1. (list_of_dicts, fieldnames) o (None, None)."""
    for enc in ('utf-8', 'latin-1'):
        try:
            with open(f, encoding=enc) as fh:
                rd = csv.DictReader(fh)
                return list(rd), (rd.fieldnames or [])
        except UnicodeDecodeError:
            continue
        except Exception:
            return None, None
    return None, None

def raw_series(eleccion):
    """{depto: set(serieNorm)} de las series con VOTOS VÁLIDOS (>0) en el raw, o None si no se halla.

    Clave: usar votos válidos, NO el mero registro (plan-circuital lista TODAS las series, incluso las
    de 0 votos como las de solo-observados → falsos positivos). Preferimos la columna de NO_Observados
    (totales por CRV); si no hay, sumamos columnas de votos; último recurso, presencia."""
    d = RAW_DIR.get(eleccion)
    if not d: return None
    archivos = glob.glob(f'data/raw/electoral/{d}/*.csv')
    # 1º preferir un CSV con Serie + columna de válidos/no-observados (totales por CRV)
    def col(cols, *subs):
        for c in cols:
            cl = c.strip().strip('"').lower()
            if any(s in cl for s in subs): return c
        return None
    for prefer_validos in (True, False):
        for f in archivos:
            rows, fn = _rows(f)
            if rows is None: continue
            cdep = col(fn, 'departamento'); cser = col(fn, 'serie', 'series')
            if not (cdep and cser): continue
            cval = col(fn, 'no_observados', 'novobservados', 'no observados')
            if prefer_validos and not cval:
                continue
            out = {}
            for r in rows:
                dep = CODE2ID.get((r.get(cdep) or '').strip().strip('"'))
                ser = (r.get(cser) or '').strip().strip('"')
                if not (dep and ser): continue
                if cval:   # solo series con válidos > 0
                    try:
                        if int((r.get(cval) or '0').strip().strip('"') or 0) <= 0: continue
                    except ValueError:
                        continue
                out.setdefault(dep, set()).add(norm(ser))
            if out:
                return out
    return None
