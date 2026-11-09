import { integer, text } from 'drizzle-orm/sqlite-core';

/** Fecha actual en ISO-8601 UTC (1:1 con timestamptz de Postgres). */
export const nowIso = () => new Date().toISOString();

let lastTs = 0;
let seq = 0;

/**
 * UUID v7: 48 bits de timestamp + aleatorio. Se genera en el dispositivo,
 * es ordenable por tiempo y no colisiona entre dispositivos al sincronizar.
 * Dentro del mismo milisegundo van en orden (un contador de 12 bits en
 * `rand_a`, RFC 9562 §6.2): si no, dos filas creadas seguidas se ordenaban
 * al azar al desempatar por id.
 */
export function uuidv7(): string {
  const b = crypto.getRandomValues(new Uint8Array(16));
  let ts = Date.now();
  if (ts > lastTs) {
    lastTs = ts;
    // Empieza en la mitad de abajo, para que quede sitio para contar.
    seq = ((b[6]! & 0x07) << 8) | b[7]!;
  } else {
    ts = lastTs;
    seq++;
    if (seq > 0xfff) {
      ts = ++lastTs;
      seq = 0;
    }
  }
  b[0] = Math.floor(ts / 2 ** 40) & 0xff;
  b[1] = Math.floor(ts / 2 ** 32) & 0xff;
  b[2] = Math.floor(ts / 2 ** 24) & 0xff;
  b[3] = Math.floor(ts / 2 ** 16) & 0xff;
  b[4] = Math.floor(ts / 2 ** 8) & 0xff;
  b[5] = ts & 0xff;
  b[6] = 0x70 | (seq >> 8); // versión 7 + lo alto del contador
  b[7] = seq & 0xff;
  b[8] = (b[8] & 0x3f) | 0x80; // variante RFC 4122
  const h = Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

/**
 * Columnas comunes a TODA tabla de datos de un módulo ("sync-ready"):
 *  - id: UUID v7 texto (nunca autoincrement)
 *  - created_at / updated_at: ISO-8601; updated_at se renueva en cada update
 *  - deleted_at: borrado lógico (tombstone) -> propagable y permite "Deshacer"
 *
 * Es una función (no un objeto) para que cada tabla reciba builders nuevos.
 * El SQL equivalente para migraciones está en SYNC_COLUMNS_SQL.
 */
export const syncColumns = () => ({
  id: text('id').primaryKey().$defaultFn(uuidv7),
  createdAt: text('created_at').notNull().$defaultFn(nowIso),
  updatedAt: text('updated_at').notNull().$defaultFn(nowIso).$onUpdateFn(nowIso),
  deletedAt: text('deleted_at'),
});

export const SYNC_COLUMNS_SQL = `
  id          TEXT PRIMARY KEY NOT NULL,
  created_at  TEXT NOT NULL,
  updated_at  TEXT NOT NULL,
  deleted_at  TEXT`;

/** Booleano SQLite (0/1) tipado. */
export const bool = (name: string) => integer(name, { mode: 'boolean' });
