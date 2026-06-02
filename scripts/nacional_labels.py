"""Helper compartido (Story 15.4 fix): label legible de zona para la vista nacional.

En la vista zona nacional el geoId/name de cada zona debe ser legible Y único globalmente.
- MVD (nivel zona/barrio): el geoId YA es el nombre del barrio ("Ciudad Vieja") → identidad.
- Interior (nivel serie): el geoId es el código de serie ("jaa") → se mapea a "{Localidad} · {SERIE}"
  igual que la ficha per-depto (serie-barrio.json tiene prioridad sobre serie-localidad.json,
  como en ChoroplethMap). Ej.: "Salto · JAA".

El mismo helper se usa en build-nacional-zona-geo.py (nombres de geometría) y
build-nacional-votes.py (geoId de votes-zona) → el join norm(name==geoId) se mantiene.
"""
import json, os, glob

MAPPINGS = 'public/data/mappings'

def build_label_map(depto: str, nivel: str) -> dict:
    """raw geoId (lower) → label de display. Vacío (identidad) para MVD; 'Localidad · SERIE' interior."""
    if nivel != 'serie':
        return {}
    # serie → localidad (cobertura de todo el interior)
    loc = {}
    p = f'{MAPPINGS}/{depto}/serie-localidad.json'
    if os.path.exists(p):
        for e in json.load(open(p, encoding='utf-8')):
            s = str(e.get('serie', '')).lower()
            if s:
                loc[s] = e.get('localidad', '')
    # serie → barrio (ciudades grandes: tiene prioridad, como serieBarrioMap en el front)
    barrio = {}
    for bp in glob.glob(f'{MAPPINGS}/{depto}/*serie-barrio*.json') + glob.glob(f'{MAPPINGS}/{depto}/*barrio*.json'):
        try:
            for e in json.load(open(bp, encoding='utf-8')):
                s = str(e.get('serie', '')).lower()
                b = e.get('barrio') or e.get('localidad')
                if s and b:
                    barrio[s] = b
        except Exception:
            pass
    out = {}
    for s in set(loc) | set(barrio):
        nombre = barrio.get(s) or loc.get(s)
        out[s] = f'{nombre} · {s.upper()}' if nombre else s.upper()
    return out

def label_for(raw, lmap: dict) -> str:
    """Label de display para un geoId crudo; identidad si no está mapeado (MVD barrios / sin mapeo)."""
    return lmap.get(str(raw).lower(), str(raw))
