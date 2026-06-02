#!/usr/bin/env python3
"""Post-pass: puebla noPartidarios (enBlanco/anulados/observados) + habilitados/emitidos en los
shards, leyendo el 'totales-generales' por circuito de la Corte. Cubre las elecciones multi-partido
(nacionales/internas/departamentales) cuyo desglose NO trae esas filas. Ver
docs/superpowers/specs/2026-06-02-votos-no-partidarios-design.md.

Nivel base (votes.json): MVD por barrio (vía crvToBarrio.{ciclo}); interior por serie (col del totales).
NO toca votos por opción ni válidos. Idempotente. Uso: python scripts/build-no-partidarios.py
"""
import csv, json, os, re
from collections import defaultdict

# elección → (csv de totales, ciclo para crvToBarrio MVD, plan-circuital para CRV→serie+rango→local)
ELECTIONS = {
    'nacionales-2014': ('data/raw/electoral/nacionales-2014/totales-generales-por-comisi-n-receptora.csv', '2014', 'data/raw/electoral/nacionales-2014/plan-circuital.csv'),
    'internas-2019': ('data/raw/electoral/internas-2019/totales-generales-por-comisi-n-receptora.csv', 'internas-2019', 'data/raw/electoral/internas-2019/plan-circuital.csv'),
    'nacionales-2019': ('data/raw/electoral/nacionales-2019-full/totales-generales-por-comisi-n-receptora.csv', '2019', 'data/raw/electoral/nacionales-2019-full/plan-circuital.csv'),
    'departamentales-2020': ('data/raw/electoral/departamentales-2020/totales-generales-por-comisi-n-receptora.csv', 'departamentales-2020', 'data/raw/electoral/departamentales-2020/plan-circuital.csv'),
    'internas-2024': ('data/raw/electoral/internas-2024/totales-generales.csv', '2024', 'data/raw/electoral/plan-circuital.csv'),
    'nacionales-2024': ('data/raw/electoral/nacionales-2024/totales-generales-plebiscitos.csv', '2024', 'data/raw/geographic/plan_circuital_2024.csv'),
    'departamentales-2025': ('data/raw/electoral/departamentales-2025/totales-generales-por-comision-receptora.csv', 'departamentales-2025', 'data/raw/electoral/departamentales-2025/plan-circuital.csv'),
}
DEPTO_DIR = {'MO': 'montevideo', 'CA': 'canelones', 'MA': 'maldonado', 'RO': 'rocha', 'TT': 'treinta_y_tres',
             'CL': 'cerro_largo', 'RV': 'rivera', 'AR': 'artigas', 'SA': 'salto', 'PA': 'paysandu',
             'RN': 'rio_negro', 'SO': 'soriano', 'CO': 'colonia', 'SJ': 'san_jose', 'FS': 'flores',
             'FD': 'florida', 'DU': 'durazno', 'LA': 'lavalleja', 'TA': 'tacuarembo'}
NAME_TO_CODE = {v: k for k, v in DEPTO_DIR.items()}
# geoId del shard _nacional = nombre display del departamento.
CODE_TO_NAME = {'MO': 'Montevideo', 'CA': 'Canelones', 'MA': 'Maldonado', 'RO': 'Rocha', 'TT': 'Treinta y Tres',
                'CL': 'Cerro Largo', 'RV': 'Rivera', 'AR': 'Artigas', 'SA': 'Salto', 'PA': 'Paysandú',
                'RN': 'Río Negro', 'SO': 'Soriano', 'CO': 'Colonia', 'SJ': 'San José', 'FS': 'Flores',
                'FD': 'Florida', 'DU': 'Durazno', 'LA': 'Lavalleja', 'TA': 'Tacuarembó'}

def to_int(s):
    try: return int(re.sub(r'[^0-9-]', '', str(s)) or 0)
    except: return 0
def cnorm(c): return re.sub(r'[^a-z0-9]', '', c.lower())

def parse_totales(path):
    """→ lista de dicts {depto_code, crv, serie(lower), hab, emit, obs, anul, blanco}."""
    out = []
    with open(path, encoding='utf-8', errors='replace') as f:
        rd = csv.DictReader(f)
        cm = {cnorm(c): c for c in rd.fieldnames}
        def col(*names):
            for n in names:
                if n in cm: return cm[n]
            return None
        cD, cC, cS = col('departamento'), col('crv'), col('serie', 'series')
        cH, cE = col('totalhabilitados'), col('totalvotosemitidos')
        cO = col('totalvotosobservados', 'totalobservados')
        cA = col('totalanulados', 'totalvotosanulados')
        cB = col('totalenblanco', 'totalvotosenblanco')
        for r in rd:
            dep = (r.get(cD) or '').strip().strip('"').upper()
            code = dep if dep in DEPTO_DIR else NAME_TO_CODE.get(dep.lower())
            if not code: continue
            out.append({'code': code, 'crv': (r.get(cC) or '').strip(), 'serie': (r.get(cS) or '').strip().lower(),
                        'hab': to_int(r.get(cH)), 'emit': to_int(r.get(cE)),
                        'obs': to_int(r.get(cO)), 'anul': to_int(r.get(cA)), 'blanco': to_int(r.get(cB))})
    return out

ACC = lambda: {'hab': 0, 'emit': 0, 'obs': 0, 'anul': 0, 'blanco': 0}
def add(a, r):
    for k in ('hab', 'emit', 'obs', 'anul', 'blanco'): a[k] += r[k]

def load_plan_ranges(plan_path):
    """→ {(code, crv): (SERIE, desde, hasta)} desde el plan-circuital de la elección."""
    out = {}
    if not os.path.exists(plan_path): return out
    with open(plan_path, encoding='utf-8', errors='replace') as f:
        rd = csv.DictReader(f); cm = {cnorm(c): c for c in rd.fieldnames}
        cD = cm.get('departamento'); cC = cm.get('nrocircuito') or cm.get('crv')
        cS = cm.get('serie') or cm.get('series'); cDe = cm.get('desde'); cHa = cm.get('hasta')
        if not (cC and cS and cDe and cHa): return out
        for r in rd:
            dep = (r.get(cD) or '').strip().strip('"').upper()
            code = dep if dep in DEPTO_DIR else NAME_TO_CODE.get(dep.lower())
            if not code: continue
            de, ha = to_int(r[cDe]), to_int(r[cHa])
            out[(code, r[cC].strip())] = (r[cS].strip().upper(), de, ha)
    return out

def build_crv2local(code, plan_ranges, catalog):
    """CRV → localId por serie + máximo solapamiento de rango de credencial (robusto a renumeración,
    igual criterio que el builder de votes-local)."""
    by_serie = defaultdict(list)  # SERIE -> [(d, h, localId)]
    for lo in catalog['locales']:
        for rg in lo.get('ranges', []):
            by_serie[str(rg[0]).upper()].append((to_int(rg[1]), to_int(rg[2]), lo['localId']))
    out = {}
    for (c, crv), (serie, de, ha) in plan_ranges.items():
        if c != code or de is None or ha is None: continue
        best = None; bestov = 0
        for (d2, h2, lid) in by_serie.get(serie, []):
            ov = min(ha, h2) - max(de, d2)
            if ov > bestov: bestov = ov; best = lid
        if best: out[crv] = best
    return out

def patch_shard(path, by_geo):
    """Parchea noPartidarios + habilitados/emitidos por geoId. Devuelve (n_zonas, n_match, sin_match)."""
    d = json.load(open(path, encoding='utf-8'))
    matched = 0; sin = []
    for z in d['zonas']:
        acc = by_geo.get(z['geoId'])
        if not acc:
            sin.append(z['geoId']); continue
        matched += 1
        z['noPartidarios'] = {'enBlanco': acc['blanco'], 'anulados': acc['anul'], 'observados': acc['obs']}
        z['habilitados'] = acc['hab']
        z['emitidos'] = acc['emit']
    json.dump(d, open(path, 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))
    return len(d['zonas']), matched, sin

def run():
    for el, (csvpath, ciclo, planpath) in ELECTIONS.items():
        if not os.path.exists(csvpath):
            print(f'  {el}: SIN totales ({csvpath}) — skip'); continue
        rows = parse_totales(csvpath)
        plan_ranges = load_plan_ranges(planpath)  # (code,crv)→(serie,desde,hasta) para CRV→local
        # MVD: crv→barrio del ciclo
        mapping_path = f'data/mappings/montevideo-circuito-barrio.{ciclo}.json'
        crv2barrio = json.load(open(mapping_path, encoding='utf-8'))['crvToBarrio'] if os.path.exists(mapping_path) else {}
        # acumular por depto
        recon = {'emit': 0, 'blanco': 0, 'anul': 0, 'obs': 0}
        for r in rows:
            for k in recon: recon[k] += r['emit'] if k == 'emit' else r[k]
        deptos_done = 0; local_done = 0
        for code in sorted(set(r['code'] for r in rows)):
            depto_dir = DEPTO_DIR[code]
            shard = f'public/data/{el}/{depto_dir}/votes.json'
            if not os.path.exists(shard): continue
            by_geo = defaultdict(ACC)
            if code == 'MO':
                for r in rows:
                    if r['code'] != 'MO': continue
                    b = crv2barrio.get(r['crv'])
                    if b: add(by_geo[b], r)
            else:
                for r in rows:
                    if r['code'] != code: continue
                    add(by_geo[r['serie']], r)
            n, m, sin = patch_shard(shard, by_geo)
            deptos_done += 1
            # Nivel LOCAL (issue #22): CRV→local por serie+rango del catálogo; patchea votes-local.json
            local_shard = f'public/data/{el}/{depto_dir}/votes-local.json'
            cat_path = f'data/processed/locales/{depto_dir}.json'
            if os.path.exists(local_shard) and os.path.exists(cat_path) and plan_ranges:
                catalog = json.load(open(cat_path, encoding='utf-8'))
                crv2local = build_crv2local(code, plan_ranges, catalog)
                by_local = defaultdict(ACC)
                for r in rows:
                    if r['code'] != code: continue
                    lid = crv2local.get(r['crv'])
                    if lid: add(by_local[lid], r)
                if by_local: patch_shard(local_shard, by_local); local_done += 1
        # _nacional: una zona por departamento (geoId = nombre display), suma de su totales.
        nac = f'public/data/{el}/_nacional/votes.json'
        if os.path.exists(nac):
            by_nac = defaultdict(ACC)
            for r in rows:
                add(by_nac[CODE_TO_NAME[r['code']]], r)
            patch_shard(nac, by_nac)
        print(f"  {el:24s} deptos={deptos_done:>2} local={local_done:>2} +nacional | emitidos={recon['emit']:>9,} blanco={recon['blanco']:>7,} anul={recon['anul']:>6,} obs={recon['obs']:>7,}")

if __name__ == '__main__':
    print('=== Poblar no-partidarios (barrio MVD / serie interior + local + nacional) ===')
    run()
    print('Listo.')
