# Epic 21 — Dimensión de candidatos / personas (persona↔hoja) — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Construir la dimensión de datos **persona↔hoja** (quién integra cada lista, con id de persona estable por credencial) a partir de la "Integración de hojas de votación" de la Corte, y verificar standalone "¿en qué departamentos sacó más votos la lista de la persona X?" — sin depender todavía de la API (Epic 20).

**Architecture:** Post-steps en Python sobre datos de CKAN, espejando los precedentes del repo (`scripts/fetch-totales-ckan.py` para bajar, `scripts/build-internas-sublemas.py` para parsear integración, `scripts/gate-*.py` para integridad). Tres etapas: (1) fetch de la integración → raw; (2) parse → `personas-hoja.{eleccion}.json` por elección; (3) consolidación cross-elección por **credencial** → `personas.json`. Una etapa de verificación (CLI) cruza personas↔hoja con los votos por hoja ya existentes. El voto legislativo es **a la LISTA** → "votos de un candidato" = votos de su(s) hoja(s); el dataset y la verificación deben enunciarlo así.

**Tech Stack:** Python 3 (stdlib `csv`/`json`/`urllib`, `openpyxl` para fallback XLSX), CKAN API de catalogodatos.gub.uy, npm scripts `etl:*`/`gate:*`. Salida en `public/data/personas/`, raw en `data/raw/electoral/{eleccion}/`.

**Alcance:** Foco en **nacionales** (2024 → 2019 → 2014), que es donde están diputados/senadores (caso de Octavio). El fetcher y el parser son genéricos (tabla `TARGETS`) para extender luego a internas/departamentales. La Story 21.3 (endpoint `/api/v1/candidatos`) depende del Epic 20 (API) y **queda fuera de este plan**.

**Columnas reales de la Integración (verificadas en CKAN, nacionales-2024 CSV ~28 MB):**
`Numero, Departamento, PartidoPolitico, Agrupacion, Candidatura, SistemaSuplentes, Sublema, Nombre, CredencialSerie, CredencialNumero, Sexo, Ordinal, TitularSuplente`
- `Numero` = nº de hoja (lista) · `Candidatura` = cargo (PRESIDENCIAL/VICEPRESIDENCIAL/SENADOR/DIPUTADO/…) · `Nombre` = persona · `Ordinal`+`TitularSuplente` = posición · `CredencialSerie`+`CredencialNumero` = id de persona estable.

---

### Task 1: Fetch de la Integración de hojas desde CKAN

**Files:**
- Create: `scripts/fetch-nominas-ckan.py`
- Modify: `package.json` (agregar script `etl:nominas-fetch`)

Espeja `scripts/fetch-totales-ckan.py` (mismo helper `ckan()`/`resolve()`, idempotente). Baja el recurso **"Integración de hojas de votación"** (CSV; si viene vacío, XLSX) a `data/raw/electoral/{eleccion}/nominas-integracion.{csv|xlsx}`.

- [ ] **Step 1: Escribir el fetcher**

```python
#!/usr/bin/env python3
"""Baja de CKAN (Corte Electoral) el recurso 'Integración de hojas de votación' por elección — la
fuente del mapeo persona↔hoja (nombre, cargo, hoja, credencial). Idempotente. Uso:
  python scripts/fetch-nominas-ckan.py            # todas las TARGETS
  python scripts/fetch-nominas-ckan.py nacionales-2024
"""
import urllib.request, urllib.parse, json, os, sys

API = 'https://catalogodatos.gub.uy/api/3/action/'
UA = {'User-Agent': 'uruguay-electoral-map/1.0 (nominas fetch)'}
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# eleccion → (dataset CKAN, substring del recurso de integración)
TARGETS = {
    'nacionales-2024': 'corte-electoral-elecciones-nacionales-2024',
    'nacionales-2019': 'corte-electoral-elecciones-nacionales-2019',
    'nacionales-2014': 'corte-electoral-elecciones_nacionales_2014',
}
RES_SUB = 'integraci'  # matchea "Integración de hojas de votación"

def ckan(action, **params):
    url = API + action + '?' + urllib.parse.urlencode(params)
    return json.load(urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=60))

def resolve(dataset, fmt):
    pkg = ckan('package_show', id=dataset)['result']
    for r in pkg['resources']:
        if r.get('format', '').upper() == fmt and RES_SUB in r.get('name', '').lower():
            return r['url']
    return None

def fetch_one(eleccion, dataset):
    destdir = os.path.join(ROOT, 'data/raw/electoral', eleccion)
    os.makedirs(destdir, exist_ok=True)
    # Preferir CSV; si pesa < 1 KB (placeholder vacío), caer a XLSX.
    for fmt, ext in (('CSV', 'csv'), ('XLSX', 'xlsx')):
        url = resolve(dataset, fmt)
        if not url:
            continue
        dest = os.path.join(destdir, f'nominas-integracion.{ext}')
        if os.path.exists(dest) and os.path.getsize(dest) > 1024:
            print(f"  {eleccion}: ya existe {dest} (skip)"); return
        data = urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=300).read()
        if len(data) < 1024 and fmt == 'CSV':
            print(f"  {eleccion}: CSV vacío ({len(data)}B), pruebo XLSX"); continue
        with open(dest, 'wb') as f:
            f.write(data)
        print(f"  {eleccion}: bajado {len(data)//1024} KB → {dest}"); return
    raise SystemExit(f"no encontré recurso de integración para {eleccion}")

def main():
    sel = sys.argv[1:] or list(TARGETS)
    for e in sel:
        if e not in TARGETS:
            raise SystemExit(f"elección desconocida: {e} (válidas: {list(TARGETS)})")
        fetch_one(e, TARGETS[e])

if __name__ == '__main__':
    main()
```

- [ ] **Step 2: Agregar el npm script**

En `package.json`, dentro de `"scripts"`, agregar:
```json
"etl:nominas-fetch": "python scripts/fetch-nominas-ckan.py",
```

- [ ] **Step 3: Correr y verificar la descarga**

Run: `python scripts/fetch-nominas-ckan.py nacionales-2024`
Expected: imprime `nacionales-2024: bajado ~27000 KB → data/raw/electoral/nacionales-2024/nominas-integracion.csv` y el archivo existe (>1 MB).

Verificar el header:
Run: `head -1 data/raw/electoral/nacionales-2024/nominas-integracion.csv`
Expected: `Numero,Departamento,PartidoPolitico,Agrupacion,Candidatura,SistemaSuplentes,Sublema,Nombre,CredencialSerie,CredencialNumero,Sexo,Ordinal,TitularSuplente`

- [ ] **Step 4: Commit**

```bash
git add scripts/fetch-nominas-ckan.py package.json
git commit -m "feat(etl): fetch de Integración de hojas (nóminas) desde CKAN (Epic 21.1)"
```

---

### Task 2: Parser persona↔hoja por elección

**Files:**
- Create: `scripts/build-personas-hoja.py`
- Create (salida): `public/data/personas/personas-hoja.{eleccion}.json`
- Modify: `package.json` (`etl:personas-hoja`)

Lee la integración (CSV; fallback XLSX hoja 0) y emite un registro por fila persona×hoja×cargo, con id de persona estable. Reusa el idiom `DEPT_CODE`/`norm()` de `build-internas-sublemas.py`.

- [ ] **Step 1: Escribir el builder**

```python
#!/usr/bin/env python3
"""Parsea la Integración de hojas de votación → public/data/personas/personas-hoja.{eleccion}.json:
un registro por (persona × hoja × cargo). id de persona = credencial (estable cross-elección).
Uso: python scripts/build-personas-hoja.py nacionales-2024
"""
import csv, json, os, sys, unicodedata

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
# código de 2 letras de la Corte → folder de depto del proyecto
CODE_DEPT = {"AR":"artigas","CA":"canelones","CL":"cerro_largo","CO":"colonia","DU":"durazno",
    "FD":"florida","FS":"flores","LA":"lavalleja","MA":"maldonado","MO":"montevideo","PA":"paysandu",
    "RN":"rio_negro","RO":"rocha","RV":"rivera","SA":"salto","SJ":"san_jose","SO":"soriano",
    "TA":"tacuarembo","TT":"treinta_y_tres"}
VACIO = {"", "NO APLICA", "NO APLICA.", "N/A"}

def clean(s):
    return (s or "").strip()

def persona_id(serie, numero):
    """id estable: SERIE-NUMERO, normalizado (mayúsculas, sin espacios)."""
    return f"{clean(serie).upper()}-{clean(numero)}"

def read_rows(eleccion):
    base = os.path.join(ROOT, 'data/raw/electoral', eleccion)
    csv_path = os.path.join(base, 'nominas-integracion.csv')
    if os.path.exists(csv_path) and os.path.getsize(csv_path) > 1024:
        # 2019 puede venir latin-1; intentar utf-8 y caer a latin-1.
        for enc in ('utf-8-sig', 'latin-1'):
            try:
                with open(csv_path, encoding=enc) as f:
                    return list(csv.DictReader(f))
            except UnicodeDecodeError:
                continue
    xlsx = os.path.join(base, 'nominas-integracion.xlsx')
    if os.path.exists(xlsx):
        from openpyxl import load_workbook
        ws = load_workbook(xlsx, read_only=True).worksheets[0]
        it = ws.iter_rows(values_only=True)
        header = [str(c).strip() if c is not None else "" for c in next(it)]
        return [dict(zip(header, [("" if v is None else str(v)) for v in row])) for row in it]
    raise SystemExit(f"no hay integración para {eleccion} (corré etl:nominas-fetch)")

def main():
    if len(sys.argv) < 2:
        raise SystemExit("uso: build-personas-hoja.py <eleccion>")
    eleccion = sys.argv[1]
    rows = read_rows(eleccion)
    out = []
    for r in rows:
        cod = clean(r.get("Departamento")).upper()
        rec = {
            "personaId": persona_id(r.get("CredencialSerie"), r.get("CredencialNumero")),
            "nombre": clean(r.get("Nombre")),
            "sexo": clean(r.get("Sexo")) or None,
            "departamento": CODE_DEPT.get(cod, cod.lower()),
            "hoja": clean(r.get("Numero")),
            "partido": clean(r.get("PartidoPolitico")),
            "agrupacion": clean(r.get("Agrupacion")) or None,
            "sublema": (clean(r.get("Sublema")) or None) if clean(r.get("Sublema")).upper() not in VACIO else None,
            "cargo": clean(r.get("Candidatura")),
            "ordinal": clean(r.get("Ordinal")) or None,
            "titularSuplente": clean(r.get("TitularSuplente")) or None,
        }
        out.append(rec)
    destdir = os.path.join(ROOT, 'public/data/personas')
    os.makedirs(destdir, exist_ok=True)
    dest = os.path.join(destdir, f'personas-hoja.{eleccion}.json')
    with open(dest, 'w', encoding='utf-8') as f:
        json.dump({"eleccion": eleccion, "registros": out}, f, ensure_ascii=False)
    cargos = sorted({r["cargo"] for r in out})
    print(f"{eleccion}: {len(out)} registros, {len({r['personaId'] for r in out})} personas, cargos={cargos} → {dest}")

if __name__ == '__main__':
    main()
```

- [ ] **Step 2: Agregar el npm script**

En `package.json`:
```json
"etl:personas-hoja": "python scripts/build-personas-hoja.py",
```

- [ ] **Step 3: Correr y verificar formas + un caso conocido**

Run: `python scripts/build-personas-hoja.py nacionales-2024`
Expected: imprime algo como `nacionales-2024: ~9000 registros, ~7000 personas, cargos=['DIPUTADO', 'EDIL'..., 'PRESIDENCIAL', 'SENADOR', 'VICEPRESIDENCIAL'] → public/data/personas/personas-hoja.nacionales-2024.json` (los cargos exactos dependen del origen; deben incluir SENADOR y DIPUTADO).

Verificar un registro concreto:
Run: `python3 -c "import json; d=json.load(open('public/data/personas/personas-hoja.nacionales-2024.json')); r=[x for x in d['registros'] if x['cargo']=='SENADOR'][0]; print(r)"`
Expected: un dict con `personaId` tipo `"BEB-9853"`, `nombre`, `departamento`, `hoja`, `cargo='SENADOR'`, `ordinal`, `titularSuplente`.

- [ ] **Step 4: Commit**

```bash
git add scripts/build-personas-hoja.py package.json public/data/personas/personas-hoja.nacionales-2024.json
git commit -m "feat(etl): parser persona↔hoja por elección (Epic 21.1)"
```

---

### Task 3: Consolidación canónica de personas (cross-elección por credencial)

**Files:**
- Create: `scripts/build-personas-canonical.py`
- Create (salida): `public/data/personas/personas.json`
- Modify: `package.json` (`etl:personas`)

Une todos los `personas-hoja.*.json` por `personaId` (credencial) → una persona por credencial, con todas sus apariciones (elección, depto, hoja, cargo, ordinal, titular/suplente). Resuelve la identidad cross-elección por credencial (no por nombre); guarda variantes de nombre vistas para mostrar.

- [ ] **Step 1: Escribir el consolidador**

```python
#!/usr/bin/env python3
"""Consolida public/data/personas/personas-hoja.*.json → public/data/personas/personas.json:
una persona por credencial (personaId), con sus apariciones por elección. Uso:
  python scripts/build-personas-canonical.py
"""
import json, os, glob
from collections import defaultdict

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DIR = os.path.join(ROOT, 'public/data/personas')

def main():
    files = sorted(glob.glob(os.path.join(DIR, 'personas-hoja.*.json')))
    if not files:
        raise SystemExit("no hay personas-hoja.*.json (corré etl:personas-hoja)")
    personas = {}
    for path in files:
        doc = json.load(open(path, encoding='utf-8'))
        eleccion = doc["eleccion"]
        for r in doc["registros"]:
            pid = r["personaId"]
            p = personas.setdefault(pid, {"personaId": pid, "nombres": [], "sexo": r.get("sexo"), "apariciones": []})
            if r["nombre"] and r["nombre"] not in p["nombres"]:
                p["nombres"].append(r["nombre"])
            p["apariciones"].append({
                "eleccion": eleccion, "departamento": r["departamento"], "hoja": r["hoja"],
                "partido": r["partido"], "sublema": r.get("sublema"), "cargo": r["cargo"],
                "ordinal": r.get("ordinal"), "titularSuplente": r.get("titularSuplente"),
            })
    out = sorted(personas.values(), key=lambda p: p["nombres"][0] if p["nombres"] else p["personaId"])
    dest = os.path.join(DIR, 'personas.json')
    with open(dest, 'w', encoding='utf-8') as f:
        json.dump({"total": len(out), "personas": out}, f, ensure_ascii=False)
    multi = sum(1 for p in out if len({a["eleccion"] for a in p["apariciones"]}) > 1)
    print(f"{len(out)} personas consolidadas ({multi} en >1 elección) → {dest}")

if __name__ == '__main__':
    main()
```

- [ ] **Step 2: Agregar el npm script**

En `package.json`:
```json
"etl:personas": "python scripts/build-personas-canonical.py",
```

- [ ] **Step 3: Correr y verificar la consolidación**

Run: `python scripts/build-personas-canonical.py`
Expected: `N personas consolidadas (M en >1 elección) → public/data/personas/personas.json` con N > 0. Con una sola elección cargada (nacionales-2024), M = 0; al sumar 2019/2014 (Task 6) M > 0 (mismas credenciales reaparecen) — esto VALIDA que la credencial une personas entre elecciones.

- [ ] **Step 4: Commit**

```bash
git add scripts/build-personas-canonical.py package.json public/data/personas/personas.json
git commit -m "feat(etl): consolidación canónica de personas por credencial (Epic 21.2)"
```

---

### Task 4: Gate de integridad de la dimensión personas

**Files:**
- Create: `scripts/gate-personas.py`
- Modify: `package.json` (`gate:personas`)

Valida los shards generados (espeja `scripts/gate-no-partidarios.py`): toda fila tiene credencial y hoja; los cargos esperados existen (SENADOR/DIPUTADO en nacionales); cada hoja de la nómina existe en el catálogo de votos de su depto (no hay personas en hojas fantasma); conteos coherentes.

- [ ] **Step 1: Escribir el gate**

```python
#!/usr/bin/env python3
"""Gate de integridad de la dimensión personas↔hoja. Falla (exit 1) si:
  - algún registro no tiene personaId (credencial) o hoja;
  - faltan cargos legislativos esperados en nacionales (SENADOR, DIPUTADO);
  - una hoja de la nómina no existe en el catálogo de votos de su depto (hoja fantasma).
Uso: python scripts/gate-personas.py
"""
import json, os, glob, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DIR = os.path.join(ROOT, 'public/data/personas')

def hojas_catalogo(eleccion, depto):
    """Conjunto de nº de hoja presentes en el catálogo de votos del depto (para detectar fantasmas)."""
    cat = os.path.join(ROOT, 'public/data', eleccion, depto, 'catalogo.json')
    if not os.path.exists(cat):
        return None  # depto sin shard (no se puede chequear) → no falla por esto
    doc = json.load(open(cat, encoding='utf-8'))
    hojas = set()
    for c in doc.get("contiendas", []):
        for o in c.get("opciones", []):
            if o.get("hoja"):
                hojas.add(str(o["hoja"]))
    return hojas

def main():
    errs = []
    for path in sorted(glob.glob(os.path.join(DIR, 'personas-hoja.*.json'))):
        doc = json.load(open(path, encoding='utf-8'))
        eleccion = doc["eleccion"]
        regs = doc["registros"]
        sin_cred = [r for r in regs if not r["personaId"] or r["personaId"].startswith("-")]
        sin_hoja = [r for r in regs if not r["hoja"]]
        if sin_cred: errs.append(f"{eleccion}: {len(sin_cred)} registros sin credencial")
        if sin_hoja: errs.append(f"{eleccion}: {len(sin_hoja)} registros sin hoja")
        if eleccion.startswith("nacionales"):
            cargos = {r["cargo"].upper() for r in regs}
            for c in ("SENADOR", "DIPUTADO"):
                if c not in cargos:
                    errs.append(f"{eleccion}: falta el cargo {c} (cargos={sorted(cargos)})")
        # hojas fantasma (solo donde hay catálogo)
        fantasmas = 0
        for r in regs:
            cat = hojas_catalogo(eleccion, r["departamento"])
            if cat is not None and r["hoja"] and r["hoja"] not in cat:
                fantasmas += 1
        if fantasmas:
            errs.append(f"{eleccion}: {fantasmas} registros en hojas que no están en el catálogo de votos")
    if errs:
        print("[gate:personas] FALLÓ:")
        for e in errs: print("  -", e)
        sys.exit(1)
    print("[gate:personas] OK")

if __name__ == '__main__':
    main()
```

- [ ] **Step 2: Agregar el npm script**

En `package.json`:
```json
"gate:personas": "python scripts/gate-personas.py",
```

- [ ] **Step 3: Correr el gate**

Run: `npm run gate:personas`
Expected: `[gate:personas] OK`. Si reporta "hojas fantasma", investigar el mapeo hoja↔catálogo (puede haber hojas de cargos sin votos por hoja en el shard, p. ej. presidenciales que no se desglosan por hoja en ese depto) — ajustar el chequeo para excluir cargos sin desglose si aplica.

- [ ] **Step 4: Commit**

```bash
git add scripts/gate-personas.py package.json
git commit -m "test(gate): integridad de la dimensión personas↔hoja (Epic 21)"
```

---

### Task 5: Verificación standalone — "¿dónde sacó más votos la lista de la persona X?"

**Files:**
- Create: `scripts/query-persona.py`

CLI de verificación (no es la API): dado un nombre o credencial, encuentra a la persona, sus hojas por elección, y suma los votos de esas hojas **por departamento** desde los shards de votos existentes (vía el `catalogo.json` que mapea hoja→opcionId y el `votes.json` por depto). Imprime el ranking de departamentos. **Enuncia la métrica:** "votos de la(s) lista(s) que integra", no votos personales.

- [ ] **Step 1: Escribir el CLI de verificación**

```python
#!/usr/bin/env python3
"""Verificación standalone de la dimensión personas↔hoja (previo a la API).
Dado un nombre (substring) o credencial, imprime las hojas que integra la persona y los votos de
esas listas por departamento (ordenado desc). Métrica: votos de la LISTA, no votos personales.
Uso:
  python scripts/query-persona.py "ORSI"
  python scripts/query-persona.py BEB-9853
"""
import json, os, sys, unicodedata
from collections import defaultdict

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

def norm(s):
    s = unicodedata.normalize("NFD", s or "")
    return "".join(c for c in s if unicodedata.category(c) != "Mn").upper()

def find_persona(q):
    doc = json.load(open(os.path.join(ROOT, 'public/data/personas/personas.json'), encoding='utf-8'))
    qn = norm(q)
    for p in doc["personas"]:
        if p["personaId"] == q or any(qn in norm(n) for n in p["nombres"]):
            return p
    return None

def hoja_opcion(eleccion, depto, hoja):
    """nº de hoja → opcionId en el catálogo de votos del depto (None si no está)."""
    cat = os.path.join(ROOT, 'public/data', eleccion, depto, 'catalogo.json')
    if not os.path.exists(cat):
        return None
    doc = json.load(open(cat, encoding='utf-8'))
    for c in doc.get("contiendas", []):
        for o in c.get("opciones", []):
            if str(o.get("hoja")) == str(hoja):
                return o["id"]
    return None

def votos_hoja_por_depto(eleccion, depto, opcion_id):
    """Suma los votos de un opcionId (hoja) sobre las zonas del votes.json del depto."""
    vp = os.path.join(ROOT, 'public/data', eleccion, depto, 'votes.json')
    if not os.path.exists(vp):
        return 0
    doc = json.load(open(vp, encoding='utf-8'))
    total = 0
    for z in doc.get("zonas", []):
        for o in z.get("porOpcion", []):
            if o.get("opcionId") == opcion_id:
                total += o.get("votos", 0)
    return total

def main():
    if len(sys.argv) < 2:
        raise SystemExit('uso: query-persona.py "<nombre|credencial>"')
    p = find_persona(sys.argv[1])
    if not p:
        raise SystemExit("persona no encontrada")
    print(f"Persona: {p['nombres'][0]}  (id credencial {p['personaId']})")
    por_depto = defaultdict(int)
    for a in p["apariciones"]:
        oid = hoja_opcion(a["eleccion"], a["departamento"], a["hoja"])
        v = votos_hoja_por_depto(a["eleccion"], a["departamento"], oid) if oid else 0
        print(f"  {a['eleccion']} · {a['cargo']} · hoja {a['hoja']} · {a['departamento']}: {v} votos de la lista"
              + ("" if oid else "  (sin desglose por hoja en el shard)"))
        por_depto[a["departamento"]] += v
    print("\nRanking de departamentos (votos de las listas que integra):")
    for depto, v in sorted(por_depto.items(), key=lambda kv: -kv[1]):
        print(f"  {depto}: {v}")
    print("\nNota: es el voto a la LISTA (hoja), no voto personal — así funciona el voto legislativo en UY.")

if __name__ == '__main__':
    main()
```

- [ ] **Step 2: Correr la verificación con un senador conocido**

Run: `python scripts/query-persona.py SENADOR_CONOCIDO` (usar un apellido presente en la nómina, p. ej. el primer senador que listó el Task 2 Step 3).
Expected: imprime sus hojas por elección/depto y un ranking de departamentos con votos > 0 en al menos los deptos donde su lista compitió, terminando con la nota de "voto a la lista". Si todos los votos dan 0, revisar el matching hoja↔opcionId (el `id`/`hoja` del catálogo vs el `Numero` de la nómina) antes de avanzar.

- [ ] **Step 3: Commit**

```bash
git add scripts/query-persona.py
git commit -m "feat(etl): verificación standalone persona→votos-de-lista por depto (Epic 21)"
```

---

### Task 6: Extender a nacionales 2019 y 2014 (y dejar listo internas/departamentales)

**Files:**
- Modify: `scripts/fetch-nominas-ckan.py` (ya tiene 2019/2014 en `TARGETS`)
- Create (salida): `personas-hoja.nacionales-2019.json`, `personas-hoja.nacionales-2014.json`

- [ ] **Step 1: Bajar y construir 2019 y 2014**

```bash
python scripts/fetch-nominas-ckan.py nacionales-2019 nacionales-2014
python scripts/build-personas-hoja.py nacionales-2019
python scripts/build-personas-hoja.py nacionales-2014
python scripts/build-personas-canonical.py
```
Expected: el consolidado ahora reporta **M > 0** personas en >1 elección (validación clave de que la credencial une identidades entre años). Nota: 2019 puede venir en latin-1 — el parser ya cae a `latin-1`; si los nombres salen con caracteres rotos, verificar el encoding del CSV bajado.

- [ ] **Step 2: Correr el gate sobre las 3 elecciones**

Run: `npm run gate:personas`
Expected: `[gate:personas] OK`.

- [ ] **Step 3: Documentar y dejar extensión anotada**

En `scripts/README.md`, agregar bajo los builders una línea para `fetch-nominas-ckan.py` / `build-personas-hoja.py` / `build-personas-canonical.py` / `gate-personas.py` / `query-persona.py`, indicando: fuente (Integración de hojas, CKAN), id por credencial, métrica "voto a la lista", y que **internas/departamentales** se suman agregando sus slugs a `TARGETS` (el cargo será EDIL/INTENDENTE/precandidato, no SENADOR/DIPUTADO → el chequeo de cargos del gate es solo para `nacionales-*`).

- [ ] **Step 4: Commit**

```bash
git add public/data/personas/ scripts/README.md
git commit -m "feat(etl): nóminas nacionales 2019+2014 + doc dimensión personas (Epic 21)"
```

---

## Notas de cierre

- **21.3 (endpoint `/api/v1/candidatos/{id}/resultados`) NO está en este plan** — depende del Epic 20 (API). Cuando el Epic 20 exista, ese endpoint lee `personas.json` + los shards de votos (misma lógica que `query-persona.py`) y expone el ranking, explicitando la métrica "voto a la lista".
- **Tamaño:** `personas.json` y los `personas-hoja.*.json` se commitean a `public/data/personas/` (se sirven estáticos). Si el agregado crece, evaluar gzip/particionado, pero a nivel nacional el volumen es manejable (~miles de personas).
- **Identidad por credencial:** es la decisión central que simplifica 21.2 — no hay matching difuso de nombres. Caso a vigilar: la misma credencial con variantes de nombre (se guardan todas en `nombres[]`).
