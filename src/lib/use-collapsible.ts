import { ref, watch, type Ref } from 'vue';

/**
 * Estado plegado/desplegado persistido en localStorage (por clave), para que el usuario pueda
 * esconder paneles (control de listas, resultado) y la preferencia sobreviva la navegación.
 * SSR-safe: en el server arranca con `defaultOpen` y no toca localStorage.
 */
export function useCollapsible(key: string, defaultOpen: boolean): { open: Ref<boolean>; toggle: () => void } {
  const storageKey = `ui:collapse:${key}`;
  let initial = defaultOpen;
  if (typeof window !== 'undefined') {
    const v = window.localStorage.getItem(storageKey);
    if (v === '0') initial = false;
    else if (v === '1') initial = true;
  }
  const open = ref(initial);
  watch(open, (o) => {
    if (typeof window !== 'undefined') window.localStorage.setItem(storageKey, o ? '1' : '0');
  });
  return { open, toggle: () => { open.value = !open.value; } };
}
