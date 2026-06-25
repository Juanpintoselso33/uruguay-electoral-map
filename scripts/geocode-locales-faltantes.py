#!/usr/bin/env python3
"""Geocodifica los LOCALES de votación que quedaron sin coordenada en el catálogo
(data/processed/locales/{depto}.json) y reconstruye public/data/geo/{depto}/local.topo.json.

Contexto: el plan circuital oficial de la Corte NO trae coordenadas; las coords del repo
vinieron de una geocodificación previa que dejó algunos venues sin ubicar (p.ej. Canelones, 33).
Acá los completamos con Nominatim (OSM), pero ACOTADO y VALIDADO por localidad para no caer en
el pueblo equivocado: anclamos cada localidad (centroide de sus venues ya geocodificados, o el
geocode del nombre de la localidad) y aceptamos un hit sólo si cae dentro del radio de validación.
Los que no resuelven bien quedan SIN punto (cobertura parcial honesta). Cachea en _geocode-cache.json.

Uso: python scripts/geocode-locales-faltantes.py <depto>   (ej. canelones)
"""
import json, math, os, sys, time, unicodedata, urllib.parse, urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CAT_DIR = os.path.join(ROOT, "data/processed/locales")
GEO_DIR = os.path.join(ROOT, "public/data/geo")
CACHE = os.path.join(CAT_DIR, "_geocode-cache.json")

# bbox grueso de Uruguay (sanity) y radio de validación contra el ancla de la localidad.
UY_BBOX = (-35.2, -30.0, -58.6, -53.0)  # (lat_min, lat_max, lon_min, lon_max)
VALID_RADIUS_KM = 4.0  # ajustado: los pueblos de la Costa de Oro están a ~2-4km → radio amplio cae en el pueblo vecino
UA = {"User-Agent": "uruguay-electoral-map/1.0 (geocoding locales de votacion)"}


def norm(s):
    return "".join(c for c in unicodedata.normalize("NFD", str(s or "")) if unicodedata.category(c) != "Mn").upper().strip()


def haversine_km(a, b):
    (la1, lo1), (la2, lo2) = a, b
    r = 6371.0
    dla, dlo = math.radians(la2 - la1), math.radians(lo2 - lo1)
    h = math.sin(dla / 2) ** 2 + math.cos(math.radians(la1)) * math.cos(math.radians(la2)) * math.sin(dlo / 2) ** 2
    return 2 * r * math.asin(math.sqrt(h))


def in_bbox(lat, lon, bbox):
    return bbox[0] <= lat <= bbox[1] and bbox[2] <= lon <= bbox[3]


_cache = json.load(open(CACHE, encoding="utf-8")) if os.path.exists(CACHE) else {}


def geocode(q, viewbox=None):
    """Nominatim. viewbox=(lat_min,lat_max,lon_min,lon_max) → bounded. Cachea por (q,viewbox)."""
    key = q + ("|" + ",".join(f"{x:.3f}" for x in viewbox) if viewbox else "")
    if key in _cache:
        return _cache[key]
    params = {"q": q, "format": "json", "limit": 1, "countrycodes": "uy"}
    if viewbox:
        params["viewbox"] = f"{viewbox[2]},{viewbox[1]},{viewbox[3]},{viewbox[0]}"  # lon_min,lat_max,lon_max,lat_min
        params["bounded"] = 1
    url = "https://nominatim.openstreetmap.org/search?" + urllib.parse.urlencode(params)
    try:
        r = json.load(urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=25))
        res = [float(r[0]["lat"]), float(r[0]["lon"])] if r else None
    except Exception:
        res = None
    _cache[key] = res
    time.sleep(1.1)  # política Nominatim: ≤1 req/s
    return res


def street_of(direccion):
    """direccion = 'VENUE-calle …' → la parte de calle (lo posterior al primer '-')."""
    parts = (direccion or "").split("-", 1)
    return (parts[1] if len(parts) > 1 else parts[0]).strip()


def main():
    if len(sys.argv) < 2:
        print("uso: geocode-locales-faltantes.py <depto>"); return 1
    depto = sys.argv[1]
    cat_path = os.path.join(CAT_DIR, f"{depto}.json")
    cat = json.load(open(cat_path, encoding="utf-8"))
    locales = cat["locales"]
    depto_label = depto.replace("_", " ")

    # 1) Anclas por localidad: centroide de venues YA geocodificados de esa localidad.
    anchors = {}
    by_loc = {}
    for lo in locales:
        by_loc.setdefault(norm(lo.get("localidad")), []).append(lo)
    for locn, los in by_loc.items():
        pts = [(lo["lat"], lo["lon"]) for lo in los if lo.get("lat") and lo.get("lon")]
        if pts:
            anchors[locn] = (sum(p[0] for p in pts) / len(pts), sum(p[1] for p in pts) / len(pts))

    missing = [lo for lo in locales if not (lo.get("lat") and lo.get("lon"))]
    print(f"{depto}: {len(missing)} locales sin coord (de {len(locales)})")

    resolved = 0
    for lo in missing:
        locn = norm(lo.get("localidad"))
        localidad = lo.get("localidad", "")
        # ancla: venues existentes de la localidad, o geocode del nombre de la localidad.
        anchor = anchors.get(locn)
        if not anchor:
            a = geocode(f"{localidad}, {depto_label}, Uruguay")
            if a and in_bbox(a[0], a[1], UY_BBOX):
                anchor = tuple(a); anchors[locn] = anchor
        vb = (anchor[0] - 0.05, anchor[0] + 0.05, anchor[1] - 0.05, anchor[1] + 0.05) if anchor else None
        # intentar calle y nombre del venue; primero acotado al viewbox, luego SIN viewbox pero
        # validado por radio contra el ancla (a veces bounded no devuelve nada aunque la calle
        # esté cerca). NUNCA aceptamos un hit fuera del radio → no caemos en el pueblo equivocado.
        cand = None
        street_q = f"{street_of(lo.get('direccion'))}, {localidad}, {depto_label}, Uruguay"
        name_q = f"{lo.get('nombre','')}, {localidad}, {depto_label}, Uruguay"
        attempts = [(street_q, vb), (name_q, vb), (street_q, None), (name_q, None)]
        for q, box in attempts:
            hit = geocode(q, viewbox=box)
            if hit and in_bbox(hit[0], hit[1], UY_BBOX) and (not anchor or haversine_km(anchor, tuple(hit)) <= VALID_RADIUS_KM):
                cand = hit; break
        if cand:
            lo["lat"], lo["lon"] = round(cand[0], 6), round(cand[1], 6)
            lo["geocoded"] = True  # marca de procedencia (no es coord oficial)
            resolved += 1
        else:
            print(f"   sin resolver: {lo['localId']}  '{lo.get('direccion','')[:50]}'  (localidad={localidad})")

    json.dump(_cache, open(CACHE, "w", encoding="utf-8"), ensure_ascii=False, indent=0)
    json.dump(cat, open(cat_path, "w", encoding="utf-8"), ensure_ascii=False)
    print(f"  resueltos {resolved}/{len(missing)}; catálogo actualizado → {cat_path}")

    # 2) Reconstruir local.topo.json (mismo formato que build-locales-catalog).
    topo_path = os.path.join(GEO_DIR, depto, "local.topo.json")
    obj_key = "zonas"
    if os.path.exists(topo_path):
        obj_key = next(iter(json.load(open(topo_path, encoding="utf-8"))["objects"].keys()))
    geometries = [{
        "type": "Point", "coordinates": [lo["lon"], lo["lat"]],
        "properties": {"name": lo["localId"], "habilitados": lo.get("habilitados", 0), "nombre": lo.get("nombre", "")},
    } for lo in locales if lo.get("lat") and lo.get("lon")]
    topo = {"type": "Topology", "objects": {obj_key: {"type": "GeometryCollection", "geometries": geometries}}}
    json.dump(topo, open(topo_path, "w", encoding="utf-8"), ensure_ascii=False)
    print(f"  local.topo.json: {len(geometries)} puntos → {topo_path}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
