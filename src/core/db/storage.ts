import type { Database } from 'sql.js';

import { BASE_PATH } from '../base';
import { idbGet, idbPut } from '../idb';
import { openDatabase, replaceDatabase } from './client';

/**
 * El archivo SQLite en IndexedDB. Se guarda en cuanto hay una escritura, sin
 * esperar a cerrar: iOS mata las PWA en segundo plano sin avisar.
 */
const FILE = 'library.sqlite';
const WASM_URL = `${BASE_PATH}/sql-wasm.wasm`;

// Dos pestañas abiertas (en escritorio) se pisarían el archivo entero: la que
// guarda avisa y la otra recarga.
const channel = typeof BroadcastChannel === 'undefined' ? null : new BroadcastChannel('notflix-db');

let saving = false;
let pending: Database | null = null;

async function save(database: Database) {
  pending = database;
  if (saving) return;
  saving = true;
  try {
    while (pending) {
      const next = pending;
      pending = null;
      await idbPut(FILE, next.export());
      channel?.postMessage('saved');
    }
  } catch (e) {
    console.error('[db] No se ha podido guardar', e);
  } finally {
    saving = false;
  }
}

/** Abre la biblioteca guardada, o una nueva si es la primera vez. */
export async function startDatabase(): Promise<void> {
  const bytes = await idbGet<Uint8Array>(FILE);
  await openDatabase({ bytes, wasmUrl: WASM_URL, onWrite: save });
  if (channel) {
    channel.onmessage = async () => {
      const latest = await idbGet<Uint8Array>(FILE);
      if (latest) await replaceDatabase(latest);
    };
  }
}
