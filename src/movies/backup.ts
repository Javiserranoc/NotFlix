/**
 * Copia de seguridad de la biblioteca: un JSON que se puede guardar en Archivos
 * (compartir un `.sqlite` no está permitido en todos los navegadores).
 *
 * Importar acepta también un SQLite con las tablas `movies_*`, como el `hub.db`
 * de la app de Android. La key de TMDB no va en la copia.
 */
import type { Database, SqlValue } from 'sql.js';

import { openDatabaseFile, rawDb, replaceLibrary } from '../core/db/client';
import { nowIso } from '../core/db/sync';
import { MOVIE_KINDS, MOVIE_STATUSES } from './enums';

type Row = Record<string, SqlValue>;
export type Library = { titles: Row[]; watches: Row[] };

const APP = 'notflix';
const TITLES = 'movies_titles';
const WATCHES = 'movies_watches';

/** Error con mensaje ya listo para enseñar en la UI. */
export class BackupError extends Error {}

const NOT_A_BACKUP = 'Este archivo no es una copia de NotFlix';

function tableRows(database: Database, table: string): Row[] {
  const [result] = database.exec(`SELECT * FROM ${table}`);
  if (!result) return [];
  return result.values.map((row) => Object.fromEntries(result.columns.map((c, i) => [c, row[i]!])));
}

export function backupFileName(date = new Date()): string {
  return `notflix-${date.toISOString().slice(0, 10)}.json`;
}

/** Síncrono a propósito: iOS solo abre la hoja de compartir justo tras el toque. */
export function exportBackup(): string {
  const database = rawDb();
  return JSON.stringify({
    app: APP,
    exportedAt: nowIso(),
    titles: tableRows(database, TITLES),
    watches: tableRows(database, WATCHES),
  });
}

const SQLITE_HEADER = 'SQLite format 3\0';
const isSqlite = (bytes: Uint8Array) =>
  bytes.length > 100 && String.fromCharCode(...bytes.subarray(0, SQLITE_HEADER.length)) === SQLITE_HEADER;

async function readSqlite(bytes: Uint8Array): Promise<Library> {
  // Android abre la base en modo WAL y sql.js no puede leer ese modo. Son dos
  // bytes de la cabecera del archivo (offsets 18 y 19): se marca como modo
  // clásico en una copia.
  const copy = bytes.slice();
  if (copy[18] === 2) copy[18] = 1;
  if (copy[19] === 2) copy[19] = 1;

  let database: Database;
  try {
    database = await openDatabaseFile(copy);
  } catch {
    throw new BackupError(NOT_A_BACKUP);
  }
  try {
    const hasTable = (name: string) =>
      database.exec(`SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = '${name}'`).length > 0;
    if (!hasTable(TITLES)) throw new BackupError(NOT_A_BACKUP);
    return {
      titles: tableRows(database, TITLES),
      watches: hasTable(WATCHES) ? tableRows(database, WATCHES) : [],
    };
  } catch (e) {
    throw e instanceof BackupError ? e : new BackupError('El archivo está dañado');
  } finally {
    database.close();
  }
}

function readJson(bytes: Uint8Array): Library {
  let data: { app?: unknown; titles?: unknown; watches?: unknown };
  try {
    data = JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    throw new BackupError(NOT_A_BACKUP);
  }
  if (data?.app !== APP || !Array.isArray(data.titles) || !Array.isArray(data.watches)) {
    throw new BackupError(NOT_A_BACKUP);
  }
  return { titles: data.titles as Row[], watches: data.watches as Row[] };
}

const hasText = (row: Row, ...columns: string[]) => columns.every((c) => typeof row[c] === 'string' && row[c] !== '');

/** Comprueba lo imprescindible y actualiza lo antiguo. Un archivo a medias se rechaza entero. */
function normalize({ titles, watches }: Library): Library {
  if (titles.length === 0) throw new BackupError('Este archivo no tiene ninguna película ni serie');
  const validTitle = (r: Row) =>
    hasText(r, 'id', 'title', 'created_at', 'updated_at') &&
    (MOVIE_KINDS as readonly SqlValue[]).includes(r.kind!) &&
    (MOVIE_STATUSES as readonly SqlValue[]).includes(r.status!);
  const validWatch = (r: Row) => hasText(r, 'id', 'title_id', 'watched_at', 'created_at', 'updated_at');
  if (!titles.every(validTitle) || !watches.every(validWatch)) throw new BackupError('El archivo está dañado');

  // "En curso" ya no existe: lo mismo que hace la migración 6.
  return { titles: titles.map((t) => (t.status === 'watching' ? { ...t, status: 'wishlist' } : t)), watches };
}

/** Lee y valida un archivo sin tocar la biblioteca. */
export async function readBackup(bytes: Uint8Array): Promise<Library> {
  return normalize(isSqlite(bytes) ? await readSqlite(bytes) : readJson(bytes));
}

function insertRows(database: Database, table: string, rows: Row[]) {
  const known = new Set(database.exec(`PRAGMA table_info(${table})`)[0]!.values.map((c) => String(c[1])));
  for (const row of rows) {
    // Sin los null: las columnas NOT NULL con DEFAULT toman su valor por defecto.
    const columns = Object.keys(row).filter((c) => known.has(c) && row[c] != null);
    const marks = columns.map(() => '?').join(', ');
    database.run(`INSERT INTO ${table} (${columns.join(', ')}) VALUES (${marks})`, columns.map((c) => row[c]!));
  }
}

/** Sustituye la biblioteca. Si la copia no entra, la actual se queda como estaba. */
export async function restoreBackup(library: Library): Promise<void> {
  try {
    await replaceLibrary((database) => {
      insertRows(database, TITLES, library.titles);
      insertRows(database, WATCHES, library.watches);
    });
  } catch {
    throw new BackupError('El archivo está dañado');
  }
}
