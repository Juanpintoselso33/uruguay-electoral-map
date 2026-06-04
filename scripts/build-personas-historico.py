#!/usr/bin/env python3
"""Puente histórico de la dimensión persona↔hoja hacia elecciones SIN credencial
(nacionales-2019, internas-2019, departamentales-2020).

La integración de hojas de esos años NO trae CredencialSerie/Numero (la Corte recién la
publica desde 2024), así que no se pueden keyear por credencial como [[build-personas-hoja]].
La credencial tampoco serviría de id estable de por vida: cambia con el traslado (serie =
departamento de residencia). El único puente viable es por NOMBRE.

Estrategia (testeada en spikes/test-identidad-matcheo.py): el nombre es casi-único
(0.15% de homónimos; 0.01% entre legisladores/intendentes). Indexamos nombre→credencial
desde los shards de la era credencial y, para cada candidato 2019/2020 cuyo nombre apunta a
UNA sola credencial (unívoco), le anexamos esa aparición histórica con `match: "nombre"`
(confianza menor que las nativas `match: "credencial"`). Los nombres ambiguos (homónimos) y
los que no matchean ninguna credencial se descartan: solo EXTENDEMOS personas existentes
hacia atrás, no creamos identidades nuevas (no aportarían cruce cross-año).

Salida: public/data/personas/personas-historico.{eleccion}.json (mismo schema que los
shards nativos + flag `match`). Patrón de archivo DISTINTO a `personas-hoja.*` a propósito:
`gate-personas.py` solo valida los nativos (asume catalogo/hoja-local, que no existen para
2019/2020). `build-personas-canonical.py` glob-ea ambos patrones y los consolida.

Uso: python scripts/build-personas-historico.py   (correr ANTES de etl:personas)
"""
import csv, json, os, unicodedata
from collections import defaultdict

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DIR = os.path.join(ROOT, "public/data/personas")

# Shards de la era credencial (fuente del índice nombre→credencial).
ERA_CRED = ["nacionales-2024", "internas-2024", "departamentales-2025"]

# Elecciones a puentear (sin credencial en origen).
HISTORICO = [
    ("nacionales-2019", "data/raw/electoral/nacionales-2019/integracion-hojas.csv"),
    ("internas-2019", "data/raw/electoral/internas-2019/integraci-n-de-las-hojas-de-votaci-n.csv"),
    ("departamentales-2020", "data/raw/electoral/departamentales-2020/integraci-n-de-las-hojas-de-votaci-n.csv"),
]

CODE_DEPT = {"AR": "artigas", "CA": "canelones", "CL": "cerro_largo", "CO": "colonia", "DU": "durazno",
    "FD": "florida", "FS": "flores", "LA": "lavalleja", "MA": "maldonado", "MO": "montevideo", "PA": "paysandu",
    "RN": "rio_negro", "RO": "rocha", "RV": "rivera", "SA": "salto", "SJ": "san_jose", "SO": "soriano",
    "TA": "tacuarembo", "TT": "treinta_y_tres"}

VACIO = {"", "NO APLICA", "NO APLICA.", "N/A", "SIN SUBLEMA", "SIN AGRUPACION", "SIN AGRUPACIÓN"}


def clean(s):
    return (s or "").strip()


def norm_nombre(s):
    """Clave de matcheo: nombre sin tildes, MAYÚSCULAS, sin coma, espacios colapsados."""
    s = unicodedata.normalize("NFD", s or "")
    s = "".join(c for c in s if unicodedata.category(c) != "Mn")
    return " ".join(s.upper().replace(",", " ").split())


def norm_upper(s):
    s = unicodedata.normalize("NFD", s or "")
    s = "".join(c for c in s if unicodedata.category(c) != "Mn")
    return s.upper().strip()


def col(r, *names):
    """Primer valor no vacío entre varias columnas posibles (formatos cambian por año)."""
    for n in names:
        if r.get(n) not in (None, ""):
            return r[n]
    return ""


def read_raw(rel):
    path = os.path.join(ROOT, rel)
    if not os.path.exists(path):
        return None
    for enc in ("utf-8-sig", "utf-8", "latin-1"):
        try:
            with open(path, encoding=enc) as f:
                return list(csv.DictReader(f))
        except UnicodeDecodeError:
            continue
    return None


def build_index():
    """nombre(norm) → set(credenciales) desde los shards de la era credencial."""
    idx = defaultdict(set)
    for elec in ERA_CRED:
        p = os.path.join(DIR, f"personas-hoja.{elec}.json")
        if not os.path.exists(p):
            print(f"  AVISO: falta shard {elec} (corré etl:personas-hoja) — índice incompleto")
            continue
        for r in json.load(open(p, encoding="utf-8"))["registros"]:
            idx[norm_nombre(r.get("nombre"))].add(r["personaId"])
    return idx


def main():
    idx = build_index()
    univocos = {nm for nm, creds in idx.items() if len(creds) == 1}
    print(f"índice era-credencial: {len(idx):,} nombres ({len(univocos):,} unívocos)")

    for eleccion, rel in HISTORICO:
        rows = read_raw(rel)
        if rows is None:
            print(f"\n{eleccion}: NO se pudo leer ({rel}) — omitido")
            continue

        registros = []
        personas_ext = set()
        n_match = n_ambig = 0
        for r in rows:
            nm = norm_nombre(col(r, "Nombre"))
            if not nm:
                continue
            creds = idx.get(nm)
            if not creds:
                continue
            if len(creds) > 1:
                n_ambig += 1
                continue  # homónimo: no linkeable solo por nombre
            pid = next(iter(creds))
            n_match += 1
            personas_ext.add(pid)
            cod = norm_upper(col(r, "Departamento"))
            sublema = clean(col(r, "Sublema"))
            sexo = clean(col(r, "Sexo"))
            registros.append({
                "personaId": pid,
                "nombre": clean(col(r, "Nombre")),
                "sexo": sexo if norm_upper(sexo) in ("M", "F") else None,
                "departamento": CODE_DEPT.get(cod, cod.lower()),
                "hoja": clean(col(r, "Numero", "Numero_de_hoja")),
                "partido": clean(col(r, "PartidoPolitico", "Partido_Politico")),
                "agrupacion": None,
                "sublema": sublema if norm_upper(sublema) not in VACIO else None,
                "cargo": clean(col(r, "Candidatura", "TipoHoja")),
                "ordinal": clean(col(r, "Ordinal")) or None,
                "titularSuplente": clean(col(r, "TitularSuplente", "Titular_Suplente")) or None,
                "match": "nombre",  # confianza menor: linkeado por nombre, no credencial
            })

        dest = os.path.join(DIR, f"personas-historico.{eleccion}.json")
        with open(dest, "w", encoding="utf-8") as f:
            json.dump({
                "eleccion": eleccion,
                "fuente": "Integración de hojas (sin credencial en origen); personaId resuelto por matcheo de nombre unívoco contra la era credencial.",
                "registros": registros,
            }, f, ensure_ascii=False)

        total = len(rows)
        print(f"\n{eleccion}: {total:,} filas → {n_match:,} linkeadas a {len(personas_ext):,} personas "
              f"({n_ambig:,} descartadas por homónimo) → {dest}")


if __name__ == "__main__":
    main()
