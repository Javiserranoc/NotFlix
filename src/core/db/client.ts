import { drizzle } from 'drizzle-orm/sql-js';
import initSqlJs, { type Database } from 'sql.js';

import { moviesTitles, moviesWatches } from '../../movies/schema';
import { MIGRATIONS } from './migrations';

/**
 * SQLite en el navegador con sql.js: la base vive en memoria, así que leer y
 * escribir es síncrono (repo.ts cuenta con ello), y `storage.ts` guarda una
 * copia del archivo entero en IndexedDB tras cada escritura.
 *
 * No se usa expo-sqlite porque en web exige SharedArrayBuffer y, con él,
 * cabeceras COEP: las imágenes de TMDB no mandan CORP y dejarían de verse.
 */
export const schema = { moviesTitles, moviesWatches };

let current: Database | null = null;
let version = 0;
let flushQueued = false;
const listeners = new Set<() => void>();
let afterWrite: ((database: Database) => void) | null = null;

export function rawDb(): Database {
  if (!current) throw new Error('La base de datos aún no está abierta');
  return current;
}

function publish() {
  version++;
  for (const l of listeners) l();
}

/**
 * Se avisa en un microtask: cuando corre ya ha terminado la escritura, y las
 * que van seguidas (marcar Vista son dos) cuentan como un solo cambio.
 */
function queueFlush() {
  if (flushQueued) return;
  flushQueued = true;
  queueMicrotask(() => {
    flushQueued = false;
    if (current) afterWrite?.(current);
    publish();
  });
}

const READ_ONLY = /^\s*(select|pragma)\b/i;

/** Lo único que Drizzle le pide al cliente es `prepare`; así `db` existe antes de abrir la base. */
const client = {
  prepare(sql: string) {
    if (!READ_ONLY.test(sql)) queueFlush();
    return rawDb().prepare(sql);
  },
} as unknown as Database;

export const db = drizzle(client, { schema });

export type Db = typeof db;

/** Carga el motor una sola vez. Sin `wasmUrl` lo busca junto al paquete (tests). */
let engine: ReturnType<typeof initSqlJs> | null = null;
const loadEngine = (wasmUrl?: string) =>
  (engine ??= initSqlJs(wasmUrl ? { locateFile: () => wasmUrl } : undefined));

/** Abre la base (nueva, o la guardada en `bytes`) y aplica las migraciones pendientes. */
export async function openDatabase(options: {
  bytes?: Uint8Array | null;
  wasmUrl?: string;
  onWrite?: (database: Database) => void;
} = {}): Promise<void> {
  const SQL = await loadEngine(options.wasmUrl);
  current = new SQL.Database(options.bytes ?? undefined);
  afterWrite = options.onWrite ?? null;
  if (migrate()) afterWrite?.(current);
  publish();
}

/** Sustituye la base por la que ha guardado otra pestaña. No vuelve a guardarla. */
export async function replaceDatabase(bytes: Uint8Array): Promise<void> {
  const SQL = await loadEngine();
  current?.close();
  current = new SQL.Database(bytes);
  publish();
}

/** Abre un archivo SQLite aparte, sin tocar la biblioteca. Quien lo pide lo cierra. */
export async function openDatabaseFile(bytes: Uint8Array): Promise<Database> {
  const SQL = await loadEngine();
  return new SQL.Database(bytes);
}

/**
 * Cambia la biblioteca entera por una nueva que rellena `fill`. Se construye
 * aparte y se cambia al final: si `fill` falla, la actual sigue intacta.
 */
export async function replaceLibrary(fill: (database: Database) => void): Promise<void> {
  const SQL = await loadEngine();
  const next = new SQL.Database();
  try {
    migrate(next);
    next.exec('BEGIN');
    fill(next);
    next.exec('COMMIT');
  } catch (e) {
    next.close();
    throw e;
  }
  current?.close();
  current = next;
  afterWrite?.(next);
  publish();
}

/** Aplica migraciones pendientes (PRAGMA user_version). Devuelve si ha aplicado alguna. */
export function migrate(database: Database = rawDb()): boolean {
  const found = database.exec('PRAGMA user_version')[0]?.values[0]?.[0];
  const from = typeof found === 'number' ? found : 0;
  let applied = false;

  for (const m of MIGRATIONS) {
    if (m.version <= from) continue;
    database.exec('BEGIN');
    try {
      database.exec(m.sql);
      database.exec(`PRAGMA user_version = ${m.version}`);
      database.exec('COMMIT');
    } catch (e) {
      database.exec('ROLLBACK');
      throw e;
    }
    applied = true;
  }
  return applied;
}

/** Para `useLiveQuery`: un número que cambia con cada tanda de escrituras. */
export const getDbVersion = () => version;

export function subscribeDb(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
