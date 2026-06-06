/**
 * Manifest de capacidades por (elección, depto): qué archivos OPCIONALES existen
 * (`public/data/_manifest.json`, generado por `scripts/build-data-manifest.mjs`).
 *
 * Sirve para que el front NO pida datos opcionales que esa vista no tiene (binarias sin
 * hoja-circuito, interior sin serie-annexed, plebiscitos/balotajes sin catálogo de hoja…)
 * y así no ensucie la consola con 404. Cache global: una sola carga, compartida entre
 * ChoroplethMap y OpcionAccordion.
 *
 * Contrato (fallback SEGURO): se SALTA un fetch opcional sólo si el manifest CONOCE esa
 * vista y el archivo no está listado. Si el manifest falta o no conoce la vista → se hace
 * el fetch igual (comportamiento previo), nunca se omite dato por un manifest incompleto.
 */
type Manifest = Record<string, Record<string, string[]>>;

let manifestData: Manifest | null = null;
let manifestPromise: Promise<void> | null = null;

export function ensureManifest(): Promise<void> {
  if (!manifestPromise) {
    const base = import.meta.env.BASE_URL.replace(/\/$/, '');
    manifestPromise = fetch(`${base}/data/_manifest.json`)
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        manifestData = j as Manifest | null;
      })
      .catch(() => {
        manifestData = null;
      });
  }
  return manifestPromise;
}

/** ¿Pedir este archivo opcional? Sí, salvo que el manifest conozca la vista y el archivo no esté listado. */
export function tieneOpcional(eleccion: string, departamento: string, key: string): boolean {
  const vista = manifestData?.[eleccion]?.[departamento];
  if (!vista) return true; // manifest desconocido → fetch como antes (seguro)
  return vista.includes(key);
}
