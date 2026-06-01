<script setup lang="ts">
/**
 * Acordeón de opción multi-selección (Story 10.3, Epic 10).
 *
 * Lee `catalogo.json` del dept/eleccion y arma el árbol CONTIENDA → LEMA →
 * (PRECANDIDATO) → HOJA según la escalera de cada contienda. Checkbox tri-estado en
 * cada nivel: marcar un nodo selecciona la SUMA de sus hojas. La selección (conjunto
 * de opcionIds) y la contienda viven en la URL (`?sel=&cont=`). Se limpia al cambiar
 * departamento/elección/contienda. Filtro de partido, búsqueda por número, chips.
 */
import { onMounted, ref, computed, onUnmounted } from 'vue';
import { resolveParty } from '../../lib/party-meta';
import { $selection, commit } from '../../stores/map-state';

const props = defineProps<{ eleccion: string; departamento: string }>();

interface NodoOpcion {
  id: string;
  nivel: 'contienda' | 'lema' | 'sublema' | 'precandidato' | 'candidato' | 'alcalde' | 'hoja' | 'binaria';
  etiqueta: string;
  parentId?: string;
  partidoId?: string;
}
interface OpcionHojaJson {
  clase: 'hoja' | 'candidato' | 'binaria';
  id: string;
  hoja?: string;
  etiqueta?: string;
  candidato?: string;
  partidoId?: string;
  lemaId?: string;
  precandidatoId?: string;
  /** Id del nodo medio (sublema/alcalde) al que cuelga la opción (Story 10.9, genérico). */
  grupoId?: string;
}
interface ContiendaCat {
  contienda: string;
  niveles: string[];
  nodos: NodoOpcion[];
  opciones: OpcionHojaJson[];
  degradado?: boolean;
}
interface Catalogo {
  eleccionId: string;
  departamento: string;
  contiendas: ContiendaCat[];
}

const CONTIENDA_LABEL: Record<string, string> = {
  odn: 'Convención Nacional',
  odd: 'Convención Departamental',
  intendente: 'Intendente',
  junta: 'Junta Departamental',
  municipio: 'Municipio',
  unica: 'Opciones',
};

const catalogo = ref<Catalogo | null>(null);
const contiendaActiva = ref<string | null>(null);
const seleccion = ref<Set<string>>(new Set());
const expandidos = ref<Set<string>>(new Set()); // ids de nodos expandidos
const filtroPartido = ref<string>('');
const busqueda = ref<string>('');
const totalVotosLema = ref<Record<string, number>>({});
const totalVotosHoja = ref<Record<string, number>>({});
const fetchedHojas = new Set<string>(); // "{contienda}/{lemaId}" ya descargados

let unsub: (() => void) | null = null;

/**
 * Catálogo PLANO sintético desde opciones.json, para elecciones sin catálogo de HOJA
 * (nacionales-2019 interior, balotaje/plebiscito/referéndum del interior). Las vuelve
 * multi-seleccionables con el mismo toggle {Ganador, Share, Heatmap} que el resto (Epic 13):
 * "ganador entre lo seleccionado" colorea cada zona según cuál opción seleccionada lidera ahí.
 */
async function catalogoPlanoFallback(base: string): Promise<Catalogo | null> {
  const res = await fetch(`${base}/data/${props.eleccion}/${props.departamento}/opciones.json`);
  if (!res.ok) return null;
  const opcDoc = (await res.json()) as { opciones: { opcionId: string; nombre: string }[] };
  const binaria = props.eleccion.includes('plebiscito') || props.eleccion.includes('referendum');
  return {
    eleccionId: props.eleccion,
    departamento: props.departamento,
    contiendas: [
      {
        contienda: 'unica',
        niveles: ['lema'], // un solo nivel → esPlano → lista de checkboxes
        nodos: [],
        opciones: opcDoc.opciones.map((o) => ({
          clase: binaria ? 'binaria' : 'candidato',
          id: o.opcionId,
          etiqueta: o.nombre,
          candidato: o.nombre,
        })),
      },
    ],
  };
}

onMounted(async () => {
  unsub = $selection.subscribe((s) => {
    seleccion.value = new Set(s.seleccion);
    if (s.contienda) contiendaActiva.value = s.contienda;
  });
  try {
    const base = import.meta.env.BASE_URL.replace(/\/$/, '');
    const [resCat, resVotes] = await Promise.all([
      fetch(`${base}/data/${props.eleccion}/${props.departamento}/catalogo.json`),
      fetch(`${base}/data/${props.eleccion}/${props.departamento}/votes.json`),
    ]);
    const doc = resCat.ok
      ? ((await resCat.json()) as Catalogo)
      : await catalogoPlanoFallback(base); // sin catálogo de HOJA → catálogo plano sintético (Epic 13)
    if (!doc) return;
    catalogo.value = doc;
    if (!contiendaActiva.value) contiendaActiva.value = doc.contiendas[0]?.contienda ?? null;
    sembrarExpansionDeSeleccion(); // AC7: deep-link abre el árbol en las ramas seleccionadas
    if (resVotes.ok) {
      const vd = (await resVotes.json()) as { zonas: { porOpcion: { opcionId: string; votos: number }[] }[] };
      const map: Record<string, number> = {};
      for (const zona of vd.zonas) {
        for (const op of zona.porOpcion ?? []) {
          map[op.opcionId] = (map[op.opcionId] ?? 0) + op.votos;
        }
      }
      totalVotosLema.value = map;
    }
  } catch {
    /* sin catálogo → el mapa sigue en modo ganador por lema */
  }
});
onUnmounted(() => unsub?.());

const contienda = computed<ContiendaCat | null>(
  () => catalogo.value?.contiendas.find((c) => c.contienda === contiendaActiva.value) ?? null,
);
const tieneVariasContiendas = computed(() => (catalogo.value?.contiendas.length ?? 0) > 1);
const esPlano = computed(() => (contienda.value?.niveles.length ?? 2) <= 1);
// Escalera genérica (Story 10.9): el nivel MEDIO (cuando hay 3) es precandidato|sublema|alcalde;
// el nivel TERMINAL (la hoja del árbol) es hoja|candidato. El acordeón no hardcodea ninguno.
const nivelMedio = computed(() => (contienda.value?.niveles.length === 3 ? contienda.value.niveles[1] : null));
const nivelHoja = computed(() => contienda.value?.niveles[contienda.value.niveles.length - 1] ?? 'hoja');
/** Id del nodo medio (sublema/alcalde/precandidato) al que cuelga una opción terminal. */
const parentDe = (o: OpcionHojaJson): string | undefined => o.grupoId ?? o.precandidatoId;

/** lemas (nodos nivel 'lema') filtrados por partido y por búsqueda de hoja. */
const lemas = computed<NodoOpcion[]>(() => {
  const c = contienda.value;
  if (!c) return [];
  let ls = c.nodos.filter((n) => n.nivel === 'lema');
  if (filtroPartido.value) ls = ls.filter((l) => l.partidoId === filtroPartido.value);
  if (busqueda.value.trim()) {
    const lemasConMatch = new Set(hojasFiltradas.value.map((h) => h.lemaId));
    ls = ls.filter((l) => lemasConMatch.has(l.id));
  }
  const tv = totalVotosLema.value;
  return ls.slice().sort((a, b) => (tv[b.id] ?? 0) - (tv[a.id] ?? 0) || a.etiqueta.localeCompare(b.etiqueta, 'es'));
});

const partidos = computed<{ id: string; nombre: string }[]>(() => {
  const c = contienda.value;
  if (!c) return [];
  const tv = totalVotosLema.value;
  return c.nodos
    .filter((n) => n.nivel === 'lema')
    .map((l) => ({ id: l.partidoId ?? l.id, nombre: l.etiqueta, votos: tv[l.id] ?? 0 }))
    .sort((a, b) => b.votos - a.votos || a.nombre.localeCompare(b.nombre, 'es'));
});

/** Opciones que matchean la búsqueda (por número de hoja o por nombre de candidato; vacío = todas). */
const hojasFiltradas = computed<OpcionHojaJson[]>(() => {
  const c = contienda.value;
  if (!c) return [];
  const q = busqueda.value.trim();
  if (!q) return c.opciones;
  const ql = q.toLowerCase();
  return c.opciones.filter((o) => (o.hoja ?? '').includes(q) || etiquetaOpcion(o).toLowerCase().includes(ql));
});

/** Orden de opciones terminales: por votos descendente (si disponibles), si no por número de hoja. */
function ordenarOpciones(a: OpcionHojaJson, b: OpcionHojaJson): number {
  const tv = totalVotosHoja.value;
  const va = tv[a.id];
  const vb = tv[b.id];
  if (va !== undefined || vb !== undefined) return (vb ?? 0) - (va ?? 0);
  const na = Number(a.hoja);
  const nb = Number(b.hoja);
  if (Number.isFinite(na) && Number.isFinite(nb)) return na - nb;
  return etiquetaOpcion(a).localeCompare(etiquetaOpcion(b), 'es');
}
/** Nodos MEDIOS (sublema/alcalde/precandidato) de un lema, ordenados por votos totales de sus hojas. */
function gruposDe(lemaId: string): NodoOpcion[] {
  const nivel = nivelMedio.value;
  if (!nivel) return [];
  const grupos = (contienda.value?.nodos ?? []).filter((n) => n.nivel === nivel && n.parentId === lemaId);
  const tv = totalVotosHoja.value;
  if (Object.keys(tv).length === 0) return grupos.sort((a, b) => a.etiqueta.localeCompare(b.etiqueta, 'es'));
  // Suma de votos de todas las hojas bajo cada grupo
  const votosGrupo = (gid: string): number =>
    (contienda.value?.opciones ?? [])
      .filter((o) => parentDe(o) === gid)
      .reduce((acc, o) => acc + (tv[o.id] ?? 0), 0);
  return grupos.sort((a, b) => votosGrupo(b.id) - votosGrupo(a.id) || a.etiqueta.localeCompare(b.etiqueta, 'es'));
}
/** Opciones terminales VISIBLES que cuelgan de un nodo medio. */
function opcionesDeGrupo(grupoId: string): OpcionHojaJson[] {
  const set = new Set(hojasFiltradas.value.map((h) => h.id));
  return (contienda.value?.opciones ?? [])
    .filter((o) => parentDe(o) === grupoId && set.has(o.id))
    .sort(ordenarOpciones);
}
/** Opciones terminales VISIBLES directas del lema (sin nodo medio): ODD, candidatos de intendente, voto-al-lema. */
function opcionesDeLemaDirecto(lemaId: string): OpcionHojaJson[] {
  const set = new Set(hojasFiltradas.value.map((h) => h.id));
  return (contienda.value?.opciones ?? [])
    .filter((o) => o.lemaId === lemaId && !parentDe(o) && set.has(o.id))
    .sort(ordenarOpciones);
}
/** Ids VISIBLES de todas las opciones de un lema — para checkbox/tri-estado del lema. */
function hojasDeLema(lemaId: string): string[] {
  const set = new Set(hojasFiltradas.value.map((h) => h.id));
  return (contienda.value?.opciones ?? []).filter((o) => o.lemaId === lemaId && set.has(o.id)).map((o) => o.id);
}
/** Ids VISIBLES de las opciones de un nodo medio — para tri-estado del nodo. */
function idsDeGrupo(grupoId: string): string[] {
  const set = new Set(hojasFiltradas.value.map((h) => h.id));
  return (contienda.value?.opciones ?? []).filter((o) => parentDe(o) === grupoId && set.has(o.id)).map((o) => o.id);
}

type TriState = 'empty' | 'partial' | 'full';
function tri(ids: string[]): TriState {
  if (ids.length === 0) return 'empty';
  let n = 0;
  for (const id of ids) if (seleccion.value.has(id)) n++;
  return n === 0 ? 'empty' : n === ids.length ? 'full' : 'partial';
}

function toggleSet(ids: string[]): void {
  const next = new Set(seleccion.value);
  const estado = tri(ids);
  if (estado === 'full') ids.forEach((id) => next.delete(id));
  else ids.forEach((id) => next.add(id));
  aplicar(next);
}
function toggleHoja(id: string): void {
  const next = new Set(seleccion.value);
  if (next.has(id)) next.delete(id);
  else next.add(id);
  aplicar(next);
}
function aplicar(next: Set<string>): void {
  commit({ seleccion: [...next], contienda: contiendaActiva.value, opcion: null });
}

function cambiarContienda(c: string): void {
  contiendaActiva.value = c;
  expandidos.value = new Set();
  commit({ contienda: c, seleccion: [], opcion: null }); // limpia selección al cambiar contienda (AC6)
}
function toggleExpand(id: string): void {
  const next = new Set(expandidos.value);
  const opening = !next.has(id);
  if (!opening) { next.delete(id); expandidos.value = next; return; }
  next.add(id);
  expandidos.value = next;
  // Fetch lazy de votos por hoja cuando se abre un lema de primer nivel
  const cont = contiendaActiva.value;
  const esLema = catalogo.value?.contiendas.some(
    (c) => c.nodos.some((n) => n.nivel === 'lema' && n.id === id),
  );
  if (!cont || !esLema) return;
  const key = `${cont}/${id}`;
  if (fetchedHojas.has(key)) return;
  fetchedHojas.add(key);
  const base = import.meta.env.BASE_URL.replace(/\/$/, '');
  fetch(`${base}/data/${props.eleccion}/${props.departamento}/hoja/${cont}/${id}.json`)
    .then((r) => r.ok ? r.json() : null)
    .then((vd: { zonas: { porOpcion: { opcionId: string; votos: number }[] }[] } | null) => {
      if (!vd) return;
      const map = { ...totalVotosHoja.value };
      for (const zona of vd.zonas) {
        for (const op of zona.porOpcion ?? []) {
          map[op.opcionId] = (map[op.opcionId] ?? 0) + op.votos;
        }
      }
      totalVotosHoja.value = map;
    })
    .catch(() => { /* silencioso */ });
}
function limpiarTodo(): void {
  filtroPartido.value = '';
  busqueda.value = '';
  aplicar(new Set());
}
function seleccionarTodasVisibles(): void {
  // Respeta AMBOS filtros: partido (lemas visibles) y búsqueda (hojasFiltradas). AC3.
  const next = new Set(seleccion.value);
  const lemaVis = new Set(lemas.value.map((l) => l.id));
  for (const h of hojasFiltradas.value) if (h.lemaId && lemaVis.has(h.lemaId)) next.add(h.id);
  aplicar(next);
}

/** Siembra `expandidos` con las ramas (lema/precandidato) de las hojas seleccionadas (deep-link, AC7). */
function sembrarExpansionDeSeleccion(): void {
  const c = contienda.value;
  if (!c || seleccion.value.size === 0) return;
  const next = new Set(expandidos.value);
  for (const o of c.opciones) {
    if (seleccion.value.has(o.id)) {
      if (o.lemaId) next.add(o.lemaId);
      const g = parentDe(o);
      if (g) next.add(g);
    }
  }
  expandidos.value = next;
}

/** Etiqueta humana de una hoja. La pseudo-hoja 'vl' (VOTO_LEMA) → "Voto al lema". */
const etiquetaLista = (hoja?: string): string => (hoja === 'vl' ? 'Voto al lema' : `Lista ${hoja ?? ''}`);
/** Etiqueta de una opción terminal: nombre del candidato (intendente) o "Lista N" / "Voto al lema". */
const etiquetaOpcion = (o: OpcionHojaJson): string =>
  o.clase === 'candidato' ? (o.candidato ?? o.etiqueta ?? o.id) : etiquetaLista(o.hoja);

/** Presentación de una opción plana (balotaje/plebiscito): etiqueta legible + color/sigla. */
function metaPlano(o: OpcionHojaJson): { label: string; color: string; sigla: string; flagUrl: string | null } {
  // Binaria: el etiqueta del dato es 'si'/'no' → resolveParty lo lleva a Sí/No con su color.
  const nombre = o.clase === 'binaria' ? (o.etiqueta ?? o.id) : (o.candidato ?? o.etiqueta ?? o.id);
  const m = resolveParty(nombre, props.eleccion);
  return { label: o.clase === 'binaria' ? m.sigla : nombre, color: m.color, sigla: m.sigla, flagUrl: m.flagUrl };
}

const colorLema = (l: NodoOpcion): string => resolveParty(l.etiqueta, props.eleccion).color;
const siglaLema = (l: NodoOpcion): string => resolveParty(l.etiqueta).sigla;
const flagLema  = (l: NodoOpcion): string | null => resolveParty(l.etiqueta).flagUrl;
</script>

<template>
  <section class="acc" aria-label="Selector de opción (granularidad)">
    <!-- Selector de contienda (solo si hay >1) -->
    <div v-if="tieneVariasContiendas" class="acc__contiendas" role="tablist" aria-label="Contienda">
      <button
        v-for="c in catalogo?.contiendas"
        :key="c.contienda"
        type="button"
        role="tab"
        :aria-selected="c.contienda === contiendaActiva"
        class="acc__contienda"
        :class="{ 'acc__contienda--activa': c.contienda === contiendaActiva }"
        @click="cambiarContienda(c.contienda)"
      >
        {{ CONTIENDA_LABEL[c.contienda] ?? c.contienda }}
      </button>
    </div>

    <!-- Filtro + búsqueda + acciones -->
    <div v-if="contienda && !esPlano" class="acc__controles">
      <input
        v-model="busqueda"
        class="acc__busqueda"
        type="search"
        :inputmode="nivelHoja === 'candidato' ? 'text' : 'numeric'"
        :placeholder="nivelHoja === 'candidato' ? 'Buscar candidato…' : 'Buscar lista por número…'"
        :aria-label="nivelHoja === 'candidato' ? 'Buscar candidato' : 'Buscar lista por número'"
      />
      <select v-model="filtroPartido" class="acc__filtro" aria-label="Filtrar por partido">
        <option value="">Todos los partidos</option>
        <option v-for="p in partidos" :key="p.id" :value="p.id">{{ p.nombre }}</option>
      </select>
    </div>

    <!-- Chips de filtros/selección activos -->
    <div v-if="seleccion.size > 0 || filtroPartido || busqueda" class="acc__chips" aria-live="polite">
      <span v-if="filtroPartido" class="acc__chip">
        {{ partidos.find((p) => p.id === filtroPartido)?.nombre }}
        <button type="button" aria-label="Quitar filtro de partido" @click="filtroPartido = ''">✕</button>
      </span>
      <span v-if="busqueda" class="acc__chip">
        "{{ busqueda }}"
        <button type="button" aria-label="Limpiar búsqueda" @click="busqueda = ''">✕</button>
      </span>
      <span v-if="seleccion.size > 0" class="acc__chip acc__chip--sel">
        {{ seleccion.size }} {{ seleccion.size === 1 ? 'lista' : 'listas' }} seleccionada{{ seleccion.size === 1 ? '' : 's' }}
      </span>
      <button class="acc__limpiar" type="button" @click="limpiarTodo">Limpiar todo</button>
    </div>

    <div v-if="contienda && !esPlano" class="acc__acciones">
      <button class="acc__link" type="button" @click="seleccionarTodasVisibles">Seleccionar todas</button>
    </div>

    <!-- Rótulo de degradación: escalera sin nivel sublema por falta de dato (AC2, Story 10.7) -->
    <p v-if="contienda?.degradado" class="acc__degradado">
      Sin desglose por sublema — dato no disponible; se muestra lema → lista.
    </p>

    <!-- Árbol -->
    <ul v-if="contienda && !esPlano" class="acc__tree" role="tree">
      <li v-for="l in lemas" :key="l.id" class="acc__lema" role="treeitem" :aria-expanded="expandidos.has(l.id)">
        <div class="acc__row acc__row--lema">
          <button
            type="button"
            class="acc__cb"
            :class="`acc__cb--${tri(hojasDeLema(l.id))}`"
            :aria-label="`Seleccionar todas las listas de ${l.etiqueta}`"
            @click="toggleSet(hojasDeLema(l.id))"
          ><span aria-hidden="true">{{ tri(hojasDeLema(l.id)) === 'full' ? '✓' : tri(hojasDeLema(l.id)) === 'partial' ? '–' : '' }}</span></button>
          <button type="button" class="acc__chevron" :aria-label="`Expandir ${l.etiqueta}`" @click="toggleExpand(l.id)">
            {{ expandidos.has(l.id) ? '▼' : '▸' }}
          </button>
          <img v-if="flagLema(l)" :src="flagLema(l)!" :alt="siglaLema(l)" class="acc__flag" aria-hidden="true" />
          <span v-else class="acc__swatch" :style="{ background: colorLema(l) }" aria-hidden="true"></span>
          <span class="acc__sigla">{{ siglaLema(l) }}</span>
          <span class="acc__etiqueta">{{ l.etiqueta }}</span>
        </div>

        <ul v-if="expandidos.has(l.id)" class="acc__children" role="group">
          <!-- Nivel medio genérico (precandidato/sublema/alcalde): lema → grupo → opción -->
          <li v-for="g in gruposDe(l.id)" :key="g.id" class="acc__precand" role="treeitem" :aria-expanded="expandidos.has(g.id)">
            <div class="acc__row acc__row--precand">
              <button
                type="button"
                class="acc__cb"
                :class="`acc__cb--${tri(idsDeGrupo(g.id))}`"
                :aria-label="`Seleccionar todas las opciones de ${g.etiqueta}`"
                @click="toggleSet(idsDeGrupo(g.id))"
              ><span aria-hidden="true">{{ tri(idsDeGrupo(g.id)) === 'full' ? '✓' : tri(idsDeGrupo(g.id)) === 'partial' ? '–' : '' }}</span></button>
              <button type="button" class="acc__chevron" :aria-label="`Expandir ${g.etiqueta}`" @click="toggleExpand(g.id)">
                {{ expandidos.has(g.id) ? '▼' : '▸' }}
              </button>
              <span class="acc__etiqueta acc__etiqueta--precand">{{ g.etiqueta }}</span>
            </div>
            <ul v-if="expandidos.has(g.id)" class="acc__children" role="group">
              <li v-for="h in opcionesDeGrupo(g.id)" :key="h.id" class="acc__hoja" role="treeitem">
                <div class="acc__row acc__row--hoja">
                  <button
                    type="button"
                    class="acc__cb"
                    :class="seleccion.has(h.id) ? 'acc__cb--full' : 'acc__cb--empty'"
                    :aria-label="`Seleccionar ${etiquetaOpcion(h)}`"
                    @click="toggleHoja(h.id)"
                  ><span aria-hidden="true">{{ seleccion.has(h.id) ? '✓' : '' }}</span></button>
                  <span class="acc__lista">{{ etiquetaOpcion(h) }}</span>
                </div>
              </li>
            </ul>
          </li>
          <!-- Opciones directas del lema (ODD: hoja; intendente: candidato; voto al lema) -->
          <li v-for="h in opcionesDeLemaDirecto(l.id)" :key="h.id" class="acc__hoja" role="treeitem">
            <div class="acc__row acc__row--hoja">
              <button
                type="button"
                class="acc__cb"
                :class="seleccion.has(h.id) ? 'acc__cb--full' : 'acc__cb--empty'"
                :aria-label="`Seleccionar ${etiquetaOpcion(h)}`"
                @click="toggleHoja(h.id)"
              ><span aria-hidden="true">{{ seleccion.has(h.id) ? '✓' : '' }}</span></button>
              <span class="acc__lista">{{ etiquetaOpcion(h) }}</span>
            </div>
          </li>
        </ul>
      </li>
    </ul>

    <!-- Tipo plano (balotaje/plebiscito): lista simple de opciones con checkbox, sin chevrons -->
    <ul v-else-if="contienda && esPlano" class="acc__tree acc__tree--plano" role="group">
      <li v-for="o in contienda.opciones" :key="o.id" class="acc__hoja">
        <div class="acc__row">
          <button
            type="button"
            class="acc__cb"
            :class="seleccion.has(o.id) ? 'acc__cb--full' : 'acc__cb--empty'"
            :aria-label="`Seleccionar ${metaPlano(o).label}`"
            @click="toggleHoja(o.id)"
          ><span aria-hidden="true">{{ seleccion.has(o.id) ? '✓' : '' }}</span></button>
          <img v-if="metaPlano(o).flagUrl" :src="metaPlano(o).flagUrl!" :alt="metaPlano(o).sigla" class="acc__flag" aria-hidden="true" />
          <span v-else class="acc__swatch" :style="{ background: metaPlano(o).color }" aria-hidden="true"></span>
          <span class="acc__lista">{{ metaPlano(o).label }}</span>
        </div>
      </li>
    </ul>

    <p v-if="!catalogo" class="acc__cargando">Cargando opciones…</p>
  </section>
</template>

<style scoped>
.acc { padding: 0.5rem 1rem; border-bottom: 1px solid var(--color-border); font-size: 0.875rem; }
.acc__contiendas { display: flex; gap: 0.25rem; margin-bottom: 0.5rem; }
.acc__contienda {
  flex: 1; padding: 0.375rem 0.5rem; border: 1px solid var(--color-border-strong);
  border-radius: 0.25rem; background: var(--color-surface-1); color: var(--color-ink-soft);
  font-size: 0.75rem; font-weight: 600; cursor: pointer; min-height: 36px;
}
.acc__contienda--activa { background: var(--color-ink); color: var(--color-paper); border-color: var(--color-ink); }
.acc__contienda:focus-visible { outline: 2px solid var(--color-focus); outline-offset: 2px; }

.acc__controles { display: flex; gap: 0.375rem; margin-bottom: 0.375rem; }
.acc__busqueda { flex: 1; min-width: 0; padding: 0.375rem 0.5rem; border: 1px solid var(--color-border); border-radius: 0.25rem; min-height: 36px; }
.acc__filtro { padding: 0.375rem 0.5rem; border: 1px solid var(--color-border); border-radius: 0.25rem; max-width: 11rem; min-height: 36px; }

.acc__chips { display: flex; flex-wrap: wrap; align-items: center; gap: 0.375rem; margin-bottom: 0.375rem; font-size: 0.75rem; }
.acc__chip { display: inline-flex; align-items: center; gap: 0.25rem; padding: 0.125rem 0.5rem; border: 1px solid var(--color-border-strong); border-radius: 9999px; background: var(--color-surface-1); }
.acc__chip--sel { font-weight: 700; }
.acc__chip button { background: none; border: none; cursor: pointer; color: var(--color-ink-muted); padding: 0 0.125rem; }
.acc__limpiar { background: none; border: none; cursor: pointer; color: var(--color-accent); text-decoration: underline; font-size: 0.75rem; }

.acc__acciones { margin-bottom: 0.25rem; }
.acc__link { background: none; border: none; cursor: pointer; color: var(--color-accent); text-decoration: underline; font-size: 0.75rem; padding: 0; }

.acc__tree { list-style: none; margin: 0; padding: 0; max-height: 22rem; overflow-y: auto; border: 1px solid var(--color-border); border-radius: 0.375rem; }
.acc__children { list-style: none; margin: 0; padding: 0; }
.acc__row { display: flex; align-items: center; gap: 0.375rem; min-height: 40px; padding: 0.125rem 0.375rem; border-bottom: 1px solid var(--color-surface-2); }
.acc__row--lema { font-weight: 600; }
.acc__row--precand { padding-left: 1.75rem; }
.acc__row--hoja { padding-left: 3rem; }
.acc__tree--plano .acc__row { padding-left: 0.375rem; }

.acc__cb {
  width: 22px; height: 22px; flex-shrink: 0; border: 1.5px solid var(--color-border-strong);
  border-radius: 0.25rem; background: var(--color-paper); cursor: pointer; display: grid; place-items: center;
  font-size: 0.8rem; line-height: 1; color: var(--color-paper);
}
.acc__cb--full { background: var(--color-ink); border-color: var(--color-ink); }
.acc__cb--partial { background: var(--color-ink-soft); border-color: var(--color-ink-soft); }
.acc__cb:focus-visible { outline: 2px solid var(--color-focus); outline-offset: 2px; }

.acc__chevron { background: none; border: none; cursor: pointer; color: var(--color-ink-soft); width: 22px; height: 40px; flex-shrink: 0; font-size: 0.7rem; }
.acc__chevron:focus-visible { outline: 2px solid var(--color-focus); outline-offset: -2px; }

.acc__swatch { width: 0.75rem; height: 0.75rem; border-radius: 0.125rem; flex-shrink: 0; border: 1px solid rgba(0,0,0,.1); }
.acc__flag  { width: 1.25rem; height: 0.8125rem; border-radius: 0.125rem; flex-shrink: 0; border: 1px solid rgba(0,0,0,.15); object-fit: cover; }
.acc__sigla { font-weight: 700; min-width: 2.25rem; color: var(--color-ink); }
.acc__etiqueta { color: var(--color-ink-soft); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.acc__etiqueta--precand { font-weight: 500; color: var(--color-ink); }
.acc__lista { color: var(--color-ink); }

.acc__cargando { color: var(--color-ink-faint); font-size: 0.8125rem; margin: 0.5rem 0; }
.acc__degradado { font-size: 0.7rem; color: var(--color-ink-faint); font-style: italic; margin: 0 0 0.375rem; }
</style>
