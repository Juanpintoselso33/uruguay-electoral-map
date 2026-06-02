"""Epic 16 — Auditoría de polígonos GRISES (zonas "sin datos") y votos invisibles.

Un polígono se pinta gris (COLOR_SIN_DATOS) cuando su `name` (normalizado) NO matchea ningún
`geoId` del votes.json. El inverso (voto sin polígono) es peor: esos votos no se ven en NINGÚN lado.

Tres causas (ver hallazgos al final del epic 16-1):
  A) DRIFT TEMPORAL: la geometría de series está fijada al padrón ~2024; en elecciones viejas
     muchas series no existían/no votaron → sus polígonos 2024 quedan grises (mayormente benigno).
  B) GEOMETRÍA MERGEADA: polígonos con label tipo "sia-sib-sic" (3 series en una forma) nunca
     matchean las series individuales del voto → grises + dejan esas series sin polígono.
  C) VOTOS INVISIBLES (inverso): zonas con voto sin polígono. Despreciable (~0,07%) salvo en
     DEPARTAMENTALES 2020/2025 (~0,55%, ~11k votos) por series especiales (q1, q2…) sin geometría.

Uso: python scripts/audit-grises.py
"""
import json, os, re, sys, unicodedata
from collections import defaultdict

DATA = 'public/data'
GEO = 'public/data/geo'
DEPTS = [d['id'] for d in json.load(open('src/config/departments.json', encoding='utf-8'))]
NO_ELEC = {'geo', 'geographic', 'mappings', 'electoral', 'hoja-equivalencias'}

def norm(s):
    s = unicodedata.normalize('NFD', str(s))
    s = ''.join(c for c in s if unicodedata.category(c) != 'Mn')
    return re.sub(r'\s+', ' ', re.sub(r'[.,]', ' ', s.upper())).strip()

def geo_names(d, nivel):
    p = f'{GEO}/{d}/{nivel}.topo.json'
    if not os.path.exists(p): return None
    t = json.load(open(p, encoding='utf-8')); o = list(t['objects'].keys())[0]
    return [g.get('properties', {}).get('name', '') for g in t['objects'][o]['geometries']]

def elecciones():
    return [e for e in sorted(os.listdir(DATA))
            if os.path.isdir(f'{DATA}/{e}') and e not in NO_ELEC]

def main():
    print(f"{'elección':38} grises   votos-invisibles")
    peor_inv = []
    for e in elecciones():
        grey = geo = inv = inv_votos = validos = 0
        for d in DEPTS:
            vp = f'{DATA}/{e}/{d}/votes.json'
            if not os.path.exists(vp): continue
            v = json.load(open(vp, encoding='utf-8'))
            gn = geo_names(d, v['nivel'])
            if gn is None: continue
            gnorm = {norm(n) for n in gn}
            vids = {norm(z['geoId']) for z in v['zonas']}
            grey += sum(1 for n in gn if norm(n) not in vids); geo += len(gn)
            for z in v['zonas']:
                validos += z.get('validos', 0)
                if norm(z['geoId']) not in gnorm:
                    inv += 1; inv_votos += z.get('validos', 0)
        if not geo: continue
        pct_inv = 100 * inv_votos / validos if validos else 0
        print(f"  {e:36} {grey:3}/{geo} ({100*grey/geo:4.1f}%)  invis={inv:3} ({inv_votos:6,} votos · {pct_inv:.2f}%)")
        if pct_inv > 0.2: peor_inv.append((e, inv, inv_votos, pct_inv))

    print("\n=== Geometría mergeada (label con '-' — nunca matchea series individuales) ===")
    for d in DEPTS:
        gn = geo_names(d, 'serie') or []
        m = [n for n in gn if '-' in n]
        if m: print(f"  {d}: {m}")

    if peor_inv:
        print("\n=== ⚠ Elecciones con votos invisibles relevantes (>0,2%) ===")
        for e, inv, votos, pct in peor_inv:
            print(f"  {e}: {inv} zonas, {votos:,} votos ({pct:.2f}%) sin polígono")

if __name__ == '__main__':
    sys.exit(main())
