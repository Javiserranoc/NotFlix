/** Copia de seguridad contra un SQLite real: lo que importa es no perder nada al restaurar. */
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';

import { MIGRATIONS } from '../../core/db/migrations';
import { db, openDatabase, rawDb } from '../../core/db/client';
import { BackupError, exportBackup, readBackup, restoreBackup } from '../backup';
import { insertMovieReturningId, logWatch, softDelete } from '../repo';
import { moviesTitles, moviesWatches } from '../schema';

const bytes = (text: string) => new TextEncoder().encode(text);
const titles = () => db.select().from(moviesTitles).all();
const watches = () => db.select().from(moviesWatches).all();
const add = (title: string) => insertMovieReturningId({ kind: 'movie', status: 'wishlist', title, genres: 'Drama', rating: 8.5 });

beforeEach(() => openDatabase());

/** Un archivo real como el de la app de Android: en WAL y con otras tablas. */
function hubDb(fill: (hub: DatabaseSync) => void): Uint8Array {
  const dir = mkdtempSync(join(tmpdir(), 'notflix-'));
  const file = join(dir, 'hub.db');
  const hub = new DatabaseSync(file);
  hub.exec('PRAGMA journal_mode = WAL; CREATE TABLE gym_sets (id TEXT);');
  for (const m of MIGRATIONS) hub.exec(m.sql);
  fill(hub);
  hub.exec('PRAGMA wal_checkpoint(TRUNCATE)');
  hub.close();
  const out = new Uint8Array(readFileSync(file));
  rmSync(dir, { recursive: true });
  return out;
}

const INSERT_TITLE = `INSERT INTO movies_titles (id, created_at, updated_at, kind, title, status)
  VALUES (?, '2024-01-01', '2024-01-01', 'movie', ?, ?)`;

describe('exportar y restaurar', () => {
  it('devuelve la biblioteca tal cual, con historial y borrados', async () => {
    const dune = add('Dune');
    logWatch(dune, '2024-02-02T21:00:00.000Z');
    softDelete(add('Borrada'));
    const before = { titles: titles(), watches: watches() };

    const library = await readBackup(bytes(exportBackup()));
    await openDatabase();
    expect(titles()).toHaveLength(0);
    await restoreBackup(library);

    expect(titles()).toEqual(before.titles);
    expect(watches()).toEqual(before.watches);
  });

  it('sustituye lo que hubiera y deja la base en la última migración', async () => {
    add('Original');
    const library = await readBackup(bytes(exportBackup()));
    add('Se va');
    await restoreBackup(library);
    expect(titles().map((t) => t.title)).toEqual(['Original']);
    expect(rawDb().exec('PRAGMA user_version')[0]!.values[0]![0]).toBe(MIGRATIONS.at(-1)!.version);
  });
});

describe('importar el hub.db de Android', () => {
  it('lee un archivo en WAL y se queda solo con cine', async () => {
    const file = hubDb((hub) => {
      hub.prepare(INSERT_TITLE).run('a', 'Del móvil', 'completed');
      hub.exec(`INSERT INTO movies_watches (id, created_at, updated_at, title_id, watched_at)
        VALUES ('w', '2024-01-01', '2024-01-01', 'a', '2024-01-02')`);
    });
    expect(file[18]).toBe(2);
    await restoreBackup(await readBackup(file));
    expect(titles().map((t) => t.title)).toEqual(['Del móvil']);
    expect(watches()).toHaveLength(1);
    expect(rawDb().exec("SELECT 1 FROM sqlite_master WHERE name = 'gym_sets'")).toHaveLength(0);
  });

  it('lo que estaba En curso pasa a Deseada', async () => {
    const file = hubDb((hub) => void hub.prepare(INSERT_TITLE).run('a', 'A medias', 'watching'));
    await restoreBackup(await readBackup(file));
    expect(titles()[0]!.status).toBe('wishlist');
  });
});

describe('archivos que no valen', () => {
  const backup = (over: object) => bytes(JSON.stringify({ app: 'notflix', titles: [], watches: [], ...over }));
  const good = { id: 'a', title: 'T', kind: 'movie', status: 'wishlist', created_at: 'x', updated_at: 'x' };

  it.each([
    ['texto cualquiera', bytes('hola')],
    ['JSON de otra app', bytes('{"foo":1}')],
    ['sin títulos', backup({})],
    ['título sin id', backup({ titles: [{ ...good, id: '' }] })],
    ['estado desconocido', backup({ titles: [{ ...good, status: 'raro' }] })],
    ['visionado sin fecha', backup({ titles: [good], watches: [{ id: 'w', title_id: 'a', created_at: 'x', updated_at: 'x' }] })],
  ])('rechaza: %s', async (_name, file) => {
    await expect(readBackup(file)).rejects.toBeInstanceOf(BackupError);
  });

  it('rechaza un SQLite sin tablas de cine', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'notflix-'));
    const file = join(dir, 'otra.db');
    const other = new DatabaseSync(file);
    other.exec('CREATE TABLE cosas (id TEXT)');
    other.close();
    const content = new Uint8Array(readFileSync(file));
    rmSync(dir, { recursive: true });
    await expect(readBackup(content)).rejects.toBeInstanceOf(BackupError);
  });

  it('si la copia no entra, la biblioteca actual sigue igual', async () => {
    add('Sigo aquí');
    const dupes = [{ ...good }, { ...good }];
    await expect(restoreBackup({ titles: dupes, watches: [] })).rejects.toBeInstanceOf(BackupError);
    expect(titles().map((t) => t.title)).toEqual(['Sigo aquí']);
  });
});
