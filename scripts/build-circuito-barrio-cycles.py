#!/usr/bin/env python3
"""
Genera un mapeo CRV→barrio POR CICLO ELECTORAL para Montevideo y valida la salida.

Motivo (ver docs/AUDIT-carrasco-2014-circuito-barrio.md): los números de CRV se reasignan
entre elecciones, pero el pipeline reutilizaba UN solo mapeo (clavado a la numeración 2024)
para todas. Resultado: ~60-85% de los circuitos mal-joineados a barrio en los ciclos no-2024
(ej. "Carrasco 2014 FA 66.5%" falso). Aquí construimos un mapeo por ciclo desde el
plan-circuital de ese ciclo, con el mismo método de geolocalización + un tier 'coarse' extra.

Método (de más a menos preciso):
  1) dir    — street-key exacta del plan → coords del georef-2024 → point-in-polygon (PIP).
  2) coarse — calle sin número; solo si esa coarse-key mapea a UN único barrio en el georef
              (conservador). Sube cobertura por dirección ~56%→66%, sin regresión de correlación.
  3) serie  — fallback: barrio dominante de la serie (≈63% de acierto; el eslabón débil).
El tier 'range' (serie+credencial) se evaluó y se DESCARTÓ (baja la correlación: los rangos de
credenciales se reparten entre elecciones).

NO toca el ciclo 2024 (montevideo-circuito-barrio.json queda congelado = known-good).
Salida: data/mappings/montevideo-circuito-barrio.<cycle>.json  ({"crvToBarrio": {...}})

Uso: python scripts/build-circuito-barrio-cycles.py
"""
import csv, json, unicodedata, re, sys
from collections import defaultdict

ROOT = '.'
GEOREF = 'data/raw/geographic/plan-circuital-georreferencia-nacional-2024.csv'
BARRIOS = 'public/v_sig_barrios.json'

# ---------- normalización ----------
def norm(s):
    s = unicodedata.normalize('NFD', s or ''); s = ''.join(c for c in s if unicodedata.category(c) != 'Mn')
    return re.sub(r'\s+', ' ', re.sub(r'[^A-Za-z0-9]+', ' ', s).upper()).strip()
def street_key(local):
    parts = (local or '').split('-'); return norm(parts[-1] if len(parts) > 1 else local)
STOP = {'ESQ','ESQUINA','S','N','BIS','AV','AVDA','AVENIDA','CALLE','DR','GRAL','CNO','CAMINO'}
def coarse_key(local):
    toks = [t for t in street_key(local).split() if not t.isdigit() and t not in STOP]
    return ' '.join(sorted(set(toks)))
def street_tokens(local):
    # tokens de nombre de calle (≥4 chars) — para match por token (resuelve el desajuste de esquina:
    # una fuente lista calle+esquina, otra solo la calle principal).
    return [t for t in street_key(local).split() if not t.isdigit() and t not in STOP and len(t) >= 4]
def to_num(s):
    try: return float(re.sub(r'["\s]', '', str(s)))
    except: return float('nan')

# ---------- point-in-polygon ----------
_bar = json.load(open(BARRIOS, encoding='utf-8'))
BARRIO_GEOMS = [(str(f['properties']['BARRIO']), f['geometry']) for f in _bar['features']]
def _in_ring(x, y, r):
    ins = False; n = len(r); j = n - 1
    for i in range(n):
        xi, yi = r[i][0], r[i][1]; xj, yj = r[j][0], r[j][1]
        if ((yi > y) != (yj > y)) and x < (xj - xi) * (y - yi) / (yj - yi) + xi: ins = not ins
        j = i
    return ins
def _in_feat(x, y, g):
    for poly in ([g['coordinates']] if g['type'] == 'Polygon' else g['coordinates']):
        if _in_ring(x, y, poly[0]) and not any(_in_ring(x, y, poly[h]) for h in range(1, len(poly))): return True
    return False
def pip(lon, lat):
    for n, g in BARRIO_GEOMS:
        if _in_feat(lon, lat, g): return n
    return None

# ---------- índices del georef 2024 ----------
def build_georef_indices():
    street_coord = {}; coarse_barrios = defaultdict(set); serie_tally = defaultdict(lambda: defaultdict(int))
    tok_barrios = defaultdict(lambda: defaultdict(int))
    with open(GEOREF, encoding='utf-8') as f:
        h = f.readline().lstrip('﻿').rstrip('\n').split(';')
        iD, iDir, iLa, iLo, iS = (h.index(x) for x in ['Departamento', 'direccion', 'Latitud', 'Longitud', 'Serie'])
        for line in f:
            c = line.rstrip('\n').split(';')
            if len(c) <= iLo or c[iD] != 'Montevideo': continue
            lat, lon = to_num(c[iLa]), to_num(c[iLo])
            if lat != lat or lon != lon: continue
            b = pip(lon, lat)
            sk = street_key(c[iDir])
            if sk and sk not in street_coord: street_coord[sk] = (lon, lat)
            ck = coarse_key(c[iDir])
            if ck and b: coarse_barrios[ck].add(b)
            if b:
                serie_tally[c[iS].strip()][b] += 1
                for t in set(street_tokens(c[iDir])): tok_barrios[t][b] += 1
    serie_barrio = {s: max(t.items(), key=lambda kv: kv[1])[0] for s, t in serie_tally.items()}
    coarse_unique = {k: next(iter(v)) for k, v in coarse_barrios.items() if len(v) == 1}
    return street_coord, coarse_unique, serie_barrio, tok_barrios

def tok_barrio(addr, tok_barrios):
    """Asigna por voto de tokens de calle: barrio dominante si ≥60% del peso y ≥2 de margen."""
    score = defaultdict(int)
    for t in set(street_tokens(addr)):
        for b, n in tok_barrios.get(t, {}).items(): score[b] += n
    if not score: return None
    ranked = sorted(score.items(), key=lambda kv: -kv[1]); total = sum(score.values()); top = ranked[0]
    if top[1] / total >= 0.6 and (len(ranked) == 1 or top[1] - ranked[1][1] >= 2): return top[0]
    return None

STREET_COORD, COARSE_UNIQUE, SERIE_BARRIO, TOK_BARRIOS = build_georef_indices()

# Cache de geocodificación (street_key → barrio|null), generado por scripts/geocode-missing-barrios.py
# para direcciones de ciclos viejos ausentes del georef-2024. Coordenada real → PIP. Opcional.
import os as _os
GEO_CACHE = json.load(open('data/mappings/montevideo-geocode-cache.json', encoding='utf-8')) if _os.path.exists('data/mappings/montevideo-geocode-cache.json') else {}

# ---------- construcción del mapeo de un ciclo ----------
def build_mapping(plan_path, addr_col):
    c2b = {}; stats = defaultdict(int)
    with open(plan_path, encoding='utf-8', errors='replace') as f:
        rd = csv.DictReader(f)
        # tolera nombres con espacios ('Local ')
        cols = {c.strip(): c for c in rd.fieldnames}
        ac = cols[addr_col]; cc = cols['NroCircuito']; sc = cols['Serie']; dc = cols['Departamento']
        for r in rd:
            if r[dc].strip() not in ('MO', 'MONTEVIDEO'): continue
            crv = r[cc].strip(); addr = r[ac]; serie = r[sc].strip()
            co = STREET_COORD.get(street_key(addr))
            if co:
                b = pip(*co)
                if b: c2b[crv] = b; stats['dir'] += 1; continue
            gb = GEO_CACHE.get(street_key(addr))  # coord geocodificada → barrio (real, > heurísticos)
            if gb: c2b[crv] = gb; stats['geo'] += 1; continue
            cb = COARSE_UNIQUE.get(coarse_key(addr))
            if cb: c2b[crv] = cb; stats['coarse'] += 1; continue
            tb = tok_barrio(addr, TOK_BARRIOS)
            if tb: c2b[crv] = tb; stats['tok'] += 1; continue
            if serie in SERIE_BARRIO: c2b[crv] = SERIE_BARRIO[serie]; stats['serie'] += 1; continue
            stats['unmapped'] += 1
    return c2b, stats

def build_mapping_georef_direct():
    """Ciclo 2024: el georef ES de nacionales-2024, así que mapea CRV→coords→PIP directo (sin texto).
    Es el mapeo más preciso posible. internas/nacionales/balotaje/plebiscitos-2024 comparten esta
    numeración (99% de cobertura verificada)."""
    c2b = {}; stats = defaultdict(int)
    with open(GEOREF, encoding='utf-8') as f:
        h = f.readline().lstrip('﻿').rstrip('\n').split(';')
        iD, iC, iLa, iLo = (h.index(x) for x in ['Departamento', 'NroCircuito', 'Latitud', 'Longitud'])
        for line in f:
            c = line.rstrip('\n').split(';')
            if len(c) <= iLo or c[iD] != 'Montevideo': continue
            lat, lon = to_num(c[iLa]), to_num(c[iLo])
            if lat != lat or lon != lon: continue
            b = pip(lon, lat)
            if b: c2b[c[iC].strip()] = b; stats['dir'] += 1
            else: stats['unmapped'] += 1
    return c2b, stats

# ---------- ciclos ----------
CYCLES = [
    {'cycle': '2014', 'plan': 'data/raw/electoral/nacionales-2014/plan-circuital.csv', 'addr': 'Direccion'},
    # internas-2014: PLAN CIRCUITAL recuperado de Wayback (solo MVD+CA+MA archivados). Los CRV se
    # renumeran vs nacionales-2014 (0% match exacto de rango) → mapeo PROPIO obligatorio, no reuso.
    {'cycle': 'internas-2014', 'plan': 'data/raw/electoral/internas-2014/plan-circuital.csv', 'addr': 'Direccion'},
    {'cycle': 'internas-2019', 'plan': 'data/raw/electoral/internas-2019/plan-circuital.csv', 'addr': 'Direccion'},
    {'cycle': '2019', 'plan': 'data/raw/electoral/nacionales-2019-full/plan-circuital.csv', 'addr': 'Direccion'},
    # 2015 (departamentales/municipales): PLAN CIRCUITAL recuperado de Wayback (6 letras; MVD=A+B).
    # CRV renumerados vs otros ciclos → mapeo propio. departamentales-2015 + municipales-2015 lo usan.
    {'cycle': '2015', 'plan': 'data/raw/electoral/2015/plan-circuital.csv', 'addr': 'Direccion'},
    {'cycle': 'departamentales-2020', 'plan': 'data/raw/electoral/departamentales-2020/plan-circuital.csv', 'addr': 'Direccion'},
    {'cycle': 'referendum-2022', 'plan': 'data/raw/electoral/referendum-2022/plan-circuital.csv', 'addr': 'Direccion'},
    {'cycle': 'departamentales-2025', 'plan': 'data/raw/electoral/departamentales-2025/plan-circuital.csv', 'addr': 'Local'},
    # Ciclo 2024 (internas/nacionales/balotaje/plebiscitos): MISMO método address-based que el resto,
    # por COHERENCIA cross-año (no georef-direct, que daría +precisión pero rompería la comparación
    # entre años — ver docs/AUDIT). Plan internas-2024 (cubre los 4 al 99%).
    {'cycle': '2024', 'plan': 'data/raw/electoral/plan-circuital.csv', 'addr': 'Local'},
]

def write_mappings():
    out = {}
    for c in CYCLES:
        c2b, st = build_mapping(c['plan'], c['addr'])
        path = f"data/mappings/montevideo-circuito-barrio.{c['cycle']}.json"
        json.dump({'crvToBarrio': c2b}, open(path, 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))
        tot = st['dir'] + st['geo'] + st['coarse'] + st['tok'] + st['serie']
        rough = 100 * st['serie'] / tot if tot else 0
        print(f"  {c['cycle']:22s} dir={st['dir']:>4} geo={st['geo']:>4} coarse={st['coarse']:>4} tok={st['tok']:>4} serie={st['serie']:>4} "
              f"unmap={st['unmapped']:>3} | serie%={rough:4.1f} → {path}")
        out[c['cycle']] = c2b
    return out

if __name__ == '__main__':
    print('=== Generando mapeos CRV→barrio por ciclo (Montevideo) ===')
    write_mappings()
    print('Listo. Los 7 ciclos usan el mismo método address-based + geocoding (coherencia cross-año).')
    print('El legacy montevideo-circuito-barrio.json ya no se usa (cada ciclo lee el suyo).')
