#!/usr/bin/env python3
"""Geocodifica (Nominatim/OSM) las direcciones de locales de votación de ciclos viejos que NO
matchean el vocabulario del georef-2024, para asignarlas a barrio por coordenada real (PIP) en
vez del fallback por serie. Cierra la brecha de precisión de 2014/2019/2020/2022.

Guard: si las coords caen FUERA de todo polígono de barrio (v_sig), se descarta (ej. una calle
homónima que Nominatim ubica en otro depto) → cae al fallback. El PIP ES el filtro geográfico.

Cachea en data/mappings/montevideo-geocode-cache.json (street_key → barrio|null). Resumible e
idempotente: solo geocodifica claves nuevas. COMMITEAR el cache → build reproducible sin red.

Política Nominatim: 1 req/seg, User-Agent identificable. Uso puntual (one-time).
Uso: python scripts/geocode-missing-barrios.py
"""
import csv, re, json, time, unicodedata, urllib.request, urllib.parse, os
from collections import defaultdict

CACHE = 'data/mappings/montevideo-geocode-cache.json'
GEOREF = 'data/raw/geographic/plan-circuital-georreferencia-nacional-2024.csv'

def norm(s):
    s = unicodedata.normalize('NFD', s or ''); s = ''.join(c for c in s if unicodedata.category(c) != 'Mn')
    return re.sub(r'\s+', ' ', re.sub(r'[^A-Za-z0-9]+', ' ', s).upper()).strip()
def street_key(local):
    parts = (local or '').split('-'); return norm(parts[-1] if len(parts) > 1 else local)

# PIP contra v_sig_barrios
_bar = json.load(open('public/v_sig_barrios.json', encoding='utf-8'))
BARRIOS = [(str(f['properties']['BARRIO']), f['geometry']) for f in _bar['features']]
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
    for n, g in BARRIOS:
        if _in_feat(lon, lat, g): return n
    return None

def georef_keys():
    ks = set()
    with open(GEOREF, encoding='utf-8') as f:
        h = f.readline().lstrip('﻿').rstrip().split(';'); iD = h.index('Departamento'); iDir = h.index('direccion')
        for line in f:
            c = line.rstrip().split(';')
            if len(c) > iDir and c[iD] == 'Montevideo': ks.add(street_key(c[iDir]))
    return ks

PLANS = [('data/raw/electoral/nacionales-2014/plan-circuital.csv', 'Direccion'),
         ('data/raw/electoral/internas-2019/plan-circuital.csv', 'Direccion'),
         ('data/raw/electoral/nacionales-2019-full/plan-circuital.csv', 'Direccion'),
         ('data/raw/electoral/departamentales-2020/plan-circuital.csv', 'Direccion'),
         ('data/raw/electoral/referendum-2022/plan-circuital.csv', 'Direccion'),
         ('data/raw/electoral/departamentales-2025/plan-circuital.csv', 'Local'),
         ('data/raw/electoral/plan-circuital.csv', 'Local')]  # internas/ciclo-2024 (coherencia método)

def missing_keys():
    gk = georef_keys(); miss = set()
    for path, ac in PLANS:
        with open(path, encoding='utf-8', errors='replace') as f:
            rd = csv.DictReader(f); cols = {c.strip(): c for c in rd.fieldnames}
            for r in rd:
                if r[cols['Departamento']].strip() not in ('MO', 'MONTEVIDEO'): continue
                sk = street_key(r[cols[ac]])
                if sk and sk not in gk: miss.add(sk)
    return miss

def geocode(query):
    q = urllib.parse.quote(f'{query}, Montevideo, Uruguay')
    url = f'https://nominatim.openstreetmap.org/search?q={q}&format=json&limit=1'
    req = urllib.request.Request(url, headers={'User-Agent': 'uruguay-electoral-map/1.0 (one-time geocode of historical polling addresses)'})
    try:
        r = json.load(urllib.request.urlopen(req, timeout=20))
        if r: return float(r[0]['lon']), float(r[0]['lat'])
    except Exception:
        return None
    return None

def candidates(sk):
    # "CALLE NUM ESQ OTRA" -> intentar [parte antes de ESQ] y [calle de la esquina]
    parts = re.split(r'\bESQ\b', sk)
    out = []
    if parts[0].strip(): out.append(parts[0].strip())
    if len(parts) > 1 and parts[1].strip(): out.append(parts[1].strip())
    return out or [sk]

def main():
    cache = json.load(open(CACHE, encoding='utf-8')) if os.path.exists(CACHE) else {}
    miss = sorted(missing_keys())
    todo = [k for k in miss if k not in cache]
    print(f'faltantes={len(miss)} | en cache={len(miss)-len(todo)} | a geocodificar={len(todo)}')
    hits = 0
    for i, sk in enumerate(todo):
        barrio = None
        for cand in candidates(sk):
            co = geocode(cand)
            time.sleep(1.1)  # política Nominatim
            if co:
                b = pip(*co)
                if b: barrio = b; break
        cache[sk] = barrio
        if barrio: hits += 1
        if (i + 1) % 25 == 0:
            json.dump(cache, open(CACHE, 'w', encoding='utf-8'), ensure_ascii=False, indent=0)
            print(f'  {i+1}/{len(todo)} · hits {hits} · último: {sk[:40]} -> {barrio}')
    json.dump(cache, open(CACHE, 'w', encoding='utf-8'), ensure_ascii=False, indent=0)
    placed = sum(1 for v in cache.values() if v)
    print(f'LISTO. cache={len(cache)} claves · con barrio={placed} ({100*placed/len(cache):.0f}%) · sin ubicar={len(cache)-placed}')

if __name__ == '__main__':
    main()
