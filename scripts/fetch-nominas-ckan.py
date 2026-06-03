#!/usr/bin/env python3
"""Baja de CKAN (Corte Electoral) el recurso 'Integración de hojas de votación' por elección — la
fuente del mapeo persona↔hoja (nombre, cargo, hoja, credencial). Idempotente. Uso:
  python scripts/fetch-nominas-ckan.py            # todas las TARGETS
  python scripts/fetch-nominas-ckan.py nacionales-2024
"""
import urllib.request, urllib.parse, json, os, sys

API = 'https://catalogodatos.gub.uy/api/3/action/'
UA = {'User-Agent': 'uruguay-electoral-map/1.0 (nominas fetch)'}
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

TARGETS = {
    'nacionales-2024':       'corte-electoral-elecciones-nacionales-2024',
    'nacionales-2019':       'corte-electoral-elecciones-nacionales-2019',
    'nacionales-2014':       'corte-electoral-elecciones_nacionales_2014',
    'internas-2024':         'corte-electoral-elecciones-internas-de-los-partidos-politicos-2024',
    'departamentales-2025':  'corte-electoral-elecciones_departamentales_y_municipales_2025',
}
RES_SUB = 'integraci'  # matchea "Integración de hojas de votación"

def ckan(action, **params):
    url = API + action + '?' + urllib.parse.urlencode(params)
    return json.load(urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=60))

def resolve(dataset, fmt):
    pkg = ckan('package_show', id=dataset)['result']
    for r in pkg['resources']:
        if r.get('format', '').upper() == fmt and RES_SUB in r.get('name', '').lower():
            return r['url']
    return None

def fetch_one(eleccion, dataset):
    destdir = os.path.join(ROOT, 'data/raw/electoral', eleccion)
    os.makedirs(destdir, exist_ok=True)
    for fmt, ext in (('CSV', 'csv'), ('XLSX', 'xlsx')):
        url = resolve(dataset, fmt)
        if not url:
            continue
        dest = os.path.join(destdir, f'nominas-integracion.{ext}')
        if os.path.exists(dest) and os.path.getsize(dest) > 1024:
            print(f"  {eleccion}: ya existe {dest} (skip)"); return
        data = urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=300).read()
        if len(data) < 1024 and fmt == 'CSV':
            print(f"  {eleccion}: CSV vacío ({len(data)}B), pruebo XLSX"); continue
        with open(dest, 'wb') as f:
            f.write(data)
        print(f"  {eleccion}: bajado {len(data)//1024} KB → {dest}"); return
    raise SystemExit(f"no encontré recurso de integración para {eleccion}")

def main():
    sel = sys.argv[1:] or list(TARGETS)
    for e in sel:
        if e not in TARGETS:
            raise SystemExit(f"elección desconocida: {e} (válidas: {list(TARGETS)})")
        fetch_one(e, TARGETS[e])

if __name__ == '__main__':
    print('=== Fetch nóminas-integración (CKAN Corte Electoral) ===')
    main()
    print('Listo.')
