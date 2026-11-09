import { BASE_PATH } from './base';

/** Lo que solo tiene sentido en la app publicada: modo offline y almacenamiento duradero. */
export function setupPwa() {
  if (__DEV__ || typeof navigator === 'undefined') return;

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register(`${BASE_PATH}/sw.js`).catch((e) => console.warn('[pwa] Sin modo offline', e));
  }
  // Pide al navegador que no borre la biblioteca si se queda sin espacio.
  navigator.storage?.persist?.().catch(() => {});
}
