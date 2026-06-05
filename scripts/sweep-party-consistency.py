#!/usr/bin/env python3
"""
Sweep de consistencia de partidos a través de TODAS las elecciones.

Problema: en internas-2019 e internas-2024 el mismo partido quedó partido en
dos opcionId distintos (split de votos) por diferencias de ingesta:
  - prefijo "partido-"  : partido-nacional  vs  nacional      (montevideo vs resto)
  - sufijo "-pcn"       : por-los-cambios-necesarios (mvd) vs  ...-pcn (resto)
Además los nombres visibles eran inconsistentes ("NACIONAL", "Nacional",
"PARTIDO NACIONAL") en todas las elecciones.

Este sweep:
  1) MERGE de ids (solo internas-2019 / internas-2024): canoniza opcionId a la
     forma bare ("partido-X" -> "X") y aplica el alias del caso PCN. Reescribe
     todos los archivos con `zonas[]`, opciones.json, catalogo.json, y renombra
     los shards hoja/{odn,odd}/*.json. Recalcula ganadorOpcionId.
     -> Análisis previo confirmó CERO solape intra-archivo: es relabel puro,
        no se suma nada dentro de un mismo archivo. La suma del split sólo
        ocurre (correctamente) al regenerar _nacional.
  2) NOMBRE canónico (TODAS las elecciones): setea el `nombre` en opciones.json
     y `etiqueta` de nodos lema en catalogo.json al nombre propio canónico
     (p.ej. "Partido Nacional", "Partido Colorado"). No toca ids fuera de (1).

Invariante de seguridad: la suma de votos por archivo NO cambia (relabel puro).

Uso:
  python3 scripts/sweep-party-consistency.py            # dry-run (no escribe)
  python3 scripts/sweep-party-consistency.py --apply    # aplica cambios
Luego regenerar _nacional SOLO de las internas:
  python3 scripts/build-nacional-votes.py internas-2019 internas-2024
"""
import json, os, re, glob, sys
from collections import defaultdict

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA = os.path.join(ROOT, 'public', 'data')
APPLY = '--apply' in sys.argv

NON_ELEC = {'electoral', 'geo', 'geographic', 'mappings', 'hoja-equivalencias'}
# Canonizamos ids a forma bare en TODAS las elecciones (no solo las internas):
# - internas-2019/2024 tienen split real (mismo partido en 2 ids)
# - balotaje-2014/2019 usan prefijo "partido-" consistente pero distinto al resto
# El análisis confirmó 0 solape intra-archivo en todas -> relabel puro seguro.

# Nombre de display canónico por opcionId (forma bare). Plebiscitos si/no no son
# partidos y NO se tocan. Si aparece un id de partido no listado -> WARN.
CANON_NAME = {
    'abriendo-caminos': 'Abriendo Caminos',
    'asamblea-popular': 'Asamblea Popular',
    'avanzar-republicano': 'Partido Avanzar Republicano',
    'basta-ya': 'Partido Basta Ya',
    'cabildo-abierto': 'Cabildo Abierto',
    'coalicion-republicana': 'Coalición Republicana',  # es una coalición, no un partido
    'colorado': 'Partido Colorado',
    'constitucional-ambientalista': 'Partido Constitucional Ambientalista',
    'de-la-armonia': 'Partido de la Armonía',
    'de-la-concertacion': 'Partido de la Concertación',
    'de-la-gente': 'Partido de la Gente',
    'de-los-trabajadores': 'Partido de los Trabajadores',
    'democratico-unido-pdu': 'Partido Democrático Unido - PDU',
    'devolucion': 'Partido Devolución',
    'digital': 'Partido Digital',
    'ecologista-radical-intransigente': 'Partido Ecologista Radical Intransigente',
    'frente-amplio': 'Frente Amplio',
    'identidad-soberana': 'Identidad Soberana',
    'independiente': 'Partido Independiente',
    'libertario': 'Partido Libertario',
    'nacional': 'Partido Nacional',
    'orden-republicano': 'Partido Orden Republicano',
    'p-e-r-i': 'P.E.R.I.',
    'patria-alternativa': 'Patria Alternativa',
    'por-los-cambios-necesarios-pcn': 'Por los Cambios Necesarios (PCN)',
    'unidos': 'Unidos',                                # lema menor internas-2014
    'union-para-el-cambio': 'Unión para el Cambio',    # lema menor internas-2014
    'verde-animalista': 'Partido Verde Animalista',
}
PLEBISCITE_IDS = {'si', 'no'}

# Remaps específicos por elección (se aplican DESPUÉS de canon_id genérico).
# Balotaje: el contendiente se rotula por el lema que lo llevó en la nacional.
# En balotaje-2024 Delgado fue del Partido Nacional (el id venía como la coalición).
# OJO: scoped a balotaje-2024 — en internas/departamentales 'coalicion-republicana'
# es un lema real distinto y NO se toca.
ELECTION_REMAP = {
    'balotaje-2024': [(re.compile(r'(^|-)coalicion-republicana(-|$)'), r'\1nacional\2')],
}
CUR_EL = None  # elección en curso (la setea process())

warnings = []
stats = defaultdict(int)


def canon_id(opid):
    """Canoniza un opcionId (lema-level o hoja-level {niv}-{slug}-{num})."""
    new = re.sub(r'(^|-)partido-', r'\1', opid)
    new = re.sub(r'(^|-)por-los-cambios-necesarios(?!-pcn)(-|$)',
                 r'\1por-los-cambios-necesarios-pcn\2', new)
    # P.E.R.I. (montevideo) == Partido Ecologista Radical Intransigente (resto)
    new = re.sub(r'(^|-)p-e-r-i(-|$)', r'\1ecologista-radical-intransigente\2', new)
    # remaps específicos de la elección en curso
    for pat, repl in ELECTION_REMAP.get(CUR_EL, []):
        new = pat.sub(repl, new)
    return new


def jload(p):
    with open(p, encoding='utf-8') as f:
        return json.load(f)


def jdump(p, obj):
    if not APPLY:
        return
    import time
    for attempt in range(5):  # Windows EINVAL bajo file-watcher: reintentar
        try:
            with open(p, 'w', encoding='utf-8') as f:
                json.dump(obj, f, ensure_ascii=False, separators=(',', ':'))
            return
        except OSError:
            if attempt == 4:
                raise
            time.sleep(0.2)


def transform_zonas(doc, path):
    """Reescribe opcionId/ganador RECURSIVAMENTE en cualquier nodo del doc con
    `porOpcion` (suma + invariante) o `ganadorOpcionId` (relabel). Cubre zonas,
    circuitos anidados, y cualquier otra estructura de votos."""
    def walk(node):
        changed = False
        if isinstance(node, dict):
            if isinstance(node.get('porOpcion'), list):
                agg = {}
                order = []
                before = 0
                for po in node['porOpcion']:
                    before += po['votos']
                    cid = canon_id(po['opcionId'])
                    if cid != po['opcionId']:
                        changed = True
                    if cid in agg:
                        agg[cid] += po['votos']
                        stats['intra_file_merge'] += 1
                        warnings.append(f"INTRA-FILE MERGE {path}: {cid} ({node.get('geoId')})")
                    else:
                        agg[cid] = po['votos']
                        order.append(cid)
                after = sum(agg.values())
                assert before == after, f"INVARIANTE ROTA {path} {node.get('geoId')}: {before}!={after}"
                node['porOpcion'] = [{'opcionId': k, 'votos': agg[k]} for k in order]
                if node['porOpcion']:  # recomputar ganador desde votos
                    win = max(node['porOpcion'], key=lambda x: x['votos'])['votos']
                    node['ganadorOpcionId'] = next(p['opcionId'] for p in node['porOpcion'] if p['votos'] == win)
            elif isinstance(node.get('ganadorOpcionId'), str):  # p.ej. circuitos sin porOpcion
                new = canon_id(node['ganadorOpcionId'])
                if new != node['ganadorOpcionId']:
                    node['ganadorOpcionId'] = new
                    changed = True
            for v in node.values():
                if walk(v):
                    changed = True
        elif isinstance(node, list):
            for v in node:
                if walk(v):
                    changed = True
        return changed
    return walk(doc)


def transform_opciones(doc, election, path):
    """opciones.json: canoniza id (forma bare) + dedupe + nombre canónico."""
    merge = True
    out = {}
    order = []
    for o in doc['opciones']:
        oid = canon_id(o['opcionId']) if merge else o['opcionId']
        name = o['nombre']
        if oid in CANON_NAME:
            name = CANON_NAME[oid]
        elif oid in PLEBISCITE_IDS:
            pass  # mantener Sí/No
        else:
            warnings.append(f"NOMBRE no canónico (sin entrada en CANON_NAME): {oid} en {path}")
        if oid not in out:
            out[oid] = name
            order.append(oid)
        else:
            stats['opciones_dedup'] += 1
    new_list = [{'opcionId': k, 'nombre': out[k]} for k in sorted(order)]
    doc['opciones'] = new_list
    return True


def transform_catalogo(doc, election, path):
    """catalogo.json: canoniza RECURSIVAMENTE todo campo id/`*Id` (id, partidoId,
    parentId, lemaId, precandidatoId, opcionId...) preservando integridad
    referencial, setea etiqueta/nombre lema canónico, y dedupe de lemas.
    Maneja `contiendas[].nodos[]` (internas) y `contiendas[].opciones[]` (balotaje)."""
    # 1) canon recursivo de todos los campos id/*Id
    def walk(node):
        if isinstance(node, dict):
            for k, v in node.items():
                if isinstance(v, str) and (k == 'id' or k.endswith('Id')):
                    node[k] = canon_id(v)
                else:
                    walk(v)
        elif isinstance(node, list):
            for v in node:
                walk(v)
    walk(doc)
    # 2) nombre canónico para entradas lema + dedupe
    for cont in doc.get('contiendas', []):
        for arr_key in ('nodos', 'opciones'):
            if arr_key not in cont:
                continue
            seen = {}
            new_arr = []
            for n in cont[arr_key]:
                pid = n.get('partidoId') or n.get('id') or n.get('opcionId')
                is_lema = n.get('nivel') == 'lema' or (arr_key == 'opciones' and 'clase' not in n and 'precandidatoId' not in n)
                if is_lema and pid in CANON_NAME:
                    if 'etiqueta' in n:
                        n['etiqueta'] = CANON_NAME[pid]
                    if 'nombre' in n:
                        n['nombre'] = CANON_NAME[pid]
                key = (n.get('nivel') or n.get('clase'), n.get('id') or n.get('opcionId'))
                if key in seen:
                    stats['catalogo_dedup'] += 1
                    continue
                seen[key] = True
                new_arr.append(n)
            cont[arr_key] = new_arr
    return True


def process():
    elections = sorted(d for d in os.listdir(DATA)
                       if os.path.isdir(os.path.join(DATA, d)) and d not in NON_ELEC)
    global CUR_EL
    for el in elections:
        CUR_EL = el
        edir = os.path.join(DATA, el)
        merge = True
        for path in glob.glob(os.path.join(edir, '**', '*.json'), recursive=True):
            bn = os.path.basename(path)
            try:
                doc = jload(path)
            except Exception:
                continue
            wrote = False
            if bn == 'opciones.json' and isinstance(doc, dict) and 'opciones' in doc:
                wrote = transform_opciones(doc, el, path)
            elif bn == 'catalogo.json' and isinstance(doc, dict) and 'contiendas' in doc:
                wrote = transform_catalogo(doc, el, path)
            elif merge and isinstance(doc, dict) and 'zonas' in doc:
                wrote = transform_zonas(doc, path)
            if wrote:
                stats['files_written'] += 1
                jdump(path, doc)

        # renombrar shards hoja/{odn,odd}/*.json (solo merge elecs)
        if merge:
            for sub in glob.glob(os.path.join(edir, '*', 'hoja', '*')):
                if not os.path.isdir(sub):
                    continue
                for shard in glob.glob(os.path.join(sub, '*.json')):
                    base = os.path.basename(shard)[:-5]
                    cbase = canon_id(base)
                    if cbase != base:
                        target = os.path.join(sub, cbase + '.json')
                        stats['shards_renamed'] += 1
                        if APPLY:
                            if os.path.exists(target):
                                warnings.append(f"SHARD COLLISION (no esperado): {shard} -> {target}")
                            else:
                                os.rename(shard, target)


def safety_scan():
    """Tras --apply: no deben quedar ids con prefijo partido- ni el caso pcn sin sufijo."""
    leftover = []
    elecs = [d for d in os.listdir(DATA) if os.path.isdir(os.path.join(DATA, d)) and d not in NON_ELEC]
    for el in elecs:
        for path in glob.glob(os.path.join(DATA, el, '**', '*.json'), recursive=True):
            txt = open(path, encoding='utf-8').read()
            if re.search(r'"(?:[a-z0-9-]*-)?partido-[a-z]', txt):
                leftover.append((path, 'partido-'))
            if re.search(r'por-los-cambios-necesarios(?!-pcn)', txt):
                leftover.append((path, 'pcn-sin-sufijo'))
    return leftover


if __name__ == '__main__':
    process()
    print(f"\n{'APPLY' if APPLY else 'DRY-RUN'} — resumen:")
    for k, v in sorted(stats.items()):
        print(f"  {k}: {v}")
    if warnings:
        print(f"\n⚠ {len(warnings)} warnings:")
        for w in warnings[:40]:
            print(f"  {w}")
    if APPLY:
        lo = safety_scan()
        if lo:
            print(f"\n❌ SAFETY SCAN: {len(lo)} archivos con ids no canónicos:")
            for p, why in lo[:20]:
                print(f"  [{why}] {os.path.relpath(p, ROOT)}")
        else:
            print("\n✅ SAFETY SCAN: no quedan ids 'partido-' ni 'pcn' sin sufijo en las internas.")
        print("\n➡ Regenerar _nacional: python3 scripts/build-nacional-votes.py")
