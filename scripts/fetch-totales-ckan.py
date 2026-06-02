#!/usr/bin/env python3
"""Descarga de CKAN (catalogodatos.gub.uy, Corte Electoral) los CSV de 'Totales Generales por
circuito' que no estén en local. Trae Habilitados/Emitidos/Observados/Anulados/EnBlanco por CRV,
fuente para poblar noPartidarios + participación (ver epic votos-no-partidarios).

Idempotente: no re-baja si el archivo ya existe. Uso: python scripts/fetch-totales-ckan.py
"""
import urllib.request, urllib.parse, json, os, sys

API = 'https://catalogodatos.gub.uy/api/3/action/'
UA = {'User-Agent': 'uruguay-electoral-map/1.0 (totales fetch)'}

# eleccion local → (dataset CKAN, substring del recurso de totales, archivo destino)
TARGETS = [
    ('internas-2024', 'corte-electoral-elecciones-internas-de-los-partidos-politicos-2024',
     'totales generales', 'data/raw/electoral/internas-2024/totales-generales.csv'),
    ('departamentales-2025', 'corte-electoral-elecciones_departamentales_y_municipales_2025',
     'totales generales', 'data/raw/electoral/departamentales-2025/totales-generales-por-comision-receptora.csv'),
]

def ckan(action, **params):
    url = API + action + '?' + urllib.parse.urlencode(params)
    return json.load(urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=60))

def resolve_csv(dataset, name_sub):
    pkg = ckan('package_show', id=dataset)['result']
    for r in pkg['resources']:
        if r.get('format', '').upper() == 'CSV' and name_sub.lower() in r.get('name', '').lower():
            return r['url']
    raise SystemExit(f"no encontré recurso CSV '{name_sub}' en {dataset}")

def main():
    for eleccion, dataset, name_sub, dest in TARGETS:
        if os.path.exists(dest):
            print(f"  {eleccion}: ya existe → {dest} (skip)")
            continue
        url = resolve_csv(dataset, name_sub)
        os.makedirs(os.path.dirname(dest), exist_ok=True)
        data = urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=120).read()
        with open(dest, 'wb') as f:
            f.write(data)
        n = data.count(b'\n')
        print(f"  {eleccion}: bajado {len(data)//1024} KB, ~{n} filas → {dest}")

if __name__ == '__main__':
    print('=== Fetch totales-generales (CKAN Corte Electoral) ===')
    main()
    print('Listo.')
