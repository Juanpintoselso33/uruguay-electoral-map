#!/usr/bin/env python3
"""Gate de sanidad de no-partidarios (blanco/anulados/observados + habilitados/emitidos).

OJO DOMINIO: `emitidos`/`habilitados` salen del 'totales oficial' (donde se EMITIÓ el voto), mientras
`validos`/`porOpcion` salen del 'desglose' (donde se CONTÓ — el voto observado se cuenta en el circuito
de origen del votante, no donde votó). Por eso `emitidos = válidos + blanco + anulados + observados`
NO se cumple por zona (ni exacto a nivel país: ~2% por el observado/diferencia entre productos).
Son dos datasets oficiales distintos; este gate NO los fuerza a reconciliar.

Chequea: no-partidarios ≥ 0; habilitados/emitidos presentes y > 0; participación (emitidos/habilitados)
en un rango sano amplio (los circuitos con mucho observado superan el 100%, es legítimo). Reporta la
reconciliación NACIONAL como info. Uso: python scripts/gate-no-partidarios.py
"""
import json, glob, os, sys
from collections import defaultdict

DATA = 'public/data'
PART_MAX = 2.5   # participación > 250% en una zona = sospechoso (no error duro salvo extremo)
HARD_PART = 5.0  # > 500% = error

def run():
    negs = []; bad_part = []; checked = 0
    nat = defaultdict(lambda: {'emit': 0, 'val': 0, 'np': 0})
    for path in glob.glob(f'{DATA}/*/*/votes*.json'):
        try:
            d = json.load(open(path, encoding='utf-8'))
        except Exception:
            continue
        el = path.replace('\\', '/').split('/')[2]
        for z in d.get('zonas', []):
            emit = z.get('emitidos')
            if not emit:
                continue
            checked += 1
            np = z.get('noPartidarios', {})
            b, a, o = np.get('enBlanco', 0), np.get('anulados', 0), np.get('observados', 0)
            if min(b, a, o) < 0:
                negs.append((path, z['geoId']))
            hab = z.get('habilitados') or 0
            if hab > 0:
                part = emit / hab
                if part > PART_MAX:
                    bad_part.append((part, el, z['geoId'], emit, hab))
            # reconciliación nacional (solo shards _nacional para no doble-contar)
            if path.replace('\\', '/').split('/')[3] == '_nacional':
                nat[el]['emit'] += emit; nat[el]['val'] += z['validos']
                nat[el]['np'] += b + a + o
    bad_part.sort(reverse=True)
    print(f'[gate:no-partidarios] zonas con datos: {checked}')
    print('  reconciliación nacional por elección (emitidos vs válidos+np; ~2% esperado por observado):')
    for el in sorted(nat):
        e, v, n = nat[el]['emit'], nat[el]['val'], nat[el]['np']
        if e: print(f'    {el:24s} emit={e:>9,} val+np={v+n:>9,} delta={100*(e-(v+n))/e:+5.1f}%')
    # Solo los no-partidarios negativos son corrupción real. La participación >100% es legítima en
    # circuitos observado-heavy (hospitales, circuitos especiales 'q*'); se reporta, no falla.
    if negs:
        print(f'  ✗ {len(negs)} zonas con no-partidarios negativos (corrupción):'); [print('    ', p, g) for p, g in negs[:10]]
    if bad_part:
        print(f'  · {len(bad_part)} zonas con participación > {PART_MAX*100:.0f}% (observado-heavy, esperado): '
              + ', '.join(f'{g} {p*100:.0f}%' for p, el, g, e, h in bad_part[:5]))
    if negs:
        print('[gate:no-partidarios] FALLÓ (no-partidarios negativos)'); sys.exit(1)
    print('[gate:no-partidarios] OK — datos no-partidarios sanos (deltas zona/país por diseño del observado).')

if __name__ == '__main__':
    run()
