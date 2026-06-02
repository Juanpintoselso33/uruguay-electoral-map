#!/usr/bin/env python3
"""
Epic 17 · Stories 17.2/17.3/17.4 — votes-local.json desde el "Desglose de votos" (HOJA_EN).

Dos modos de circuito→local:
  --mode direct : familia 2024 (mismo ciclo del georef) → CRV→local directo del catálogo.
  --mode match  : elección vieja → motor fuzzy(nombre de local)+solapamiento de rango de
                  credencial, usando el plan-circuital de esa elección (--plan PATH).

lema → opcionId : se quita el prefijo "Partido " y se slugifica; se valida contra opciones.json.

Uso:
  python build-votes-local.py nacionales-2024 nacional --mode direct
  python build-votes-local.py nacionales-2019 nacional --mode match --plan data/raw/electoral/nacionales-2019-full/plan-circuital.csv
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

def slug(s):
    s = unicodedata.normalize("NFD", s or "")
    s = "".join(c for c in s if unicodedata.category(c) != "Mn").lower()
    s = re.sub(r"[^a-z0-9]+", "-", s)
    return s.strip("-")

def lema_to_opcion(lema):
    l = (lema or "").strip()
    if norm(l).startswith("PARTIDO "):
        l = l[len("Partido "):] if l[:8].lower()=="partido " else l
        l = re.sub(r"(?i)^partido\s+", "", (lema or "").strip())
    return slug(l)

def read_desglose(path):
    """Devuelve filas dict con claves canónicas: tipo, dep, crv, serie, lema, votos."""
    # detectar separador y encoding
    with open(path, "rb") as f:
        head = f.read(4)
    enc = "utf-8-sig"
    try:
        open(path, encoding="utf-8-sig").readline()
    except Exception:
        enc = "latin-1"
    out = []
    with open(path, encoding=enc, errors="replace", newline="") as f:
        r = csv.DictReader(f)
        cols = {norm(c).replace("Ó","O").replace("�","").replace("_",""): c for c in (r.fieldnames or [])}
        def col(*names):
            for n in names:
                k = n.replace("_","")
                if k in cols: return cols[k]
            return None
        c_tipo = col("TIPOREGISTRO"); c_dep = col("DEPARTAMENTO"); c_crv = col("CRV")
        c_ser = col("SERIES"); c_lema = col("LEMA"); c_vot = col("CANTIDADVOTOS")
        for row in r:
            out.append({
                "tipo": (row.get(c_tipo,"") or "").strip(),
                "dep": (row.get(c_dep,"") or "").strip(),
                "crv": (row.get(c_crv,"") or "").strip(),
                "serie": (row.get(c_ser,"") or "").strip(),
                "lema": (row.get(c_lema,"") or "").strip(),
                "votos": (row.get(c_vot,"") or "").strip(),
            })
    return out

def load_catalog(dept):
    with open(os.path.join(CAT_DIR, f"{dept}.json"), encoding="utf-8") as f:
        return json.load(f)

# ---------- motor circuito→local ----------
def overlap(a0,a1,b0,b1):
    return max(0, min(a1,b1) - max(a0,b0) + 1)

def build_circ2local_match(dept, plan_rows):
    """plan_rows: filas del plan-circuital de la elección (dept ya filtrado).
       Devuelve (circ2local, report) usando fuzzy de nombre + solapamiento de rango."""
    cat = load_catalog(dept)
    # índice por serie → locales candidatos, con sus rangos en esa serie
    by_serie = defaultdict(list)
    for lo in cat["locales"]:
        for (s,d,h) in lo["ranges"]:
            by_serie[s].append((lo, d, h))
    circ2local = {}
    methods = defaultdict(int)
    for pr in plan_rows:
        serie = pr["serie"];
        try: d=int(pr["desde"]); h=int(pr["hasta"])
        except: d=h=None
        crv = pr["crv"]
        nrm = norm(pr["dir"])
        cands = by_serie.get(serie, [])
        if not cands:
            methods["sin_serie"] += 1
            continue
        best=None; best_score=-1; best_method=None
        for (lo, ld, lh) in cands:
            ov = overlap(d,h,ld,lh) if d is not None else 0
            ov_frac = ov / max(1, (h-d+1)) if d is not None else 0
            # similitud de nombre (token overlap sobre el nombre del venue)
            name = lo["nombreNorm"]
            nsim = 0.0
            if name and nrm:
                a=set(name.split()); b=set(nrm.split())
                if a and b: nsim = len(a&b)/len(a|b)
                if nrm.startswith(name[:12]) or name.startswith(nrm[:12]): nsim = max(nsim, 0.6)
            score = ov_frac*1.0 + nsim*0.8
            if score > best_score:
                best_score=score; best=lo; best_method=("name+range" if nsim>=0.5 and ov_frac>0 else ("name" if nsim>=0.5 else "range"))
        if best is not None:
            circ2local[crv]=best["localId"]; methods[best_method]+=1
        else:
            methods["sin_match"]+=1
    return circ2local, methods

def build_circ2local_direct(dept):
    cat = load_catalog(dept)
    m={}
    for lo in cat["locales"]:
        for c in lo["circuitos"]:
            m[str(c)]=lo["localId"]
    return m, cat

def _nkey(s):
    return re.sub(r"[^A-Z0-9]","",norm(s))

def read_plan(path):
    """plan-circuital comma → filas {dep_dir, serie, crv, desde, hasta, dir}.
       Tolera Departamento como nombre completo o código de 2 letras, y dir en DIRECCION/LOCAL."""
    out=defaultdict(list)
    with open(path, encoding="utf-8-sig", errors="replace", newline="") as f:
        r=csv.DictReader(f)
        cols={_nkey(c):c for c in (r.fieldnames or [])}
        def col(*n):
            for x in n:
                if x in cols: return cols[x]
            return None
        c_dep=col("DEPARTAMENTO"); c_nro=col("NROCIRCUITO"); c_ser=col("SERIE")
        c_d=col("DESDE"); c_h=col("HASTA"); c_dir=col("DIRECCION","LOCAL")
        for row in r:
            dk=norm(row.get(c_dep,""))
            dep=NAME_DIR.get(dk) or CODE_DIR.get(dk)
            if not dep: continue
            out[dep].append({"serie":(row.get(c_ser,"") or "").strip(),"crv":(row.get(c_nro,"") or "").strip(),
                "desde":(row.get(c_d,"") or "").strip(),"hasta":(row.get(c_h,"") or "").strip(),
                "dir":(row.get(c_dir,"") or "").strip()})
    return out

def main():
    ap=argparse.ArgumentParser()
    ap.add_argument("eleccion"); ap.add_argument("tipo")
    ap.add_argument("--desglose", default=None)
    ap.add_argument("--mode", choices=["direct","match"], required=True)
    ap.add_argument("--plan", default=None)
    ap.add_argument("--tiporeg", default="HOJA_EN")
    a=ap.parse_args()

    desg = a.desglose or f"data/raw/electoral/{a.eleccion}/desglose-de-votos.csv"
    desg = os.path.join(ROOT, desg)
    rows = read_desglose(desg)
    # agregar por dept→crv→opcion
    by_dept = defaultdict(lambda: defaultdict(lambda: defaultdict(int)))
    for r in rows:
        if r["tipo"] != a.tiporeg: continue
        dep = CODE_DIR.get(r["dep"].upper())
        if not dep: continue
        try: v=int(r["votos"])
        except: continue
        if v<=0: continue
        by_dept[dep][r["crv"]][r["lema"]] += v   # lema CRUDO; se resuelve a opcionId por-depto

    plan_by_dept = read_plan(os.path.join(ROOT,a.plan)) if (a.mode=="match" and a.plan) else None

    # validar opciones contra opciones.json
    tot_dep=0; tot_locales=0; tot_hab=0; cov_rows=[]
    for dep, crvs in sorted(by_dept.items()):
        # opciones canónicas
        opc_path=os.path.join(ROOT,f"public/data/{a.eleccion}/{dep}/opciones.json")
        valid_ops=None; name2id={}
        if os.path.exists(opc_path):
            ops_doc=json.load(open(opc_path,encoding="utf-8"))["opciones"]
            valid_ops={o["opcionId"] for o in ops_doc}
            for o in ops_doc:
                nm=norm(o["nombre"]); name2id[nm]=o["opcionId"]
                name2id[re.sub(r"^PARTIDO\s+","",nm)]=o["opcionId"]
        def resolve_op(lema):
            nm=norm(lema)
            return name2id.get(nm) or name2id.get(re.sub(r"^PARTIDO\s+","",nm)) or lema_to_opcion(lema)
        # circ→local
        if a.mode=="direct":
            c2l, cat = build_circ2local_direct(dep)
            methods={}
        else:
            c2l, methods = build_circ2local_match(dep, plan_by_dept.get(dep, []))
            cat = load_catalog(dep)
        order=[lo["localId"] for lo in cat["locales"]]
        # metadata por local para enriquecer la ficha (nombre/dirección/habilitados)
        cat_meta={lo["localId"]:{"nombre":lo.get("nombre"),"direccion":lo.get("direccion"),"habilitados":lo.get("habilitados")} for lo in cat["locales"]}
        # construir circ_votes (filtrando opciones no canónicas → log)
        unknown=set()
        circ_votes={}
        for crv, lemas in crvs.items():
            d={}
            for lema,v in lemas.items():
                op=resolve_op(lema)
                if valid_ops and op not in valid_ops:
                    unknown.add(f"{lema}->{op}")
                d[op]=d.get(op,0)+v
            circ_votes[str(crv)]=d
        # agregar a local
        sys.path.insert(0, os.path.join(ROOT,"scripts"))
        from votes_local_lib import aggregate_to_local
        shard, rep = aggregate_to_local(circ_votes, c2l, a.eleccion, dep, a.tipo, local_order=order, cat_meta=cat_meta)
        out=os.path.join(ROOT,f"public/data/{a.eleccion}/{dep}/votes-local.json")
        os.makedirs(os.path.dirname(out),exist_ok=True)
        json.dump(shard, open(out,"w",encoding="utf-8"), ensure_ascii=False)
        # cobertura por habilitados ubicados (locales con ≥1 voto)
        tot_dep+=1; tot_locales+=len(shard["zonas"])
        m=" ".join(f"{k}={v}" for k,v in sorted(methods.items())) if methods else ""
        unk=f" UNK_OP={sorted(unknown)[:4]}" if unknown else ""
        sl=f" sin_local={len(rep['sin_local'])}" if rep["sin_local"] else ""
        print(f"  {dep:16} locales={len(shard['zonas']):4} crv_in={len(circ_votes):5} {m}{sl}{unk}")
    print(f"\n{a.eleccion} [{a.mode}]: {tot_dep} deptos · locales con voto={tot_locales}")

if __name__=="__main__":
    main()
