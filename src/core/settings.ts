/**
 * Ajustes de la app: la key de TMDB, cifrada con AES-GCM en IndexedDB. La clave
 * de cifrado se genera en este dispositivo y es no extraíble: el navegador
 * puede usarla, pero el código no puede leerla.
 *
 * Protege lo guardado frente a quien vuelque el almacenamiento, no frente a
 * código que corra dentro de la propia app, que necesita la key para llamar a
 * TMDB. Nunca va en `.env`: todo `EXPO_PUBLIC_*` acabaría en el JavaScript publicado.
 *
 * `tmdb.ts` la necesita de forma síncrona, así que `loadSettings` la descifra
 * al arrancar y queda en memoria. Las pantallas usan `useSetting`.
 */
import { useSyncExternalStore } from 'react';

import { idbDelete, idbGet, idbPut } from './idb';

const STORE_KEYS = {
  tmdbKey: 'setting.tmdb_key',
} as const;

export type SettingId = keyof typeof STORE_KEYS;
type Encrypted = { iv: Uint8Array<ArrayBuffer>; data: ArrayBuffer };

const CIPHER_KEY = 'setting.cipher_key';
const ALGORITHM = 'AES-GCM';

const values: Partial<Record<SettingId, string>> = {};
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((l) => l());

async function cipherKey(): Promise<CryptoKey> {
  const saved = await idbGet<CryptoKey>(CIPHER_KEY);
  if (saved) return saved;
  const created = await crypto.subtle.generateKey({ name: ALGORITHM, length: 256 }, false, ['encrypt', 'decrypt']);
  await idbPut(CIPHER_KEY, created);
  return created;
}

/** Descifra los ajustes. Si algo falla, como si no hubiera key: la app arranca igual. */
export async function loadSettings(): Promise<void> {
  for (const id of Object.keys(STORE_KEYS) as SettingId[]) {
    try {
      const saved = await idbGet<Encrypted>(STORE_KEYS[id]);
      if (!saved) continue;
      const plain = await crypto.subtle.decrypt({ name: ALGORITHM, iv: saved.iv }, await cipherKey(), saved.data);
      values[id] = new TextDecoder().decode(plain);
    } catch (e) {
      console.warn('[settings] No se ha podido descifrar', id, e);
    }
  }
  notify();
}

/** Lo guardado en Ajustes. '' si nada. */
export function getSetting(id: SettingId): string {
  return values[id] ?? '';
}

/** Guarda cifrado (o borra, con ''). Avisa a las pantallas al terminar. */
export async function setSetting(id: SettingId, value: string): Promise<void> {
  const v = value.trim();
  if (v) {
    // Sin HTTPS el navegador no ofrece `crypto.subtle` y esto falla: mejor no
    // guardar que guardar la key en claro.
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const data = await crypto.subtle.encrypt({ name: ALGORITHM, iv }, await cipherKey(), new TextEncoder().encode(v));
    await idbPut(STORE_KEYS[id], { iv, data } satisfies Encrypted);
    values[id] = v;
  } else {
    await idbDelete(STORE_KEYS[id]);
    delete values[id];
  }
  notify();
}

function subscribe(l: () => void) {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
}

/** Hook: el valor guardado, que cambia en cuanto se guarda en Ajustes. */
export function useSetting(id: SettingId): string {
  return useSyncExternalStore(subscribe, () => getSetting(id));
}
