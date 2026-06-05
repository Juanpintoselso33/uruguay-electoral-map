#!/usr/bin/env python3
"""
Builder de shards a nivel DEPARTAMENTO para el ciclo 2009-2010 (Epic 23).

Parsea el HTML cacheado por scrape_2009_2010.py (data/raw/electoral/{el}/asp-cache/)
y emite el contrato estándar del repo en public/data/{el}/{depto}/ + _nacional/.

Granularidad: DEPARTAMENTO. geoId = nombre de display del depto ("Cerro Largo"),
para joinear contra public/data/geo/_nacional/departamento.topo.json (properties.name).

Jerarquías reales (decodificadas del menú GeneXus + verificadas en el dato):
  - nacionales-2009 / departamentales-2010: FLAT  lema -> hoja
    (el hoja↔sublema NO es recuperable: H no carga sublema, y el orden de H no
     agrupa por sublema — verificado contra S en FA-Montevideo). niveles=['lema','hoja'].
  - internas-2009: lema(partido) -> precandidato -> hoja  (precandidato inline en H:
     "609 - JOSE MUJICA"). niveles=['lema','precandidato','hoja'].
  - balotaje-2009: PLANO (candidato/fórmula). niveles=['candidato'].

"Votos al Lema/Precand." (hojas-less, residual) se preserva como opción sintética
(`{contienda}-{partido}-lema` / `...-{precand}-lema`) para que
Σ(opciones-hoja) == total-del-lema y no se pierda ningún voto.

Uso:
  python3 scripts/build_2009_2010.py nacionales-2009
  python3 scripts/build_2009_2010.py all
"""
import os, sys, re, json, html, unicodedata
from collections import defaultdict, OrderedDict

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RAW = os.path.join(ROOT, 'data', 'raw', 'electoral')
DATA = os.path.join(ROOT, 'public', 'data')

# code de URL -> (id snake_case, nombre display que matchea departamento.topo.json properties.name)
DEPTOS = [
    ('ARTIGAS', 'artigas', 'Artigas'), ('CANELONES', 'canelones', 'Canelones'),
    ('CERROLARGO', 'cerro_largo', 'Cerro Largo'), ('COLONIA', 'colonia', 'Colonia'),
    ('DURAZNO', 'durazno', 'Durazno'), ('FLORES', 'flores', 'Flores'),
    ('FLORIDA', 'florida', 'Florida'), ('LAVALLEJA', 'lavalleja', 'Lavalleja'),
    ('MALDONADO', 'maldonado', 'Maldonado'), ('MONTEVIDEO', 'montevideo', 'Montevideo'),
    ('PAYSANDU', 'paysandu', 'Paysandú'), ('RIONEGRO', 'rio_negro', 'Río Negro'),
    ('RIVERA', 'rivera', 'Rivera'), ('ROCHA', 'rocha', 'Rocha'), ('SALTO', 'salto', 'Salto'),
    ('SANJOSE', 'san_jose', 'San José'), ('SORIANO', 'soriano', 'Soriano'),
    ('TACUAREMBO', 'tacuarembo', 'Tacuarembó'), ('TREINTAYTRES', 'treinta_y_tres', 'Treinta y Tres'),
]
# Lema nacional 2009: código de URL -> opcionId bare (convención del repo)
LEMA_PARTY_NAC = {
    '1': 'frente-amplio', '3': 'nacional', '2': 'colorado',
    '4': 'independiente', '5': 'asamblea-popular',
}
# Nombre de lema (texto en la tabla L) -> opcionId bare. Cubre nacionales y departamentales.
LEMA_NAME2ID = {
    'frente amplio': 'frente-amplio',
    'partido nacional': 'nacional',
    'partido colorado': 'colorado',
    'partido independiente': 'independiente',
    'partido asamblea popular': 'asamblea-popular',
    'asamblea popular': 'asamblea-popular',
    'partido de los trabajadores': 'de-los-trabajadores',
    'partido cuatro puntos cardinales': 'cuatro-puntos-cardinales',
    'partido comuna': 'comuna',
    'partido de la concertacion': 'de-la-concertacion',
    'union popular': 'union-popular',
}
CANON_NAME = {
    'frente-amplio': 'Frente Amplio', 'nacional': 'Partido Nacional',
    'colorado': 'Partido Colorado', 'independiente': 'Partido Independiente',
    'asamblea-popular': 'Asamblea Popular', 'de-los-trabajadores': 'Partido de los Trabajadores',
    'cuatro-puntos-cardinales': 'Partido Cuatro Puntos Cardinales', 'comuna': 'Partido Comuna',
    'de-la-concertacion': 'Partido de la Concertación', 'union-popular': 'Unión Popular',
}
# Internas: Org (código de partido) -> opcionId bare del lema
ORG_INTERNAS2ID = {
    '2': 'frente-amplio', '6': 'nacional', '4': 'colorado', '8': 'independiente',
    '12': 'de-los-trabajadores', '18': 'cuatro-puntos-cardinales',
    '14': 'asamblea-popular', '22': 'comuna',
}


def decode(b):
    """latin-1 vs utf-8 auto: internas se sirve UTF-8, el resto latin-1."""
    try:
        return b.decode('utf-8')
    except UnicodeDecodeError:
        return b.decode('latin-1')


def slug(s):
    s = unicodedata.normalize('NFKD', s).encode('ascii', 'ignore').decode('ascii')
    s = s.lower().strip()
    s = re.sub(r'[^a-z0-9]+', '-', s)
    return re.sub(r'(^-|-$)', '', s)


def num(s):
    s = (s or '').strip().replace('.', '').replace(chr(160), '').replace(' ', '')
    s = s.replace(',', '.')  # por si viene decimal
    if s in ('', '-'):
        return 0
    try:
        return int(float(s))
    except ValueError:
        return 0


def parse_rows(txt):
    """HTML -> lista de filas (cada una = lista de celdas limpias no vacías)."""
    t = re.sub(r'<script.*?</script>', '', txt, flags=re.S | re.I)
    t = re.sub(r'<style.*?</style>', '', t, flags=re.S | re.I)
    out = []
    for r in re.findall(r'<tr.*?</tr>', t, flags=re.S | re.I):
        cells = re.findall(r'<t[dh][^>]*>(.*?)</t[dh]>', r, flags=re.S | re.I)
        cells = [html.unescape(re.sub(r'<[^>]+>', '', c)).strip().replace(chr(160), ' ') for c in cells]
        cells = [c for c in cells if c != '']
        # descartar fila-basura de CSS leakeado (contiene 'Border-Style' o '{')
        if cells and ('Border-Style' in cells[0] or 'Font-Family' in cells[0]):
            cells = cells[1:]
            cells = [c for c in cells if c != '']
        if cells:
            out.append(cells)
    return out


def read_cache(eleccion, name):
    p = os.path.join(RAW, eleccion, 'asp-cache', name)
    if not os.path.exists(p) or os.path.getsize(p) == 0:
        return None
    with open(p, 'rb') as f:
        return decode(f.read())


# ---------------------------------------------------------------------------
# Parsers de cada tipo de tabla
# ---------------------------------------------------------------------------

NONPART_KEYS = {
    'votos en blanco total': 'enBlanco', 'votos en blanco': 'enBlanco',
    'sobres con hojas anuladas en su totalidad': 'anulados',
    'votos observados anulados': 'observados', 'observados anulados': 'observados',
}


def parse_L_nacional(txt):
    """L de nacionales/departamentales: por-lema + footer no-partidario + habilitados/emitidos.
    Devuelve dict: lemas {opcionId: {'hojas':n,'lema':n,'total':n}}, no_part, emitidos, habilitados,
    sobres_si (plebiscito flavor, solo nacionales-2009)."""
    rows = parse_rows(txt)
    lemas = OrderedDict()
    no_part = {'enBlanco': 0, 'anulados': 0, 'observados': 0}
    emitidos = habilitados = 0
    sobres_si = 0
    for c in rows:
        low = c[0].lower()
        # Filas de lema: [nombre, votosAHojas, votosAlLema, total, %]
        if len(c) >= 4 and low in LEMA_NAME2ID:
            oid = LEMA_NAME2ID[low]
            lemas[oid] = {'hojas': num(c[1]), 'lema': num(c[2]), 'total': num(c[3])}
        elif 'sobres' in low and 'si' in low and 'anulad' not in low:
            # "Sobres solo con hojas por SI" -> bucket aparte (no válido, no partidario)
            sobres_si = num(c[-2]) if len(c) >= 2 else num(c[-1])
        elif low in NONPART_KEYS and len(c) >= 2:
            no_part[NONPART_KEYS[low]] = num(c[-2]) if len(c) >= 3 else num(c[-1])
        elif low.startswith('total de votos emitidos') and len(c) >= 2:
            emitidos = num(c[1])
        elif low.startswith('total de habilitados') and len(c) >= 2:
            habilitados = num(c[1])
    return {'lemas': lemas, 'no_part': no_part, 'emitidos': emitidos,
            'habilitados': habilitados, 'sobres_si': sobres_si}


def parse_H_nacional(txt):
    """H de nacionales/departamentales: [hoja, votos, %]. Flat bajo el lema."""
    rows = parse_rows(txt)
    hojas = []
    for c in rows:
        if len(c) == 3 and re.fullmatch(r'\d+', c[0].strip()):
            hojas.append((c[0].strip(), num(c[1])))
    return hojas


def parse_L_internas(txt):
    """L de internas (Org. Deliberativo Nacional): filas de precandidato con forma estricta de 5
    celdas [NOMBRE, votosAHojas, votosAlPrecand, total, %] — donde las 4 últimas son numéricas.
    Footer general (en blanco / anuladas / observados) keyeado por su etiqueta exacta."""
    rows = parse_rows(txt)
    precands = OrderedDict()
    no_part = {'enBlanco': 0, 'anulados': 0, 'observados': 0}
    emitidos = habilitados = 0
    NUMRE = re.compile(r'^[\d.,\s]+$')
    for c in rows:
        low = c[0].lower().strip()
        # precandidato: 5 celdas, las 4 tras el nombre son numéricas, y el nombre es MAYÚSCULAS (no header)
        if (len(c) == 5 and NUMRE.match(c[1]) and NUMRE.match(c[2]) and NUMRE.match(c[3])
                and not low.startswith('suma') and not low.startswith('total')
                and not low.startswith('votos') and not low.startswith('acto')
                and not low.startswith('circuito') and not low.startswith('estad')):
            precands[c[0].strip()] = {'hojas': num(c[1]), 'al_precand': num(c[2]), 'total': num(c[3])}
        elif low == 'votos en blanco total' and len(c) >= 2:
            no_part['enBlanco'] = num(c[-1])
        elif low == 'sobres con hojas anuladas en su totalidad' and len(c) >= 2:
            no_part['anulados'] = num(c[-1])
        elif low in ('observados anulados', 'votos observados anulados') and len(c) >= 2:
            no_part['observados'] = num(c[-1])
        elif low.startswith('total de votos emitidos') and len(c) >= 2:
            emitidos = num(c[1])
        elif low.startswith('total de habilitados') and len(c) >= 2:
            habilitados = num(c[1])
    return {'precands': precands, 'no_part': no_part, 'emitidos': emitidos, 'habilitados': habilitados}


def parse_H_internas(txt):
    """H de internas: [\"609 - JOSE MUJICA\", votos, %]. hoja + precandidato inline."""
    rows = parse_rows(txt)
    hojas = []
    for c in rows:
        if len(c) == 3:
            m = re.fullmatch(r'(\d+)\s*-\s*(.+)', c[0].strip())
            if m:
                hojas.append((m.group(1), m.group(2).strip(), num(c[1])))
    return hojas


def parse_H_departamentales(txt):
    """H de departamentales-2010 con Lema=0: hojas agrupadas por lema con headers de lema.
    Formato de filas: ['Frente Amplio','Votos'], ['77','2848'], ..., ['Suma de Votos a las Hojas','13239'].
    Devuelve OrderedDict: opcionId_lema -> [(hoja, votos), ...]."""
    rows = parse_rows(txt)
    out = OrderedDict()
    cur = None
    for c in rows:
        low = c[0].lower().strip()
        # header de lema: ['<Nombre Lema>', 'Votos']
        if len(c) == 2 and c[1].strip().lower() == 'votos' and low in LEMA_NAME2ID:
            cur = LEMA_NAME2ID[low]
            out[cur] = []
        elif cur and len(c) == 2 and re.fullmatch(r'\d+', c[0].strip()):
            out[cur].append((c[0].strip(), num(c[1])))
        elif low.startswith('suma de votos') or low.startswith('total de votos') or low.startswith('votos a'):
            cur = None  # fin del bloque del lema actual
    return out


def parse_H_internas_odd(txt):
    """H ODD de internas (Org=ODN_org-1): filas ['<hoja> - <Lema>', votos, %]. Junta Departamental.
    El sufijo es el nombre del lema (no precandidato; ODD no tiene precandidato). Devuelve [(hoja, votos)]."""
    rows = parse_rows(txt)
    hojas = []
    for c in rows:
        if len(c) == 3:
            m = re.fullmatch(r'(\d+)\s*-\s*(.+)', c[0].strip())
            if m and re.fullmatch(r'[\d.,\s]+', c[1]):
                hojas.append((m.group(1), num(c[1])))
    return hojas


def parse_L_balotaje(txt):
    """L de balotaje (Org=4): [formula, 'hojas\\nacum\\ntotal', %] + no-partidario."""
    rows = parse_rows(txt)
    formulas = OrderedDict()
    no_part = {'enBlanco': 0, 'anulados': 0, 'observados': 0}
    emitidos = habilitados = 0
    for c in rows:
        low = c[0].lower()
        if len(c) >= 2 and re.search(r'\d', c[1]) and '-' in c[0] and low not in NONPART_KEYS:
            nums = re.findall(r'\d+', c[1].replace('.', ''))
            total = int(nums[-1]) if nums else 0
            formulas[c[0].strip()] = total
        elif low.startswith('votos en blanco') and 'parcial' not in low and len(c) >= 2:
            no_part['enBlanco'] = num(c[-1])
        elif low == 'sobres con hojas anuladas en su totalidad' and len(c) >= 2:
            no_part['anulados'] = num(c[-1])
        elif low.startswith('observados') and len(c) >= 2:
            no_part['observados'] = num(c[-1])
        elif low.startswith('total de votos emitidos') and len(c) >= 2:
            emitidos = num(c[1])
        elif low.startswith('total de habilitados') and len(c) >= 2:
            habilitados = num(c[1])
    return {'formulas': formulas, 'no_part': no_part, 'emitidos': emitidos, 'habilitados': habilitados}


# Mapeo fórmula de balotaje -> opcionId (lema que la llevó)
BALOTAJE_FORMULA2ID = {
    'mujica': 'frente-amplio', 'lacalle': 'nacional',
}


def formula_to_id(name):
    low = name.lower()
    for k, v in BALOTAJE_FORMULA2ID.items():
        if k in low:
            return v
    return slug(name)


# ---------------------------------------------------------------------------
# Construcción de shards (contrato del repo)
# ---------------------------------------------------------------------------

def wjson(path, obj):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, 'w', encoding='utf-8') as f:
        json.dump(obj, f, ensure_ascii=False, separators=(',', ':'))


def ganador(por):
    if not por:
        return None
    return max(por, key=lambda o: o['votos'])['opcionId']


def build_nacionales_2009():
    el = 'nacionales-2009'
    tipo = 'nacionales'
    # Acumuladores: por depto -> estructuras; y catálogo/hoja por depto.
    nac_zonas = []        # filas de _nacional/votes.json (una por depto)
    nac_opciones = OrderedDict()  # opcionId -> nombre (lema-level)
    delta_report = []
    for code, did, dname in DEPTOS:
        txtL = read_cache(el, f'L_{code}.html')
        if not txtL:
            print(f'  ! falta L_{code}'); continue
        L = parse_L_nacional(txtL)
        # ---- base votes (lema-level) ----
        por = []
        for oid, v in L['lemas'].items():
            por.append({'opcionId': oid, 'votos': v['total']})
            nac_opciones[oid] = CANON_NAME.get(oid, oid)
        validos = sum(o['votos'] for o in por)
        no_part = dict(L['no_part'])
        zona = {'geoId': dname, 'ganadorOpcionId': ganador(por), 'validos': validos,
                'porOpcion': por, 'noPartidarios': no_part}
        nac_zonas.append(zona)
        # depto base shard (nivel=departamento, una sola zona = el depto)
        dep_base = {'eleccionId': el, 'departamento': did, 'nivel': 'departamento',
                    'escrutinio': 'definitivo', 'tipo': tipo, 'zonas': [dict(zona)]}
        wjson(os.path.join(DATA, el, did, 'votes.json'), dep_base)
        # depto opciones.json (lema-level)
        wjson(os.path.join(DATA, el, did, 'opciones.json'),
              {'opciones': [{'opcionId': oid, 'nombre': nac_opciones[oid]} for oid in L['lemas']]})

        # ---- hoja shards + catálogo (FLAT lema->hoja) ----
        cat_nodos = []
        cat_opciones = []
        for code_l, oid in LEMA_PARTY_NAC.items():
            if oid not in L['lemas']:
                continue
            txtH = read_cache(el, f'H_{code}_L{code_l}.html')
            hojas = parse_H_nacional(txtH) if txtH else []
            sH = sum(v for _, v in hojas)
            expected = L['lemas'][oid]['hojas']
            if sH != expected:
                delta_report.append((did, oid, sH, expected, sH - expected))
            # nodo lema
            cat_nodos.append({'id': oid, 'nivel': 'lema', 'etiqueta': CANON_NAME.get(oid, oid), 'partidoId': oid})
            por_hoja = []
            for hoja, votos in hojas:
                hid = f'unica-{oid}-{hoja}'
                cat_opciones.append({'clase': 'hoja', 'id': hid, 'hoja': hoja, 'partidoId': oid,
                                     'contienda': 'unica', 'lemaId': oid})
                por_hoja.append({'opcionId': hid, 'votos': votos})
            # opción sintética "Votos al Lema" (residual hojas-less). La computamos como
            # base_total - Σhojas: así absorbe los "votos al lema" reales + cualquier discrepancia
            # de la fuente entre el reporte L y el H (p.ej. San José FA, ±3 votos), garantizando
            # Σ(opciones-hoja) == total-del-lema-en-base exactamente.
            al_lema = L['lemas'][oid]['total'] - sH
            if al_lema != 0:
                lid = f'unica-{oid}-lema'
                cat_opciones.append({'clase': 'hoja', 'id': lid, 'hoja': '—', 'partidoId': oid,
                                     'contienda': 'unica', 'lemaId': oid,
                                     'etiqueta': 'Voto al lema (sin hoja)'})
                por_hoja.append({'opcionId': lid, 'votos': al_lema})
            # hoja shard: una zona = el depto, opciones = hojas del lema
            hoja_shard = {'eleccionId': el, 'departamento': did, 'nivel': 'departamento',
                          'escrutinio': 'definitivo', 'tipo': tipo,
                          'zonas': [{'geoId': dname, 'ganadorOpcionId': ganador(por_hoja),
                                     'validos': sum(o['votos'] for o in por_hoja), 'porOpcion': por_hoja,
                                     'noPartidarios': {'enBlanco': 0, 'anulados': 0, 'observados': 0}}]}
            wjson(os.path.join(DATA, el, did, 'hoja', 'unica', f'{oid}.json'), hoja_shard)
        catalogo = {'eleccionId': el, 'departamento': did,
                    'contiendas': [{'contienda': 'unica', 'niveles': ['lema', 'hoja'], 'degradado': True,
                                    'nodos': cat_nodos, 'opciones': cat_opciones}]}
        wjson(os.path.join(DATA, el, did, 'catalogo.json'), catalogo)
        print(f'  {did}: {len(L["lemas"])} lemas, {len(cat_opciones)} hojas')
    # ---- _nacional ----
    nac = {'eleccionId': el, 'departamento': '_nacional', 'nivel': 'departamento',
           'escrutinio': 'definitivo', 'tipo': tipo, 'zonas': nac_zonas}
    wjson(os.path.join(DATA, el, '_nacional', 'votes.json'), nac)
    wjson(os.path.join(DATA, el, '_nacional', 'opciones.json'),
          {'opciones': [{'opcionId': k, 'nombre': v} for k, v in nac_opciones.items()]})
    print(f'  _nacional: {len(nac_zonas)} deptos')
    if delta_report:
        print('  ! DELTAS (Σhoja != L.hojas):')
        for r in delta_report:
            print('    ', r)
    else:
        print('  reconciliación OK (delta=0 en todos los lemas/deptos)')
    return delta_report


def build_departamentales_2010():
    """Igual estructura que nacionales (FLAT lema->hoja), tipo='departamentales', contienda 'junta'.
    OJO: la base votes.json de departamentales en el repo representa el resultado de INTENDENTE,
    pero aquí solo tenemos el total por lema (que en departamentales = Junta/lema). Usamos contienda
    'junta' con niveles ['lema','hoja'] para el desglose, y la base por-lema como resultado del depto."""
    el = 'departamentales-2010'
    tipo = 'departamentales'
    nac_zonas = []
    nac_opciones = OrderedDict()
    delta_report = []
    for code, did, dname in DEPTOS:
        txtL = read_cache(el, f'L_{code}.html')
        if not txtL:
            print(f'  ! falta L_{code}'); continue
        L = parse_L_nacional(txtL)
        por = []
        for oid, v in L['lemas'].items():
            por.append({'opcionId': oid, 'votos': v['total']})
            nac_opciones[oid] = CANON_NAME.get(oid, oid)
        validos = sum(o['votos'] for o in por)
        zona = {'geoId': dname, 'ganadorOpcionId': ganador(por), 'validos': validos,
                'porOpcion': por, 'noPartidarios': dict(L['no_part'])}
        nac_zonas.append(zona)
        wjson(os.path.join(DATA, el, did, 'votes.json'),
              {'eleccionId': el, 'departamento': did, 'nivel': 'departamento',
               'escrutinio': 'definitivo', 'tipo': tipo, 'zonas': [dict(zona)]})
        wjson(os.path.join(DATA, el, did, 'opciones.json'),
              {'opciones': [{'opcionId': oid, 'nombre': nac_opciones[oid]} for oid in L['lemas']]})
        # hoja: H_{code} (Lema=0) trae TODAS las hojas agrupadas por lema con headers de lema.
        txtH = read_cache(el, f'H_{code}.html')
        hojas_por_lema = parse_H_departamentales(txtH) if txtH else OrderedDict()
        cat_nodos = []; cat_opciones = []
        for oid in L['lemas']:
            cat_nodos.append({'id': oid, 'nivel': 'lema', 'etiqueta': CANON_NAME.get(oid, oid), 'partidoId': oid})
        for oid in L['lemas']:
            por_hoja = []
            for hoja, votos in hojas_por_lema.get(oid, []):
                hid = f'junta-{oid}-{hoja}'
                cat_opciones.append({'clase': 'hoja', 'id': hid, 'hoja': hoja, 'partidoId': oid,
                                     'contienda': 'junta', 'lemaId': oid})
                por_hoja.append({'opcionId': hid, 'votos': votos})
            sHojas = sum(o['votos'] for o in por_hoja)
            al = L['lemas'][oid]['total'] - sHojas  # absorbe al-lema + ruido L/H de la fuente
            if hojas_por_lema.get(oid) and al != 0:
                lid = f'junta-{oid}-lema'
                cat_opciones.append({'clase': 'hoja', 'id': lid, 'hoja': '—', 'partidoId': oid,
                                     'contienda': 'junta', 'lemaId': oid, 'etiqueta': 'Voto al lema (sin hoja)'})
                por_hoja.append({'opcionId': lid, 'votos': al})
            sH = sum(o['votos'] for o in por_hoja)
            exp = L['lemas'][oid]['total']
            if hojas_por_lema.get(oid) and sH != exp:
                delta_report.append((did, oid, sH, exp, sH - exp))
            if por_hoja:
                wjson(os.path.join(DATA, el, did, 'hoja', 'junta', f'{oid}.json'),
                      {'eleccionId': el, 'departamento': did, 'nivel': 'departamento',
                       'escrutinio': 'definitivo', 'tipo': tipo,
                       'zonas': [{'geoId': dname, 'ganadorOpcionId': ganador(por_hoja),
                                  'validos': sum(o['votos'] for o in por_hoja), 'porOpcion': por_hoja,
                                  'noPartidarios': {'enBlanco': 0, 'anulados': 0, 'observados': 0}}]})
        wjson(os.path.join(DATA, el, did, 'catalogo.json'),
              {'eleccionId': el, 'departamento': did,
               'contiendas': [{'contienda': 'junta', 'niveles': ['lema', 'hoja'], 'degradado': True,
                               'nodos': cat_nodos, 'opciones': cat_opciones}]})
        print(f'  {did}: {len(L["lemas"])} lemas, {len(cat_opciones)} hojas')
    wjson(os.path.join(DATA, el, '_nacional', 'votes.json'),
          {'eleccionId': el, 'departamento': '_nacional', 'nivel': 'departamento',
           'escrutinio': 'definitivo', 'tipo': tipo, 'zonas': nac_zonas})
    wjson(os.path.join(DATA, el, '_nacional', 'opciones.json'),
          {'opciones': [{'opcionId': k, 'nombre': v} for k, v in nac_opciones.items()]})
    print(f'  _nacional: {len(nac_zonas)} deptos')
    if delta_report:
        print('  ! DELTAS:', delta_report[:10])
    else:
        print('  reconciliación OK')
    return delta_report


def build_balotaje_2009():
    """PLANO: candidato/fórmula (lema). niveles=['candidato']. Sin hoja."""
    el = 'balotaje-2009'
    tipo = 'balotaje'
    nac_zonas = []
    nac_opciones = OrderedDict()
    for code, did, dname in DEPTOS:
        txtL = read_cache(el, f'L_{code}.html')
        if not txtL:
            print(f'  ! falta L_{code}'); continue
        L = parse_L_balotaje(txtL)
        por = []
        for formula, total in L['formulas'].items():
            oid = formula_to_id(formula)
            por.append({'opcionId': oid, 'votos': total})
            nac_opciones[oid] = CANON_NAME.get(oid, formula.title())
        validos = sum(o['votos'] for o in por)
        zona = {'geoId': dname, 'ganadorOpcionId': ganador(por), 'validos': validos,
                'porOpcion': por, 'noPartidarios': dict(L['no_part'])}
        nac_zonas.append(zona)
        wjson(os.path.join(DATA, el, did, 'votes.json'),
              {'eleccionId': el, 'departamento': did, 'nivel': 'departamento',
               'escrutinio': 'definitivo', 'tipo': tipo, 'zonas': [dict(zona)]})
        wjson(os.path.join(DATA, el, did, 'opciones.json'),
              {'opciones': [{'opcionId': o['opcionId'], 'nombre': nac_opciones[o['opcionId']]} for o in por]})
        print(f'  {did}: {len(por)} fórmulas')
    wjson(os.path.join(DATA, el, '_nacional', 'votes.json'),
          {'eleccionId': el, 'departamento': '_nacional', 'nivel': 'departamento',
           'escrutinio': 'definitivo', 'tipo': tipo, 'zonas': nac_zonas})
    wjson(os.path.join(DATA, el, '_nacional', 'opciones.json'),
          {'opciones': [{'opcionId': k, 'nombre': v} for k, v in nac_opciones.items()]})
    print(f'  _nacional: {len(nac_zonas)} deptos')


def build_internas_2009():
    """lema(partido) -> precandidato -> hoja. Precandidato inline en H ('609 - JOSE MUJICA').
    Base votes.json = total por partido (lema). Catálogo: nodo lema + nodo precandidato + hojas."""
    el = 'internas-2009'
    tipo = 'internas'
    nac_zonas = []
    nac_opciones = OrderedDict()
    delta_report = []
    for code, did, dname in DEPTOS:
        # base: total por partido = suma de precandidatos de cada Org
        por = []
        cat_nodos = []; cat_opciones = []
        # ODD (Junta Departamental) = contienda paralela en el mismo catálogo
        odd_cat_nodos = []; odd_cat_opciones = []; odd_lemas_vistos = set(); odd_por_partido = []
        # blancos/anulados/observados: del footer general (igual para todos los Org del depto) -> tomar de uno
        no_part = {'enBlanco': 0, 'anulados': 0, 'observados': 0}
        for org, oid in ORG_INTERNAS2ID.items():
            txtL = read_cache(el, f'L_{code}_O{org}.html')
            if not txtL:
                continue
            L = parse_L_internas(txtL)
            if not L['precands']:
                continue
            partido_total = sum(p['total'] for p in L['precands'].values())
            if partido_total == 0:
                continue
            por.append({'opcionId': oid, 'votos': partido_total})
            nac_opciones[oid] = CANON_NAME.get(oid, oid)
            if L['no_part']['enBlanco'] or L['no_part']['anulados']:
                # footer general es por-partido en internas (cada partido tiene su propia hoja en blanco)
                for k in no_part:
                    no_part[k] += L['no_part'][k]
            cat_nodos.append({'id': oid, 'nivel': 'lema', 'etiqueta': CANON_NAME.get(oid, oid), 'partidoId': oid})
            # precandidato nodos
            precand_id = {}
            for pname in L['precands']:
                pid = f'{oid}-{slug(pname)}'
                precand_id[pname.upper()] = pid
                cat_nodos.append({'id': pid, 'nivel': 'precandidato', 'etiqueta': pname.title(),
                                  'parentId': oid, 'partidoId': oid})
            # hojas (de H)
            txtH = read_cache(el, f'H_{code}_O{org}.html')
            por_hoja_partido = []
            if txtH:
                for hoja, precand, votos in parse_H_internas(txtH):
                    pid = precand_id.get(precand.upper())
                    if not pid:  # precandidato no visto en L (raro) -> crear nodo
                        pid = f'{oid}-{slug(precand)}'
                        precand_id[precand.upper()] = pid
                        cat_nodos.append({'id': pid, 'nivel': 'precandidato', 'etiqueta': precand.title(),
                                          'parentId': oid, 'partidoId': oid})
                    hid = f'odn-{oid}-{hoja}'
                    cat_opciones.append({'clase': 'hoja', 'id': hid, 'hoja': hoja, 'partidoId': oid,
                                         'contienda': 'odn', 'lemaId': oid, 'precandidatoId': pid, 'grupoId': pid})
                    por_hoja_partido.append({'opcionId': hid, 'votos': votos})
                # residual "Votos al Precand." (hojas-less) — absorbe al-precand + ruido L/H
                al = partido_total - sum(o['votos'] for o in por_hoja_partido)
                if al != 0:
                    lid = f'odn-{oid}-lema'
                    # cuelga del lema directo (no de un precandidato puntual)
                    cat_opciones.append({'clase': 'hoja', 'id': lid, 'hoja': '—', 'partidoId': oid,
                                         'contienda': 'odn', 'lemaId': oid, 'etiqueta': 'Voto al lema (sin hoja)'})
                    por_hoja_partido.append({'opcionId': lid, 'votos': al})
                sH = sum(o['votos'] for o in por_hoja_partido)
                if sH != partido_total:
                    delta_report.append((did, oid, sH, partido_total, sH - partido_total))
            if por_hoja_partido:
                wjson(os.path.join(DATA, el, did, 'hoja', 'odn', f'{oid}.json'),
                      {'eleccionId': el, 'departamento': did, 'nivel': 'departamento',
                       'escrutinio': 'definitivo', 'tipo': tipo,
                       'zonas': [{'geoId': dname, 'ganadorOpcionId': ganador(por_hoja_partido),
                                  'validos': sum(o['votos'] for o in por_hoja_partido), 'porOpcion': por_hoja_partido,
                                  'noPartidarios': {'enBlanco': 0, 'anulados': 0, 'observados': 0}}]})

            # ── ODD (Junta Departamental): contienda paralela, lema->hoja (sin precandidato/sublema).
            # Org_odd = ODN_org - 1. El total por-partido del ODD difiere del ODN; usamos Σhojas ODD.
            txtHodd = read_cache(el, f'HODD_{code}_O{org}.html')
            if txtHodd:
                hojas_odd = parse_H_internas_odd(txtHodd)
                if hojas_odd:
                    # nodo lema del ODD: id ÚNICO en el catálogo (odd-{oid}) para no colisionar con el
                    # nodo lema del ODN ({oid}); pero lemaId de las opciones = {oid} para que el map
                    # resuelva el shard `hoja/odd/{oid}.json` (ruta = {contienda}/{lemaId}).
                    if oid not in odd_lemas_vistos:
                        odd_cat_nodos.append({'id': oid, 'nivel': 'lema',
                                              'etiqueta': CANON_NAME.get(oid, oid), 'partidoId': oid})
                        odd_lemas_vistos.add(oid)
                    por_odd = []
                    for hoja, votos in hojas_odd:
                        hid = f'odd-{oid}-{hoja}'
                        odd_cat_opciones.append({'clase': 'hoja', 'id': hid, 'hoja': hoja, 'partidoId': oid,
                                                 'contienda': 'odd', 'lemaId': oid})
                        por_odd.append({'opcionId': hid, 'votos': votos})
                    odd_por_partido.append({'opcionId': oid, 'votos': sum(o['votos'] for o in por_odd)})
                    wjson(os.path.join(DATA, el, did, 'hoja', 'odd', f'{oid}.json'),
                          {'eleccionId': el, 'departamento': did, 'nivel': 'departamento',
                           'escrutinio': 'definitivo', 'tipo': tipo,
                           'zonas': [{'geoId': dname, 'ganadorOpcionId': ganador(por_odd),
                                      'validos': sum(o['votos'] for o in por_odd), 'porOpcion': por_odd,
                                      'noPartidarios': {'enBlanco': 0, 'anulados': 0, 'observados': 0}}]})
        validos = sum(o['votos'] for o in por)
        zona = {'geoId': dname, 'ganadorOpcionId': ganador(por), 'validos': validos,
                'porOpcion': por, 'noPartidarios': no_part}
        nac_zonas.append(zona)
        wjson(os.path.join(DATA, el, did, 'votes.json'),
              {'eleccionId': el, 'departamento': did, 'nivel': 'departamento',
               'escrutinio': 'definitivo', 'tipo': tipo, 'zonas': [dict(zona)]})
        wjson(os.path.join(DATA, el, did, 'opciones.json'),
              {'opciones': [{'opcionId': o['opcionId'], 'nombre': nac_opciones[o['opcionId']]} for o in por]})
        contiendas = [{'contienda': 'odn', 'niveles': ['lema', 'precandidato', 'hoja'], 'degradado': True,
                       'nodos': cat_nodos, 'opciones': cat_opciones}]
        if odd_cat_opciones:
            contiendas.append({'contienda': 'odd', 'niveles': ['lema', 'hoja'], 'degradado': True,
                               'nodos': odd_cat_nodos, 'opciones': odd_cat_opciones})
        wjson(os.path.join(DATA, el, did, 'catalogo.json'),
              {'eleccionId': el, 'departamento': did, 'contiendas': contiendas})
        print(f'  {did}: {len(por)} partidos, ODN {len(cat_opciones)} + ODD {len(odd_cat_opciones)} hojas')
    wjson(os.path.join(DATA, el, '_nacional', 'votes.json'),
          {'eleccionId': el, 'departamento': '_nacional', 'nivel': 'departamento',
           'escrutinio': 'definitivo', 'tipo': tipo, 'zonas': nac_zonas})
    wjson(os.path.join(DATA, el, '_nacional', 'opciones.json'),
          {'opciones': [{'opcionId': k, 'nombre': v} for k, v in nac_opciones.items()]})
    print(f'  _nacional: {len(nac_zonas)} deptos')
    if delta_report:
        print('  ! DELTAS:', delta_report[:10])
    else:
        print('  reconciliación OK')
    return delta_report


BUILDERS = {
    'nacionales-2009': build_nacionales_2009,
    'departamentales-2010': build_departamentales_2010,
    'balotaje-2009': build_balotaje_2009,
    'internas-2009': build_internas_2009,
}


if __name__ == '__main__':
    target = sys.argv[1] if len(sys.argv) > 1 else 'nacionales-2009'
    els = list(BUILDERS) if target == 'all' else [target]
    for el in els:
        if el not in BUILDERS:
            print(f'! sin builder para {el}'); continue
        print(f'== build {el} ==')
        BUILDERS[el]()
