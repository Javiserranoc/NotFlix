/**
 * Las migraciones contra un SQLite real (node:sqlite). Es lo único que no se
 * puede arreglar después: una migración rota deja la app sin
 * arrancar, y ya no se puede editar, solo añadir otra.
 */
import { getTableConfig, type SQLiteTable } from 'drizzle-orm/sqlite-core';
import { DatabaseSync } from 'node:sqlite';

import { MIGRATIONS } from '../db/migrations';
import { MOVIES_MIGRATION_V1 } from '../../movies/schema';


const UUID_V7 = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

const upTo = (db: DatabaseSync, from: number, to: number) => {
  for (const m of MIGRATIONS) if (m.version > from && m.version <= to) db.exec(m.sql);
};

describe('lista de migraciones', () => {
  it('va de 1 en 1 sin huecos ni repetidas', () => {
    expect(MIGRATIONS.map((m) => m.version)).toEqual(MIGRATIONS.map((_, i) => i + 1));
  });

  it('la v1 no se ha tocado (ya se ejecutó en los dispositivos)', () => {
    // Si este test falla es que alguien editó la v1: hay que deshacerlo y
    // hacer el cambio en una migración nueva.
    expect(MIGRATIONS[0]!.sql).toBe(MOVIES_MIGRATION_V1);
    expect(MOVIES_MIGRATION_V1).toContain('total_episodes  INTEGER');
  });
});

describe('actualizar una base de la v1 con datos dentro', () => {
  const db = new DatabaseSync(':memory:');

  beforeAll(() => {
    upTo(db, 0, 1);
    const ins = db.prepare(
      `INSERT INTO movies_titles (id, created_at, updated_at, deleted_at, kind, title, status, season, episode, finished_at)
       VALUES (?, '2024-01-01T00:00:00.000Z', '2024-01-01T00:00:00.000Z', ?, ?, ?, ?, ?, ?, ?)`,
    );
    ins.run('a', null, 'movie', 'Vista con fecha', 'completed', null, null, '2024-02-02T21:00:00.000Z');
    ins.run('b', null, 'series', 'En curso con episodio', 'watching', 2, 5, null);
    ins.run('c', null, 'movie', 'Vista sin fecha', 'completed', null, null, null);
    ins.run('d', '2024-03-01T00:00:00.000Z', 'movie', 'Borrada', 'completed', null, null, '2024-01-10T00:00:00.000Z');
    upTo(db, 1, MIGRATIONS.length);
  });

  it('conserva todas las filas', () => {
    expect(db.prepare('SELECT count(*) AS n FROM movies_titles').get()).toEqual({ n: 4 });
  });

  it('la v2 quita las columnas de episodios', () => {
    const cols = db.prepare('PRAGMA table_info(movies_titles)').all().map((c) => c.name);
    expect(cols).not.toContain('season');
    expect(cols).not.toContain('episode');
    expect(cols).not.toContain('total_episodes');
    expect(cols).toEqual(expect.arrayContaining(['tmdb_id', 'seasons_json', 'watched_seasons', 'collection_id']));
  });

  it('la v5 apunta un visionado por cada Vista viva con fecha, con id UUID v7', () => {
    const rows = db.prepare('SELECT * FROM movies_watches').all();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ title_id: 'a', watched_at: '2024-02-02T21:00:00.000Z', deleted_at: null });
    expect(String(rows[0]!.id)).toMatch(UUID_V7);
  });

  it('el índice único de tmdb_id solo cuenta las filas vivas', () => {
    db.exec(`UPDATE movies_titles SET tmdb_id = 42 WHERE id = 'd'`); // borrada
    db.exec(`UPDATE movies_titles SET tmdb_id = 42 WHERE id = 'a'`); // viva: cabe
    expect(() => db.exec(`UPDATE movies_titles SET tmdb_id = 42 WHERE id = 'c'`)).toThrow(/UNIQUE/);
  });
});

describe('los ids que genera la v5 en SQL', () => {
  it('siempre tienen forma de UUID v7', () => {
    const db = new DatabaseSync(':memory:');
    upTo(db, 0, 4);
    const ins = db.prepare(
      `INSERT INTO movies_titles (id, created_at, updated_at, kind, title, status, finished_at)
       VALUES (?, 'x', 'x', 'movie', 't', 'completed', '2024-01-01')`,
    );
    for (let i = 0; i < 300; i++) ins.run(`t${i}`);
    upTo(db, 4, 5);
    const ids = db.prepare('SELECT id FROM movies_watches').all().map((r) => String(r.id));
    expect(ids).toHaveLength(300);
    for (const id of ids) expect(id).toMatch(UUID_V7);
    expect(new Set(ids).size).toBe(300);
  });
});

describe('el SQL de las migraciones y las tablas de Drizzle', () => {
  // Se mantienen a mano (no hay drizzle-kit): este test es el que avisa.
  const client = require('../db/client') as typeof import('../db/client');
  const { migrate, schema } = client;
  const scalar = (sql: string) => client.rawDb().exec(sql)[0]!.values[0]![0];
  beforeAll(() => client.openDatabase());

  it('migrate() deja user_version en la última y es idempotente', () => {
    const last = MIGRATIONS.at(-1)!.version;
    expect(scalar('PRAGMA user_version')).toBe(last);
    expect(migrate()).toBe(false);
    expect(scalar('PRAGMA user_version')).toBe(last);
  });

  it.each(Object.entries(schema))('%s: mismas columnas y mismos NOT NULL', (_key, table) => {
    const cfg = getTableConfig(table as SQLiteTable);
    const drizzle = cfg.columns
      .map((c) => ({ name: c.name, notNull: c.notNull || c.primary }))
      .sort((a, b) => a.name.localeCompare(b.name));
    const info = client.rawDb().exec(`PRAGMA table_info(${cfg.name})`)[0]!;
    const sql = info.values
      .map((row) => Object.fromEntries(info.columns.map((col, i) => [col, row[i]])))
      .map((c) => ({ name: String(c.name), notNull: c.notnull === 1 || c.pk === 1 }))
      .sort((a, b) => a.name.localeCompare(b.name));
    expect(sql).toEqual(drizzle);
  });
});
