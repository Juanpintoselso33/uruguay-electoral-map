---
status: final
created: 2026-05-30
updated: 2026-05-30
sources:
  - ../../prds/prd-uruguay-electoral-map-2026-05-30/prd.md
  - ../../../project-context.md
  - .decision-log.md
  - .working/direction-editorial.html
  - .working/direction-dark-night.html
  - .working/fa-tricolor-test.html
  - ../../../../../src/utils/partyColors.ts
name: Uruguay Electoral Map
description: Choropleth electoral atlas for Uruguay's 19 departments — serious, newspaper-grade reading of who won each zone. Editorial light identity with a recolored dark mode for night reading. Mobile-first.
colors:
  # ---- Chrome · LIGHT (editorial, non-partisan) ----
  paper: '#F7F4EE'
  ink: '#1A1916'
  ink-soft: '#5C574E'
  hairline: '#D8D2C6'
  card: '#FFFFFF'
  accent: '#8A1C1C'
  app-bg: '#E9E5DC'
  # ---- Chrome · DARK (recolored editorial, palette based on dark-night) ----
  paper-dark: '#151B2B'
  base-dark: '#0E1320'
  panel-dark: '#1E2638'
  card-dark: '#28324A'
  ink-dark: '#E8ECF6'
  ink-soft-dark: '#93A0BC'
  hairline-dark: '#313C56'
  accent-dark: '#E0A6A6'
  # ---- Focus ring (visible keyboard focus, both modes) ----
  focus-ring: '#8A1C1C'
  focus-ring-dark: '#E0A6A6'
  # ---- Party DATA colors (FIXED tokens — source of truth: src/utils/partyColors.ts) ----
  party-fa: '#A569BD'
  party-pn: '#55B5E5'
  party-pc: '#E52828'
  party-ca: '#2D7D3E'
  party-pi: '#7B2CBF'
  party-on-fill: '#FFFFFF'
  # ---- FA Otorgués flag sub-tokens (literal fill — Variant A) ----
  fa-flag-red: '#D52B1E'
  fa-flag-blue: '#0038A8'
  fa-flag-white: '#FFFFFF'
  fa-brand-yellow: '#FFCD00'
  # ---- Map utility ----
  zone-label-backing: 'rgba(26,25,22,0.78)'
typography:
  display:
    fontFamily: Source Serif 4
    fontSize: 27px
    fontWeight: '700'
    lineHeight: '1.05'
    letterSpacing: -0.01em
  headline:
    fontFamily: Source Serif 4
    fontSize: 21px
    fontWeight: '700'
    lineHeight: '1.15'
    letterSpacing: -0.01em
  title:
    fontFamily: Source Serif 4
    fontSize: 17px
    fontWeight: '600'
    lineHeight: '1.2'
  figure:
    fontFamily: Source Serif 4
    fontSize: 30px
    fontWeight: '700'
    lineHeight: '1'
    letterSpacing: -0.02em
  kicker:
    fontFamily: Inter
    fontSize: 10.5px
    fontWeight: '600'
    lineHeight: '1.2'
    letterSpacing: 0.22em
  label-caps:
    fontFamily: Inter
    fontSize: 10px
    fontWeight: '600'
    lineHeight: '1.4'
    letterSpacing: 0.18em
  body:
    fontFamily: Inter
    fontSize: 13px
    fontWeight: '400'
    lineHeight: '1.5'
  meta:
    fontFamily: Inter
    fontSize: 11px
    fontWeight: '400'
    lineHeight: '1.4'
  zone-label:
    fontFamily: Inter
    fontSize: 11px
    fontWeight: '700'
    lineHeight: '1'
    letterSpacing: 0.04em
  compare-link:
    fontFamily: Source Serif 4
    fontSize: 12.5px
    fontWeight: '400'
    lineHeight: '1.2'
rounded:
  sm: 0.125rem
  DEFAULT: 0.1875rem
  md: 0.375rem
  lg: 0.5rem
  sheet: 1.375rem
  full: 9999px
spacing:
  unit: 8px
  '1': 4px
  '2': 8px
  '3': 12px
  '4': 16px
  '5': 22px
  '6': 32px
  gutter: 22px
  margin-mobile: 18px
  section-gap: 18px
components:
  masthead:
    background: '{colors.paper}'
    border-bottom: '2px solid {colors.ink}'
    padding: '14px {spacing.gutter} 16px'
    kicker-color: '{colors.accent}'
    kicker-type: '{typography.kicker}'
    title-type: '{typography.display}'
    title-color: '{colors.ink}'
    stamp-type: '{typography.meta}'
    stamp-color: '{colors.ink-soft}'
  map-zone:
    stroke: '{colors.paper}'
    stroke-width: '2px'
    stroke-selected: '{colors.ink}'
    stroke-selected-dark: '{colors.ink-dark}'
    stroke-width-selected: '2.5px'
    fill-source: 'party data color, e.g. {colors.party-pn}'
    fa-fill: 'Otorgués flag — equal-thirds linear gradient {colors.fa-flag-red} / {colors.fa-flag-blue} / {colors.fa-flag-white}'
  zone-label:
    type: '{typography.zone-label}'
    color: '{colors.party-on-fill}'
    backing-fill: '{colors.zone-label-backing}'
    backing-radius: '{rounded.DEFAULT}'
  legend:
    border-top: '1px solid {colors.hairline}'
    heading-type: '{typography.label-caps}'
    heading-color: '{colors.ink-soft}'
    name-type: '{typography.body}'
    name-color: '{colors.ink}'
    swatch-size: '13px'
    swatch-radius: '{rounded.sm}'
    count-type: '{typography.meta}'
    count-color: '{colors.ink-soft}'
  legend-fa-swatch:
    description: 'Three stacked equal bands red/blue/white'
    band-red: '{colors.fa-flag-red}'
    band-blue: '{colors.fa-flag-blue}'
    band-white: '{colors.fa-flag-white}'
  legend-fa-mark:
    background: '{colors.fa-brand-yellow}'
    glyph: 'entwined FA letters (asset TBD)'
    glyph-color: '{colors.fa-flag-blue}'
    radius: '{rounded.sm}'
  bottom-sheet:
    background: '{colors.card}'
    radius: '{rounded.sheet} {rounded.sheet} 0 0'
    border-top: '2px solid {colors.ink}'
    shadow: '0 -10px 40px rgba(40,34,22,0.16)'
    padding: '14px {spacing.gutter} {spacing.5}'
    grip-color: '{colors.hairline}'
    zone-title-type: '{typography.headline}'
  winner-block:
    bar-width: '5px'
    bar-radius: '{rounded.DEFAULT}'
    bar-color: 'winning party data color'
    lema-type: '{typography.title}'
    lema-color: '{colors.ink}'
    lista-type: '{typography.meta}'
    lista-color: '{colors.ink-soft}'
    tag-type: '{typography.zone-label}'
    tag-bg: 'winning party data color'
    tag-color: '{colors.party-on-fill}'
    tag-radius: '{rounded.DEFAULT}'
  figures:
    border-top: '1px solid {colors.hairline}'
    number-type: '{typography.figure}'
    number-color: '{colors.ink}'
    label-type: '{typography.label-caps}'
    label-color: '{colors.ink-soft}'
  button-share:
    background: '{colors.ink}'
    color: '{colors.paper}'
    type: '{typography.body}'
    weight: '600'
    padding: '13px'
    radius: '{rounded.md}'
  compare-link:
    type: '{typography.compare-link}'
    style: 'italic, underline, underline-offset 3px'
    color: '{colors.accent}'
  selector-eleccion:
    background: '{colors.card}'
    border: '1px solid {colors.hairline}'
    radius: '{rounded.md}'
    padding: '{spacing.2} {spacing.3}'
    label-type: '{typography.label-caps}'
    label-color: '{colors.ink-soft}'
    value-type: '{typography.title}'
    value-color: '{colors.ink}'
    chevron-color: '{colors.ink-soft}'
    min-target: '44px'
  selector-opcion:
    background: '{colors.card}'
    border: '1px solid {colors.hairline}'
    radius: '{rounded.md}'
    padding: '{spacing.2} {spacing.3}'
    label-type: '{typography.label-caps}'
    label-color: '{colors.ink-soft}'
    option-type: '{typography.body}'
    option-color: '{colors.ink}'
    selected-bar: 'winning/selected party data color, 3px left bar'
    min-target: '44px'
  search:
    background: '{colors.card}'
    border: '1px solid {colors.hairline}'
    radius: '{rounded.md}'
    padding: '{spacing.3}'
    input-type: '{typography.body}'
    input-color: '{colors.ink}'
    placeholder-color: '{colors.ink-soft}'
    icon-color: '{colors.ink-soft}'
    result-type: '{typography.body}'
    result-color: '{colors.ink}'
    result-meta-type: '{typography.meta}'
    result-meta-color: '{colors.ink-soft}'
    min-target: '44px'
  compare-dual:
    layout: 'two map panels side-by-side (or single map + delta), each framed by 1px {colors.hairline}'
    panel-label-type: '{typography.label-caps}'
    panel-label-color: '{colors.ink-soft}'
    divider: '1px solid {colors.hairline}'
    delta-positive-color: 'gaining party data color'
    delta-negative-color: '{colors.ink-soft}'
    delta-figure-type: '{typography.figure}'
    delta-label-type: '{typography.label-caps}'
    active-indicator-type: '{typography.meta}'
    active-indicator-color: '{colors.accent}'
---

# DESIGN.md — Uruguay Electoral Map

This is the visual identity spine for Uruguay Electoral Map. The frontmatter is the machine-readable contract; the prose below is the rationale downstream implementation follows. Order of body sections is locked. Light and dark token sets both ship here; mode is a recolor, not a redesign.

## Brand & Style

Uruguay Electoral Map reads like the results page of a serious newspaper, not a dashboard. The posture is **editorial and authoritative** — periodístico serio in the register of a national daily. The product makes one promise: an accurate, non-partisan, legible answer to "¿quién ganó acá?" for any zone of any of Uruguay's 19 departments, and it carries itself with the quiet credibility that question deserves.

The aesthetic is warm paper, near-black ink, serif headlines, hairline rules, and generous air. Density is low on purpose: one map, one legend, one bottom sheet, lots of breathing room. There is no chrome competing with the data — the only saturated color on screen belongs to the parties, and that color is *information*, never decoration.

Two registers, one identity:
- **Light (default daytime / canonical editorial)** — warm paper `{colors.paper}`, ink `{colors.ink}`, oxblood `{colors.accent}` for links and kickers. Calm, printed, authoritative.
- **Dark (night reading)** — the same editorial restraint recolored onto a deep slate palette borrowed from the dark-night direction. Same serif-plus-sans voice, same hairline language, same low density. Dark mode is editorial-at-night, **not** a different "live election neon" product. [ASSUMPTION — see Colors and Typography.]

## Colors

There are two distinct color systems and they must never be confused: **chrome** (the non-partisan UI shell) and **party data** (fixed, meaningful, never restyled for taste).

### Chrome — Light
- **Paper `{colors.paper}`** (`#F7F4EE`) — the canvas. Warm off-white, never clinical, never pure `#FFFFFF`. It's also the zone stroke color on the map, so zones read as cut from the same paper.
- **Ink `{colors.ink}`** (`#1A1916`) — near-black warm ink for headlines, body, the masthead bottom rule, the share button, and selected-zone strokes.
- **Ink-soft `{colors.ink-soft}`** (`#5C574E`) — captions, metadata, legend counts, the verification stamp.
- **Hairline `{colors.hairline}`** (`#D8D2C6`) — the thinnest legible rule. Section dividers, the sheet grip, ghost separators.
- **Card `{colors.card}`** (`#FFFFFF`) — the bottom-sheet surface only; the one place pure white is allowed, to lift the sheet off the paper.
- **Accent / oxblood `{colors.accent}`** (`#8A1C1C`) — kickers, links, the italic "comparar" affordance. Editorial red, used sparingly, never as a party color and never as a fill.

### Chrome — Dark (palette based on dark-night)
- **Base `{colors.base-dark}`** (`#0E1320`) behind the frame, **paper-dark `{colors.paper-dark}`** (`#151B2B`) as the app canvas — a deep slate, deliberately not pure black so the two purple parties (FA `#A569BD` / PI `#7B2CBF`) don't vibrate against the background.
- **Panel `{colors.panel-dark}`** (`#1E2638`) for the bottom sheet, **card `{colors.card-dark}`** (`#28324A`) for inset cards/figures.
- **Line `{colors.hairline-dark}`** (`#313C56`) hairlines; **text `{colors.ink-dark}`** (`#E8ECF6`) primary; **text-soft `{colors.ink-soft-dark}`** (`#93A0BC`) muted.
- **Accent-dark `{colors.accent-dark}`** (`#E0A6A6`) — a lightened, desaturated oxblood. [ASSUMPTION] The decision log says dark is "basado en dark-night" — its *palette*, within editorial identity. Oxblood `#8A1C1C` on slate `#151B2B` fails contrast for links, so we lighten the same hue rather than adopt dark-night's teal neon `#38E1C6`. The neon would import a different (live-election, gamified) personality the editorial direction rejects. If product wants the night experience to feel like election night specifically, swap `accent-dark` to `#38E1C6` — that is the single token that decides it.

### Party data colors (FIXED — do not restyle)
Source of truth is `src/utils/partyColors.ts`. The five majors are tokenized here; the ~14 minor parties (Asamblea Popular, Avanzar Republicano, Basta Ya, Coalición Republicana, Constitucional Ambientalista, Devolución, Identidad Soberana, Independiente, Libertario, P.E.R.I., Partido de la Armonía, Patria Alternativa, Por los Cambios Necesarios, Verde Animalista) live **only** in code and are consumed by name — DESIGN.md does not restate them.

| Token | Party | Hex | Note |
|---|---|---|---|
| `party-fa` | Frente Amplio | `#A569BD` | Violeta claro. Used for legend chip & accents; **on the map FA is the Otorgués flag, not this fill** — see below. |
| `party-pn` | Partido Nacional | `#55B5E5` | **Celeste — NEVER white.** This is the single most error-prone token. |
| `party-pc` | Partido Colorado | `#E52828` | Rojo sólido. |
| `party-ca` | Cabildo Abierto | `#2D7D3E` | Verde. |
| `party-pi` | Partido Independiente | `#7B2CBF` | Morado oscuro. Distinct from FA violet by text label, not by hue alone. |

### FA Otorgués flag (special treatment — Variant A, literal fill)
Frente Amplio map zones are filled with the **Bandera de Otorgués**, rendered literally: three equal horizontal thirds — **red top `{colors.fa-flag-red}` (`#D52B1E`) · blue middle `{colors.fa-flag-blue}` (`#0038A8`) · white bottom `{colors.fa-flag-white}` (`#FFFFFF`)**. The brand mark (entwined "FA" letters) sits on **yellow `{colors.fa-brand-yellow}` (`#FFCD00`)** and appears only in the legend, never as a map fill.

This is the canonical decision (decision-log line 17): Variant A was chosen *after* seeing that the red top stripe collides with the solid red of Colorado. We do **not** adopt the test's Variant B (desaturated bands + violet border) or Variant C (solid violet + corner chip). The collision is mitigated by the **legibility safeguard**, not by altering the flag — see Components and Do's & Don'ts.

### Contrast targets (verified ratios — WCAG 2.2 AA)
- **SIGLA on its backing pill — the load-bearing combo.** White SIGLA text directly on a fill is **FORBIDDEN**: white-on-FA-white-band = **1.00:1** (invisible), white-on-PN-celeste = 2.30:1 (fails). The mandatory dark pill `zone-label-backing` `rgba(26,25,22,0.78)` rescues it: composited over the FA white band it yields **~8.6:1**, over PN celeste **~11.7:1** — both pass AA comfortably. The pill must render opaque at 0.78 and never be omitted.
- **Focus ring.** In light, `focus-ring` (`#8A1C1C`) is **8.45:1** over paper (passes the 3:1 non-text-contrast bar). In dark, plain `accent`/`#8A1C1C` as a ring **FAILS** at **1.85:1** over `paper-dark`; the ring must use `focus-ring-dark` (`#E0A6A6`, ~8.3:1).
- **Chrome (verified, holgado).** ink/paper **16:1**, ink-dark/paper-dark **14.5:1**, ink-soft/paper 6.5:1, ink-soft-dark/paper-dark 6.5:1. `accent-dark` (`#E0A6A6`) as link/text on dark surfaces ranges **6.2:1 (card-dark) to 8.3:1 (paper-dark)** — all pass AA.
- **Selected-zone stroke in dark.** `ink` on the slate fills is **1.02:1** (invisible) — `stroke-selected-dark` (`{colors.ink-dark}`) is required (see Components / map-zone).

## Typography

Two families, two jobs — the global rule across both modes:
- **Source Serif 4** is the voice of authority. Mastheads, zone titles, big vote figures, the italic compare link. Optical-size serif; tight leading and slightly negative tracking on display sizes for a cohesive printed block.
- **Inter** is the functional counterpoint: kickers, all-caps labels, body, metadata, on-map zone labels, and **all numerals** (vote counts, percentages render in Inter unless they are the large hero figure, which is serif for editorial weight).

Ramp: `display` (27px masthead) · `headline` (21px sheet zone title) · `figure` (30px serif hero number) · `title` (17px winner lema) · `kicker` / `label-caps` (tracked-out 0.18–0.22em uppercase Inter) · `body` (13px) · `meta` (11px) · `zone-label` (11px bold). Kickers and section labels are always tracked out to keep the airy, premium register. The map carries only the party SIGLA (`zone-label`); the zone NAME is not painted on polygons — it belongs in the bottom-sheet ficha (`headline`), where it has room and contrast.

[ASSUMPTION] **Dark mode keeps Source Serif 4 + Inter.** The dark-night reference used Space Grotesk / Space Mono with neon glow and a "live" pulse; we deliberately do **not** inherit those. The global decision ("serif headlines + clean sans for body/UI/numerals") is stated once and is mode-agnostic, and dark is defined as editorial recolored. Flagging because the source HTML diverged.

## Layout & Spacing

Mobile-first, single column, vertical stack — the scroll of a results page. Base unit is `8px`; the working scale is 4 / 8 / 12 / 16 / 22 / 32. Mobile side margins hold at `{spacing.margin-mobile}` (18px) so content feels framed like a page rather than bleeding to the device edge. `{spacing.section-gap}` (18px) separates masthead → map → legend → sheet.

The screen is a fixed vertical composition: masthead (with a 2px ink bottom rule), a flexible map area that grows to fill, then either the legend or the bottom sheet anchored to the bottom. The bottom sheet has two states (collapsed peek / expanded detail) and never stacks more than one level. Tap targets on map zones and sheet controls meet a 44px minimum even where the visual element is smaller.

## Elevation & Depth

Depth comes from **tone and hairlines**, not heavy shadow.
- **Light:** surfaces separate by tone (white card on warm paper) and by hairline rules. The bottom sheet is the one true elevated object — a soft, warm-tinted shadow `0 -10px 40px rgba(40,34,22,0.16)` plus a crisp 2px ink top rule that reads as an editorial divider.
- **Dark:** elevation is purely tonal — `base` → `paper` → `panel` → `card` climb in lightness. The dark-night reference's neon glows, drop-shadow halos, and live-pulse are **not** part of this system. Selected state is communicated by stroke weight/color, not by glow.

Borders are 1px hairline except the two structural 2px ink rules (masthead bottom, sheet top) that give the layout its newspaper spine.

## Shapes

Soft, not pill. Base radius `{rounded.DEFAULT}` (≈3px) on chips, tags, swatches, the share button uses `{rounded.md}` (6px). The bottom sheet uses `{rounded.sheet}` (22px) on its top corners only. Map zones follow their real geographic geometry — no forced rounding; the demo's `rx` on rectangles is mockup scaffolding, not a rule. Nothing is fully rounded; `{rounded.full}` exists only for the rare dot/pulse and is otherwise unused. The aesthetic is paper-with-soft-corners, not iOS-button.

## Components

- **Masthead** — `{colors.paper}` with a 2px `{colors.ink}` bottom rule. Oxblood kicker (`{typography.kicker}`), serif `{typography.display}` title (e.g. "Maldonado · Internas 2024"), then a verification stamp ("✓ Corte Electoral — escrutinio definitivo") in `{typography.meta}` / `{colors.ink-soft}`. The stamp is the credibility signal — keep it.
- **Map zone** — filled with the winning party's data color; 2px `{colors.paper}` stroke between zones, thickening to 2.5px when selected (`{colors.ink}` in light, `{colors.ink-dark}` via `stroke-selected-dark` in dark — the near-black `ink` stroke is invisible on the slate dark palette, ~1.02:1, so the dark override is required). **Every zone always has a stroke** — this is load-bearing, not cosmetic (see Do's & Don'ts).
- **FA map zone** — filled with the Otorgués flag (equal-thirds `fa-flag-red` / `fa-flag-blue` / `fa-flag-white` linear gradient). Same crisp stroke rule applies.
- **Zone label** — the party abbreviation (FA, PN, PC, CA, PI) as `{typography.zone-label}` text, white, **sitting on a dark backing pill** `{colors.zone-label-backing}` with `{rounded.DEFAULT}` corners. The backing is mandatory, not optional: FA's white bottom stripe (and PN celeste) would swallow a plain white label otherwise. **Only the SIGLA goes on the map** — the zone name is shown in the bottom-sheet ficha, not painted on the polygon (a tiny white name on the FA white band would be invisible).
- **Legend** — hairline-topped block; `{typography.label-caps}` heading; each row is a swatch + serif-adjacent party name (`{typography.body}`) + zone count (`{typography.meta}`). 
- **Legend · FA row** — a three-band swatch (red/blue/white) **plus** the yellow `{colors.fa-brand-yellow}` brand mark with entwined "FA" lettering, captioned "bandera de Otorgués." The mark is a spec; no SVG glyph asset exists yet — implementation must produce it. [ASSUMPTION/flagged]
- **Bottom sheet** — `{colors.card}` (light) / `{colors.panel-dark}` (dark), `{rounded.sheet}` top corners, 2px ink top rule, warm shadow, hairline grip. Expanded shows zone title (`{typography.headline}`), winner block, figures, actions. Collapsed shows a single summary row + "deslizá para ver el detalle."
- **Winner block** — a vertical colored bar (winning party color), lema in `{typography.title}`, lista + candidate in `{typography.meta}`, and a small filled tag "PARTIDO · GANADOR" in the party color with white text.
- **Figures** — hairline-topped pair: serif `{typography.figure}` number ("4.812", "38,4%") over `{typography.label-caps}` caption ("Votos", "del total").
- **Share button** — solid `{colors.ink}` fill, `{colors.paper}` text, `{rounded.md}`. Primary action.
- **Compare link** — italic serif, oxblood `{colors.accent}`, underlined ("comparar vs. 2019"). Secondary, editorial.
- **Selector de elección** (`selector-eleccion`) — a `{colors.card}` field with a `{colors.hairline}` border and `{rounded.md}` corners. A tracked-out `{typography.label-caps}` caption ("ELECCIÓN") over the current value in `{typography.title}` `{colors.ink}`, with a soft chevron in `{colors.ink-soft}`. Reads as a quiet editorial control, not a chrome dropdown; ≥44px target. Behavior lives in EXPERIENCE.
- **Selector de opción** (`selector-opcion`) — same `{colors.card}` field/border/`{rounded.md}` language. Each option row is `{typography.body}` `{colors.ink}`; the selected option carries a 3px left bar in the party data color (echoing `winner-block`). Label-caps caption names what the option list is (HOJA vs candidato/lema). ≥44px target.
- **Búsqueda** (`search`) — a single `{colors.card}` input with `{colors.hairline}` border, `{rounded.md}`, a leading icon in `{colors.ink-soft}`, placeholder in `{colors.ink-soft}`, typed text in `{typography.body}` `{colors.ink}`. Results stack as `{typography.body}` name + `{typography.meta}` `{colors.ink-soft}` context (depto/elección). ≥44px target.
- **Comparación dual** (`compare-dual`) — two map panels side-by-side (or one map + delta), each framed by a 1px `{colors.hairline}` rule and headed by a `{typography.label-caps}` `{colors.ink-soft}` panel label naming its election/option. Delta figures use `{typography.figure}` over a `{typography.label-caps}` caption; a gaining party reads in its own data color, losses fall back to `{colors.ink-soft}`. A persistent `{typography.meta}` `{colors.accent}` indicator marks that two contexts are active. Visual contract only; behavior lives in EXPERIENCE.

## Do's and Don'ts

| Do | Don't |
|---|---|
| Treat party colors as fixed data tokens sourced from `partyColors.ts` | Recolor a party for aesthetic balance or theme harmony |
| Render Partido Nacional as celeste `#55B5E5` | Ever render PN as white — it is the #1 known mistake |
| Always draw a crisp per-zone stroke **and** show the party abbreviation as text | Communicate the winner by fill color/flag alone (an FA flag zone beside solid-red Colorado must never merge) |
| El ganador NUNCA se comunica solo por color — la sigla del partido (con pill de respaldo) va sobre cada zona. Crítico por colisión FA-rojo/Colorado-rojo y por daltonismo rojo-verde (PC/CA) | Confiar en el matiz como única señal: bajo deuteranopía/protanopía PC-rojo y CA-verde colapsan, y FA-rojo ≈ Colorado-rojo |
| Put the zone abbreviation on the dark backing pill `{colors.zone-label-backing}` | Lay white label text directly on the FA white stripe or PN celeste (white-on-white-flag-band = 1.00:1) |
| Fill FA zones with the literal Otorgués flag (red/blue/white thirds) — Variant A | Substitute Variant B (violet border) or C (corner chip); reserve violet `party-fa` for the legend/accents |
| Keep one editorial identity across light and dark — Source Serif 4 + Inter, hairlines, low density | Import dark-night's neon teal, glow shadows, live-pulse, or Space Grotesk/Mono |
| Use oxblood `{colors.accent}` only for kickers, links, compare | Use oxblood as a fill or let it read as a party color (it isn't) |
| Keep the Corte Electoral verification stamp visible | Drop the provenance signal — credibility is the brand |
| Hold mobile margins at `{spacing.margin-mobile}` and a single-column stack | Increase density to fit more; stack the sheet more than one level deep |
| Express elevation through tone + the two 2px ink rules | Use heavy/colored drop shadows for hierarchy |
