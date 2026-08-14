---
name: git-commit
description: |
  Arma un commit del Mapa Electoral con la convención del repo (conventional commits en
  español). Usar cuando el usuario pida commitear, o diga "/commit". Stagea rutas explícitas,
  nunca el working tree entero.
---

# Git Commit

Crea commits siguiendo la convención de este repo.

## Regla dura: nunca `git add -A` / `git add .`

Este repo suele tener cambios sin relación en el working tree (artefactos de build, caché de
Playwright, `.pyc` borrados, salidas de ETL). Stagear todo mete basura ajena en el commit y en
algún caso publica datos que no deberían estar versionados.

```bash
git add ruta/exacta/uno.ts ruta/exacta/dos.vue    # SÍ
git add -A                                        # NO
git add .                                         # NO
```

Si el usuario pide explícitamente commitear todo, mostrarle primero `git status --short`
completo y pedir confirmación.

## Workflow

1. **Mirar el estado real.**
   ```bash
   git status --short
   git diff --stat
   git diff            # el contenido, no solo los nombres
   git log --oneline -10   # tomar el tono de los mensajes de este repo
   ```

2. **Separar lo que corresponde.** Del working tree, quedarse solo con los archivos que son
   parte del cambio pedido. Si hay dos cambios sin relación, son dos commits.

3. **Stagear por ruta.**
   ```bash
   git add <rutas exactas>
   git diff --cached --stat    # confirmar que quedó solo lo que corresponde
   ```

4. **Escribir el mensaje** (formato abajo) y commitear.

5. **No pushear** salvo pedido explícito. **No crear PR** salvo pedido explícito.

## Formato del mensaje

```
<tipo>(<scope>): <descripción corta en minúscula, en español>

[cuerpo opcional: qué cambió y por qué, no cómo]
```

| Tipo | Cuándo |
|------|--------|
| feat | funcionalidad nueva |
| fix | corrección de bug |
| refactor | reorganización sin cambio de comportamiento |
| perf | performance |
| docs | documentación |
| style | formato |
| chore | mantenimiento, dependencias, tooling |
| data | datos electorales o mapeos |

Scopes usuales: `mapa`, `api`, `geo`, `ux`, `etl`, `claude`, `sweep`, o el id del departamento.

### Ejemplos reales del repo
```
fix(geo): cerrar el gap de locales sin coordenada (overlay local)
feat(mapa): nivel "Localidades" usable en todo el interior
docs(claude): corregir deriva factual y ajustar a Opus 5
```

## Antes de commitear cambios de código

```bash
npm run check     # type-check
npm run test      # vitest
```

Si el cambio toca datos o geometría, además el gate correspondiente (`gate:data`,
`gate:escaleras`, `gate:grises`).

## Workflow de contribución

Rama desde `master` → cambios → gates → commit → PR. No commitear directo a `master` sin que
el usuario lo pida.
