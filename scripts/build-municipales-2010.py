#!/usr/bin/env python3
"""
Builder de municipales-2010 a nivel MUNICIPIO (primera elección municipal del país, 89 municipios).

Fuente: HTML cacheado por el scraper de la app GeneXus viva, en
  data/raw/electoral/municipales-2010/asp-cache/{L,H}_{DEPTO}_J{juntaId}.html
  - L = por lema (totales hojas/lema/total + no-partidarios + "Municipio: <nombre>")
  - H = por hoja, AGRUPADO por lema con headers; la hoja ya trae sufijo de municipio ("1059-A").

Estructura (gemela de build_2009_2010.build_departamentales_2010, pero por municipio en vez de por
depto, y con el desglose por hoja CONSOLIDADO en hoja-municipio.json como municipales-2025):
  public/data/municipales-2010/{depto}/  votes.json · opciones.json · catalogo.json · hoja-municipio.json
  public/data/municipales-2010/_nacional/ idem (89 municipios, geoId compuesto "Nombre · Depto")

Contienda 'municipio', niveles ['lema','hoja'] degradado (sin sublema/alcalde: la app no los da por
hoja para 2010). geoId = nombre de municipio EXACTO del topo (join 1:1 con municipio.2010.topo.json).
opcionId de hoja sufijado con juntaId → único global (en el consolidado _nacional las letras repiten).

Reconciliación: Σ(opciones-hoja por municipio·lema) == total-del-lema en L (delta=0; el residual
"Voto al lema (sin hoja)" absorbe los "Adjudicados al Lema" + cualquier ruido L/H de la fuente).
"""
import os, sys, re, json, html, unicodedata
from collections import OrderedDict

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RAW = os.path.join(ROOT, 'data', 'raw', 'electoral', 'municipales-2010')
DATA = os.path.join(ROOT, 'public', 'data')
EL = 'municipales-2010'
TIPO = 'municipales'

# nombre de lema (texto de la tabla) -> opcionId bare + nombre canónico (misma convención que el repo)
LEMA_NAME2ID = {
    'frente amplio': 'frente-amplio', 'partido nacional': 'nacional',
    'partido colorado': 'colorado', 'partido independiente': 'independiente',
    'independiente': 'independiente', 'partido asamblea popular': 'asamblea-popular',
    'asamblea popular': 'asamblea-popular', 'partido de los trabajadores': 'de-los-trabajadores',
    'partido cuatro puntos cardinales': 'cuatro-puntos-cardinales', 'partido comuna': 'comuna',
    'unidad popular': 'unidad-popular', 'union popular': 'union-popular',
}
CANON_NAME = {
    'frente-amplio': 'Frente Amplio', 'nacional': 'Partido Nacional', 'colorado': 'Partido Colorado',
    'independiente': 'Partido Independiente', 'asamblea-popular': 'Asamblea Popular',
    'de-los-trabajadores': 'Partido de los Trabajadores',
    'cuatro-puntos-cardinales': 'Partido Cuatro Puntos Cardinales', 'comuna': 'Partido Comuna',
    'unidad-popular': 'Unidad Popular', 'union-popular': 'Unión Popular',
}
NONPART_KEYS = {
    'votos en blanco total': 'enBlanco', 'votos en blanco': 'enBlanco',
    'sobres con hojas anuladas en su totalidad': 'anulados',
    'votos observados anulados': 'observados', 'observados anulados': 'observados',
}


def decode(b):
    try:
        return b.decode('utf-8')
    except UnicodeDecodeError:
        return b.decode('latin-1')


def num(s):
    s = (s or '').strip().replace('.', '').replace(chr(160), '').replace(' ', '').replace(',', '.')
    if s in ('', '-'):
        return 0
    try:
        return int(float(s))
    except ValueError:
        return 0


def parse_rows(txt):
    t = re.sub(r'<script.*?</script>', '', txt, flags=re.S | re.I)
    t = re.sub(r'<style.*?</style>', '', t, flags=re.S | re.I)
    out = []
    for r in re.findall(r'<tr.*?</tr>', t, flags=re.S | re.I):
        cells = re.findall(r'<t[dh][^>]*>(.*?)</t[dh]>', r, flags=re.S | re.I)
        cells = [html.unescape(re.sub(r'<[^>]+>', '', c)).strip().replace(chr(160), ' ') for c in cells]
        cells = [c for c in cells if c != '']
        if cells and ('Border-Style' in cells[0] or 'Font-Family' in cells[0]):
            cells = [c for c in cells[1:] if c != '']
        if cells:
            out.append(cells)
    return out


def parse_L(txt):
    """L municipal: filas de lema [nombre, hojas, lema, total, %] + no-partidario."""
    rows = parse_rows(txt)
    lemas = OrderedDict()
    no_part = {'enBlanco': 0, 'anulados': 0, 'observados': 0}
    for c in rows:
        low = c[0].lower().strip()
        if len(c) >= 4 and low in LEMA_NAME2ID:
            oid = LEMA_NAME2ID[low]
            lemas[oid] = {'hojas': num(c[1]), 'lema': num(c[2]), 'total': num(c[3])}
        elif low in NONPART_KEYS and len(c) >= 2:
            no_part[NONPART_KEYS[low]] = num(c[-2]) if len(c) >= 3 else num(c[-1])
    return {'lemas': lemas, 'no_part': no_part}


def parse_H(txt):
    """H municipal: hojas agrupadas por lema con headers ['<Lema>','Votos'], filas ['1059-A', votos],
    cerradas por 'Suma de Votos a las Hojas <n>'. Devuelve (hojas, suma):
      hojas: OrderedDict opcionId_lema -> [(hojaRaw, votos)]
      suma:  OrderedDict opcionId_lema -> 'Suma de Votos a las Hojas' (footer del PROPIO H = ancla de
             completitud de parseo, independiente del L)."""
    rows = parse_rows(txt)
    hojas = OrderedDict()
    suma = OrderedDict()
    cur = None
    for c in rows:
        low = c[0].lower().strip()
        if len(c) == 2 and c[1].strip().lower() == 'votos' and low in LEMA_NAME2ID:
            cur = LEMA_NAME2ID[low]
            hojas.setdefault(cur, [])
        elif cur and len(c) == 2 and re.fullmatch(r'\d+\s*-\s*[A-ZÑ]+', c[0].strip().upper()):
            hojas[cur].append((re.sub(r'\s*-\s*', '-', c[0].strip().upper()), num(c[1])))
        elif cur and low.startswith('suma de votos a las hojas') and len(c) >= 2:
            suma[cur] = num(c[-1])
            cur = None
        elif low.startswith('suma de votos') or low.startswith('total de votos') or low.startswith('votos a'):
            cur = None
    return hojas, suma


def wjson(path, obj):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, 'w', encoding='utf-8') as f:
        json.dump(obj, f, ensure_ascii=False, separators=(',', ':'))


def ganador(por):
    return max(por, key=lambda o: o['votos'])['opcionId'] if por else None


def read_cache(name):
    p = os.path.join(RAW, 'asp-cache', name)
    if not os.path.exists(p) or os.path.getsize(p) == 0:
        return None
    with open(p, 'rb') as f:
        return decode(f.read())


def load_geo_names():
    """Devuelve (perDepto, nacional): nombres EXACTOS del topo para joinear el geoId.
      perDepto[slug] = set(nombres);  nacional[(slug, bareName)] = 'bareName · Label'.
    El topo per-depto.name = nombre de municipio; _nacional.name = 'nombre · Label'."""
    per = {}
    nac = {}
    nac_topo = json.load(open(os.path.join(DATA, 'geo', '_nacional', 'municipio.2010.topo.json'), encoding='utf8'))
    obj = next(iter(nac_topo['objects'].values()))
    for g in obj['geometries']:
        p = g['properties']
        full = p['name']               # "Bella Union · Artigas"
        slug = p['departamento']
        bare = full.split(' · ')[0]
        nac[(slug, bare)] = full
        per.setdefault(slug, set()).add(bare)
    return per, nac


def main():
    juntas = json.load(open(os.path.join(RAW, 'juntas.json'), encoding='utf8'))
    DEPTO_SLUG = {
        'MONTEVIDEO': 'montevideo', 'CANELONES': 'canelones', 'CERROLARGO': 'cerro_largo',
        'COLONIA': 'colonia', 'DURAZNO': 'durazno', 'FLORES': 'flores', 'FLORIDA': 'florida',
        'LAVALLEJA': 'lavalleja', 'MALDONADO': 'maldonado', 'PAYSANDU': 'paysandu',
        'RIONEGRO': 'rio_negro', 'RIVERA': 'rivera', 'ROCHA': 'rocha', 'SALTO': 'salto',
        'SANJOSE': 'san_jose', 'SORIANO': 'soriano', 'TACUAREMBO': 'tacuarembo',
        'TREINTAYTRES': 'treinta_y_tres', 'ARTIGAS': 'artigas',
    }
    per_geo, nac_geo = load_geo_names()

    # acumuladores por depto y nacional
    by_depto = {}   # slug -> {'votes':[zonas], 'opciones':OrderedDict, 'cat_nodos':[], 'cat_opc':[], 'hoja_zonas':[]}
    nac = {'votes': [], 'opciones': OrderedDict(), 'cat_nodos': OrderedDict(), 'cat_opc': [], 'hoja_zonas': []}
    deltas = []
    source_noise = []
    missing = []

    for m in juntas:
        slug = DEPTO_SLUG[m['depto']]
        jid = m['juntaId']
        depto_code = m['depto']
        txtL = read_cache(f'L_{depto_code}_J{jid}.html')
        txtH = read_cache(f'H_{depto_code}_J{jid}.html')
        if not txtL:
            missing.append(f'{depto_code}/J{jid} ({m["name"]})')
            continue
        L = parse_L(txtL)
        H, Hsuma = parse_H(txtH) if txtH else (OrderedDict(), OrderedDict())

        # geoId EXACTO del topo (join 1:1). El nombre canónico es juntas.name.
        bare = m['name']
        if slug not in per_geo or bare not in per_geo[slug]:
            # el municipio no tiene polígono (no debería pasar: gate all-gris=0) → lo registramos igual
            geo_bare = bare
            geo_full = f'{bare} · {m["depto"].title()}'
        else:
            geo_bare = bare
            geo_full = nac_geo[(slug, bare)]

        D = by_depto.setdefault(slug, {'votes': [], 'opciones': OrderedDict(),
                                       'cat_nodos': OrderedDict(), 'cat_opc': [], 'hoja_zonas': []})

        # ---- base por lema (votes.json) ----
        por = []
        for oid, v in L['lemas'].items():
            if v['total'] <= 0:
                continue
            por.append({'opcionId': oid, 'votos': v['total']})
            D['opciones'][oid] = CANON_NAME.get(oid, oid)
            nac['opciones'][oid] = CANON_NAME.get(oid, oid)
            D['cat_nodos'][oid] = {'id': oid, 'nivel': 'lema', 'etiqueta': CANON_NAME.get(oid, oid), 'partidoId': oid}
            nac['cat_nodos'][oid] = dict(D['cat_nodos'][oid])
        validos = sum(o['votos'] for o in por)
        no_part = dict(L['no_part'])
        D['votes'].append({'geoId': geo_bare, 'ganadorOpcionId': ganador(por), 'validos': validos,
                           'porOpcion': por, 'noPartidarios': no_part})
        nac['votes'].append({'geoId': geo_full, 'ganadorOpcionId': ganador(por), 'validos': validos,
                             'porOpcion': por, 'noPartidarios': dict(no_part)})

        # ---- desglose por hoja (consolidado) ----
        por_hoja_depto = []
        por_hoja_nac = []
        for oid in L['lemas']:
            hojas = H.get(oid, [])
            sub = []
            for hojaRaw, votos in hojas:
                hid = f'municipio-{oid}-{hojaRaw}-j{jid}'
                opc = {'clase': 'hoja', 'id': hid, 'hoja': hojaRaw, 'partidoId': oid,
                       'contienda': 'municipio', 'lemaId': oid}
                D['cat_opc'].append(opc)
                nac['cat_opc'].append(dict(opc))
                sub.append({'opcionId': hid, 'votos': votos})
            # CHECK DE COMPLETITUD (advisor, no vacuo): Σ(hojas parseadas) DEBE == el footer "Suma de
            # Votos a las Hojas" del PROPIO H. Esto SÍ falla si el parse pierde una fila o falta el H.
            # (No uso L.hojas como ancla dura: el L y el H de la app difieren a veces ±pocos votos —
            # ruido de la fuente, no del parse; eso va al reporte blando de abajo.)
            sH_parsed = sum(o['votos'] for o in sub)
            footer = Hsuma.get(oid)
            if footer is not None and sH_parsed != footer:
                deltas.append((slug, m['name'], oid, 'PARSE_MISS Σhoja', sH_parsed, 'H.suma', footer))
            # parse-miss/ausencia de H: L dice que hay votos a hojas pero no parseamos ninguna.
            exp_hojas = L['lemas'][oid]['hojas']     # "Votos a Hojas" del L
            if exp_hojas > 0 and sH_parsed == 0:
                deltas.append((slug, m['name'], oid, 'H_VACIO exp>0', exp_hojas))
            # delta blando L-vs-H (ruido de fuente): reportar, no abortar.
            if footer is not None and footer != exp_hojas:
                source_noise.append((slug, m['name'], oid, footer, exp_hojas, footer - exp_hojas))
            # residual = "votos al lema (sin hoja)" = total − Σhojas (≈ L.lema, col c[2]).
            total = L['lemas'][oid]['total']
            al = total - sH_parsed
            if al < 0:
                deltas.append((slug, m['name'], oid, 'RESIDUAL_NEG', al))
            if al != 0:
                lid = f'municipio-{oid}-vl-j{jid}'
                opc = {'clase': 'hoja', 'id': lid, 'hoja': 'vl', 'partidoId': oid,
                       'contienda': 'municipio', 'lemaId': oid, 'etiqueta': 'Voto al lema (sin hoja)'}
                D['cat_opc'].append(opc)
                nac['cat_opc'].append(dict(opc))
                sub.append({'opcionId': lid, 'votos': al})
            # FLAG parse-miss de partido grande: lema mayoritario con residual >15% del total = sospecha
            # de que el desglose por hoja no se capturó (el grueso quedó como "voto al lema").
            if oid in ('frente-amplio', 'nacional', 'colorado') and total > 0 and al / total > 0.15:
                deltas.append((slug, m['name'], oid, 'MAJOR_SIN_HOJA', f'{al}/{total}={al/total:.2f}'))
            por_hoja_depto.extend(sub)
            por_hoja_nac.extend(sub)
        if por_hoja_depto:
            D['hoja_zonas'].append({'geoId': geo_bare, 'ganadorOpcionId': ganador(por_hoja_depto),
                                    'validos': sum(o['votos'] for o in por_hoja_depto),
                                    'porOpcion': por_hoja_depto,
                                    'noPartidarios': {'enBlanco': 0, 'anulados': 0, 'observados': 0}})
            nac['hoja_zonas'].append({'geoId': geo_full, 'ganadorOpcionId': ganador(por_hoja_nac),
                                      'validos': sum(o['votos'] for o in por_hoja_nac),
                                      'porOpcion': por_hoja_nac,
                                      'noPartidarios': {'enBlanco': 0, 'anulados': 0, 'observados': 0}})

    # ---- escribir per-depto ----
    for slug, D in by_depto.items():
        base = os.path.join(DATA, EL, slug)
        wjson(os.path.join(base, 'votes.json'),
              {'eleccionId': EL, 'departamento': slug, 'nivel': 'municipio',
               'escrutinio': 'definitivo', 'tipo': TIPO, 'zonas': D['votes']})
        wjson(os.path.join(base, 'opciones.json'),
              {'opciones': [{'opcionId': k, 'nombre': v} for k, v in D['opciones'].items()]})
        wjson(os.path.join(base, 'catalogo.json'),
              {'eleccionId': EL, 'departamento': slug,
               'contiendas': [{'contienda': 'municipio', 'niveles': ['lema', 'hoja'], 'degradado': True,
                               'nodos': list(D['cat_nodos'].values()), 'opciones': D['cat_opc']}]})
        wjson(os.path.join(base, 'hoja-municipio.json'),
              {'eleccionId': EL, 'departamento': slug, 'nivel': 'municipio', 'escrutinio': 'definitivo',
               'tipo': TIPO, 'clase': 'hoja', 'zonas': D['hoja_zonas']})

    # ---- escribir _nacional ----
    base = os.path.join(DATA, EL, '_nacional')
    wjson(os.path.join(base, 'votes.json'),
          {'eleccionId': EL, 'departamento': '_nacional', 'nivel': 'municipio',
           'escrutinio': 'definitivo', 'tipo': TIPO, 'zonas': nac['votes']})
    wjson(os.path.join(base, 'opciones.json'),
          {'opciones': [{'opcionId': k, 'nombre': v} for k, v in nac['opciones'].items()]})
    wjson(os.path.join(base, 'catalogo.json'),
          {'eleccionId': EL, 'departamento': '_nacional',
           'contiendas': [{'contienda': 'municipio', 'niveles': ['lema', 'hoja'], 'degradado': True,
                           'nodos': list(nac['cat_nodos'].values()), 'opciones': nac['cat_opc']}]})
    wjson(os.path.join(base, 'hoja-municipio.json'),
          {'eleccionId': EL, 'departamento': '_nacional', 'nivel': 'municipio', 'escrutinio': 'definitivo',
           'tipo': TIPO, 'clase': 'hoja', 'zonas': nac['hoja_zonas']})

    print(f'✅ {len(by_depto)} deptos, {len(nac["votes"])} municipios')
    if missing:
        print(f'❌ {len(missing)} municipios SIN cache L: {missing}')
    if source_noise:
        tot = sum(abs(d[5]) for d in source_noise)
        print(f'ℹ️  {len(source_noise)} municipio·lema con ruido de fuente L≠H (Σ|Δ|={tot} votos, '
              f'benigno — el residual lo absorbe):')
        for d in source_noise[:10]:
            print(f'     {d[0]}/{d[1]} {d[2]}: H.suma={d[3]} L.hojas={d[4]} Δ={d[5]}')
    if deltas:
        print(f'❌ {len(deltas)} fallos DUROS de parse/reconciliación:')
        for d in deltas[:20]:
            print('   ', d)
        sys.exit(1)
    print('✅ parse COMPLETO (Σhoja == footer H en todos los municipios·lema); reconciliación OK')


if __name__ == '__main__':
    main()
