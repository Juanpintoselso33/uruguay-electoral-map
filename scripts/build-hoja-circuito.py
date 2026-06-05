#!/usr/bin/env python3
"""
build-hoja-circuito.py — desglose por HOJA al nivel CIRCUITO → hoja-circuito.json.

Es el gemelo POR CIRCUITO de `hoja-local.json`: misma resolución de `opcionId` de HOJA
(contra `catalogo.json`, ids idénticos a `hoja-local.json` post-sweep) y el MISMO motor
circuito→local (direct/match) que `build-hoja-local.py`/`build-votes-local.py`, pero NO
agrega al local: emite una zona por CIRCUITO con un puntero `local` (geoId del local),
igual que `votes-circuito.json`.

Estructura emitida (single-file por depto):
  { eleccionId, departamento, nivel:'circuito', escrutinio:'definitivo', tipo,
    zonas: [ { geoId:str(crv), local:<localId>, ganadorOpcionId,
               validos, porOpcion:[{opcionId,votos}] } ] }

RECONCILE-BY-CONSTRUCTION:
  Cada circuito se resuelve con el MISMO resolver de hoja y el MISMO c2l que usa
  `build-hoja-local.py`, y se DESCARTAN los mismos CRV sin local. Por lo tanto
    Σ_circuitos∈local hoja-circuito.porOpcion[op] == hoja-local.porOpcion[op]
  por opcionId×local, exactamente (gate delta=0).

SHARDING (cota 3 MB por archivo):
  Si el single-file de un depto supera 3 MB (típicamente Montevideo internas), se emite
  en su lugar `hoja-circuito/{localId}.json` (un archivo chico por local) + un índice
  `hoja-circuito.json` con {sharded:true, locales:[...], ...}. El frontend detecta el
  `sharded` y fetchea el shard del local abierto. Sólo se shardea el depto que excede.

Cobertura: las 6 elecciones que tienen `hoja-local.json` (desglose con hojas):
  nacionales-2014 (match), nacionales-2019 (match, MVD), nacionales-2024 (direct),
  internas-2019 (match), internas-2024 (direct), departamentales-2025 (match).

Uso:
  python scripts/build-hoja-circuito.py                 # todas las del CONFIG
  python scripts/build-hoja-circuito.py nacionales-2024 # una elección
  python scripts/build-hoja-circuito.py --check         # sólo el gate
"""
import csv, json, os, sys, re, unicodedata, argparse
from collections import defaultdict

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CAT_DIR = os.path.join(ROOT, "data/processed/locales")
DATA = os.path.join(ROOT, "public/data")
SHARD_LIMIT = 3 * 1024 * 1024  # 3 MB

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

# ── motor circuito→local (idéntico a build-hoja-local.py) ──────────────────────
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

# TIPO_REGISTRO del desglose → contienda del catálogo (idéntico a build-hoja-local.py)
TIPO_CONTIENDA = {
    "HOJA_EN": "unica", "VOTO_LEMA": "unica",
    "HOJA_ODN": "odn", "HOJA_ODD": "odd",
    "HOJA_ED": "junta", "VOTO_LEMA_ED": "junta",
    "HOJA_EM": "municipio", "VOTO_LEMA_EM": "municipio",
}

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
    """De catalogo.json: name2lema, hoja2opc, vl2opc — idéntico a build-hoja-local.py."""
    path = os.path.join(ROOT, f"public/data/{eleccion}/{dep}/catalogo.json")
    if not os.path.exists(path): return None
    doc = json.load(open(path, encoding="utf-8"))
    name2lema = {}; hoja2opc = {}; vl2opc = {}
    def reg(nm, lid):
        nm = norm(nm)
        if not nm: return
        name2lema[nm] = lid
        name2lema[re.sub(r"^PARTIDO\s+", "", nm)] = lid
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

# ── CONFIG: las 6 elecciones con hoja-local. Espeja modo/plan de build-hoja-local. ──
CONFIG = {
    "nacionales-2024": {"tipo": "nacional", "mode": "direct"},
    "nacionales-2014": {"tipo": "nacional", "mode": "match",
        "plan": "data/raw/electoral/nacionales-2014/plan-circuital.csv"},
    "nacionales-2019": {"tipo": "nacional", "mode": "match",
        "plan": "data/raw/electoral/nacionales-2019-full/plan-circuital.csv"},
    "internas-2019": {"tipo": "internas", "mode": "match",
        "plan": "data/raw/electoral/internas-2019/plan-circuital.csv"},
    # internas-2014: plan PARCIAL (solo MVD+CA+MA, recuperado de Wayback). El GUARD de plan-por-depto
    # evita emitir overlay en los 16 deptos sin plan.
    "internas-2014": {"tipo": "internas", "mode": "match",
        "plan": "data/raw/electoral/internas-2014/plan-circuital.csv"},
    "internas-2024": {"tipo": "internas", "mode": "direct"},
    "departamentales-2025": {"tipo": "departamental", "mode": "match",
        "plan": "data/raw/electoral/departamentales-2025/plan-circuital.csv"},
    "departamentales-2020": {"tipo": "departamental", "mode": "match",
        "desglose": "data/raw/electoral/departamentales-2020/desglose-de-votos-combinado.csv",
        "plan": "data/raw/electoral/departamentales-2020/plan-circuital.csv"},
}

def emit_dep(eleccion, dep, tipo, circ_zonas):
    """circ_zonas: lista de zonas-circuito ya armadas. Decide single-file vs sharded.
       Devuelve dict de reporte."""
    base = os.path.join(DATA, eleccion, dep)
    single = {"eleccionId": eleccion, "departamento": dep, "nivel": "circuito",
              "escrutinio": "definitivo", "tipo": tipo, "zonas": circ_zonas}
    blob = json.dumps(single, ensure_ascii=False, separators=(",", ":"))
    size = len(blob.encode("utf-8"))
    out_main = os.path.join(base, "hoja-circuito.json")
    shard_dir = os.path.join(base, "hoja-circuito")

    if size <= SHARD_LIMIT:
        # limpiar shards previos si existían
        if os.path.isdir(shard_dir):
            for fn in os.listdir(shard_dir):
                os.remove(os.path.join(shard_dir, fn))
            os.rmdir(shard_dir)
        os.makedirs(base, exist_ok=True)
        open(out_main, "w", encoding="utf-8").write(blob)
        return {"format": "single", "size": size, "zonas": len(circ_zonas), "locales_sharded": 0}

    # SHARDED: un archivo por local + índice
    os.makedirs(shard_dir, exist_ok=True)
    by_local = defaultdict(list)
    sin_local = []
    for z in circ_zonas:
        lid = z.get("local")
        if lid: by_local[lid].append(z)
        else: sin_local.append(z)  # no debería pasar (ya filtrados), por las dudas
    # escribir cada shard
    written = set()
    max_shard = 0
    for lid, zs in by_local.items():
        doc = {"eleccionId": eleccion, "departamento": dep, "nivel": "circuito",
               "escrutinio": "definitivo", "tipo": tipo, "local": lid, "zonas": zs}
        b = json.dumps(doc, ensure_ascii=False, separators=(",", ":"))
        p = os.path.join(shard_dir, f"{lid}.json")
        open(p, "w", encoding="utf-8").write(b)
        written.add(f"{lid}.json")
        max_shard = max(max_shard, len(b.encode("utf-8")))
    # limpiar shards huérfanos
    for fn in os.listdir(shard_dir):
        if fn not in written:
            os.remove(os.path.join(shard_dir, fn))
    # índice (reemplaza el single hoja-circuito.json)
    idx = {"eleccionId": eleccion, "departamento": dep, "nivel": "circuito",
           "escrutinio": "definitivo", "tipo": tipo, "sharded": True,
           "shardDir": "hoja-circuito", "locales": sorted(by_local.keys())}
    open(out_main, "w", encoding="utf-8").write(json.dumps(idx, ensure_ascii=False, separators=(",", ":")))
    return {"format": "sharded", "size": size, "zonas": len(circ_zonas),
            "locales_sharded": len(by_local), "max_shard": max_shard}

def build(eleccion, cfg):
    desg = os.path.join(ROOT, cfg.get("desglose") or f"data/raw/electoral/{eleccion}/desglose-de-votos.csv")
    if not os.path.exists(desg):
        return {"error": f"sin desglose {desg}"}
    rows = read_desglose(desg)
    plan_by_dept = read_plan(os.path.join(ROOT, cfg["plan"])) if cfg["mode"] == "match" else None

    by_dept_rows = defaultdict(list)
    for r in rows:
        dep = CODE_DIR.get(r["dep"].upper())
        if dep: by_dept_rows[dep].append(r)

    results = {}
    for dep, drows in sorted(by_dept_rows.items()):
        resolver = load_hoja_resolver(eleccion, dep)
        if not resolver:
            continue  # depto sin catálogo (ej. nacionales-2019 sólo MVD)
        name2lema, hoja2opc, vl2opc = resolver
        if cfg["mode"] == "direct":
            c2l, cat = build_circ2local_direct(dep)
        else:
            # GUARD plan parcial (internas-2014 = solo MVD+CA+MA): sin plan para el depto → skip.
            if not plan_by_dept.get(dep):
                continue
            c2l, cat = build_circ2local_match(dep, plan_by_dept.get(dep, []))

        # circ_votes[crv][opcionId] += votos  (misma resolución que build-hoja-local)
        circ_votes = defaultdict(lambda: defaultdict(int))
        unknown = set()
        for r in drows:
            try: v = int(r["votos"])
            except: continue
            if v <= 0: continue
            cont = TIPO_CONTIENDA.get(r["tipo"].upper())
            if not cont: continue
            lnm = norm(r["lema"])
            lemaId = name2lema.get(lnm) or name2lema.get(re.sub(r"^PARTIDO\s+", "", lnm))
            if not lemaId:
                unknown.add(("lema", r["lema"])); continue
            if "VOTO_LEMA" in r["tipo"].upper():
                op = vl2opc.get((cont, lemaId))
            else:
                op = hoja2opc.get((cont, lemaId, r["d1"])) or hoja2opc.get((cont, lemaId, r["d2"]))
            if not op:
                unknown.add((r["tipo"], lemaId, r["d1"], r["d2"])); continue
            circ_votes[str(r["crv"])][op] += v

        # armar zonas por circuito; DESCARTAR crv sin local (igual que hoja-local)
        zonas = []; sin_local = 0
        for crv in sorted(circ_votes.keys(), key=lambda x: (len(x), x)):
            lid = c2l.get(crv)
            ops = circ_votes[crv]
            if not lid:
                sin_local += sum(ops.values()); continue
            porOpcion = sorted(({"opcionId": op, "votos": v} for op, v in ops.items()),
                               key=lambda x: -x["votos"])
            validos = sum(ops.values())
            if validos <= 0: continue
            zonas.append({"geoId": str(crv), "local": lid,
                          "ganadorOpcionId": porOpcion[0]["opcionId"],
                          "validos": validos, "porOpcion": porOpcion})
        rep = emit_dep(eleccion, dep, cfg["tipo"], zonas)
        rep["sin_local"] = sin_local
        rep["unknown"] = sorted(unknown)[:3]
        results[dep] = rep
    return results

# ── GATE: Σ_circuitos∈local hoja-circuito[op] == hoja-local[op] (delta=0 por op×local) ──
def load_hoja_circuito_zonas(eleccion, dep):
    """Devuelve la lista de zonas-circuito sea single-file o sharded, o None."""
    base = os.path.join(DATA, eleccion, dep)
    main = os.path.join(base, "hoja-circuito.json")
    if not os.path.exists(main): return None
    doc = json.load(open(main, encoding="utf-8"))
    if doc.get("sharded"):
        zonas = []
        for lid in doc["locales"]:
            p = os.path.join(base, doc.get("shardDir", "hoja-circuito"), f"{lid}.json")
            sd = json.load(open(p, encoding="utf-8"))
            zonas.extend(sd["zonas"])
        return zonas
    return doc["zonas"]

def gate(eleccion):
    base = os.path.join(DATA, eleccion)
    deptos = sorted(d for d in os.listdir(base) if os.path.isdir(os.path.join(base, d)))
    report = {}
    for dep in deptos:
        hl_p = os.path.join(base, dep, "hoja-local.json")
        if not os.path.exists(hl_p): continue
        zonas = load_hoja_circuito_zonas(eleccion, dep)
        if zonas is None: continue
        # agregar circuito → (local, op)
        circ = defaultdict(int)
        for z in zonas:
            lid = z["local"]
            for o in z["porOpcion"]:
                circ[(lid, o["opcionId"])] += o["votos"]
        # hoja-local → (local, op)
        hl = json.load(open(hl_p, encoding="utf-8"))
        loc = defaultdict(int)
        for z in hl["zonas"]:
            for o in z["porOpcion"]:
                loc[(z["geoId"], o["opcionId"])] += o["votos"]
        diffs = {}
        for k in set(circ) | set(loc):
            d = circ.get(k, 0) - loc.get(k, 0)
            if d != 0:
                diffs[f"{k[0]}|{k[1]}"] = {"circuito": circ.get(k, 0), "local": loc.get(k, 0), "delta": d}
        report[dep] = {"ok": not diffs, "ndiffs": len(diffs), "diffs": dict(list(diffs.items())[:5])}
    return report

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("eleccion", nargs="?", default=None)
    ap.add_argument("--check", action="store_true", help="sólo correr el gate")
    a = ap.parse_args()

    elecciones = [a.eleccion] if a.eleccion else list(CONFIG.keys())
    overall_ok = True
    max_size = 0; max_size_file = ""
    sharded = []; failed = []
    for el in elecciones:
        cfg = CONFIG.get(el)
        if not cfg:
            print(f"⚠ {el}: sin CONFIG — skip"); continue
        print(f"\n=== {el} [{cfg['mode']}] ===")
        if not a.check:
            res = build(el, cfg)
            if "error" in res:
                print(f"  ✗ {res['error']}"); failed.append((el, res["error"])); overall_ok = False; continue
            for dep, r in sorted(res.items()):
                kb = r["size"] / 1024
                if r["size"] > max_size: max_size = r["size"]; max_size_file = f"{el}/{dep}"
                fmt = r["format"]
                extra = ""
                if fmt == "sharded":
                    sharded.append(f"{el}/{dep}")
                    extra = f" SHARDED locales={r['locales_sharded']} max_shard={r['max_shard']/1024:.0f}KB"
                sl = f" sin_local={r['sin_local']}" if r.get("sin_local") else ""
                unk = f" UNK={r['unknown']}" if r.get("unknown") else ""
                print(f"  {dep:16} zonas={r['zonas']:5} {kb:8.1f} KB [{fmt}]{extra}{sl}{unk}")
        # GATE
        g = gate(el)
        bad = {d: r for d, r in g.items() if not r["ok"]}
        if bad:
            overall_ok = False
            print(f"  GATE ✗ {len(bad)} deptos con delta≠0:")
            for d, r in sorted(bad.items()):
                print(f"     {d}: ndiffs={r['ndiffs']} {r['diffs']}")
        else:
            print(f"  GATE ✓ {len(g)} deptos reconcilian (delta=0 por op×local)")
    print(f"\n{'='*64}")
    print(f"max size single-file: {max_size/1024:.1f} KB ({max_size_file}) — cota 3 MB {'OK' if max_size <= SHARD_LIMIT else 'EXCEDIDA→sharded'}")
    if sharded:
        print(f"SHARDED ({len(sharded)} deptos): {', '.join(sharded)}")
    else:
        print("SHARDED: ninguno (todos single-file)")
    print(f"GATE GLOBAL: {'✓ TODO RECONCILIA' if overall_ok else '✗ HAY DELTAS'}")
    if failed:
        print("Elecciones no generadas:")
        for el, e in failed: print(f"  {el}: {e}")
    sys.exit(0 if overall_ok else 1)

if __name__ == "__main__":
    main()
