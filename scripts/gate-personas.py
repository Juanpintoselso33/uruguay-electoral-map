#!/usr/bin/env python3
"""Gate de integridad de la dimensión personas↔hoja. Falla (exit 1) si:
  - algún registro no tiene personaId (credencial) o hoja;
  - faltan cargos legislativos esperados (SENADOR / REPRESENTANTE) en nacionales;
  - la tasa de hojas huérfanas absolutas supera el umbral HUERFANAS_HARD_PCT
    (indicaría un bug de formato/join sistémico, no candidaturas sin votos);
  - la sonda de conteo no-cero falla: resuelve una persona legislativa real → 0 votos
    (indicaría que el join hoja→opcionId→hoja-local está roto sin que nada lo detecte).

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

DISEÑO DE LA SONDA DE CONTEO NO-CERO:
  Por cada shard, toma la persona con más apariciones entre los cargos legislativos
  (SENADOR/REPRESENTANTE en nacionales, ODN/ODD en internas, JUNTA DEPARTAMENTAL en
  departamentales). Resuelve su hoja → opcionId via catalogo.json y suma votos desde
  hoja-local.json (misma lógica que query-persona.py). Si el total da 0, el gate falla:
  ese resultado implica que el join produce votos, no solo que la hoja existe.
  Si no hay hoja-local.json para la elección se omite la sonda (advertencia).

Uso: python scripts/gate-personas.py
"""
import json
import os
import glob
import sys
import unicodedata
from collections import Counter, defaultdict

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DIR = os.path.join(ROOT, "public", "data", "personas")

# ---------------------------------------------------------------------------
# Helpers con caché (evita recargar catálogos por cada shard)
# ---------------------------------------------------------------------------

_union_cache: dict[str, set[str]] = {}
_cat_cache: dict[str, dict] = {}
_hl_cache: dict[str, dict[str, int]] = {}


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


def _get_cat(eleccion: str, depto: str) -> dict:
    """Carga y cachea catalogo.json de una combinación eleccion+depto."""
    key = f"{eleccion}/{depto}"
    if key not in _cat_cache:
        path = os.path.join(ROOT, "public", "data", eleccion, depto, "catalogo.json")
        _cat_cache[key] = json.load(open(path, encoding="utf-8")) if os.path.exists(path) else {}
    return _cat_cache[key]


def _hoja_opcion(cat_doc: dict, hoja: str, partido: str | None = None) -> str | None:
    """Resuelve hoja → opcionId. Si hay ambigüedad, desambigua por partido.

    Prueba el slug completo ("partido-nacional") Y sin el prefijo "partido-"
    ("nacional") para cubrir opcionIds que omiten dicho prefijo.
    """
    hoja_str = str(hoja)
    candidates = [
        o["id"]
        for c in cat_doc.get("contiendas", [])
        for o in c.get("opciones", [])
        if str(o.get("hoja")) == hoja_str
    ]
    if not candidates:
        return None
    if len(candidates) == 1:
        return candidates[0]
    if partido:
        slug = unicodedata.normalize("NFD", partido)
        slug = "".join(ch for ch in slug if unicodedata.category(ch) != "Mn")
        slug = slug.lower().replace(" ", "-")
        slug_no_prefix = slug[len("partido-"):] if slug.startswith("partido-") else slug
        for oid in candidates:
            oid_l = oid.lower()
            if slug in oid_l or slug_no_prefix in oid_l:
                return oid
    return candidates[0]


def _oid_totals(eleccion: str, depto: str) -> dict[str, int]:
    """Carga hoja-local.json y suma votos por opcionId (total depto). Cacheado."""
    key = f"{eleccion}/{depto}"
    if key not in _hl_cache:
        hl_path = os.path.join(ROOT, "public", "data", eleccion, depto, "hoja-local.json")
        if not os.path.exists(hl_path):
            _hl_cache[key] = {}
        else:
            doc = json.load(open(hl_path, encoding="utf-8"))
            totals: dict[str, int] = defaultdict(int)
            for z in doc.get("zonas", []):
                for o in z.get("porOpcion", []):
                    totals[o["opcionId"]] += o.get("votos", 0)
            _hl_cache[key] = dict(totals)
    return _hl_cache[key]


# Cargos legislativos por tipo de elección (para la sonda de conteo)
CARGOS_SONDA: dict[str, set[str]] = {
    "nacionales": {"SENADOR", "REPRESENTANTE"},
    "internas": {"ODN", "ODD"},
    "departamentales": {"JUNTA DEPARTAMENTAL"},
}


def sonda_conteo(eleccion: str, regs: list[dict]) -> tuple[bool, str]:
    """Sonda: toma la persona con más apariciones en cargos legislativos y verifica
    que su join hoja→opcionId→hoja-local produce >0 votos en al menos un depto.

    Retorna (ok: bool, mensaje: str).
    """
    # Determinar tipo de elección para elegir cargos
    tipo = next((t for t in CARGOS_SONDA if eleccion.startswith(t)), None)
    if tipo is None:
        return True, f"  sonda: elección '{eleccion}' sin cargos sonda definidos — omitida"

    target_cargos = CARGOS_SONDA[tipo]
    leg = [r for r in regs if r.get("cargo", "").upper() in target_cargos]
    if not leg:
        return True, f"  sonda: no hay registros con cargos {target_cargos} en {eleccion} — omitida"

    # Persona con más apariciones entre los legislativos
    cnt = Counter(r["personaId"] for r in leg)
    probe_id, _ = cnt.most_common(1)[0]
    probe_recs = [r for r in leg if r["personaId"] == probe_id]
    nombre = probe_recs[0]["nombre"]
    hoja = probe_recs[0]["hoja"]

    # Deduplicar por depto para no sumar el mismo depto dos veces (persona con
    # múltiples cargos en el mismo departamento).
    deptos_vistos: set[str] = set()
    total_votos = 0
    for r in probe_recs:
        depto = r["departamento"]
        if depto in deptos_vistos:
            continue
        deptos_vistos.add(depto)
        partido = r.get("partido", "")
        cat_doc = _get_cat(eleccion, depto)
        if not cat_doc:
            continue
        oid = _hoja_opcion(cat_doc, hoja, partido)
        if not oid:
            continue
        totals = _oid_totals(eleccion, depto)
        total_votos += totals.get(oid, 0)

    msg_probe = (
        f"  sonda [{eleccion}]: {probe_id} ({nombre}), hoja {hoja}, "
        f"{len(deptos_vistos)} depto(s) → {total_votos:,} votos"
    )
    if total_votos == 0:
        return False, (
            f"join roto: persona {probe_id} ({nombre}) hoja {hoja} "
            f"resolvió 0 votos en {eleccion} — verificá catalogo.json y hoja-local.json"
        )
    return True, msg_probe


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
    errs: list[str] = []
    infos: list[str] = []
    probe_msgs: list[str] = []

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

        # 4. Sonda de conteo no-cero: verifica que el join hoja→opcionId→hoja-local
        #    produzca votos reales para una persona legislativa conocida del shard.
        sonda_ok, sonda_msg = sonda_conteo(eleccion, regs)
        probe_msgs.append(sonda_msg)
        if not sonda_ok:
            errs.append(sonda_msg)

    print(f"[gate:personas] {len(shards)} shard(s), {total_regs_global:,} registros")
    print("  sondas de conteo no-cero:")
    for pm in probe_msgs:
        print(pm)
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
        f"tasa de hojas huérfanas dentro del umbral (<{HUERFANAS_HARD_PCT:.0f}%), "
        "sonda de votos > 0."
    )


if __name__ == "__main__":
    main()
