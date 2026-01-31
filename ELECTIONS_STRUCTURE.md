# Estructura de Elecciones en Uruguay

## Calendario Electoral Uruguayo

Uruguay tiene un ciclo electoral de 5 años con diferentes tipos de elecciones:

### 📅 Ciclo Electoral

```
Año 0: Elecciones Departamentales y Municipales (Mayo)
Año 0: Elecciones Internas de Partidos (Junio)
Año 0: Elecciones Nacionales (Octubre)
Año 0: Balotaje Presidencial* (Noviembre - si es necesario)
Año 5: Elecciones Departamentales y Municipales (Mayo)
```

*El balotaje solo ocurre si ningún candidato obtiene mayoría absoluta en primera vuelta.

## Tipos de Elecciones

### 1. Elecciones Internas de Partidos Políticos

**Cuándo:** Junio (último domingo)
**Qué se elige:** Candidatos presidenciales de cada partido
**Nivel:** Nacional
**Datos disponibles:** Votos por precandidato, por departamento y circuito

**Características:**
- Solo votantes afiliados a cada partido
- Define candidatos para las Nacionales
- Voto por listas (hojas de votación)
- Permite votar por candidato a presidente (ODN) y lemas/sublemas (ODD)

### 2. Elecciones Nacionales

**Cuándo:** Octubre (último domingo)
**Qué se elige:** Presidente, Vicepresidente, Senadores, Diputados
**Nivel:** Nacional
**Datos disponibles:** Votos por partido, lista, departamento y circuito

**Características:**
- Toda la ciudadanía habilitada
- Primera vuelta presidencial
- Elección simultánea de Parlamento
- Voto único por partido y lista

### 3. Balotaje Presidencial

**Cuándo:** Noviembre (último domingo) - solo si es necesario
**Qué se elige:** Presidente y Vicepresidente
**Nivel:** Nacional
**Datos disponibles:** Votos por candidato y departamento

**Características:**
- Solo si ningún candidato obtuvo >50% en primera vuelta
- Solo dos candidatos más votados
- Decisión binaria

### 4. Elecciones Departamentales y Municipales

**Cuándo:** Mayo (segundo domingo)
**Qué se elige:** Intendentes, Juntas Departamentales, Alcaldes
**Nivel:** Departamental y Municipal
**Datos disponibles:** Votos por departamento, municipio y cargo

**Características:**
- Gobierno local
- Voto separado: Intendente + Junta Departamental + Alcalde
- Solo afecta al departamento específico

## Elecciones Disponibles (2014-2025)

| Año  | Tipo           | Fecha       | Estado      | Notas                    |
|------|----------------|-------------|-------------|--------------------------|
| 2014 | Nacionales     | 26/10/2014  | ✅ Disponible | Primera vuelta          |
| 2019 | Internas       | 30/06/2019  | ✅ Disponible | Partidos políticos      |
| 2019 | Nacionales     | 27/10/2019  | ✅ Disponible | Primera vuelta          |
| 2020 | Departamentales| 27/09/2020  | ✅ Disponible | Pospuestas por COVID-19 |
| 2024 | Internas       | 30/06/2024  | ✅ Implementado | **YA EN LA APP**     |
| 2024 | Nacionales     | 27/10/2024  | ✅ Disponible | Primera vuelta          |
| 2024 | Balotaje       | 24/11/2024  | ✅ Disponible | Segunda vuelta          |
| 2025 | Departamentales| 11/05/2025  | ⏳ Futura    | Aún no ocurrió          |

## Estructura de Datos

### Formato CSV Común

Todas las elecciones comparten una estructura similar:

#### Desglose de Votos
```csv
TIPO_REGISTRO,DEPARTAMENTO,CRV,SERIES,LEMA,DESCRIPCIÓN_1,DESCRIPCIÓN_2,CANTIDAD_VOTOS
```

**Campos:**
- `TIPO_REGISTRO`: HOJA_ODN o HOJA_ODD
- `DEPARTAMENTO`: Código (MO, CA, etc.)
- `CRV`: Comisión Receptora de Votos (circuito + serie)
- `LEMA`: Partido político
- `DESCRIPCIÓN_1`: Tipo de candidatura / escrutinio
- `DESCRIPCIÓN_2`: Número de hoja de votación
- `CANTIDAD_VOTOS`: Cantidad de votos

### Diferencias entre Tipos

#### Internas vs Nacionales
- **Internas:** `DESCRIPCIÓN_1` contiene nombre del precandidato
- **Nacionales:** `DESCRIPCIÓN_1` contiene "Presidente y Vicepresidente"

#### Departamentales
- Dos archivos separados: Departamental + Municipal
- `DESCRIPCIÓN_1` indica cargo (Intendente, Junta, Alcalde)

#### Balotaje
- Solo dos candidatos
- Estructura simplificada
- Sin listas/hojas complejas

## Compatibilidad con ETL Actual

### ✅ Compatible sin cambios:
- Estructura de columnas es la misma
- Códigos de departamento idénticos
- Formato CSV UTF-8

### ⚠️ Requiere adaptación:
- **Nombres de archivos** varían entre años
- **URLs** específicas por dataset
- **Integración de hojas** puede tener columnas extra en años recientes
- **Departamentales** tienen archivos separados por tipo de cargo

### 🔧 Cambios Necesarios en ETL:

1. **Extractor:**
   - Agregar parámetro `--election` o `--year`
   - Mapear año → URLs del catálogo
   - Descargar a `data/raw/electoral/{year}/`

2. **Transformer:**
   - Detectar tipo de elección automáticamente
   - Normalizar campo `DESCRIPCIÓN_1` según tipo
   - Manejar archivos múltiples (departamentales)

3. **Loader:**
   - Organizar en `public/data/electoral/{year}/{dept}/`
   - Generar metadata por elección
   - Actualizar `elections.json` global

## Prioridad de Implementación

### Fase 1 (Alta prioridad):
1. ✅ **Internas 2024** - YA IMPLEMENTADO
2. 🔄 **Nacionales 2019** - Comparación con 2024
3. 🔄 **Nacionales 2024** - Datos más recientes

### Fase 2 (Media prioridad):
4. **Internas 2019** - Comparación temporal
5. **Nacionales 2014** - Datos históricos
6. **Balotaje 2024** - Resultados finales

### Fase 3 (Baja prioridad):
7. **Departamentales 2020** - Requiere UI diferente
8. **Departamentales 2025** - Cuando estén disponibles

## Referencias

- **Catálogo de Datos Abiertos:** https://catalogodatos.gub.uy/organization/corte-electoral
- **Corte Electoral:** https://www.gub.uy/corte-electoral/datos-y-estadisticas/datos-abiertos
- **Catálogo completo:** Ver `elections-catalog.json`

---

**Última actualización:** 2026-01-30
