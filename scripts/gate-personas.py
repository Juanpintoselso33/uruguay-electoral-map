#!/usr/bin/env python3
"""Gate de integridad de la dimensión personas↔hoja. Falla (exit 1) si:
  - algún registro no tiene personaId (credencial) o hoja;
  - faltan cargos legislativos esperados (SENADOR / REPRESENTANTE) en nacionales;
  - la tasa de hojas huérfanas absolutas supera el umbral HUERFANAS_HARD_PCT
    (indicaría un bug de formato/join sistémico, no candidaturas sin votos).

DISEÑO DEL CHEQUEO DE FANTASMAS:
  En elecciones nacionales, una hoja puede presentarse en los 19 departamentos pero
  obtener votos solo en algunos. El catalogo.json de cada depto contiene ÚNICAMENTE las
  hojas que recibieron ≥1 voto en ese depto. Por eso se usa la UNIÓN de todos los
  catálogos de la elección como referencia:
    · Si la hoja existe en al menos un depto → la candidatura fue real y obtuvo votos en
      algún lugar. Que tenga 0 votos en un depto concreto es comportamiento esperado.
    · Si la hoja no existe en NINGÚN catálogo → la candidatura se presentó pero no
      obtuvo ningún voto en todo el país. Verificado contra desglose-de-votos.csv: las 12
      hojas huérfanas de nacionales-2024 (PN fracciones + 1 CA) constan en la nómina
      oficial pero suman 0 votos en la fuente cruda. Es comportamiento legítimo.

  NO se usa un chequeo per-depto estricto porque generaría ~5.893 falsos positivos (2.7%)
  en nacionales-2024, todos correspondientes a presentaciones locales con cero votos
  locales pero votos reales en otros deptos — el join NO está roto en esos casos.

  UMBRAL DE ALARMA: si más del 10% de las hojas distintas en la nómina son huérfanas
  (nunca en ningún catálogo), es señal de un bug sistémico (ej. cero a la izquierda,
  mismatch str/int). Ese caso → exit 1. Con <10% se reporta como info "·" y exit 0.

  OK del gate significa: "todas las hojas con ≥1 voto en algún depto están
  correctamente representadas en la nómina". No certifica hojas con cero votos totales.

Uso: python scripts/gate-personas.py
"""
import json
import os
import glob
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DIR = os.path.join(ROOT, "public", "data", "personas")

# ---------------------------------------------------------------------------
# Helpers con caché (evita recargar catálogos por cada shard)
# ---------------------------------------------------------------------------

_union_cache: dict[str, set[str]] = {}


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

# Cargos legislativos mínimos esperados en una elección de tipo "nacionales"
CARGOS_LEGISLATIVOS_NACIONALES = {"SENADOR", "REPRESENTANTE"}

# Umbral duro: si el porcentaje de hojas distintas huérfanas supera este valor
# se asume un bug sistémico de join/formato y el gate falla con exit 1.
# En nacionales-2024 la tasa real es 12/338 = 3.6% → bien por debajo del 10%.
HUERFANAS_HARD_PCT = 10.0


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main() -> None:
    from collections import defaultdict

    errs: list[str] = []
    infos: list[str] = []

    shards = sorted(glob.glob(os.path.join(DIR, "personas-hoja.*.json")))
    if not shards:
        print(f"[gate:personas] No se encontraron shards en {DIR}")
        sys.exit(1)

    total_regs_global = 0

    for path in shards:
        with open(path, encoding="utf-8") as f:
            doc = json.load(f)

        eleccion: str = doc["eleccion"]
        regs: list[dict] = doc["registros"]
        total_regs_global += len(regs)

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

        # 3. Hojas huérfanas absolutas (hoja en nómina pero 0 votos en cualquier depto)
        # Se usa la UNIÓN de todos los catálogos de la elección, no el catálogo per-depto,
        # para evitar falsos positivos por hojas nacionales con votos solo en algunos deptos.
        union = hojas_union_catalogo(eleccion)
        all_nomina_hojas = {str(r["hoja"]) for r in regs if r.get("hoja")}

        huerfanas = all_nomina_hojas - union
        tasa_pct = 100.0 * len(huerfanas) / len(all_nomina_hojas) if all_nomina_hojas else 0.0

        if huerfanas:
            n_regs = sum(1 for r in regs if r.get("hoja") and str(r["hoja"]) in huerfanas)
            partido_count: dict[str, int] = defaultdict(int)
            for r in regs:
                if r.get("hoja") and str(r["hoja"]) in huerfanas:
                    partido_count[r.get("partido", "?")] += 1
            partido_str = ", ".join(
                f"{p}:{c}" for p, c in sorted(partido_count.items(), key=lambda x: -x[1])
            )
            msg = (
                f"{eleccion}: {len(huerfanas)} hojas ({tasa_pct:.1f}%) sin votos en ningún "
                f"depto → {n_regs} registros ({100.0*n_regs/len(regs):.2f}% del shard). "
                f"Candidaturas presentadas con 0 votos totales ({partido_str}). "
                f"Hojas: {sorted(huerfanas)}"
            )
            if tasa_pct >= HUERFANAS_HARD_PCT:
                # Tasa alta → probable bug sistémico de join/formato → falla dura
                errs.append(msg)
            else:
                # Tasa baja → candidaturas reales sin votos (verificado en fuente) → info
                infos.append(msg)

    print(f"[gate:personas] {len(shards)} shard(s), {total_regs_global:,} registros")
    if infos:
        print(f"  · {len(infos)} aviso(s) de hojas sin votos (tasa <{HUERFANAS_HARD_PCT:.0f}%, esperado):")
        for i in infos:
            print("    -", i)

    if errs:
        print("[gate:personas] FALLÓ:")
        for e in errs:
            print("  ✗", e)
        sys.exit(1)

    print(
        "[gate:personas] OK — campos completos, cargos legislativos presentes, "
        f"tasa de hojas huérfanas dentro del umbral (<{HUERFANAS_HARD_PCT:.0f}%)."
    )


if __name__ == "__main__":
    main()
