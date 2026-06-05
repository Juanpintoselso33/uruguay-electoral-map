#!/usr/bin/env python3
"""Re-geocodifica (Nominatim/OSM) los locales de votación cuyo punto del georef-2024 es un
FALLBACK erróneo: el georef colapsa varios venues distintos en UNA misma coordenada (geocoding
fallido al centroide/depto). Eso fusionaba locales en el catálogo (bug "falta el St. George" —
serie BCA, circuitos 772-775, apilado dentro de "Escuela Nº 173").

Estrategia:
  - Detectar coordenadas compartidas por >1 venue distinto (por depto) → esos son los sospechosos.
  - Geocodificar la DIRECCIÓN (parte tras el primer '-' de `direccion`) vía Nominatim.
  - Guard: aceptar el resultado solo si cae dentro del bbox del depto (derivado de las coords
    BUENAS, no colisionadas) + margen. Rechaza homónimos en otro depto/país.
  - Cachear norm(direccion) -> [lon, lat] en data/mappings/locales-coords-cache.json.
    COMMITEAR el cache → build reproducible sin red. Resumible e idempotente.

Política Nominatim: ~1 req/seg, User-Agent identificable. Uso puntual (one-time).
Uso: python scripts/geocode-locales-coords.py
"""
import csv, re, json, time, os, unicodedata, urllib.request, urllib.parse
from collections import defaultdict

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
GEOREF = os.path.join(ROOT, "data/raw/geographic/plan-circuital-georreferencia-nacional-2024.csv")
CACHE = os.path.join(ROOT, "data/mappings/locales-coords-cache.json")

DEPT_QUERY = {  # nombre depto (col Departamento) -> término para la query Nominatim
    "Artigas": "Artigas", "Canelones": "Canelones", "Cerro Largo": "Cerro Largo",
    "Colonia": "Colonia", "Durazno": "Durazno", "Flores": "Flores", "Florida": "Florida",
    "Lavalleja": "Lavalleja", "Maldonado": "Maldonado", "Montevideo": "Montevideo",
    "Paysandú": "Paysandú", "Río Negro": "Río Negro", "Rivera": "Rivera", "Rocha": "Rocha",
    "Salto": "Salto", "San José": "San José", "Soriano": "Soriano",
    "Tacuarembó": "Tacuarembó", "Treinta y Tres": "Treinta y Tres",
}

def norm(s):
    s = unicodedata.normalize("NFD", s or ""); s = "".join(c for c in s if unicodedata.category(c) != "Mn")
    return re.sub(r"\s+", " ", s).upper().strip()

def venue(d): return (d or "").split("-", 1)[0].strip()
def addr(d):
    p = (d or "").split("-", 1)
    return p[1].strip() if len(p) > 1 else ""

def candidates(direccion):
    """Consultas a probar, de más específica a menos: 'CALLE NUM', esquina, calle sola."""
    a = addr(direccion)
    out = []
    if a:
        # cortar en 'esq'/'esquina'/','  → "DONIZETTI 1353 esq. VERDI" -> "DONIZETTI 1353" + "VERDI"
        m = re.split(r"\besq\.?\b|\besquina\b|,", a, flags=re.IGNORECASE)
        base = m[0].strip()
        if base: out.append(base)
        if len(m) > 1 and m[1].strip(): out.append(m[1].strip())
        if a not in out: out.append(a)
    return out

def geocode(query):
    u = "https://nominatim.openstreetmap.org/search?q=" + urllib.parse.quote(query) + "&format=json&limit=1"
    req = urllib.request.Request(u, headers={"User-Agent": "uruguay-electoral-map/1.0 (one-time geocode of polling places)"})
    try:
        d = json.load(urllib.request.urlopen(req, timeout=25))
        if d: return (float(d[0]["lon"]), float(d[0]["lat"]))
    except Exception:
        return None
    return None

def main():
    rows = list(csv.DictReader(open(GEOREF, encoding="utf-8-sig", newline=""), delimiter=";"))
    bydep = defaultdict(list)
    for r in rows:
        dep = (r.get("Departamento") or "").strip()
        if dep in DEPT_QUERY:
            bydep[dep].append(r)

    # bbox por depto desde coords BUENAS (las que tienen 1 solo venue) + objetivos (venues colisionados)
    targets = []  # (dep, direccion, [lon,lat] viejo)
    bbox = {}
    for dep, rs in bydep.items():
        bycoord = defaultdict(list)
        for r in rs:
            lat = (r.get("Latitud") or "").strip(); lon = (r.get("Longitud") or "").strip()
            if lat and lon: bycoord[(lat, lon)].append(r)
        good_lat = []; good_lon = []
        seen_dir = set()
        for (lat, lon), grs in bycoord.items():
            venues = {venue(x["direccion"]) for x in grs}
            if len(venues) > 1:  # coord colapsada → cada venue es objetivo
                for x in grs:
                    dd = (x.get("direccion") or "").strip()
                    if dd and dd not in seen_dir:
                        seen_dir.add(dd); targets.append((dep, dd))
            else:  # coord buena → alimenta el bbox
                try:
                    good_lat.append(float(lat.replace(",", "."))); good_lon.append(float(lon.replace(",", ".")))
                except ValueError:
                    pass
        if good_lat:
            m = 0.06  # ~6 km de margen
            bbox[dep] = (min(good_lon) - m, max(good_lon) + m, min(good_lat) - m, max(good_lat) + m)

    cache = json.load(open(CACHE, encoding="utf-8")) if os.path.exists(CACHE) else {}
    todo = [(dep, dd) for dep, dd in targets if norm(dd) not in cache]
    print(f"objetivos={len(targets)} | en cache={len(targets)-len(todo)} | a geocodificar={len(todo)}")

    hits = 0
    for i, (dep, dd) in enumerate(todo):
        bb = bbox.get(dep)
        found = None
        for cand in candidates(dd):
            co = geocode(f"{cand}, {DEPT_QUERY[dep]}, Uruguay")
            time.sleep(1.1)
            if co and (bb is None or (bb[0] <= co[0] <= bb[1] and bb[2] <= co[1] <= bb[3])):
                found = [round(co[0], 7), round(co[1], 7)]; break
        cache[norm(dd)] = found
        if found: hits += 1
        if (i + 1) % 20 == 0:
            json.dump(cache, open(CACHE, "w", encoding="utf-8"), ensure_ascii=False, indent=0)
            print(f"  {i+1}/{len(todo)} · hits {hits} · {dep}: {venue(dd)[:30]} -> {found}")
    json.dump(cache, open(CACHE, "w", encoding="utf-8"), ensure_ascii=False, indent=0)
    placed = sum(1 for v in cache.values() if v)
    print(f"LISTO. cache={len(cache)} · ubicados={placed} ({100*placed/max(1,len(cache)):.0f}%) · sin ubicar={len(cache)-placed}")

if __name__ == "__main__":
    main()
