#!/usr/bin/env python3
"""
build-votes-circuito.py — Desglose POR CIRCUITO × POR OPCIÓN para la ficha del local.

Emite `public/data/{eleccion}/{depto}/votes-circuito.json` (nivel='circuito') con el MISMO
shape que `internas-2024/*/votes-circuito.json` (el formato objetivo del overlay):

  { eleccionId, departamento, nivel:'circuito', escrutinio:'definitivo', tipo,
    zonas: [ { geoId:str(crv), ganadorOpcionId, validos, porOpcion:[{opcionId,votos}],
               noPartidarios:{enBlanco,anulados,observados} } ] }

DISEÑO (reconcile-by-construction):
  - opcionId se resuelve contra el `opciones.json` CANÓNICO (post-sweep) de esa elección×depto,
    igual que `build-votes-local.py` → los ids coinciden EXACTAMENTE con votes-local/catalogo.
  - El universo de circuitos se RESTRINGE al mismo `circ2local` que construyó el votes-local
    (direct para ciclo-2024; fuzzy match con plan-circuital para elecciones viejas). Los CRV sin
    local se descartan (no son mostrables en ninguna ficha) y se reportan. Así la suma por
    opcionId de los circuitos == la del votes-local POR CONSTRUCCIÓN (gate delta=0).

Dos familias de crudo:
  - DESGLOSE (nacionales/internas/departamentales): filas por HOJA con LEMA+CANTIDAD_VOTOS,
    filtradas por TIPO_REGISTRO (mismo filtro single-tiporeg que el votes-local: se excluyen las
    filas VOTO_LEMA → no representadas a nivel circuito, igual que el local).
  - WIDE (balotaje/plebiscito/referendum): una fila por CRV con totales en columnas nombradas.
    Para wide tomamos el universo de circuitos del propio votes-local (zonas[].circuitos[]).

Uso:
  python scripts/build-votes-circuito.py                 # todas las elecciones del CONFIG
  python scripts/build-votes-circuito.py balotaje-2024   # una elección
  python scripts/build-votes-circuito.py --check         # solo correr el gate sobre lo que haya
"""
import csv, json, os, sys, re, unicodedata, argparse
from collections import defaultdict

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CAT_DIR = os.path.join(ROOT, "data/processed/locales")
DATA = os.path.join(ROOT, "public/data")

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
    return "".join(c for c in s if unicodedata.category(c) != "Mn").upper().strip()

def slug(s):
    s = unicodedata.normalize("NFD", s or "")
    s = "".join(c for c in s if unicodedata.category(c) != "Mn").lower()
    return re.sub(r"[^a-z0-9]+", "-", s).strip("-")

def nkey(s):
    return re.sub(r"[^A-Z0-9]", "", norm(s))

def lema_to_opcion(lema):
    l = re.sub(r"(?i)^partido\s+", "", (lema or "").strip())
    return slug(l)

def load_catalog(dep):
    with open(os.path.join(CAT_DIR, f"{dep}.json"), encoding="utf-8") as f:
        return json.load(f)

# ── motor circuito→local (idéntico a build-votes-local.py) ──────────────────────
def overlap(a0, a1, b0, b1):
    return max(0, min(a1, b1) - max(a0, b0) + 1)

def c2l_direct(dep):
    cat = load_catalog(dep); m = {}
    for lo in cat["locales"]:
        for c in lo["circuitos"]:
            m[str(c)] = lo["localId"]
    return m, cat

def c2l_match(dep, plan_rows):
    cat = load_catalog(dep)
    by_serie = defaultdict(list)
    for lo in cat["locales"]:
        for (s, d, h) in lo["ranges"]:
            by_serie[s].append((lo, d, h))
    c2l = {}
    for pr in plan_rows:
        try: d = int(pr["desde"]); h = int(pr["hasta"])
        except: d = h = None
        cands = by_serie.get(pr["serie"], [])
        if not cands: continue
        nrm = norm(pr["dir"]); best = None; bs = -1
        for (lo, ld, lh) in cands:
            ov = overlap(d, h, ld, lh) if d is not None else 0
            ovf = ov / max(1, (h - d + 1)) if d is not None else 0
            name = lo["nombreNorm"]; ns = 0.0
            if name and nrm:
                a = set(name.split()); b = set(nrm.split())
                if a and b: ns = len(a & b) / len(a | b)
                if nrm.startswith(name[:12]) or name.startswith(nrm[:12]): ns = max(ns, 0.6)
            sc = ovf + ns * 0.8
            if sc > bs: bs = sc; best = lo
        if best: c2l[pr["crv"]] = best["localId"]
    return c2l, cat

def read_plan(path):
    out = defaultdict(list)
    with open(os.path.join(ROOT, path), encoding="utf-8-sig", errors="replace", newline="") as f:
        r = csv.DictReader(f); cols = {nkey(c): c for c in (r.fieldnames or [])}
        def col(*n):
            for x in n:
                if x in cols: return cols[x]
            return None
        cdep = col("DEPARTAMENTO"); cnro = col("NROCIRCUITO"); cser = col("SERIE")
        cd = col("DESDE"); ch = col("HASTA"); cdir = col("DIRECCION", "LOCAL")
        for row in r:
            dk = norm(row.get(cdep, ""))
            dep = NAME_DIR.get(dk) or CODE_DIR.get(dk)
            if not dep: continue
            out[dep].append({"serie": (row.get(cser, "") or "").strip(), "crv": (row.get(cnro, "") or "").strip(),
                "desde": (row.get(cd, "") or "").strip(), "hasta": (row.get(ch, "") or "").strip(),
                "dir": (row.get(cdir, "") or "").strip()})
    return out

# ── resolución de opcionId (desglose): contra opciones.json canónico ───────────
def load_opc_resolver(eleccion, dep):
    path = os.path.join(DATA, eleccion, dep, "opciones.json")
    if not os.path.exists(path): return None, {}
    ops = json.load(open(path, encoding="utf-8"))["opciones"]
    valid = {o["opcionId"] for o in ops}
    name2id = {}
    for o in ops:
        nm = norm(o["nombre"]); name2id[nm] = o["opcionId"]
        name2id[re.sub(r"^PARTIDO\s+", "", nm)] = o["opcionId"]
    return valid, name2id

def resolve_op(lema, name2id):
    nm = norm(lema)
    return name2id.get(nm) or name2id.get(re.sub(r"^PARTIDO\s+", "", nm)) or lema_to_opcion(lema)

# ── lector desglose ────────────────────────────────────────────────────────────
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
        c_lema = col("LEMA"); c_vot = col("CANTIDADVOTOS")
        for row in r:
            out.append({
                "tipo": (row.get(c_tipo, "") or "").strip(),
                "dep": (row.get(c_dep, "") or "").strip(),
                "crv": (row.get(c_crv, "") or "").strip(),
                "lema": (row.get(c_lema, "") or "").strip(),
                "votos": (row.get(c_vot, "") or "").strip(),
            })
    return out

# ── CONFIG por elección ─────────────────────────────────────────────────────────
# family 'desglose': lee desglose-de-votos.csv, filtra por tiporeg, resuelve LEMA→opcionId.
# family 'wide'    : lee CSV ancho/binario; universo = circuitos[] del votes-local; mapea columnas.
NP_STD = {"TOTALENBLANCO": "enBlanco", "TOTALANULADOS": "anulados", "TOTALVOTOSOBSERVADOS": "observados"}

CONFIG = {
    # ── DESGLOSE ──
    "nacionales-2024": {"family": "desglose", "mode": "direct", "tiporeg": "HOJA_EN", "tipo": "nacional"},
    "nacionales-2019": {"family": "desglose", "mode": "match", "tiporeg": "HOJA_EN", "tipo": "nacional",
        "plan": "data/raw/electoral/nacionales-2019-full/plan-circuital.csv"},
    "nacionales-2014": {"family": "desglose", "mode": "match", "tiporeg": "HOJA_EN", "tipo": "nacional",
        "plan": "data/raw/electoral/nacionales-2014/plan-circuital.csv"},
    "internas-2019": {"family": "desglose", "mode": "match", "tiporeg": "HOJA_ODN", "tipo": "internas",
        "plan": "data/raw/electoral/internas-2019/plan-circuital.csv"},
    # internas-2014: plan PARCIAL (solo MVD+CA+MA). GUARD de plan-por-depto = no toca los 16 sin plan.
    "internas-2014": {"family": "desglose", "mode": "match", "tiporeg": "HOJA_ODN", "tipo": "internas",
        "plan": "data/raw/electoral/internas-2014/plan-circuital.csv"},
    "departamentales-2020": {"family": "desglose", "mode": "match", "tiporeg": "HOJA_ED", "tipo": "departamental",
        "desglose": "data/raw/electoral/departamentales-2020/desglose-de-votos-elecci-n-departamental.csv",
        "plan": "data/raw/electoral/departamentales-2020/plan-circuital.csv"},
    "departamentales-2025": {"family": "desglose", "mode": "match", "tiporeg": "HOJA_ED", "tipo": "departamental",
        "plan": "data/raw/electoral/departamentales-2025/plan-circuital.csv"},
    # ── WIDE ──
    "balotaje-2014": {"family": "wide", "csv": "data/raw/electoral/balotaje-2014/balotaje-2014.csv", "tipo": "balotaje",
        "cols": {"TOTALVAZQUEZSENDIC": "frente-amplio", "TOTALLACALLEPOULARRANAGA": "nacional"}, "np": NP_STD},
    "balotaje-2019": {"family": "wide", "csv": "data/raw/electoral/balotaje-2019/balotaje-2019.csv", "tipo": "balotaje",
        "cols": {"TOTALMARTINEZVILLAR": "frente-amplio", "TOTALLACALLEPOUARGIMON": "nacional"}, "np": NP_STD},
    "balotaje-2024": {"family": "wide", "csv": "data/raw/electoral/balotaje-2024/balotaje-2024.csv", "tipo": "balotaje",
        "cols": {"TOTALORSICOSSE": "frente-amplio", "TOTALDELGADORIPOLL": "nacional"}, "np": NP_STD},
    "referendum-luc-2022": {"family": "wide", "csv": "data/raw/electoral/referendum-2022/refer-ndum-contra-135-art-culos-de-la-le.csv", "tipo": "referendum",
        "cols": {"TOTALSI": "si", "TOTALNO": "no"}, "np": NP_STD},
    "plebiscito-vivir-sin-miedo-2019": {"family": "wide", "csv": "data/raw/electoral/plebiscito-2019/vivir-sin-miedo-2019-por-crv.csv", "tipo": "plebiscito",
        "si_col": "SI", "emit_cols": ["NOOBSERVADOS", "OBSERVADOS"],
        "np": {"ENBLANCO": "enBlanco", "ANULADOS": "anulados", "OBSERVADOS": "observados"}},
    "plebiscito-allanamientos-2024": {"family": "wide", "csv": "data/raw/electoral/nacionales-2024/totales-generales-plebiscitos.csv", "tipo": "plebiscito",
        "si_col": "SIART11", "emit_cols": ["TOTALVOTOSNOOBSERVADOS", "TOTALVOTOSOBSERVADOS"],
        "np": {"TOTALENBLANCO": "enBlanco", "TOTALANULADOS": "anulados", "TOTALVOTOSOBSERVADOS": "observados"}},
    "plebiscito-seguridad-social-2024": {"family": "wide", "csv": "data/raw/electoral/nacionales-2024/totales-generales-plebiscitos.csv", "tipo": "plebiscito",
        "si_col": "SIART67", "emit_cols": ["TOTALVOTOSNOOBSERVADOS", "TOTALVOTOSOBSERVADOS"],
        "np": {"TOTALENBLANCO": "enBlanco", "TOTALANULADOS": "anulados", "TOTALVOTOSOBSERVADOS": "observados"}},
}

def load_local_universe(eleccion, dep):
    """{str(crv): localId} desde los circuitos[] embebidos en votes-local.json, o None."""
    p = os.path.join(DATA, eleccion, dep, "votes-local.json")
    if not os.path.exists(p): return None
    vl = json.load(open(p, encoding="utf-8"))
    out = {}
    for z in vl["zonas"]:
        for c in z.get("circuitos", []):
            out[str(c["circuito"])] = z["geoId"]
    return out  # {} si no hay circuitos embebidos

def local_porOpcion(eleccion, dep):
    """{opcionId: votos} agregados del votes-local (para el gate de reconciliación)."""
    p = os.path.join(DATA, eleccion, dep, "votes-local.json")
    tot = {}
    vl = json.load(open(p, encoding="utf-8"))
    for z in vl["zonas"]:
        for o in z["porOpcion"]:
            tot[o["opcionId"]] = tot.get(o["opcionId"], 0) + o["votos"]
    return tot

def emit_shard(eleccion, dep, tipo, circ_votes, circ_np, c2l):
    """circ_votes:{crv:{op:v}}, circ_np:{crv:{np}}, c2l:{crv:localId} → escribe votes-circuito.json.

    Cada zona lleva `local` = geoId del local al que pertenece el circuito (puntero para
    que el frontend agrupe circuitos bajo su local). Todo crv en circ_votes ya pasó el
    filtro `crv in c2l/universe`, así que el lookup nunca da None.
    """
    zonas = []
    for crv in sorted(circ_votes.keys(), key=lambda x: (len(x), x)):
        ops = circ_votes[crv]
        ranking = sorted(ops.items(), key=lambda kv: -kv[1])
        validos = sum(v for _, v in ranking)
        if validos <= 0:
            continue
        np = circ_np.get(crv, {"enBlanco": 0, "anulados": 0, "observados": 0})
        zonas.append({
            "geoId": str(crv),
            "local": c2l.get(str(crv)),
            "ganadorOpcionId": ranking[0][0] if ranking else "",
            "validos": validos,
            "porOpcion": [{"opcionId": op, "votos": v} for op, v in ranking],
            "noPartidarios": np,
        })
    shard = {"eleccionId": eleccion, "departamento": dep, "nivel": "circuito",
             "escrutinio": "definitivo", "tipo": tipo, "zonas": zonas}
    out = os.path.join(DATA, eleccion, dep, "votes-circuito.json")
    os.makedirs(os.path.dirname(out), exist_ok=True)
    json.dump(shard, open(out, "w", encoding="utf-8"), ensure_ascii=False)
    return out, len(zonas), os.path.getsize(out)

# ── build DESGLOSE ──────────────────────────────────────────────────────────────
def build_desglose(eleccion, cfg):
    desg = cfg.get("desglose") or f"data/raw/electoral/{eleccion}/desglose-de-votos.csv"
    desg = os.path.join(ROOT, desg)
    if not os.path.exists(desg):
        return {"error": f"sin desglose {desg}"}
    rows = read_desglose(desg)
    tiporeg = cfg["tiporeg"].upper()
    # raw[dep][crv][lema] += v
    raw = defaultdict(lambda: defaultdict(lambda: defaultdict(int)))
    for r in rows:
        if r["tipo"].upper() != tiporeg: continue
        dep = CODE_DIR.get(r["dep"].upper())
        if not dep: continue
        try: v = int(r["votos"])
        except: continue
        if v <= 0: continue
        raw[dep][r["crv"]][r["lema"]] += v

    plan_by_dept = None
    results = {}
    for dep in sorted(raw.keys()):
        valid, name2id = load_opc_resolver(eleccion, dep)
        if valid is None:
            results[dep] = {"error": "sin opciones.json"}; continue
        # circ2local: el mismo universo que construyó el votes-local
        universe = load_local_universe(eleccion, dep)  # {crv: localId} si hay circuitos[] embebidos
        if universe:
            c2l = universe
        elif cfg["mode"] == "direct":
            c2l, _ = c2l_direct(dep)
            # si direct deja demasiados sin local, intentar fallback plan (match)
        else:
            if plan_by_dept is None:
                plan_by_dept = read_plan(cfg["plan"])
            # GUARD (planes de cobertura PARCIAL, ej. internas-2014 = solo MVD+CA+MA): si el plan
            # no tiene filas para este depto, NO emitir overlay (evita habilitar circuito/local en
            # los 16 deptos sin plan, que es lo que el desbloqueo NO debe tocar).
            if not plan_by_dept.get(dep):
                results[dep] = {"skip": "sin plan para el depto"}; continue
            c2l, _ = c2l_match(dep, plan_by_dept.get(dep, []))

        circ_votes = defaultdict(lambda: defaultdict(int))
        unknown = set(); dropped = 0; total_in = 0
        for crv, lemas in raw[dep].items():
            total_in += sum(lemas.values())
            if crv not in c2l:
                dropped += sum(lemas.values()); continue
            for lema, v in lemas.items():
                op = resolve_op(lema, name2id)
                if op not in valid:
                    unknown.add(f"{lema}->{op}")
                circ_votes[crv][op] += v
        out, nz, size = emit_shard(eleccion, dep, cfg["tipo"], circ_votes, {}, c2l)
        results[dep] = {"zonas": nz, "size": size, "dropped": dropped, "total_in": total_in,
                        "unknown": sorted(unknown)[:4]}
    return results

# ── build WIDE ──────────────────────────────────────────────────────────────────
def build_wide(eleccion, cfg):
    csv_path = os.path.join(ROOT, cfg["csv"])
    if not os.path.exists(csv_path):
        return {"error": f"sin csv {csv_path}"}
    # raw[dep][crv] = {op: v, "_np": {...}}
    raw = defaultdict(dict)
    with open(csv_path, encoding="utf-8-sig", errors="replace", newline="") as f:
        r = csv.DictReader(f); cols = {nkey(c): c for c in (r.fieldnames or [])}
        for row in r:
            dep = CODE_DIR.get(norm(row.get(cols.get("DEPARTAMENTO", ""), "")))
            if not dep: continue
            crv = (row.get(cols.get("CRV", ""), "") or "").strip()
            def g(k):
                c = cols.get(k)
                try: return int((row.get(c, "") or "0").replace(",", "") or 0)
                except: return 0
            if cfg.get("si_col"):
                si = g(cfg["si_col"]); emit = sum(g(c) for c in cfg["emit_cols"])
                no = max(0, emit - si)
                votes = {"si": si, "no": no}
            else:
                votes = {op: g(ck) for ck, op in cfg["cols"].items()}
            np = {v: g(k) for k, v in cfg["np"].items()}
            votes["_np"] = np
            raw[dep][crv] = votes

    results = {}
    for dep in sorted(raw.keys()):
        universe = load_local_universe(eleccion, dep)  # {crv: localId} de circuitos[] embebidos
        if not universe:
            results[dep] = {"error": "votes-local sin circuitos[] embebidos"}; continue
        circ_votes = defaultdict(dict); circ_np = {}; dropped = 0; total_in = 0
        for crv, votes in raw[dep].items():
            np = votes.get("_np", {})
            cv = {op: v for op, v in votes.items() if op != "_np"}
            total_in += sum(cv.values())
            if crv not in universe:
                dropped += sum(cv.values()); continue
            circ_votes[crv] = {op: v for op, v in cv.items() if v > 0}
            circ_np[crv] = {"enBlanco": np.get("enBlanco", 0), "anulados": np.get("anulados", 0),
                            "observados": np.get("observados", 0)}
        out, nz, size = emit_shard(eleccion, dep, cfg["tipo"], circ_votes, circ_np, universe)
        results[dep] = {"zonas": nz, "size": size, "dropped": dropped, "total_in": total_in, "unknown": []}
    return results

# ── GATE de reconciliación ──────────────────────────────────────────────────────
def gate(eleccion):
    """Σ circuito.porOpcion por opcionId == votes-local.porOpcion. delta=0 obligatorio."""
    base = os.path.join(DATA, eleccion)
    deptos = sorted(d for d in os.listdir(base) if os.path.isdir(os.path.join(base, d)))
    report = {}
    for dep in deptos:
        cp = os.path.join(base, dep, "votes-circuito.json")
        lp = os.path.join(base, dep, "votes-local.json")
        if not os.path.exists(cp) or not os.path.exists(lp): continue
        circ = json.load(open(cp, encoding="utf-8"))
        ctot = {}
        for z in circ["zonas"]:
            for o in z["porOpcion"]:
                ctot[o["opcionId"]] = ctot.get(o["opcionId"], 0) + o["votos"]
        ltot = local_porOpcion(eleccion, dep)
        diffs = {}
        for op in set(ctot) | set(ltot):
            d = ctot.get(op, 0) - ltot.get(op, 0)
            if d != 0: diffs[op] = {"circuito": ctot.get(op, 0), "local": ltot.get(op, 0), "delta": d}
        report[dep] = {"ok": not diffs, "diffs": diffs}
    return report

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("eleccion", nargs="?", default=None)
    ap.add_argument("--check", action="store_true", help="solo correr el gate")
    a = ap.parse_args()

    elecciones = [a.eleccion] if a.eleccion else list(CONFIG.keys())
    overall_ok = True
    max_size = 0; max_size_file = ""
    failed = []
    for el in elecciones:
        cfg = CONFIG.get(el)
        if not cfg:
            print(f"⚠ {el}: sin CONFIG — skip"); continue
        print(f"\n=== {el} [{cfg['family']}] ===")
        if not a.check:
            res = build_desglose(el, cfg) if cfg["family"] == "desglose" else build_wide(el, cfg)
            if "error" in res:
                print(f"  ✗ {res['error']}"); failed.append((el, res["error"])); overall_ok = False; continue
            for dep, r in res.items():
                if "error" in r:
                    print(f"  {dep:16} ✗ {r['error']}"); continue
                if "skip" in r:
                    print(f"  {dep:16} — {r['skip']}"); continue
                drop = f" dropped={r['dropped']}" if r.get("dropped") else ""
                unk = f" UNK={r['unknown']}" if r.get("unknown") else ""
                kb = r["size"] / 1024
                if r["size"] > max_size: max_size = r["size"]; max_size_file = f"{el}/{dep}"
                print(f"  {dep:16} zonas={r['zonas']:5} {kb:7.1f} KB{drop}{unk}")
        # GATE
        g = gate(el)
        bad = {d: r for d, r in g.items() if not r["ok"]}
        if bad:
            overall_ok = False
            print(f"  GATE ✗ {len(bad)} deptos con delta≠0:")
            for d, r in sorted(bad.items()):
                print(f"     {d}: {r['diffs']}")
        else:
            print(f"  GATE ✓ {len(g)} deptos reconcilian (delta=0)")
    print(f"\n{'='*60}")
    print(f"max size: {max_size/1024:.1f} KB ({max_size_file}) — cota 3 MB {'OK' if max_size <= 3*1024*1024 else 'EXCEDIDA'}")
    print(f"GATE GLOBAL: {'✓ TODO RECONCILIA' if overall_ok else '✗ HAY DELTAS'}")
    if failed:
        print("Elecciones no generadas:")
        for el, e in failed: print(f"  {el}: {e}")
    sys.exit(0 if overall_ok else 1)

if __name__ == "__main__":
    main()
