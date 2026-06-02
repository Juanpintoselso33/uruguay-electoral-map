"""Epic "ficha por circuito/local" — enriquece votes-local.json existente (sin re-correr el ETL).

Para elecciones cuyo votes-local NO trae aún metadata (las no-wide: internas/nacionales/
departamentales), agrega por local:
  - `local`: {nombre, direccion, habilitados} (del catálogo data/processed/locales/{dept}.json)
  - `circuitos`: [{circuito, ganadorOpcionId, validos}] — SOLO si existe votes-circuito.json para esa
    elección (hoy: internas-2024). El desglose usa la lista circuitos[] del catálogo + el resultado
    por circuito de votes-circuito. Donde no hay votes-circuito, se omite el desglose (metadata sola).

Idempotente: salta los locales que ya tienen `local` (p. ej. los wide, ya horneados por el ETL).
Uso: python scripts/enrich-votes-local.py
"""
import json, os, sys

DATA = 'public/data'
CAT = 'data/processed/locales'
NO_ELEC = {'geo', 'geographic', 'mappings', 'electoral', 'hoja-equivalencias'}

def catalog(dept):
    p = f'{CAT}/{dept}.json'
    if not os.path.exists(p): return {}
    out = {}
    for lo in json.load(open(p, encoding='utf-8'))['locales']:
        out[lo['localId']] = {'nombre': lo.get('nombre'), 'direccion': lo.get('direccion'),
                              'habilitados': lo.get('habilitados'), 'circuitos': lo.get('circuitos', [])}
    return out

def circ_results(eleccion, dept):
    """{str(circuito): {ganadorOpcionId, validos}} desde votes-circuito.json, o {} si no existe."""
    p = f'{DATA}/{eleccion}/{dept}/votes-circuito.json'
    if not os.path.exists(p): return {}
    return {str(z['geoId']): {'ganadorOpcionId': z['ganadorOpcionId'], 'validos': z['validos']}
            for z in json.load(open(p, encoding='utf-8'))['zonas']}

def main():
    tot_meta = tot_circ = 0
    elecciones = [e for e in sorted(os.listdir(DATA)) if e not in NO_ELEC and os.path.isdir(f'{DATA}/{e}')]
    for e in elecciones:
        cat_cache = {}
        for d in sorted(os.listdir(f'{DATA}/{e}')):
            vlp = f'{DATA}/{e}/{d}/votes-local.json'
            if not os.path.exists(vlp): continue
            vl = json.load(open(vlp, encoding='utf-8'))
            if all('local' in z for z in vl['zonas']):   # ya enriquecido (wide) → skip
                continue
            if d not in cat_cache: cat_cache[d] = catalog(d)
            cat = cat_cache[d]
            cres = circ_results(e, d)
            changed = False
            for z in vl['zonas']:
                meta = cat.get(z['geoId'])
                if not meta or 'local' in z:
                    continue
                z['local'] = {'nombre': meta['nombre'], 'direccion': meta['direccion'], 'habilitados': meta['habilitados']}
                tot_meta += 1; changed = True
                if cres and meta.get('circuitos'):
                    cs = [{'circuito': str(c), **cres[str(c)]} for c in meta['circuitos'] if str(c) in cres]
                    if cs:
                        z['circuitos'] = sorted(cs, key=lambda x: -x['validos']); tot_circ += len(cs)
            if changed:
                json.dump(vl, open(vlp, 'w', encoding='utf-8'), ensure_ascii=False)
        print(f'  {e}: enriquecido')
    print(f'\n✅ locales con metadata={tot_meta} | circuitos en desglose={tot_circ}')

if __name__ == '__main__':
    sys.exit(main())
