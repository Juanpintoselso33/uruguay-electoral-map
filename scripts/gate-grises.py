"""Story 16.4 (gate) — Garantiza que TODO polígono gris es benigno (la serie no votó esa elección).

Cruza, por elección con raw disponible, cada serie GRIS (geometría sin voto en nuestro shard) contra
la columna `Serie` del CSV crudo oficial. Si una serie gris APARECE en el raw → votó y la perdimos =
BUG real (no benigno) → falla. Así el "gris = benigno" queda verificado, no asumido, y un hueco de
datos futuro no se esconde tras la anexión (16.4).

Corre LOCAL (data/raw/ está gitignored, no está en el build de Vercel). Uso: python scripts/gate-grises.py
"""
import json, os, re, sys, unicodedata
from raw_series import raw_series, RAW_DIR, norm

DATA = 'public/data'
GEO = 'public/data/geo'
DEPTS = [d['id'] for d in json.load(open('src/config/departments.json', encoding='utf-8'))]

def main():
    fallas = []; revisadas = 0; saltadas = []
    for e in sorted(RAW_DIR):
        raw = raw_series(e)
        if not raw:
            saltadas.append(e); continue
        revisadas += 1
        bug = []
        for depto in DEPTS:
            vp = f'{DATA}/{e}/{depto}/votes.json'
            if not os.path.exists(vp): continue
            v = json.load(open(vp, encoding='utf-8')); nivel = v['nivel']
            tp = f'{GEO}/{depto}/{nivel}.topo.json'
            if not os.path.exists(tp): continue
            t = json.load(open(tp, encoding='utf-8')); o = list(t['objects'].keys())[0]
            gnames = {norm(g.get('properties', {}).get('name', '')) for g in t['objects'][o]['geometries']}
            voto = {norm(z['geoId']) for z in v['zonas']}
            grey = {n for n in gnames if n not in voto and '-' not in n}
            en_raw = grey & raw.get(depto, set())   # gris PERO votó en el raw = BUG
            for s in en_raw: bug.append(f'{e}/{depto}/{s}')
        if bug:
            fallas.extend(bug)
            print(f'  ✗ {e}: {len(bug)} serie(s) GRIS que SÍ votaron (bug): {bug[:5]}')
        else:
            print(f'  ✓ {e}: 0 grises en el raw (todas benignas)')
    if saltadas:
        print(f'\n  ⚠ sin raw localizable (saltadas): {saltadas}')
    print(f'\n[gate:grises] {revisadas} elecciones revisadas, {len(fallas)} grises-bug.')
    if fallas:
        sys.exit(f'GATE FALLÓ: {len(fallas)} series grises corresponden a votos reales (no son benignas) → arreglar el ETL de datos.')
    print('[gate:grises] OK — todo gris es benigno (ninguna serie gris votó en su elección).')

if __name__ == '__main__':
    sys.exit(main())
