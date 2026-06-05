#!/usr/bin/env python3
"""
build-hoja-local.py — desglose por HOJA agregado al nivel "local de votación" → hoja-local.json.

Espeja build-votes-local.py (mismo motor circuito→local: direct/match) pero a granularidad de HOJA,
resolviendo el opcionId contra catalogo.json (la misma fuente que usan el acordeón y los shards de
hoja por serie). Alimenta la ficha del circuito/local con el detalle completo por lista/sublema,
igual que barrio/localidad. El consumidor (ChoroplethMap.ensureHojaLocalConsolidado) solo lee
`porOpcion` por geoId=localId.

Filas del desglose-de-votos.csv:
  HOJA_EN   : Lema + Descripcion1=HOJA + CantidadVotos  → opcionId de hoja
  VOTO_LEMA : Lema (Descripcion1 = listas combinadas)    → opcionId "voto al lema" (…-vl)

Uso:
  python build-hoja-local.py nacionales-2014 nacional --mode match --plan data/raw/electoral/nacionales-2014/plan-circuital.csv
  python build-hoja-local.py nacionales-2024 nacional --mode direct
"""
import csv, json, os, sys, re, unicodedata, argparse
from collections import defaultdict

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CAT_DIR = os.path.join(ROOT, "data/processed/locales")

CODE_DIR = {"AR":"artigas","CA":"canelones","CL":"cerro_largo","CO":"colonia","DU":"durazno",
    "FD":"florida","FS":"flores","LA":"lavalleja","MA":"maldonado","MO":"montevideo","PA":"paysandu",
    "RN":"rio_negro","RO":"rocha","RV":"rivera","SA":"salto","SJ":"san_jose","SO":"soriano",
    "TA":"tacuarembo","TT":"treinta_y_tres"}
NAME_DIR = {"ARTIGAS":"artigas","CANELONES":"canelones","CERRO LARGO":"cerro_largo","COLONIA":"colonia",
    "DURAZNO":"durazno","FLORES":"flores","FLORIDA":"florida","LAVALLEJA":"lavalleja","MALDONADO":"maldonado",
    "MONTEVIDEO":"montevideo","PAYSANDU":"paysandu","RIO NEGRO":"rio_negro","RIVERA":"rivera","ROCHA":"rocha",
    "SALTO":"salto","SAN JOSE":"san_jose","SORIANO":"soriano","TACUAREMBO":"tacuarembo","TREINTA Y TRES":"treinta_y_tres"}

def norm(s):
    s = unicodedata.normalize("NFD", s or "")
    s = "".join(c for c in s if unicodedata.category(c) != "Mn")
    return s.upper().strip()

def _nkey(s):
    return re.sub(r"[^A-Z0-9]", "", norm(s))

def load_catalog(dept):
    with open(os.path.join(CAT_DIR, f"{dept}.json"), encoding="utf-8") as f:
        return json.load(f)

# ---------- motor circuito→local (idéntico a build-votes-local.py) ----------
def overlap(a0, a1, b0, b1):
    return max(0, min(a1, b1) - max(a0, b0) + 1)

def build_circ2local_match(dept, plan_rows):
    cat = load_catalog(dept)
    by_serie = defaultdict(list)
    for lo in cat["locales"]:
        for (s, d, h) in lo["ranges"]:
            by_serie[s].append((lo, d, h))
    circ2local = {}
    for pr in plan_rows:
        serie = pr["serie"]
        try: d = int(pr["desde"]); h = int(pr["hasta"])
        except: d = h = None
        crv = pr["crv"]; nrm = norm(pr["dir"])
        cands = by_serie.get(serie, [])
        if not cands: continue
        best = None; best_score = -1
        for (lo, ld, lh) in cands:
            ov = overlap(d, h, ld, lh) if d is not None else 0
            ov_frac = ov / max(1, (h - d + 1)) if d is not None else 0
            name = lo["nombreNorm"]; nsim = 0.0
            if name and nrm:
                a = set(name.split()); b = set(nrm.split())
                if a and b: nsim = len(a & b) / len(a | b)
                if nrm.startswith(name[:12]) or name.startswith(nrm[:12]): nsim = max(nsim, 0.6)
            score = ov_frac * 1.0 + nsim * 0.8
            if score > best_score: best_score = score; best = lo
        if best is not None: circ2local[crv] = best["localId"]
    return circ2local, cat

def build_circ2local_direct(dept):
    cat = load_catalog(dept)
    m = {}
    for lo in cat["locales"]:
        for c in lo["circuitos"]:
            m[str(c)] = lo["localId"]
    return m, cat

def read_plan(path):
    out = defaultdict(list)
    with open(path, encoding="utf-8-sig", errors="replace", newline="") as f:
        r = csv.DictReader(f)
        cols = {_nkey(c): c for c in (r.fieldnames or [])}
        def col(*n):
            for x in n:
                if x in cols: return cols[x]
            return None
        c_dep = col("DEPARTAMENTO"); c_nro = col("NROCIRCUITO"); c_ser = col("SERIE")
        c_d = col("DESDE"); c_h = col("HASTA"); c_dir = col("DIRECCION", "LOCAL")
        for row in r:
            dk = norm(row.get(c_dep, ""))
            dep = NAME_DIR.get(dk) or CODE_DIR.get(dk)
            if not dep: continue
            out[dep].append({"serie": (row.get(c_ser, "") or "").strip(), "crv": (row.get(c_nro, "") or "").strip(),
                "desde": (row.get(c_d, "") or "").strip(), "hasta": (row.get(c_h, "") or "").strip(),
                "dir": (row.get(c_dir, "") or "").strip()})
    return out

# TIPO_REGISTRO del desglose → contienda del catálogo. Cubre los formatos vigentes:
#   nacionales: HOJA_EN/VOTO_LEMA (contienda 'unica')
#   internas:   HOJA_ODN/HOJA_ODD (contiendas 'odn'/'odd')  [PREC_*/SUBLEMA_*/VOTOS_PREC se ignoran]
#   dep-2025:   HOJA_ED→junta · HOJA_EM→municipio (+ VOTO_LEMA_ED/_EM)
TIPO_CONTIENDA = {
    "HOJA_EN": "unica", "VOTO_LEMA": "unica",
    "HOJA_ODN": "odn", "HOJA_ODD": "odd",
    "HOJA_ED": "junta", "VOTO_LEMA_ED": "junta",
    "HOJA_EM": "municipio", "VOTO_LEMA_EM": "municipio",
}

# ---------- desglose con HOJA (Descripcion1 y/o Descripcion2 según formato) ----------
def read_desglose(path):
    enc = "utf-8-sig"
    try: open(path, encoding="utf-8-sig").readline()
    except Exception: enc = "latin-1"
    out = []
    with open(path, encoding=enc, errors="replace", newline="") as f:
        r = csv.DictReader(f)
        cols = {norm(c).replace("Ó", "O").replace("�", "").replace("_", ""): c for c in (r.fieldnames or [])}
        def col(*names):
            for n in names:
                k = n.replace("_", "")
                if k in cols: return cols[k]
            return None
        c_tipo = col("TIPOREGISTRO"); c_dep = col("DEPARTAMENTO"); c_crv = col("CRV")
        c_lema = col("LEMA"); c_d1 = col("DESCRIPCION1", "DESCRIPCION"); c_d2 = col("DESCRIPCION2")
        c_vot = col("CANTIDADVOTOS")
        for row in r:
            out.append({
                "tipo": (row.get(c_tipo, "") or "").strip(),
                "dep": (row.get(c_dep, "") or "").strip(),
                "crv": (row.get(c_crv, "") or "").strip(),
                "lema": (row.get(c_lema, "") or "").strip(),
                "d1": (row.get(c_d1, "") or "").strip(),
                "d2": (row.get(c_d2, "") or "").strip() if c_d2 else "",
                "votos": (row.get(c_vot, "") or "").strip(),
            })
    return out

def load_hoja_resolver(eleccion, dep):
    """De catalogo.json: (contienda, lemaId, hoja)→opcionId, (contienda, lemaId)→vl, nombre(norm)→lemaId.
       Devuelve None si no hay catálogo (elección sin hojas)."""
    path = os.path.join(ROOT, f"public/data/{eleccion}/{dep}/catalogo.json")
    if not os.path.exists(path): return None
    doc = json.load(open(path, encoding="utf-8"))
    name2lema = {}        # norm(etiqueta lema) -> lemaId (con y sin prefijo "PARTIDO ")
    hoja2opc = {}         # (contienda, lemaId, hoja) -> opcionId
    vl2opc = {}           # (contienda, lemaId) -> opcionId voto-al-lema
    def reg(nm, lid):
        nm = norm(nm)
        if not nm: return
        name2lema[nm] = lid
        name2lema[re.sub(r"^PARTIDO\s+", "", nm)] = lid  # "Partido Colorado" ↔ "Colorado"
    for c in doc.get("contiendas", []):
        cont = c.get("contienda", "")
        for n in c.get("nodos", []):
            if n.get("nivel") == "lema":
                reg(n.get("etiqueta", ""), n["id"])
        for o in c.get("opciones", []):
            lemaId = o.get("lemaId") or o.get("partidoId") or ""
            hoja = str(o.get("hoja") or "")
            if hoja == "vl": vl2opc[(cont, lemaId)] = o["id"]
            elif hoja: hoja2opc[(cont, lemaId, hoja)] = o["id"]
    return name2lema, hoja2opc, vl2opc

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("eleccion"); ap.add_argument("tipo")
    ap.add_argument("--desglose", default=None)
    ap.add_argument("--mode", choices=["direct", "match"], required=True)
    ap.add_argument("--plan", default=None)
    a = ap.parse_args()

    desg = a.desglose or f"data/raw/electoral/{a.eleccion}/desglose-de-votos.csv"
    desg = os.path.join(ROOT, desg)
    if not os.path.exists(desg):
        print(f"  SIN desglose ({desg}) — skip"); return
    rows = read_desglose(desg)
    plan_by_dept = read_plan(os.path.join(ROOT, a.plan)) if (a.mode == "match" and a.plan) else None

    # agrupar filas crudas por dept
    by_dept_rows = defaultdict(list)
    for r in rows:
        dep = CODE_DIR.get(r["dep"].upper())
        if dep: by_dept_rows[dep].append(r)

    tot_dep = 0; tot_locales = 0
    for dep, drows in sorted(by_dept_rows.items()):
        resolver = load_hoja_resolver(a.eleccion, dep)
        if not resolver:
            continue
        name2lema, hoja2opc, vl2opc = resolver
        # circ→local (mismo motor que votes-local para que los localId coincidan con el overlay)
        if a.mode == "direct":
            c2l, cat = build_circ2local_direct(dep)
        else:
            # GUARD plan parcial (internas-2014 = solo MVD+CA+MA): sin plan para el depto → skip.
            if not plan_by_dept.get(dep):
                continue
            c2l, cat = build_circ2local_match(dep, plan_by_dept.get(dep, []))
        order = [lo["localId"] for lo in cat["locales"]]

        # circ_votes[crv][opcionId] += votos
        circ_votes = defaultdict(lambda: defaultdict(int))
        unknown = set()
        for r in drows:
            try: v = int(r["votos"])
            except: continue
            if v <= 0: continue
            cont = TIPO_CONTIENDA.get(r["tipo"].upper())
            if not cont: continue  # PREC_*/SUBLEMA_*/VOTOS_PREC/intendente: agregados, no son hojas
            lnm = norm(r["lema"])
            lemaId = name2lema.get(lnm) or name2lema.get(re.sub(r"^PARTIDO\s+", "", lnm))
            if not lemaId:
                unknown.add(("lema", r["lema"])); continue
            if "VOTO_LEMA" in r["tipo"].upper():
                op = vl2opc.get((cont, lemaId))
            else:  # HOJA_*: el nº de hoja viene en D1 (nacionales/dep) o D2 (internas) → probar ambos
                op = hoja2opc.get((cont, lemaId, r["d1"])) or hoja2opc.get((cont, lemaId, r["d2"]))
            if not op:
                unknown.add((r["tipo"], lemaId, r["d1"], r["d2"])); continue
            circ_votes[str(r["crv"])][op] += v

        # agregar a local
        by_local = defaultdict(lambda: defaultdict(int))
        sin_local = 0
        for crv, ops in circ_votes.items():
            lid = c2l.get(crv)
            if not lid:
                sin_local += sum(ops.values()); continue
            for op, v in ops.items(): by_local[lid][op] += v

        zonas = []
        for lid in order:
            ops = by_local.get(lid)
            if not ops: continue
            porOpcion = sorted(({"opcionId": op, "votos": v} for op, v in ops.items()), key=lambda x: -x["votos"])
            validos = sum(v for v in ops.values())
            zonas.append({"geoId": lid, "ganadorOpcionId": porOpcion[0]["opcionId"],
                          "validos": validos, "porOpcion": porOpcion,
                          "noPartidarios": {"enBlanco": 0, "anulados": 0, "observados": 0}})
        shard = {"eleccionId": a.eleccion, "departamento": dep, "nivel": "local",
                 "escrutinio": "definitivo", "tipo": a.tipo, "zonas": zonas}
        out = os.path.join(ROOT, f"public/data/{a.eleccion}/{dep}/hoja-local.json")
        json.dump(shard, open(out, "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))
        tot_dep += 1; tot_locales += len(zonas)
        unk = f" UNK={sorted(unknown)[:3]}" if unknown else ""
        sl = f" sin_local_votos={sin_local}" if sin_local else ""
        print(f"  {dep:16} locales={len(zonas):4} crv_in={len(circ_votes):5}{sl}{unk}")
    print(f"\n{a.eleccion} [{a.mode}]: {tot_dep} deptos · locales con hoja={tot_locales}")

if __name__ == "__main__":
    main()
