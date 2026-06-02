# Auditoría: "FA 66.5% en Carrasco (2014)" — join CRV→barrio incorrecto

**Disparador:** reporte en X (@29howww) — "dudo que el FA haya sacado 70% en Carrasco en 2014".
**Veredicto:** el dato es **incorrecto**. No es que el FA sacara 66% en el Carrasco real; es un
**join circuito→barrio mal aplicado** en la elección 2014.

## Hecho central (robusto)
La zona "Carrasco" en `public/data/nacionales-2014/montevideo/votes.json` suma los **circuitos
(CRV) 856–919** del desglose 2014 → FA 7.465 / 11.227 = **66,5%**, ganador FA.
Pero las **direcciones reales de esos circuitos en 2014**
(`data/raw/electoral/nacionales-2014/plan-circuital.csv`) NO son el Carrasco costero:
ISEF Malvín (Rambla Euskal Erria/Mataojo), San Cayetano (Comercio/Lombardini),
Santa Luisa de Marillac (Larravide), Liceo 20 (Hernani), Escuela 180 (Caramurú)…
→ **Malvín Norte / Punta Gorda / Unión**, zonas pro-FA. El 66,5% es voto de esos barrios
mal etiquetado como Carrasco.

## Causa raíz (verificada en código)
El mapeo usado es `data/mappings/montevideo-circuito-barrio.json` (`crvToBarrio`), generado por
`etl/geometry/build-circuito-barrio.ts`. Método: circuito → **dirección de calle** →
coords del georef **Nacionales-2024** → point-in-polygon contra `public/v_sig_barrios.json`
(62 barrios), con fallback serie→barrio. **Es un buen método**, pero queda **clavado a la
numeración de circuitos del plan que usa** (internas / 2024). El propio script lo advierte
(líneas 14-16): *"NO se joina por número de circuito (se reusa entre elecciones)…"*.

El problema: el ETL de 2014 (`etl/run-nacionales-2014-mvd-hoja.ts:20-32`) **aplica ese mapeo a
los CRV de 2014 por número**. Los números de CRV se **reasignan entre elecciones**, así que en
2014 los CRV 856–919 caían en Malvín Norte/Punta Gorda, no en Carrasco como en 2024. → mis-join.

(El viejo `montevideo-crv-barrio.json`, generado por intersección espacial serie→barrio, está
*reemplazado* por este script; no confundir su metadata con la del archivo en uso.)

## Número corregido (estimación autoritativa)
Re-derivando el join con las **direcciones propias de 2014** (mismo método PIP):
- "Carrasco" servido (con bug): **FA 66,5%** (11.227 válidos).
- "Carrasco" corregido: **≈ FA 41,5%** (7.054 válidos), FA aún primero por poco.
  *Nota:* el barrio oficial INE "Carrasco" es más amplio que el enclave costero rico; con el
  join correcto el FA todavía puede ganarlo ajustado en 2014, pero **lejísimos del 66%**.
  (Estimación: ~44% de los circuitos 2014 cayeron al fallback por serie, menos preciso.)
- Los circuitos que el mapeo con bug llama "Carrasco" pertenecen realmente a:
  **Punta Gorda (5.575), Unión (3.142), Peñarol/Lavalleja (2.510)**.

## Alcance
- Afecta a Montevideo a **nivel barrio/zona** en elecciones cuya numeración de CRV no coincide
  con la del plan al que está clavado el mapeo: **2014 confirmado**, **2019 probablemente
  parcial**, **2024 aproximadamente alineado** (no verificado al 100%).
- Niveles `circuito`/`local` no dependen de este mapeo → no afectados por esto.

## Fix propuesto (no aplicado)
Construir un `crvToBarrio` **por elección**, derivado de las direcciones del plan circuital de
**ese** año (point-in-polygon, como hace `build-circuito-barrio.ts`), en vez de reutilizar uno
solo para todas. Para 2014/2019 alcanza con correr el mismo método sobre su `plan-circuital.csv`
(las coords salen del georef 2024 por street-key; el fallback serie cubre el resto).
Decisión pendiente con el usuario.
