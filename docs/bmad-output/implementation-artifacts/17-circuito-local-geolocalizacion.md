# Epic 17 — Circuito geolocalizado por LOCAL · artefacto de implementación

_Arrancado 2026-06-01._

## Hallazgo de sourcing (verificado)
- **No existe georef oficial 2019.** "Plan circuital nacional con georreferencia" (gub.uy/corte-electoral) es producto único de las Nacionales 2024. CKAN no expone ningún dataset `georreferencia`; ningún Plan Circuital de CKAN trae lat/lon. → la geo histórica **se construye** anclando al georef-2024.
- **Votos por circuito (Desglose por CRV) existen** para nacionales-2019/2014, internas-2019, referéndum-2022, departamentales-2020/2025 (más Vivir sin Miedo 2019 ya por CRV en Epic 14).

## Por qué anclar por LOCAL (medido)
- Número de circuito migra **~94%** entre 2019 y 2024 → inservible como llave.
- Series solapan **100%** (2014/2019/2024). Solapamiento de rango de credencial `(Serie, Desde–Hasta)` cubre **99,9%** de circuitos, pero un circuito viejo se reparte en 2–3 locales.
- El **LOCAL (venue)** es el ancla estable; nombres no idénticos entre elecciones → **fuzzy matching** (nombre normalizado) validado por solapamiento de rango.

## Pipeline (scripts)
| Script | Rol |
|---|---|
| `scripts/build-locales-catalog.py` | georef-2024 → catálogo de locales + `geo/{dept}/local.topo.json` |
| `scripts/votes_local_lib.py` | agregación circuito→local + gate de losslessness |
| `scripts/votes-local-from-circuito.py` | familia 2024 directo desde `votes-circuito.json` (internas-2024) |
| `scripts/build-votes-local.py` | desglose (HOJA_EN) → votes-local; `--mode direct` (2024) / `--mode match` (motor fuzzy+rango) |

## Catálogo de locales
**2.283 locales** (19 deptos), 7.225 circuitos, **2.740.498 habilitados** (= padrón nacional).
`geo/{dept}/local.topo.json` (1 Point por local) emitido para los 19 deptos.

## Cobertura `votes-local.json` — **14/14 elecciones, 19/19 deptos**
| Elección | Locales | Votos ubicados | Modo | Loader |
|---|---:|---:|---|---|
| internas-2024 | 2.241 | 868.723 | direct (reusa circuito) | from-circuito · **19/19 lossless** |
| nacionales-2024 | 2.281 | 2.271.847 | direct | build-votes-local (HOJA_EN) |
| nacionales-2019 | 2.062 | 2.289.905 | match | build-votes-local (HOJA_EN) |
| nacionales-2014 | 1.987 | 2.236.789 | match | build-votes-local (HOJA_EN) |
| internas-2019 | 2.030 | 946.742 | match | build-votes-local (HOJA_ODN) |
| balotaje-2024 | 2.283 | 2.298.492 | direct | build-votes-local-wide (Orsi/Delgado) |
| balotaje-2019 | 2.062 | 2.308.067 | match | wide (Martínez/Lacalle) |
| balotaje-2014 | 1.987 | 2.163.596 | match | wide (Vázquez/Lacalle) |
| referendum-luc-2022 | 2.105 | 2.152.915 | match | wide (Sí/No) |
| plebiscito-vivir-sin-miedo-2019 | 2.062 | 2.433.342 | match | wide (Sí=1.139.433 control) |
| plebiscito-allanamientos-2024 | 2.283 | 2.441.740 | direct | wide (SiArt11) |
| plebiscito-seguridad-social-2024 | 2.283 | 2.441.740 | direct | wide (SiArt67) |
| departamentales-2020 | 2.066 | 2.033.270 | match | build-votes-local (HOJA_ED) |
| departamentales-2025 | 2.267 | 2.016.369 | match | build-votes-local (HOJA_ED) |

**Verificación de dirección vs oficial:** balotaje-2024 FA 52,1% ✓ · balotaje-2019 PN 50,6% ✓ · referéndum No 50,5% ✓ · VsM No 53,9% ✓ · plebiscitos-2024 Sí ~38% (no pasaron) ✓ · dptales-2025 ganadores por depto ✓ (MVD/Cane FA, Mald/Col Nacional, Salto Coalición).

`sin_local` = circuitos del desglose sin coordenada en el georef (exterior/observados) → logueados, nunca silenciosos (~1-3% de habilitados, menos en familia 2024).

## Frontend
- `NivelGeografico` += `'local'`; `departments.json` += `'local'` (gateado por presencia de `votes-local.json` en disco).
- Overlay de puntos **repurposeado a LOCAL** (prefiere `votes-local.json`, fallback `circuito`); botón "Local" en `LevelSelector`.
- **Verificado** internas-2024 (puntos por local en el mapa).
- **Known issue:** deep-link `?circ=1` no auto-activa el overlay en algunas elecciones (carrera de hidratación de `$circuito`); el click al botón sí lo activa. Falta verificar la ficha por local (click → `zona=localId`).

## Pendiente
- **17.5 (frontend, pulido):** fix de la carrera del deep-link `?circ=1` (no auto-activa el overlay en el primer load de algunas elecciones; el click al botón sí); verificar la ficha por local (click → `zona=localId`).
- **17.7:** decisión de migrar `internas-2024` de circuito→local (hoy conviven ambos niveles; el overlay ya prefiere local).
