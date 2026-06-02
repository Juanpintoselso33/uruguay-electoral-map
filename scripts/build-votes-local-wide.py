#!/usr/bin/env python3
"""
Epic 17 · Stories 17.4/17.6 — votes-local.json desde CSVs ANCHOS (balotaje) y BINARIOS (Sí/No).
Reusa el motor circuito→local (fuzzy nombre + solapamiento de rango) y aggregate_to_local.

Uso: python build-votes-local-wide.py <eleccion>
  (la config por elección — columnas→opcion, plan, modo — está embebida abajo)
"""
import csv, json, os, sys, re, unicodedata
from collections import defaultdict
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from votes_local_lib import aggregate_to_local

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
    return "".join(c for c in s if unicodedata.category(c) != "Mn").upper().strip()
def nkey(s):  # clave de columna: sin espacios/_/acentos
    return re.sub(r"[^A-Z0-9]", "", norm(s))

# ── CONFIG por elección ──────────────────────────────────────────────────────
NP = {"TOTALENBLANCO":"enBlanco","TOTALANULADOS":"anulados","TOTALVOTOSOBSERVADOS":"observados"}
CONFIG = {
 "balotaje-2014": {"csv":"data/raw/electoral/balotaje-2014/balotaje-2014.csv","mode":"match",
   "plan":"data/raw/electoral/nacionales-2014/plan-circuital.csv","tipo":"balotaje",
   "cols":{"TOTALVAZQUEZSENDIC":"frente-amplio","TOTALLACALLEPOULARRANAGA":"partido-nacional"},"np":NP},
 "balotaje-2019": {"csv":"data/raw/electoral/balotaje-2019/balotaje-2019.csv","mode":"match",
   "plan":"data/raw/electoral/nacionales-2019-full/plan-circuital.csv","tipo":"balotaje",
   "cols":{"TOTALMARTINEZVILLAR":"frente-amplio","TOTALLACALLEPOUARGIMON":"partido-nacional"},"np":NP},
 "balotaje-2024": {"csv":"data/raw/electoral/balotaje-2024/balotaje-2024.csv","mode":"direct","tipo":"balotaje",
   "cols":{"TOTALORSICOSSE":"frente-amplio","TOTALDELGADORIPOLL":"coalicion-republicana"},"np":NP},
 "referendum-luc-2022": {"csv":"data/raw/electoral/referendum-2022/refer-ndum-contra-135-art-culos-de-la-le.csv","mode":"match",
   "plan":"data/raw/electoral/referendum-2022/plan-circuital.csv","tipo":"referendum",
   "cols":{"TOTALSI":"si","TOTALNO":"no"},"np":NP},
 "plebiscito-vivir-sin-miedo-2019": {"csv":"data/raw/electoral/plebiscito-2019/vivir-sin-miedo-2019-por-crv.csv","mode":"match",
   "plan":"data/raw/electoral/nacionales-2019-full/plan-circuital.csv","tipo":"plebiscito",
   "si_col":"SI","emit_cols":["NOOBSERVADOS","OBSERVADOS"],"np":{"ENBLANCO":"enBlanco","ANULADOS":"anulados","OBSERVADOS":"observados"}},
 "plebiscito-allanamientos-2024": {"csv":"data/raw/electoral/nacionales-2024/totales-generales-plebiscitos.csv","mode":"direct","tipo":"plebiscito",
   "si_col":"SIART11","emit_cols":["TOTALVOTOSNOOBSERVADOS","TOTALVOTOSOBSERVADOS"],
   "np":{"TOTALENBLANCO":"enBlanco","TOTALANULADOS":"anulados","TOTALVOTOSOBSERVADOS":"observados"}},
 "plebiscito-seguridad-social-2024": {"csv":"data/raw/electoral/nacionales-2024/totales-generales-plebiscitos.csv","mode":"direct","tipo":"plebiscito",
   "si_col":"SIART67","emit_cols":["TOTALVOTOSNOOBSERVADOS","TOTALVOTOSOBSERVADOS"],
   "np":{"TOTALENBLANCO":"enBlanco","TOTALANULADOS":"anulados","TOTALVOTOSOBSERVADOS":"observados"}},
}

def overlap(a0,a1,b0,b1): return max(0, min(a1,b1)-max(a0,b0)+1)
def load_catalog(dep):
    return json.load(open(os.path.join(CAT_DIR,f"{dep}.json"),encoding="utf-8"))
def read_plan(path):
    out=defaultdict(list)
    with open(os.path.join(ROOT,path),encoding="utf-8-sig",errors="replace",newline="") as f:
        r=csv.DictReader(f); cols={nkey(c):c for c in (r.fieldnames or [])}
        def col(*n):
            for x in n:
                if x in cols: return cols[x]
            return None
        cdep=col("DEPARTAMENTO"); cnro=col("NROCIRCUITO"); cser=col("SERIE"); cd=col("DESDE"); ch=col("HASTA"); cdir=col("DIRECCION")
        for row in r:
            dep=NAME_DIR.get(norm(row.get(cdep,"")))
            if not dep: continue
            out[dep].append({"serie":(row.get(cser,"") or "").strip(),"crv":(row.get(cnro,"") or "").strip(),
                "desde":(row.get(cd,"") or "").strip(),"hasta":(row.get(ch,"") or "").strip(),"dir":(row.get(cdir,"") or "").strip()})
    return out
def c2l_match(dep, plan_rows):
    cat=load_catalog(dep); by_serie=defaultdict(list)
    for lo in cat["locales"]:
        for (s,d,h) in lo["ranges"]: by_serie[s].append((lo,d,h))
    c2l={}; meth=defaultdict(int)
    for pr in plan_rows:
        try: d=int(pr["desde"]); h=int(pr["hasta"])
        except: d=h=None
        cands=by_serie.get(pr["serie"],[])
        if not cands: meth["sin_serie"]+=1; continue
        nrm=norm(pr["dir"]); best=None; bs=-1; bm=None
        for (lo,ld,lh) in cands:
            ov=overlap(d,h,ld,lh) if d is not None else 0
            ovf=ov/max(1,(h-d+1)) if d is not None else 0
            name=lo["nombreNorm"]; ns=0.0
            if name and nrm:
                a=set(name.split()); b=set(nrm.split())
                if a and b: ns=len(a&b)/len(a|b)
                if nrm.startswith(name[:12]) or name.startswith(nrm[:12]): ns=max(ns,0.6)
            sc=ovf+ns*0.8
            if sc>bs: bs=sc; best=lo; bm=("name+range" if ns>=0.5 and ovf>0 else("name" if ns>=0.5 else "range"))
        if best: c2l[pr["crv"]]=best["localId"]; meth[bm]+=1
        else: meth["sin_match"]+=1
    return c2l, meth, cat
def c2l_direct(dep):
    cat=load_catalog(dep); m={}
    for lo in cat["locales"]:
        for c in lo["circuitos"]: m[str(c)]=lo["localId"]
    return m, cat

def main():
    el=sys.argv[1]; cfg=CONFIG[el]
    plan = read_plan(cfg["plan"]) if cfg["mode"]=="match" else None
    by_dept=defaultdict(dict)  # dep -> crv -> {opcion: votos, _np:{}}
    with open(os.path.join(ROOT,cfg["csv"]),encoding="utf-8-sig",errors="replace",newline="") as f:
        r=csv.DictReader(f); cols={nkey(c):c for c in (r.fieldnames or [])}
        for row in r:
            dep=CODE_DIR.get(norm(row.get(cols.get("DEPARTAMENTO",""),"")))
            if not dep: continue
            crv=(row.get(cols.get("CRV",""),"") or "").strip()
            def g(k):
                c=cols.get(k);
                try: return int((row.get(c,"") or "0").replace(",","") or 0)
                except: return 0
            votes={}
            if cfg.get("si_col"):
                si=g(cfg["si_col"]); emit=sum(g(c) for c in cfg["emit_cols"])
                no=max(0, emit-si)
                votes={"si":si,"no":no}
                npd={v:g(k) for k,v in cfg["np"].items()}
            else:
                for ck,op in cfg["cols"].items(): votes[op]=g(ck)
                npd={v:g(k) for k,v in cfg["np"].items()}
            votes["_np"]=npd
            by_dept[dep][crv]=votes
    tot_loc=0; tot_vot=0
    for dep,crvs in sorted(by_dept.items()):
        if cfg["mode"]=="direct": c2l,cat=c2l_direct(dep); meth={}
        else: c2l,meth,cat=c2l_match(dep, plan.get(dep,[]))
        order=[lo["localId"] for lo in cat["locales"]]
        cat_meta={lo["localId"]:{"nombre":lo.get("nombre"),"direccion":lo.get("direccion"),"habilitados":lo.get("habilitados")} for lo in cat["locales"]}
        shard,rep=aggregate_to_local(crvs, c2l, el, dep, cfg["tipo"], local_order=order, cat_meta=cat_meta)
        out=os.path.join(ROOT,f"public/data/{el}/{dep}/votes-local.json")
        os.makedirs(os.path.dirname(out),exist_ok=True); json.dump(shard,open(out,"w",encoding="utf-8"),ensure_ascii=False)
        tot_loc+=len(shard["zonas"]); tot_vot+=sum(p["votos"] for z in shard["zonas"] for p in z["porOpcion"])
        m=" ".join(f"{k}={v}" for k,v in sorted(meth.items())) if meth else "direct"
        sl=f" sin_local={len(rep['sin_local'])}" if rep["sin_local"] else ""
        print(f"  {dep:16} locales={len(shard['zonas']):4} crv_in={len(crvs):5} {m}{sl}")
    print(f"\n{el}: locales con voto={tot_loc} · votos ubicados={tot_vot:,}")

if __name__=="__main__":
    main()
