"""Auditoría: para cada elección×depto×contienda tipo-hoja, ¿cada lema con votos pinta
algo en el modo 'ganador entre lo seleccionado' del mapa? Replica el join del cliente
(ChoroplethMap.ganadorSelDeZona): sel = hojas del lema en el catálogo; los votos se buscan
en el shard hoja/{cont}/{lema}.json (hojaVotos) y, como fallback, en votes.json base.
Un lema NO pinta si para todas sus hojas seleccionadas no hay votos>0 ni en shard ni en base."""
import json, os, glob, unicodedata
from collections import defaultdict, Counter

DATA = 'public/data'

def load(p):
    try:
        with open(p, encoding='utf-8') as f:
            return json.load(f)
    except Exception:
        return None

problemas = []
revisados = 0
for cat_path in glob.glob(os.path.join(DATA, '*', '*', 'catalogo.json')):
    norm_path = cat_path.replace(os.sep, '/')
    parts = norm_path.split('/')
    eleccion, depto = parts[-3], parts[-2]
    d = os.path.dirname(cat_path)
    cat = load(cat_path)
    if not cat:
        continue
    votes = load(os.path.join(d, 'votes.json')) or {'zonas': []}
    baseTot = defaultdict(int)
    for z in votes['zonas']:
        for o in z.get('porOpcion', []):
            baseTot[o['opcionId']] += o.get('votos', 0)
    for c in cat.get('contiendas', []):
        cont = c['contienda']
        niveles = c.get('niveles', [])
        opciones = c.get('opciones', [])
        if len(niveles) <= 1:   # plano (balotaje/plebiscito): resuelve por base → skip
            continue
        lemas = [n for n in c['nodos'] if n.get('nivel') == 'lema']
        for lema in lemas:
            lid = lema['id']
            sel = set(o['id'] for o in opciones if o.get('lemaId') == lid)
            if not sel:
                continue
            esperado = baseTot.get(lid, 0)
            shard = load(os.path.join(d, 'hoja', cont, lid + '.json'))
            shard_ids = set()
            paintable = False
            if shard:
                for z in shard.get('zonas', []):
                    for o in z.get('porOpcion', []):
                        shard_ids.add(o['opcionId'])
                        if o.get('votos', 0) > 0 and o['opcionId'] in sel:
                            paintable = True
            if not paintable:
                for s in sel:
                    if baseTot.get(s, 0) > 0:
                        paintable = True
                        break
            revisados += 1
            if not paintable:
                inter = len(sel & shard_ids)
                problemas.append((eleccion, depto, cont, lema['etiqueta'], lid,
                                  'shard=%s sel=%d shard_ids=%d inter=%d baseLema=%d' %
                                  ('si' if shard else 'NO', len(sel), len(shard_ids), inter, esperado)))

print('lemas revisados:', revisados)
print('PROBLEMAS (no pintan en ganador):', len(problemas))
print('por eleccion:', dict(Counter(p[0] for p in problemas)))
print('por contienda:', dict(Counter(p[2] for p in problemas)))
print('lemas distintos afectados:', dict(Counter(p[3] for p in problemas).most_common(20)))
print()
for p in problemas[:80]:
    print('  ', p[0], p[1], p[2], '|', p[3], '|', p[5])
