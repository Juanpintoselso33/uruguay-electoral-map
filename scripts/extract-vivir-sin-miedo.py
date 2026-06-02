"""Story 14.1 — Resultado del plebiscito "Vivir sin Miedo" (27/10/2019) por CRV.

El catálogo de datos abiertos NO publica el desglose del plebiscito por serie/CRV (solo
`TotalSoloSi` = sobres con ÚNICAMENTE la papeleta del Sí ≈0,6%). El conteo COMPLETO del Sí
está en la columna "Papeleta por SI" del PDF oficial "Resultados del plebiscito, por circuito"
(gub.uy/corte-electoral, 20 pág):
  data/raw/electoral/plebiscito-2019/resultados-plebiscito-2019-por-circuito.pdf

Estrategia: parseo el PDF por posición de columna (x0) y hago un JOIN GREEDY (multiset) contra
`totales-generales-por-comisi-n-receptora.csv` por la tupla
(depto, NoObservados, Observados, EnBlanco, Anulados, SoloSi) — que identifica a la CRV. Así el
CRV y la Serie salen AUTORITATIVOS del archivo de totales (orden distinto entre PDF y totales,
por eso no sirve zip posicional), y el Sí sale del PDF.

Validado: 7229/7229 CRV joineadas (0 sin match), Σ "Papeleta por SI" = 1.139.433 (total nacional
oficial exacto). Solo 39/7187 tuplas tienen serie ambigua (0,5%, despreciable para el choropleth).

Salida: data/raw/electoral/plebiscito-2019/vivir-sin-miedo-2019-por-crv.csv
  Columnas: Departamento, CRV, Serie, NoObservados, Observados, EnBlanco, Anulados, Si
  (Válidos = NoObservados, igual que plebiscitos 2024; el ETL deriva No = Válidos − Sí.)
"""
import pdfplumber, csv, re, sys
from collections import defaultdict, deque

PDF = 'data/raw/electoral/plebiscito-2019/resultados-plebiscito-2019-por-circuito.pdf'
TOTALES = 'data/raw/electoral/nacionales-2019-full/totales-generales-por-comisi-n-receptora.csv'
OUT = 'data/raw/electoral/plebiscito-2019/vivir-sin-miedo-2019-por-crv.csv'
SI_OFICIAL = 1_139_433

NAME2CODE = {'Montevideo': 'MO', 'Canelones': 'CA', 'Maldonado': 'MA', 'Rocha': 'RO',
 'Treinta y Tres': 'TT', 'Cerro Largo': 'CL', 'Rivera': 'RV', 'Artigas': 'AR', 'Salto': 'SA',
 'Paysandú': 'PA', 'Río Negro': 'RN', 'Soriano': 'SO', 'Colonia': 'CO', 'San José': 'SJ',
 'Flores': 'FS', 'Florida': 'FD', 'Durazno': 'DU', 'Lavalleja': 'LA', 'Tacuarembó': 'TA'}

def col_of(x):
    for lim, name in [(180, 'ACTO'), (250, 'DEPTO'), (318, 'CIRSER'), (372, 'ESCR'), (437, 'HAB'),
                      (492, 'NOOBS'), (545, 'OBS'), (595, 'EMIT'), (643, 'BLANCO'), (693, 'ANUL'),
                      (748, 'SOLOSI')]:
        if x < lim:
            return name
    return 'PAPSI'

def parse_pdf():
    """Filas del PDF en orden: tupla-clave (para el join) + Sí."""
    out = []
    with pdfplumber.open(PDF) as pdf:
        for pg in pdf.pages:
            by_top = defaultdict(list)
            for w in pg.extract_words():
                by_top[round(w['top'])].append(w)
            for top in sorted(by_top):
                cells = defaultdict(list)
                for w in sorted(by_top[top], key=lambda x: x['x0']):
                    cells[col_of(w['x0'])].append(w['text'])
                depto = re.sub(r'^.*Plebiscito', '', ' '.join(cells.get('DEPTO', [])).strip()).strip()
                def num(k):
                    v = cells.get(k)
                    try:
                        return int(v[0]) if v else None
                    except ValueError:
                        return None
                if not depto or num('NOOBS') is None:
                    continue
                out.append({'code': NAME2CODE[depto], 'noobs': num('NOOBS'), 'obs': num('OBS') or 0,
                            'blanco': num('BLANCO') or 0, 'anul': num('ANUL') or 0,
                            'solosi': num('SOLOSI') or 0, 'si': num('PAPSI') or 0})
    return out

def load_totales_index():
    idx = defaultdict(deque)
    with open(TOTALES, encoding='utf-8') as fh:
        for t in csv.DictReader(fh):
            key = (t['Departamento'], int(t['TotalVotosNOObservados'] or 0), int(t['TotalVotosObservados'] or 0),
                   int(t['TotalEnBlanco'] or 0), int(t['TotalAnulados'] or 0), int(t['TotalSoloSi'] or 0))
            idx[key].append(t)
    return idx

def main():
    pdf_rows = parse_pdf()
    idx = load_totales_index()
    joined, nomatch = [], 0
    for r in pdf_rows:
        key = (r['code'], r['noobs'], r['obs'], r['blanco'], r['anul'], r['solosi'])
        if idx[key]:
            joined.append((idx[key].popleft(), r['si']))
        else:
            nomatch += 1
    leftover = sum(len(d) for d in idx.values())
    tot_si = sum(si for _, si in joined)
    assert nomatch == 0 and leftover == 0, f'join incompleto: nomatch={nomatch} leftover={leftover}'
    assert tot_si == SI_OFICIAL, f'Sí total {tot_si} != oficial {SI_OFICIAL}'
    assert all(si <= int(t['TotalVotosNOObservados'] or 0) for t, si in joined), 'Sí > NoObservados en alguna CRV'

    with open(OUT, 'w', newline='', encoding='utf-8') as fh:
        w = csv.writer(fh)
        w.writerow(['Departamento', 'CRV', 'Serie', 'NoObservados', 'Observados', 'EnBlanco', 'Anulados', 'Si'])
        for t, si in joined:
            w.writerow([t['Departamento'], t['CRV'], t['Serie'], t['TotalVotosNOObservados'],
                        t['TotalVotosObservados'], t['TotalEnBlanco'], t['TotalAnulados'], si])
    print(f'✅ {len(joined)} CRV escritas → {OUT}')
    print(f'   Sí nacional = {tot_si:,} (oficial {SI_OFICIAL:,})  ·  0 sin match, 0 sobrantes')

if __name__ == '__main__':
    sys.exit(main())
