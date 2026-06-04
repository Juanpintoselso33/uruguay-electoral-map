#!/usr/bin/env python3
"""Story 22.1 — Mapeo serie → municipio DERIVADO del dato (sin spatial join).

En las departamentales, la contienda `municipio` se vota a nivel SERIE, pero el polígono
que queremos pintar es el MUNICIPIO. Para agregar serie→municipio sin spatial join (que en
este repo está prohibido, ver [[serie-barrio-mapeo-manual]]) lo derivamos así: cada serie se
asigna al `Municipio` (columna de la Integración de hojas) de las hojas municipales que vota.
Una serie solo puede votar candidatos de SU municipio → el mapeo es unívoco.

Salida: public/data/mappings/{depto}/serie-municipio.{eleccion}.json  (lista [{serie, municipio}]).
Falla (exit 1) si alguna serie mapea a >1 municipio (señal de bug de datos).

OJO ciclo 2020: la integración de departamentales-2020 NO trae columna `Municipio`, así que
este builder NO puede derivarlo igual. 2020 necesita otra fuente para el nombre del municipio
(pendiente — ver Story 22.6).

Uso: python scripts/build-serie-municipio.py [departamentales-2025]
"""
import csv, json, os, sys, unicodedata
from collections import defaultdict

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CODE_DEPT = {"AR": "artigas", "CA": "canelones", "CL": "cerro_largo", "CO": "colonia", "DU": "durazno",
    "FD": "florida", "FS": "flores", "LA": "lavalleja", "MA": "maldonado", "MO": "montevideo", "PA": "paysandu",
    "RN": "rio_negro", "RO": "rocha", "RV": "rivera", "SA": "salto", "SJ": "san_jose", "SO": "soriano",
    "TA": "tacuarembo", "TT": "treinta_y_tres"}

# Integración con columna Municipio por elección (solo 2025 la trae).
INTEGRACION = {
    "departamentales-2025": "data/raw/electoral/departamentales-2025/integracion-de-hojas-full.csv",
}

# Montevideo es caso especial: sus votos están keyeados por BARRIO (vía CRV→barrio), y los
# barrios NO anidan en los 8 municipios (A–G, CH) — un barrio cae en varios municipios. Su mapa
# municipal necesita CRV→municipio + geometría de los 8 municipios, aparte (pendiente, Story 22.x).
SPECIAL = {"montevideo"}


def norm_muni(s: str) -> str:
    """Normaliza el nombre de municipio (UTF-8, espacios) para joinear con la geometría (22.2)."""
    return " ".join((s or "").strip().split())


def read_csv(path):
    for enc in ("utf-8-sig", "utf-8", "latin-1"):
        try:
            with open(path, encoding=enc) as f:
                return list(csv.DictReader(f))
        except UnicodeDecodeError:
            continue
    raise SystemExit(f"no se pudo leer {path}")


def main():
    eleccion = sys.argv[1] if len(sys.argv) > 1 else "departamentales-2025"
    rel = INTEGRACION.get(eleccion)
    if not rel:
        raise SystemExit(
            f"ABORTANDO: '{eleccion}' no tiene integración con columna 'Municipio'. "
            f"(El ciclo 2020 no la publica → necesita otra fuente; ver Story 22.6.)")
    rows = read_csv(os.path.join(ROOT, rel))
    if "Municipio" not in (rows[0] if rows else {}):
        raise SystemExit(f"ABORTANDO: {rel} no tiene columna 'Municipio'.")

    base = os.path.join(ROOT, "public/data", eleccion)
    # hoja -> municipio, por código de depto (solo candidaturas MUNICIPIO)
    hoja_muni = defaultdict(dict)
    for r in rows:
        if (r.get("Candidatura") or "").strip().upper() != "MUNICIPIO":
            continue
        cod = (r.get("Departamento") or "").strip().upper()
        m = norm_muni(r.get("Municipio"))
        if cod and m:
            hoja_muni[cod][str(r.get("Numero")).strip()] = m

    total_series = total_ambig = deptos_ok = 0
    for cod, slug in sorted(CODE_DEPT.items(), key=lambda kv: kv[1]):
        if slug in SPECIAL:
            print(f"  · {slug}: SALTEADO (caso especial — votos por barrio, no anidan en municipios; pendiente CRV→municipio)")
            continue
        hoja_dir = os.path.join(base, slug, "hoja", "municipio")
        cat_path = os.path.join(base, slug, "catalogo.json")
        if not os.path.isdir(hoja_dir) or not os.path.exists(cat_path):
            continue  # depto sin contienda municipal (no todos tienen municipios)
        cat = json.load(open(cat_path, encoding="utf-8"))
        opc_hoja = {o["id"]: str(o["hoja"]) for c in cat.get("contiendas", [])
                    if c.get("contienda") == "municipio"
                    for o in c.get("opciones", []) if o.get("hoja") is not None}

        serie_muni = defaultdict(set)
        for fn in sorted(os.listdir(hoja_dir)):
            if not fn.endswith(".json"):
                continue
            for z in json.load(open(os.path.join(hoja_dir, fn), encoding="utf-8")).get("zonas", []):
                for o in z.get("porOpcion", []):
                    h = opc_hoja.get(o["opcionId"])
                    m = hoja_muni[cod].get(h) if h else None
                    if m:
                        serie_muni[z["geoId"]].add(m)

        ambig = {s: sorted(ms) for s, ms in serie_muni.items() if len(ms) != 1}
        total_ambig += len(ambig)
        if ambig:
            print(f"  ✗ {slug}: {len(ambig)} series ambiguas → {list(ambig.items())[:3]}")
            continue

        mapping = sorted(({"serie": s.upper(), "municipio": next(iter(ms))}
                          for s, ms in serie_muni.items()), key=lambda x: x["serie"])
        # Los mapeos viven en public/data/mappings/{depto}/ (junto a serie-localidad.json).
        dest = os.path.join(ROOT, "public/data/mappings", slug)
        os.makedirs(dest, exist_ok=True)
        with open(os.path.join(dest, f"serie-municipio.{eleccion}.json"), "w", encoding="utf-8") as f:
            json.dump(mapping, f, ensure_ascii=False, indent=1)
        munis = sorted({m["municipio"] for m in mapping})
        print(f"  ✓ {slug}: {len(mapping)} series → {len(munis)} municipios")
        total_series += len(mapping)
        deptos_ok += 1

    print(f"\n{eleccion}: {deptos_ok} deptos con municipios · {total_series} series mapeadas · "
          f"{total_ambig} ambiguas")
    if total_ambig:
        raise SystemExit("GATE FALLÓ: hay series que mapean a >1 municipio.")
    print("GATE OK: cada serie con voto municipal → exactamente 1 municipio.")


if __name__ == "__main__":
    main()
