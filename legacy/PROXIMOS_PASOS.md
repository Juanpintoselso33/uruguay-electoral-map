# Próximos Pasos - Uruguay Electoral Map

## Estado Actual del Proyecto ✅

### Completado (6/8 tareas)

| Tarea | Estado | Detalles |
|-------|--------|----------|
| Migración a ETL | ✅ | Datos en `data/raw/` y `data/processed/` |
| ETL Transform | ✅ | 4 departamentos procesados |
| Optimización GeoJSON | ✅ | Treinta y Tres: 24MB → 0.06MB |
| Refactorización RegionMap | ✅ | 1027 → 7 archivos (~100-200 líneas) |
| Refactorización ListSelector | ✅ | 597 → 6 componentes |
| Composables | ✅ | 4 composables creados |

### Pendiente (2/8 tareas)

| Tarea | Prioridad | Esfuerzo | Impacto |
|-------|-----------|----------|---------|
| Migrar App.vue a Pinia | Media | 2-3 horas | Mejora arquitectura |
| Descargar departamentos faltantes | Alta | 4-6 horas | Escalabilidad |

---

## Tarea Pendiente #1: Migrar App.vue a Pinia Store

### Objetivo
Completar la migración del estado de `App.vue` al store de Pinia para centralizar toda la lógica de estado.

### Estado Actual
- ✅ Store creado: `src/stores/electoral.ts`
- ✅ Pinia instalado y configurado
- ⚠️ App.vue aún usa `ref()` locales

### Pasos a Seguir

1. **Revisar el store existente**
   ```bash
   # El store ya tiene la mayoría de la lógica
   cat src/stores/electoral.ts
   ```

2. **Actualizar App.vue**
   ```vue
   <script setup lang="ts">
   import { useElectoralStore } from './stores/electoral'

   const store = useElectoralStore()

   // Reemplazar refs por store
   // const selectedLists = ref([]) → store.selectedLists
   // const isODN = ref(false) → store.isODN

   onMounted(async () => {
     await store.loadRegionsConfig()
   })
   </script>
   ```

3. **Actualizar props de componentes**
   - Pasar propiedades del store en lugar de refs locales
   - Usar acciones del store para mutaciones

4. **Probar funcionalidad**
   ```bash
   npm run dev
   # Verificar que todo funciona igual
   ```

### Beneficios
- Estado centralizado y reactivo
- Mejor debugging con Pinia DevTools
- Facilita testing unitario
- Código más limpio en App.vue

### Tiempo Estimado: 2-3 horas

---

## Tarea Pendiente #2: Descargar Datos Departamentos Faltantes

### Objetivo
Obtener datos electorales y geográficos para los 15 departamentos faltantes.

### Departamentos Pendientes (15)

| Prioridad | Departamentos | Población |
|-----------|---------------|-----------|
| **Alta** | Canelones, San José, Rocha | ~600K hab |
| **Media** | Florida, Lavalleja, Durazno, Flores, Soriano, Río Negro, Paysandú, Salto | ~450K hab |
| **Baja** | Artigas, Rivera, Tacuarembó, Cerro Largo | ~250K hab |

### Datos Necesarios

#### 1. Datos Electorales (FÁCIL - Ya disponibles)

Los datos de **todos los departamentos** ya están en el archivo maestro del Corte Electoral:

```bash
# Descargar archivo maestro con TODOS los departamentos
npm run etl:extract --type electoral

# Este archivo incluye:
# - desglose-de-votos.csv (todos los departamentos)
# - integracion-hojas-de-votacion.csv (todos los departamentos)
```

**Procesamiento por departamento:**
```javascript
// El ETL ya sabe filtrar por departamento
// Solo necesitas ejecutar transform para cada uno

npm run etl:transform -- --dept canelones
npm run etl:transform -- --dept san_jose
npm run etl:transform -- --dept rocha
// ... etc
```

#### 2. Datos Geográficos (DESAFÍO - Requiere trabajo)

**Opción A: Límites Departamentales Simples** (Rápido)
```bash
# Descargar límites departamentales oficiales
# URL: https://catalogodatos.gub.uy/dataset/ide-limites-departamentales
# Cada departamento como un solo polígono (sin subdivisiones)
```

**Opción B: Secciones Electorales** (Ideal pero requiere más trabajo)
- Necesitas GeoJSON con subdivisiones (barrios/localidades)
- Fuentes:
  1. IDE Uruguay: Secciones censales del INE
  2. Plan Circuital del Corte Electoral (convertir a GeoJSON)
  3. Crear manualmente con QGIS

**Opción C: Usar Secciones Censales del INE** (Recomendado)
```bash
# 1. Descargar secciones censales por departamento
# URL: https://www.ine.gub.uy/web/guest/mapas

# 2. Convertir shapefile a GeoJSON
ogr2ogr -f GeoJSON output.json input.shp

# 3. Mapear zonas censales a zonas electorales
# Usar el archivo zone-mappings.json
```

### Estrategia Recomendada

**Fase 1: Implementación Rápida (2-3 horas)**
```bash
# 1. Usar límites departamentales simples
npm run etl:extract --type geographic

# 2. Para cada departamento:
#    - Extraer del archivo maestro electoral
#    - Usar límite departamental simple como mapa
#    - Generar agregación a nivel departamental

# Resultado: 19 departamentos funcionando (sin subdivisiones)
```

**Fase 2: Mejora Incremental (por departamento)**
```bash
# Para departamentos prioritarios, agregar subdivisiones:
# 1. Canelones → Obtener barrios/ciudades
# 2. San José → Obtener localidades
# 3. Rocha → Obtener zonas turísticas

# Herramientas:
# - QGIS para editar/crear GeoJSON
# - geojson.io para visualizar y editar
# - mapshaper para simplificar
```

### Script de Automatización

Crear `scripts/add-all-departments.js`:

```javascript
#!/usr/bin/env node
import { execSync } from 'child_process';

const departments = [
  'canelones', 'san_jose', 'rocha',
  'florida', 'lavalleja', 'durazno',
  'flores', 'soriano', 'rio_negro',
  'paysandu', 'salto', 'artigas',
  'rivera', 'tacuarembo', 'cerro_largo'
];

for (const dept of departments) {
  console.log(`\n📍 Processing ${dept}...`);

  try {
    // Transform electoral data
    execSync(`npm run etl:transform -- --dept ${dept}`, {
      stdio: 'inherit'
    });

    // Transform geographic data (if exists)
    // Si no existe el GeoJSON, usar límite departamental simple

    console.log(`✓ ${dept} processed`);
  } catch (error) {
    console.error(`✗ ${dept} failed:`, error.message);
  }
}

// Load all to public
execSync('npm run etl:load', { stdio: 'inherit' });
```

Ejecutar:
```bash
node scripts/add-all-departments.js
```

### Fuentes de Datos

#### Corte Electoral
- **URL**: https://catalogodatos.gub.uy/dataset/corte-electoral-elecciones-internas-de-los-partidos-politicos-2024
- **Recursos**:
  - ✅ `desglose-de-votos.csv` - Votos por todos los departamentos
  - ✅ `integracion-hojas-de-votacion.csv` - Listas por departamento

#### IDE Uruguay
- **URL**: https://catalogodatos.gub.uy/dataset/ide-limites-departamentales
- **Formato**: GeoJSON
- **Contenido**: Límites departamentales oficiales

#### INE (Instituto Nacional de Estadística)
- **URL**: https://www.ine.gub.uy/
- **Datos**: Secciones censales por departamento
- **Formato**: Shapefile (convertir a GeoJSON)

#### GitHub (Alternativo)
- `alotropico/uruguay.geo` - TopoJSON simplificado
- `vierja/geojson_montevideo` - Ejemplo de barrios

### Validación

Después de agregar cada departamento:

```bash
# 1. Validar datos
npm run etl:validate

# 2. Verificar en el navegador
npm run dev
# Seleccionar el departamento y probar funcionalidad

# 3. Verificar tamaño de archivos
ls -lh data/processed/geographic/ | grep [departamento]
```

### Tiempo Estimado

| Tarea | Tiempo |
|-------|--------|
| Descargar datos electorales | 30 min |
| Procesar con ETL | 1 hora |
| Obtener GeoJSON simples | 1 hora |
| Validar y ajustar | 1 hora |
| **Total Fase 1** | **3-4 horas** |
| Mejorar con subdivisiones (opcional) | +2h por depto |

---

## Tareas Adicionales (Opcional)

### 1. Tests Automatizados
```bash
# Instalar Vitest
npm install -D vitest @vue/test-utils

# Crear tests para composables
# src/composables/__tests__/useMapInteraction.test.ts
```

### 2. Optimizaciones de Performance
- Lazy loading de departamentos
- Virtual scrolling para listas grandes
- Service Worker para cache offline
- IndexedDB para datos locales

### 3. Documentación
- JSDoc en composables
- Storybook para componentes
- Guía de contribución
- Changelog

---

## Comandos Útiles

```bash
# ETL
npm run etl:extract           # Descargar datos
npm run etl:transform         # Procesar datos
npm run etl:load              # Cargar a public/
npm run etl:run               # Pipeline completo
npm run etl:validate          # Validar datos

# Desarrollo
npm run dev                   # Servidor desarrollo
npm run build                 # Build producción
npm run preview               # Preview build

# Validación
npm run validate              # Validar CSVs
npm run optimize              # Optimizar GeoJSON
```

---

## Recursos

### Documentación Creada
- `CLAUDE.md` - Guía principal del proyecto
- `PLAN_REFACTORIZACION.md` - Plan detallado de refactorización
- `REFACTORING.md` - Guía de refactorización de componentes
- `.claude/` - Configuración de agentes y skills

### Links Útiles
- [Catálogo Datos Abiertos Uruguay](https://catalogodatos.gub.uy/)
- [IDE Uruguay](https://www.gub.uy/infraestructura-datos-espaciales/)
- [Corte Electoral](https://www.corteelectoral.gub.uy/)
- [INE Uruguay](https://www.ine.gub.uy/)

---

## Notas Finales

El proyecto está en excelente estado:
- ✅ ETL funcional
- ✅ Componentes refactorizados
- ✅ TypeScript completo
- ✅ Tailwind CSS integrado
- ✅ Arquitectura escalable

Las tareas pendientes son **opcionales** para la funcionalidad básica. El sistema ya funciona perfectamente con los 4 departamentos actuales y está listo para escalar cuando necesites agregar más.

¡Excelente trabajo! 🎉
