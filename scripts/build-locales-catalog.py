#!/usr/bin/env python3
"""
Epic 17 · Story 17.1 — Catálogo de LOCALES de votación (ancla geográfica estable).

Agrupa el plan circuital georreferenciado 2024 (único insumo con lat/lon) por
coordenada → un LOCAL por venue físico. Cada local agrega los circuitos 2024 que
votan ahí, sus series y rangos de credencial (para el matching interelección de
Story 17.3) y la suma de habilitados.

Salidas:
  data/processed/locales/{dept}.json        ← catálogo (usado por el motor de votos)
  public/data/geo/{dept}/local.topo.json    ← TopoJSON de puntos (1 por local) p/ el mapa
"""
import csv, json, os, unicodedata
from collections import defaultdict

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
GEOREF = os.path.join(ROOT, "data/raw/geographic/plan-circuital-georreferencia-nacional-2024.csv")
OUT_CAT = os.path.join(ROOT, "data/processed/locales")
OUT_GEO = os.path.join(ROOT, "public/data/geo")

# planName (como aparece en el georef, col Departamento) → dir de departamento en /geo
DEPT_DIR = {
    "ARTIGAS": "artigas", "CANELONES": "canelones", "CERRO LARGO": "cerro_largo",
    "COLONIA": "colonia", "DURAZNO": "durazno", "FLORES": "flores", "FLORIDA": "florida",
    "LAVALLEJA": "lavalleja", "MALDONADO": "maldonado", "MONTEVIDEO": "montevideo",
    "PAYSANDU": "paysandu", "RIO NEGRO": "rio_negro", "RIVERA": "rivera", "ROCHA": "rocha",
    "SALTO": "salto", "SAN JOSE": "san_jose", "SORIANO": "soriano",
    "TACUAREMBO": "tacuarembo", "TREINTA Y TRES": "treinta_y_tres",
}

def norm(s: str) -> str:
    s = unicodedata.normalize("NFD", s or "")
    s = "".join(c for c in s if unicodedata.category(c) != "Mn")
    return s.upper().strip()

def venue_name(direccion: str) -> str:
    """Nombre del local: parte previa al primer '-' (el resto suele ser la calle)."""
    d = (direccion or "").strip()
    return (d.split("-", 1)[0]).strip() or d

def to_float(s):
    try: return float((s or "").replace(",", ".").strip())
    except: return None

def main():
    # 1) leer georef
    with open(GEOREF, encoding="utf-8-sig", newline="") as f:
        rows = list(csv.DictReader(f, delimiter=";"))
        # normalizar nombres de columnas (algunas con mayúscula inicial distinta)
        # keys: Departamento;NroCircuito;Serie;Desde;Hasta;Habilitados;Localidad;direccion;accesibilidad;Latitud;Longitud;municipio;tipocircuito

    by_dept = defaultdict(list)
    for r in rows:
        dep = norm(r.get("Departamento", ""))
        ddir = DEPT_DIR.get(dep)
        if not ddir:
            continue
        by_dept[ddir].append(r)

    os.makedirs(OUT_CAT, exist_ok=True)
    grand = {"locales": 0, "circuitos": 0, "habilitados": 0}

    for ddir, drows in sorted(by_dept.items()):
        # agrupar por coordenada exacta (string) = un local físico
        groups = defaultdict(list)
        for r in drows:
            lat = (r.get("Latitud") or "").strip()
            lon = (r.get("Longitud") or "").strip()
            if not lat or not lon:
                continue
            groups[(lat, lon)].append(r)

        locales = []
        # orden determinístico: por (serie mínima, desde mínimo)
        def gkey(item):
            rs = item[1]
            series = sorted(rr.get("Serie", "").strip() for rr in rs)
            desdes = sorted(int(rr["Desde"]) for rr in rs if (rr.get("Desde") or "").strip().isdigit())
            return (series[0] if series else "", desdes[0] if desdes else 0)

        for i, ((lat, lon), rs) in enumerate(sorted(groups.items(), key=gkey), start=1):
            circuitos = sorted({int(rr["NroCircuito"]) for rr in rs if (rr.get("NroCircuito") or "").strip().isdigit()})
            series = sorted({rr.get("Serie", "").strip() for rr in rs if rr.get("Serie", "").strip()})
            hab = sum(int(rr["Habilitados"]) for rr in rs if (rr.get("Habilitados") or "").strip().isdigit())
            # rangos de credencial por circuito (para matching por solapamiento)
            ranges = []
            for rr in rs:
                s = rr.get("Serie", "").strip()
                d = rr.get("Desde", "").strip(); h = rr.get("Hasta", "").strip()
                if s and d.isdigit() and h.isdigit():
                    ranges.append([s, int(d), int(h)])
            # dirección/nombre representativos (el más frecuente)
            dirs = [rr.get("direccion", "").strip() for rr in rs if rr.get("direccion", "").strip()]
            direccion = max(set(dirs), key=dirs.count) if dirs else ""
            locs = [rr.get("Localidad", "").strip() for rr in rs if rr.get("Localidad", "").strip()]
            localidad = max(set(locs), key=locs.count) if locs else ""
            locales.append({
                "localId": f"{ddir}-L{i:03d}",
                "lat": to_float(lat), "lon": to_float(lon),
                "nombre": venue_name(direccion), "direccion": direccion,
                "nombreNorm": norm(venue_name(direccion)),
                "localidad": localidad,
                "series": series, "circuitos": circuitos,
                "habilitados": hab, "ranges": ranges,
            })

        cat = {"dept": ddir, "locales": locales}
        with open(os.path.join(OUT_CAT, f"{ddir}.json"), "w", encoding="utf-8") as f:
            json.dump(cat, f, ensure_ascii=False)

        # geo TopoJSON de puntos (1 por local) — formato que ya consume el mapa
        geometries = [{
            "type": "Point",
            "coordinates": [lo["lon"], lo["lat"]],
            "properties": {"name": lo["localId"], "habilitados": lo["habilitados"], "nombre": lo["nombre"]},
        } for lo in locales if lo["lat"] is not None and lo["lon"] is not None]
        topo = {"type": "Topology", "objects": {"zonas": {"type": "GeometryCollection", "geometries": geometries}}}
        gdir = os.path.join(OUT_GEO, ddir)
        os.makedirs(gdir, exist_ok=True)
        with open(os.path.join(gdir, "local.topo.json"), "w", encoding="utf-8") as f:
            json.dump(topo, f, ensure_ascii=False)

        nc = sum(len(lo["circuitos"]) for lo in locales)
        nh = sum(lo["habilitados"] for lo in locales)
        grand["locales"] += len(locales); grand["circuitos"] += nc; grand["habilitados"] += nh
        print(f"  {ddir:16} locales={len(locales):4}  circuitos={nc:5}  habilitados={nh:>9,}")

    print(f"\nTOTAL  locales={grand['locales']:,}  circuitos={grand['circuitos']:,}  habilitados={grand['habilitados']:,}")

if __name__ == "__main__":
    main()
