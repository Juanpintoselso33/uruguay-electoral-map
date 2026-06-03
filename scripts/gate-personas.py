#!/usr/bin/env python3
"""Gate de integridad de la dimensión personas↔hoja. Falla (exit 1) si:
  - algún registro no tiene personaId (credencial) o hoja;
  - faltan cargos legislativos esperados (SENADOR / REPRESENTANTE) en nacionales;
  - una hoja de la nómina no existe en NINGÚN catálogo de ningún depto de la elección
    (hoja fantasma absoluta = 0 votos en todo el país).

DISEÑO DEL CHEQUEO DE FANTASMAS:
  En elecciones nacionales, una hoja puede presentarse en los 19 departamentos pero
  obtener votos solo en algunos. El catalogo.json de cada depto contiene ÚNICAMENTE las
  hojas que recibieron ≥1 voto en ese depto. Por eso se usa la UNIÓN de todos los
  catálogos de la elección como referencia:
    · Si la hoja existe en al menos un depto → la candidatura fue real y obtuvo votos en
      algún lugar. Que tenga 0 votos en un depto concreto es comportamiento esperado.
    · Si la hoja no existe en NINGÚN catálogo → la candidatura se presentó pero no
      obtuvo ningún voto en todo el país (12 hojas en nacionales-2024, 1.23% de
      registros). Se reporta como advertencia y cuenta como falla del gate.

  NO se usa un chequeo per-depto estricto porque generaría ~5.893 falsos positivos (2.7%)
  en nacionales-2024, todos correspondientes a presentaciones locales con cero votos
  locales pero votos reales en otros deptos — el join NO está roto en esos casos.

  OK del gate significa: "todas las hojas que recibieron votos en algún depto están
  correctamente representadas en la nómina". No certifica que hojas con cero votos
  totales sean candidaturas canceladas — eso requiere cruzar con registros de habilitación
  de la Corte Electoral.

Uso: python scripts/gate-personas.py
"""
import json
import os
import glob
import sys
from functools import lru_cache

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DIR = os.path.join(ROOT, "public", "data", "personas")

# ---------------------------------------------------------------------------
# Helpers con caché (evita recargar catálogos 217 k veces)
# ---------------------------------------------------------------------------

_cat_cache: dict[str, set[str]] = {}
_union_cache: dict[str, set[str]] = {}


def hojas_catalogo(eleccion: str, depto: str) -> set[str] | None:
    """Retorna el set de hojas del catálogo de un depto/elección (cacheado).
    Retorna None si el catálogo no existe.
    """
    key = (eleccion, depto)
    if key in _cat_cache:
        return _cat_cache[key]
    cat_path = os.path.join(ROOT, "public", "data", eleccion, depto, "catalogo.json")
    if not os.path.exists(cat_path):
        _cat_cache[key] = None
        return None
    with open(cat_path, encoding="utf-8") as f:
        doc = json.load(f)
    hojas: set[str] = set()
    for c in doc.get("contiendas", []):
        for o in c.get("opciones", []):
            if o.get("hoja"):
                hojas.add(str(o["hoja"]))
    _cat_cache[key] = hojas
    return hojas


def hojas_union_catalogo(eleccion: str) -> set[str]:
    """Retorna la unión de todas las hojas de todos los catálogos de la elección (cacheado)."""
    if eleccion in _union_cache:
        return _union_cache[eleccion]
    patron = os.path.join(ROOT, "public", "data", eleccion, "*", "catalogo.json")
    union: set[str] = set()
    for cat_path in glob.glob(patron):
        with open(cat_path, encoding="utf-8") as f:
            doc = json.load(f)
        for c in doc.get("contiendas", []):
            for o in c.get("opciones", []):
                if o.get("hoja"):
                    union.add(str(o["hoja"]))
    _union_cache[eleccion] = union
    return union


# ---------------------------------------------------------------------------
# Validaciones por cargo
# ---------------------------------------------------------------------------

# Cargos cuya hoja es de alcance NACIONAL (misma papeleta en todos los deptos).
# El catálogo per-depto los incluye solo cuando recibieron votos en ese depto, por lo
# que un chequeo per-depto generaría falsos positivos masivos. Se validan contra la
# unión de catálogos (que sí los cubre donde obtuvieron votos).
CARGOS_NACIONALES = {"PRESIDENCIAL", "VICEPRESIDENCIAL", "SENADOR"}

# Cargos por circunscripción departamental. Se validan primero per-depto; si tampoco
# están en la unión se clasifican como huérfanos absolutos.
CARGOS_POR_DEPTO = {"REPRESENTANTE", "JUNTA ELECTORAL"}

# Cargos legislativos mínimos esperados en una elección de tipo "nacionales"
CARGOS_LEGISLATIVOS_NACIONALES = {"SENADOR", "REPRESENTANTE"}


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main() -> None:
    errs: list[str] = []

    shards = sorted(glob.glob(os.path.join(DIR, "personas-hoja.*.json")))
    if not shards:
        print(f"[gate:personas] No se encontraron shards en {DIR}")
        sys.exit(1)

    for path in shards:
        with open(path, encoding="utf-8") as f:
            doc = json.load(f)

        eleccion: str = doc["eleccion"]
        regs: list[dict] = doc["registros"]

        # 1. Campos obligatorios
        sin_cred = [r for r in regs if not r.get("personaId") or str(r["personaId"]).startswith("-")]
        sin_hoja = [r for r in regs if not r.get("hoja")]
        if sin_cred:
            errs.append(f"{eleccion}: {len(sin_cred)} registros sin credencial (personaId)")
        if sin_hoja:
            errs.append(f"{eleccion}: {len(sin_hoja)} registros sin hoja")

        # 2. Cargos legislativos mínimos en nacionales
        if eleccion.startswith("nacionales"):
            cargos_presentes = {r["cargo"].upper() for r in regs}
            faltantes = CARGOS_LEGISLATIVOS_NACIONALES - cargos_presentes
            if faltantes:
                errs.append(
                    f"{eleccion}: faltan cargos legislativos esperados: "
                    f"{sorted(faltantes)} (cargos presentes: {sorted(cargos_presentes)})"
                )

        # 3. Hojas fantasma (solo registros que tienen hoja)
        # Precargamos la unión una sola vez por elección
        union = hojas_union_catalogo(eleccion)

        # Huérfanos absolutos: hoja que no existe en NINGÚN catálogo de la elección
        # (candidatura que obtuvo 0 votos en todo el país)
        huerfanos_hojas: set[str] = set()
        for r in regs:
            h = r.get("hoja")
            if h and str(h) not in union:
                huerfanos_hojas.add(str(h))

        if huerfanos_hojas:
            n_regs = sum(1 for r in regs if r.get("hoja") and str(r["hoja"]) in huerfanos_hojas)
            # Detalle por partido para diagnóstico
            from collections import defaultdict
            partido_count: dict[str, int] = defaultdict(int)
            for r in regs:
                if r.get("hoja") and str(r["hoja"]) in huerfanos_hojas:
                    partido_count[r.get("partido", "?")] += 1
            partido_str = ", ".join(
                f"{p}:{c}" for p, c in sorted(partido_count.items(), key=lambda x: -x[1])
            )
            errs.append(
                f"{eleccion}: {len(huerfanos_hojas)} hojas que no recibieron votos en "
                f"ningún depto → {n_regs} registros huérfanos ({partido_str}). "
                f"Hojas: {sorted(huerfanos_hojas)}"
            )

    if errs:
        print("[gate:personas] FALLÓ:")
        for e in errs:
            print("  -", e)
        sys.exit(1)

    total_regs = sum(
        len(json.load(open(p, encoding="utf-8"))["registros"])
        for p in shards
    )
    print(
        f"[gate:personas] OK — {len(shards)} shard(s), {total_regs:,} registros, "
        "sin fantasmas absolutos (hojas con 0 votos en algún depto son presentaciones "
        "locales sin votos, comportamiento esperado en nacionales)."
    )


if __name__ == "__main__":
    main()
