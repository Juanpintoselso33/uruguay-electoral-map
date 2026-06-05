"""Story 15.2 — Agregación nacional por departamento (votes.json nivel 'departamento').

Por elección, lee los 19 votes.json por-depto, suma porOpcion de TODAS sus zonas por opcionId
→ porOpcion a nivel depto → ganadorOpcionId = argmax. Genera el shard nacional que la página
/{eleccion} consume (departamento='_nacional', nivel='departamento'):
  public/data/{eleccion}/_nacional/votes.json      (19 'zonas' = deptos, geoId = label del depto)
  public/data/{eleccion}/_nacional/opciones.json   (unión de opcionId→nombre + pregunta si aplica)

Clave de agregación = opcionId (verificado consistente entre deptos; los "conflictos" id→nombre
son solo casing, p.ej. "FRENTE AMPLIO" vs "Frente Amplio"). geoId del shard = label del depto,
que matchea feature.properties.name del departamento.topo.json vía norm() (igual que el resto).

GATES:
  (1) Reconciliación (AC): por depto Σ(zonas.porOpcion) == depto.porOpcion y Σ(deptos) == nacional,
      delta EXACTO 0 → la agregación no pierde ni duplica votos.
  (2) Ancla independiente (tripwire, donde se declara): Σ nacional por opción == total publicado
      oficial. Declarada para Vivir sin Miedo (Sí=1.139.433). El resto loguea su total nacional
      para auditoría (NO hay cap silencioso). Nota: por placement<100% en los shards, el agregado
      puede subcontar levemente el total oficial real — el delta queda acotado y visible en el log.
"""
import json, os, sys, unicodedata
from collections import defaultdict
from nacional_labels import build_label_map, label_for

GEO = 'public/data/geo'

def merged_labels(depto):
    """Labels mergeados ('a-b-c') de la geometría serie del depto (16.3) → [(label, [partes])]."""
    p = f'{GEO}/{depto}/serie.topo.json'
    if not os.path.exists(p): return []
    t = json.load(open(p, encoding='utf-8')); o = list(t['objects'].keys())[0]
    out = []
    for g in t['objects'][o]['geometries']:
        nm = str(g.get('properties', {}).get('name', ''))
        if '-' in nm:
            out.append((nm, nm.split('-')))
    return out

def nrm(s):
    s = unicodedata.normalize('NFD', str(s)); s = ''.join(c for c in s if unicodedata.category(c) != 'Mn')
    return s.lower().strip()

DATA = 'public/data'
DEPTS = 'src/config/departments.json'
NO_ELEC = {'geo', 'geographic', 'mappings', 'electoral', 'hoja-equivalencias'}

# Anclas nacionales oficiales independientes (opcionId → total). Tripwire, no exhaustivo.
ANCLAS = {
    'plebiscito-vivir-sin-miedo-2019': {'si': 1_139_433},
}

def norm(s):
    return unicodedata.normalize('NFD', s).encode('ascii', 'ignore').decode().lower().strip()

def mejor_nombre(nombres):
    """Entre variantes de casing del mismo opcionId, preferir la que NO es todo-mayúsculas."""
    no_upper = [n for n in nombres if n != n.upper()]
    return sorted(no_upper or list(nombres))[0]

def agregar_eleccion(eleccion, id2label):
    base = f'{DATA}/{eleccion}'
    # SOLO los 19 deptos reales (excluye _nacional y cualquier carpeta no-depto, evita auto-sumarse al re-correr).
    deptos = sorted(d for d in id2label
                    if os.path.exists(f'{base}/{d}/votes.json'))
    # Elecciones que no cubren los 19 deptos a nivel votes.json por-depto (p.ej. departamentales-2015,
    # sin Montevideo a este nivel) tienen su _nacional generado por su propio builder; se OMITEN aquí
    # para no pisar/crashear (no es un error: es cobertura parcial real de esa instancia).
    if len(deptos) != 19:
        print(f'  ⏭ {eleccion}: {len(deptos)}/19 deptos con votes.json — se omite (cobertura parcial)')
        return
    tipo = None
    nombres_por_id = defaultdict(set)
    pregunta = None
    zonas_nac = []
    zonas_zona = []                           # nivel zona nacional (15.4): todas las zonas namespaceadas
    annex_feats = []                          # override de anexión nacional (16.4 propagado a zona nacional)
    nac_por_opcion = defaultdict(int)         # para gate ancla
    for d in deptos:
        v = json.load(open(f'{base}/{d}/votes.json', encoding='utf-8'))
        tipo = tipo or v.get('tipo')
        label = id2label.get(d, d)
        # Nivel zona nacional: geoId legible y único = label de zona (MVD barrio; interior
        # "Localidad · SERIE"), igual que la geometría zona.topo.json → join norm(name==geoId) intacto.
        lmap_zona = build_label_map(d, v['nivel'])
        # (16.3 propagado) MERGE: el polígono 'a-b-c' de la geometría suma sus series constituyentes.
        zpid = {nrm(z['geoId']): z for z in v['zonas']}
        consumido = set()
        for mlabel, partes in merged_labels(d):  # NO reusar `label` (es el label del depto, l.76)
            zs = [zpid[nrm(p)] for p in partes if nrm(p) in zpid]
            if not zs: continue
            po = defaultdict(int); vv = eb = an = ob = 0
            for z in zs:
                for op in z['porOpcion']: po[op['opcionId']] += op['votos']
                vv += z.get('validos', 0); npd = z.get('noPartidarios', {})
                eb += npd.get('enBlanco', 0); an += npd.get('anulados', 0); ob += npd.get('observados', 0)
            if not po: continue
            zonas_zona.append({'geoId': label_for(mlabel, lmap_zona),
                'ganadorOpcionId': max(po.items(), key=lambda kv: kv[1])[0], 'validos': vv,
                'porOpcion': [{'opcionId': k, 'votos': po[k]} for k in sorted(po, key=lambda k: -po[k])],
                'noPartidarios': {'enBlanco': eb, 'anulados': an, 'observados': ob}})
            for p in partes: consumido.add(nrm(p))
        for z in v['zonas']:
            if nrm(z['geoId']) in consumido: continue   # ya contabilizada en el mergeado
            zonas_zona.append({**z, 'geoId': label_for(z['geoId'], lmap_zona)})
        # (16.4 propagado) ANEXIÓN: relabel del serie-annexed per-depto → override nacional de zona.
        sa = f'{base}/{d}/serie-annexed.json'
        if os.path.exists(sa):
            for f in json.load(open(sa, encoding='utf-8'))['features']:
                annex_feats.append({'type': 'Feature',
                    'properties': {'name': label_for(f['properties']['name'], lmap_zona),
                                   'replaces': [label_for(r, lmap_zona) for r in f['properties'].get('replaces', [])]},
                    'geometry': f['geometry']})
        por_opcion = defaultdict(int)
        validos = enblanco = anulados = observados = 0
        for z in v['zonas']:
            for po in z['porOpcion']:
                por_opcion[po['opcionId']] += po['votos']
            validos += z.get('validos', 0)
            np = z.get('noPartidarios', {})
            enblanco += np.get('enBlanco', 0); anulados += np.get('anulados', 0); observados += np.get('observados', 0)
        # GATE (1) reconciliación intra-depto: Σ zonas por opción == lo agregado (trivial pero detecta bugs de iteración)
        chk = defaultdict(int)
        for z in v['zonas']:
            for po in z['porOpcion']: chk[po['opcionId']] += po['votos']
        assert chk == por_opcion, f'{eleccion}/{d}: reconciliación intra-depto falló'
        if not por_opcion:
            continue
        ganador = max(por_opcion.items(), key=lambda kv: kv[1])[0]
        zonas_nac.append({
            'geoId': label,
            'ganadorOpcionId': ganador,
            'validos': validos,
            'porOpcion': [{'opcionId': k, 'votos': por_opcion[k]} for k in sorted(por_opcion, key=lambda k: -por_opcion[k])],
            'noPartidarios': {'enBlanco': enblanco, 'anulados': anulados, 'observados': observados},
        })
        for k, val in por_opcion.items():
            nac_por_opcion[k] += val
        # nombres para opciones.json nacional
        op = json.load(open(f'{base}/{d}/opciones.json', encoding='utf-8'))
        pregunta = pregunta or op.get('pregunta')
        for o in op['opciones']:
            nombres_por_id[o['opcionId']].add(o['nombre'])

    # GATE (2) ancla independiente: el agregado debe acercarse al total oficial publicado.
    # Tolerancia: subcuenta ≤3% (pérdida por placement<100% de los shards upstream, esperada y
    # documentada) y NUNCA sobreconteo >0,1% (eso indicaría doble-suma → bug). El delta se loguea
    # siempre, no se oculta.
    TOL_UNDER, TOL_OVER = 0.03, 0.001
    ancla = ANCLAS.get(eleccion)
    if ancla:
        partes = []
        for opc, oficial in ancla.items():
            got = nac_por_opcion.get(opc, 0)
            delta = got - oficial
            frac = delta / oficial
            assert frac <= TOL_OVER, f'{eleccion}: ANCLA {opc} SOBRECONTEO agregado={got:,} > oficial={oficial:,} (+{frac:.2%}) → posible doble-suma'
            assert -frac <= TOL_UNDER, f'{eleccion}: ANCLA {opc} subcuenta {-frac:.2%} > {TOL_UNDER:.0%} agregado={got:,} vs oficial={oficial:,} → placement upstream sospechoso'
            partes.append(f'{opc}={got:,}/{oficial:,} ({frac:+.2%})')
        ancla_txt = '  ✓ancla ' + ', '.join(partes)
    else:
        ancla_txt = '  (sin ancla declarada — total auditable abajo)'

    votes_nac = {
        'eleccionId': eleccion, 'departamento': '_nacional', 'nivel': 'departamento',
        'escrutinio': 'definitivo', 'tipo': tipo, 'zonas': zonas_nac,
    }
    opciones_nac = {'opciones': [{'opcionId': k, 'nombre': mejor_nombre(nombres_por_id[k])}
                                 for k in sorted(nombres_por_id)]}
    if pregunta:
        opciones_nac = {'pregunta': pregunta, **opciones_nac}

    votes_zona = {
        'eleccionId': eleccion, 'departamento': '_nacional', 'nivel': 'zona',
        'escrutinio': 'definitivo', 'tipo': tipo, 'zonas': zonas_zona,
    }

    outdir = f'{base}/_nacional'
    os.makedirs(outdir, exist_ok=True)

    def _write(name, obj):  # context manager + retry (Windows EINVAL bajo file-watcher)
        import time
        path = f'{outdir}/{name}'
        for attempt in range(5):
            try:
                with open(path, 'w', encoding='utf-8') as fh:
                    json.dump(obj, fh, ensure_ascii=False)
                return
            except OSError:
                if attempt == 4:
                    raise
                time.sleep(0.2)

    _write('votes.json', votes_nac)
    _write('votes-zona.json', votes_zona)
    # override de anexión para la vista zona nacional (16.4 propagado); el front lo aplica como en per-depto
    if annex_feats:
        _write('zona-annexed.json', {'type': 'FeatureCollection', 'features': annex_feats})
    _write('opciones.json', opciones_nac)

    tot_validos = sum(z['validos'] for z in zonas_nac)
    top = sorted(nac_por_opcion.items(), key=lambda kv: -kv[1])[:3]
    print(f'  {eleccion}: {len(zonas_nac)} deptos, válidos={tot_validos:,}, opciones={len(nombres_por_id)}{ancla_txt}')
    print(f'      top nacional: ' + ', '.join(f'{nombres_por_id[k] and mejor_nombre(nombres_por_id[k])}={v:,}' for k, v in top))

def main():
    id2label = {d['id']: d['label'] for d in json.load(open(DEPTS, encoding='utf-8'))}
    elecciones = sorted(e for e in os.listdir(DATA)
                        if os.path.isdir(f'{DATA}/{e}') and e not in NO_ELEC
                        and os.path.exists(f'{DATA}/{e}'))
    elecciones = [e for e in elecciones if any(
        os.path.exists(f'{DATA}/{e}/{d}/votes.json') for d in os.listdir(f'{DATA}/{e}')
        if os.path.isdir(f'{DATA}/{e}/{d}'))]
    print(f'Agregando {len(elecciones)} elecciones a nivel departamento nacional...')
    for e in elecciones:
        agregar_eleccion(e, id2label)
    print(f'✅ {len(elecciones)} shards nacionales escritos en public/data/*/_nacional/')

if __name__ == '__main__':
    sys.exit(main())
