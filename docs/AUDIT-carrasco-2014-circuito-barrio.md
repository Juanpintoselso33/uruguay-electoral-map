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

## Alcance medido (drift vs mapeo servido, por ciclo)
Reconstruyendo el mapeo correcto por ciclo y comparando circuito-a-circuito con el servido:
`2014` 85% · `internas-2019` 83% · `2019` 85% · `departamentales-2020` 84% · `referendum-2022` 70%
· `departamentales-2025` 59% · **`2024` (internas/nac/bal/plebiscitos) 0% ✅**. Solo el ciclo 2024
está bien; el resto está mal-joineado a nivel barrio. (Drift = "difiere del roto", no prueba de
correcto; ver validación abajo.) Interior NO afectado (mapea por serie estable vía `run-barrio-all`).

## Método elegido (optimizado para mínimos errores/desvinculaciones)
`crvToBarrio` **por ciclo**, generado del `plan-circuital.csv` de ese ciclo contra el georef-2024.
Tiers de asignación (de más a menos preciso):
1. **dir** — street-key exacta → coords georef → PIP.
2. **coarse** (NUEVO) — calle sin número; si la coarse-key mapea a un único barrio en el georef.
   Gold test sobre 2024: **100% de acierto**. Sube la cobertura por dirección 56%→66%.
3. **serie-dominante** — fallback; gold test: **~63%** de acierto (el eslabón débil).
- **range (serie+credencial Desde–Hasta) RECHAZADO**: baja la correlación (los rangos se reparten
  entre elecciones). 
Resultado en 2014: 66% por dirección (≈100% preciso) + 34% por serie (≈63%) ≈ **~87% de circuitos
bien**; votos sin ubicar 5.678 = **0,7%** (mejor que el 2,7% del propio 2024).

## Validación contra realidad (no contra el roto)
- Correlación de rango (Spearman) FA% 2014-corregido vs 2024-servido (known-good): **0,80**
  (un mapeo scrambleado daría ~0).
- Spot-checks coherentes (FA% 2014corr / 2024served): Cerro 68/65, Casavalle 62/61 (alto FA);
  Pocitos 35/32, Punta Carretas 37/34, Carrasco 41/25 (bajo FA). Shift de nivel ~3-10pp (FA más
  fuerte en 2014) con geografía preservada = fix correcto.

## Implementación
Generador per-ciclo + `coarse` en `build-circuito-barrio.ts`; cada runner MVD lee el mapeo de su
ciclo; re-correr runners MVD; **re-correr `scripts/sweep-party-consistency.py`** (el ETL revierte
los nombres canónicos de partidos en `opciones.json`). Spike: `spikes/opt-circuito-barrio.py`.
