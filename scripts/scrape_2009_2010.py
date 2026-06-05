#!/usr/bin/env python3
"""
Scraper de la app GeneXus VIVA de la Corte Electoral para el ciclo 2009-2010.

Fuente: https://elecciones.corteelectoral.gub.uy  (recipe en
data/raw/electoral/SOURCING-2009-2010.md, decodificado de los menús SSPMenu.asp).

Granularidad MÁXIMA disponible = DEPARTAMENTO (y MUNICIPIO para municipales-2010).
No hay dato por circuito/serie/local en esta fuente (confirmado en sourcing).

Este módulo SOLO scrapea y cachea el HTML crudo (latin-1) en
data/raw/electoral/{eleccion}/asp-cache/. El parseo y la construcción de shards
viven en build_2009_2010.py. Respetuoso con el server: secuencial + delay.

Uso:
  python3 scripts/scrape_2009_2010.py <eleccion>      # una elección
  python3 scripts/scrape_2009_2010.py all
"""
import os, sys, ssl, time, urllib.request, urllib.error

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RAW = os.path.join(ROOT, 'data', 'raw', 'electoral')
HOST = 'https://elecciones.corteelectoral.gub.uy'
DELAY = float(os.environ.get('SCRAPE_DELAY', '0.4'))  # seg entre requests (cortés)

_CTX = ssl.create_default_context()
_CTX.check_hostname = False
_CTX.verify_mode = ssl.CERT_NONE

# 19 departamentos: código de URL (sin tildes/espacios, mayúsculas) -> id snake_case del repo
DEPTOS = [
    ('ARTIGAS', 'artigas'), ('CANELONES', 'canelones'), ('CERROLARGO', 'cerro_largo'),
    ('COLONIA', 'colonia'), ('DURAZNO', 'durazno'), ('FLORES', 'flores'),
    ('FLORIDA', 'florida'), ('LAVALLEJA', 'lavalleja'), ('MALDONADO', 'maldonado'),
    ('MONTEVIDEO', 'montevideo'), ('PAYSANDU', 'paysandu'), ('RIONEGRO', 'rio_negro'),
    ('RIVERA', 'rivera'), ('ROCHA', 'rocha'), ('SALTO', 'salto'), ('SANJOSE', 'san_jose'),
    ('SORIANO', 'soriano'), ('TACUAREMBO', 'tacuarembo'), ('TREINTAYTRES', 'treinta_y_tres'),
]

# Base paths por elección (de SOURCING-2009-2010.md)
BASE = {
    'internas-2009':       '/Internas/2009/20090628/SSPConsulta.asp',
    'nacionales-2009':     '/Nacionales/2009/20091025/ConsEscrutinio/SSPConsulta.asp',
    'balotaje-2009':       '/balotaje/2009/20091129/SSPConsulta.asp',
    'departamentales-2010':'/departamentales/2010/20100509/ConsEscrutinio/SSPConsulta.asp',
    'municipales-2010':    '/departamentales/2010/20100509/ConsEscrutinio/SSPConsulta.asp',
}
ACTO = {
    'internas-2009': '20090628', 'nacionales-2009': '20091025',
    'balotaje-2009': '20091129', 'departamentales-2010': '20100509',
    'municipales-2010': '20100509',
}
# Lemas de la nacional 2009 (de SSPMenu): código -> nada (se pide por código)
LEMAS_NAC_2009 = {'1': 'Frente Amplio', '3': 'P.Nacional', '2': 'P.Colorado',
                  '4': 'P.Independiente', '5': 'P.Asamblea Popular'}
# Partidos/convocatorias internas-2009 (Org = código de partido, de SOURCING)
ORG_INTERNAS_2009 = {
    '2': 'Frente Amplio', '6': 'Partido Nacional', '4': 'Partido Colorado',
    '8': 'Partido Independiente', '12': 'Partido de los Trabajadores',
    '18': 'Partido Cuatro Puntos Cardinales', '14': 'Partido Asamblea Popular',
    '22': 'Partido Comuna',
}


def cache_path(eleccion, name):
    d = os.path.join(RAW, eleccion, 'asp-cache')
    os.makedirs(d, exist_ok=True)
    return os.path.join(d, name)


def fetch(url, dest, force=False):
    """GET url -> bytes crudos (latin-1 al disco). Cachea; respeta delay; 501/404 -> None."""
    if os.path.exists(dest) and not force and os.path.getsize(dest) > 0:
        with open(dest, 'rb') as f:
            return f.read()
    req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0 (electoral-map-archival)'})
    try:
        with urllib.request.urlopen(req, timeout=45, context=_CTX) as r:
            data = r.read()
    except urllib.error.HTTPError as e:
        # 501 = combinación inválida (esperado en algunos cruces); 404 = no existe
        with open(dest + '.err', 'w') as f:
            f.write(f'HTTP {e.code}')
        time.sleep(DELAY)
        return None
    except Exception as e:
        with open(dest + '.err', 'w') as f:
            f.write(f'ERR {e}')
        time.sleep(DELAY)
        return None
    with open(dest, 'wb') as f:
        f.write(data)
    time.sleep(DELAY)
    return data


def url(eleccion, params):
    qs = '&'.join(f'{k}={v}' for k, v in params.items())
    return f'{HOST}{BASE[eleccion]}?{qs}'


# ---------------------------------------------------------------------------
# Scrapers por elección. Cada uno cachea L (lema) + H (hoja) por depto, etc.
# ---------------------------------------------------------------------------

def scrape_nacionales_2009(force=False):
    el = 'nacionales-2009'; acto = ACTO[el]
    for code, did in DEPTOS:
        # L: por lema (trae blancos/anulados/observados/emitidos/habilitados)
        fetch(url(el, dict(TipoCons='L', Acto=acto, Org=1, Dpto=code, Escrut='D', Circ='V', Junta=0)),
              cache_path(el, f'L_{code}.html'), force)
        # H: por hoja, por cada lema
        for lema in LEMAS_NAC_2009:
            fetch(url(el, dict(TipoCons='H', Acto=acto, Org=1, Dpto=code, Escrut='D', Circ='V', Lema=lema, Junta=0)),
                  cache_path(el, f'H_{code}_L{lema}.html'), force)
        print(f'  nacionales-2009 {code} ok')
    # Plebiscitos (TipoCons=A) — nacional, no por depto (Dpto omitido en builder A)
    fetch(url(el, dict(TipoCons='A', Acto=acto, Org=1, Escrut='D', Circ='V', CantPorc='C')),
          cache_path(el, 'A_plebiscitos.html'), force)


def scrape_balotaje_2009(force=False):
    el = 'balotaje-2009'; acto = ACTO[el]
    for code, did in DEPTOS:
        # Balotaje: TipoCons=L, Org=4 (de SOURCING). Plano por fórmula/lema.
        fetch(url(el, dict(TipoCons='L', Acto=acto, Org=4, Dpto=code, Escrut='D', Circ='V', Junta=0)),
              cache_path(el, f'L_{code}.html'), force)
        print(f'  balotaje-2009 {code} ok')


def scrape_internas_2009(force=False):
    el = 'internas-2009'; acto = ACTO[el]
    # internas: Escrut=D & Circ=I (definitivo). Org = código de partido. Hojas con precandidato inline.
    for code, did in DEPTOS:
        for org in ORG_INTERNAS_2009:
            # L: por precandidato (resumen del partido). H: por hoja (hoja - PRECANDIDATO).
            fetch(url(el, dict(TipoCons='L', Acto=acto, Org=org, Dpto=code, Escrut='D', Circ='I', Junta=0)),
                  cache_path(el, f'L_{code}_O{org}.html'), force)
            fetch(url(el, dict(TipoCons='H', Acto=acto, Org=org, Dpto=code, Escrut='D', Circ='I', Lema=0, Junta=0)),
                  cache_path(el, f'H_{code}_O{org}.html'), force)
        print(f'  internas-2009 {code} ok')


def scrape_departamentales_2010(force=False):
    el = 'departamentales-2010'; acto = ACTO[el]
    for code, did in DEPTOS:
        # L: por lema (trae no-partidarios). H: por hoja, Lema=0 = todas.
        fetch(url(el, dict(TipoCons='L', Acto=acto, Org=1, Dpto=code, Escrut='D', Circ='V', Junta=0)),
              cache_path(el, f'L_{code}.html'), force)
        fetch(url(el, dict(TipoCons='H', Acto=acto, Org=1, Dpto=code, Escrut='D', Circ='V', Lema=0, Junta=0)),
              cache_path(el, f'H_{code}.html'), force)
        print(f'  departamentales-2010 {code} ok')


# municipales-2010 requiere enumerar municipios por depto vía AJAX; se maneja en build con
# descubrimiento. Aquí dejamos un placeholder que el build llama on-demand.

SCRAPERS = {
    'nacionales-2009': scrape_nacionales_2009,
    'balotaje-2009': scrape_balotaje_2009,
    'internas-2009': scrape_internas_2009,
    'departamentales-2010': scrape_departamentales_2010,
}


def main():
    if len(sys.argv) < 2:
        print('uso: scrape_2009_2010.py <eleccion>|all'); sys.exit(1)
    force = '--force' in sys.argv
    target = sys.argv[1]
    els = list(SCRAPERS) if target == 'all' else [target]
    for el in els:
        if el not in SCRAPERS:
            print(f'! sin scraper para {el}'); continue
        print(f'== {el} ==')
        SCRAPERS[el](force=force)
    print('listo.')


if __name__ == '__main__':
    main()
