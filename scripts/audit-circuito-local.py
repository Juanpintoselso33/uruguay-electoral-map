#!/usr/bin/env python3
"""Sweep de cobertura del overlay circuito/local del mapa.

Para que el mapa muestre el detalle por circuito/local en una elección×depto necesita:
  - geometría (compartida por depto): public/data/geo/{depto}/local.topo.json  (o circuito.topo.json)
  - votos (por elección×depto):       public/data/{eleccion}/{depto}/votes-local.json (o votes-circuito.json)
El runtime (ChoroplethMap.loadCircuitos) prefiere LOCAL y cae a CIRCUITO.

Reporta, por elección, qué deptos tienen overlay (local/circuito), cuáles NO, y deptos sin geometría.
Uso: python scripts/audit-circuito-local.py
"""
import os, json

DATA = 'public/data'
GEO = f'{DATA}/geo'

def elecciones_declaradas():
    """Fuente de verdad: union de elecciones declaradas en src/config/departments.json."""
    cfg = json.load(open('src/config/departments.json', encoding='utf-8'))
    els = set()
    for d in cfg:
        els.update(d.get('elecciones', []))
    return els

def deptos_con_geo():
    out = {}
    if not os.path.isdir(GEO):
        return out
    for d in os.listdir(GEO):
        loc = os.path.exists(f'{GEO}/{d}/local.topo.json')
        cir = os.path.exists(f'{GEO}/{d}/circuito.topo.json')
        out[d] = ('local' if loc else ('circuito' if cir else None))
    return out

def main():
    geo = deptos_con_geo()
    geo_ok = {d for d, v in geo.items() if v}
    declaradas = elecciones_declaradas()
    elecciones = sorted(d for d in os.listdir(DATA)
                        if os.path.isdir(f'{DATA}/{d}') and d in declaradas)
    faltan_en_disco = sorted(declaradas - set(elecciones))
    if faltan_en_disco:
        print(f'  ⚠ declaradas en config pero sin carpeta en disco: {", ".join(faltan_en_disco)}')
    print(f'Deptos con geometría circuito/local: {len(geo_ok)}/{len(geo)} '
          f'(local: {sum(1 for v in geo.values() if v=="local")}, solo circuito: {sum(1 for v in geo.values() if v=="circuito")})')
    sin_geo = sorted(d for d, v in geo.items() if not v)
    if sin_geo:
        print(f'  ⚠ deptos SIN geometría: {", ".join(sin_geo)}')
    print()
    print(f'{"elección":34s} {"local":>6} {"circ":>5} {"sin overlay":>12}')
    print('-' * 62)
    full, partial, none_ = [], [], []
    for el in elecciones:
        eldir = f'{DATA}/{el}'
        deptos = sorted(d for d in os.listdir(eldir) if os.path.isdir(f'{eldir}/{d}') and d != '_nacional')
        nloc = ncir = 0; sin = []
        for d in deptos:
            has_loc = os.path.exists(f'{eldir}/{d}/votes-local.json')
            has_cir = os.path.exists(f'{eldir}/{d}/votes-circuito.json')
            if has_loc: nloc += 1
            elif has_cir: ncir += 1
            else: sin.append(d)
        cov = nloc + ncir
        tag = '✅' if cov == len(deptos) else ('◑' if cov else '✗')
        print(f'{tag} {el:32s} {nloc:>6} {ncir:>5} {len(sin):>12}  {("· falta: "+", ".join(sin[:6])+("…" if len(sin)>6 else "")) if sin else ""}')
        (full if cov == len(deptos) else partial if cov else none_).append(el)
    print()
    print(f'Resumen: {len(full)} con overlay completo · {len(partial)} parcial · {len(none_)} sin overlay')
    if none_:
        print(f'  ✗ SIN overlay circuito/local en ningún depto: {", ".join(none_)}')

if __name__ == '__main__':
    print('=== Sweep cobertura overlay circuito/local ===')
    main()
