/**
 * Las escrituras contra un SQLite real (sql.js), con el mismo Drizzle y el
 * mismo migrate() que en la app. Aquí vive la lógica que no se
 * ve en pantalla hasta que falla: el historial de visionados, el estado que
 * se ajusta solo con las temporadas y el borrado lógico.
 */
import { eq } from 'drizzle-orm';

import { db, openDatabase, rawDb } from '../../core/db/client';
import {
  addWishlistFromTmdb,
  findByTmdbId,
  insertMovieReturningId,
  isPartial,
  logWatch,
  randomWishlist,
  recommendationSource,
  removeWatch,
  restore,
  setRating,
  setStatus,
  setWatchDate,
  softDelete,
  tmdbColumns,
  toggleWatchedSeason,
  updateMovie,
} from '../repo';
import { MOVIES_MIGRATION_V6, moviesTitles, type NewMovie } from '../schema';
import { serializeSeasons } from '../seasons';
import { pickedDayIso } from '../stats';


type Row = Record<string, string | number | null>;
const rows = (sql: string, params: (string | number)[]) => {
  const st = rawDb().prepare(sql);
  st.bind(params);
  const out: Row[] = [];
  while (st.step()) out.push(st.getAsObject() as Row);
  st.free();
  return out;
};
const raw = {
  exec: (sql: string) => rawDb().exec(sql),
  prepare: (sql: string) => ({
    all: (...params: (string | number)[]) => rows(sql, params),
    get: (...params: (string | number)[]) => rows(sql, params)[0],
  }),
};
const today = () => new Date().toISOString().slice(0, 10);

beforeAll(() => openDatabase());
beforeEach(() => raw.exec('DELETE FROM movies_watches; DELETE FROM movies_titles;'));

const add = (values: Partial<NewMovie> = {}) =>
  insertMovieReturningId({ kind: 'movie', title: 'Dune', status: 'wishlist', ...values });

const get = (id: string) => db.select().from(moviesTitles).where(eq(moviesTitles.id, id)).all()[0]!;

/** Visionados vivos de un título, del más antiguo al más reciente. */
const watches = (id: string) =>
  raw
    .prepare('SELECT watched_at FROM movies_watches WHERE title_id = ? AND deleted_at IS NULL ORDER BY watched_at')
    .all(id)
    .map((r) => String(r.watched_at));

describe('setStatus y el historial', () => {
  it('marcar Vista apunta un visionado de hoy y la fecha', () => {
    const id = add();
    setStatus(id, 'completed', 'wishlist');
    expect(get(id).status).toBe('completed');
    expect(get(id).finishedAt?.slice(0, 10)).toBe(today());
    expect(watches(id)).toHaveLength(1);
  });

  it('toquetear el estado no infla el historial (uno por día)', () => {
    const id = add();
    setStatus(id, 'completed');
    setStatus(id, 'dropped');
    setStatus(id, 'completed');
    setStatus(id, 'completed');
    expect(watches(id)).toHaveLength(1);
  });

  it('pulsar Vista en algo visto hace tiempo no apunta nada ni cambia la fecha', () => {
    const id = add();
    logWatch(id, '2023-05-01T20:00:00.000Z');
    setStatus(id, 'completed', 'completed');
    expect(watches(id)).toEqual(['2023-05-01T20:00:00.000Z']);
    expect(get(id).finishedAt).toBe('2023-05-01T20:00:00.000Z');
  });

  it('quitar Vista borra el visionado de hoy pero no los antiguos', () => {
    const id = add();
    logWatch(id, '2023-05-01T20:00:00.000Z');
    setStatus(id, 'completed');
    expect(watches(id)).toHaveLength(2);
    setStatus(id, 'dropped', 'completed');
    expect(watches(id)).toEqual(['2023-05-01T20:00:00.000Z']);
    expect(get(id).finishedAt).toBeNull();
  });
});

describe('volver a ver', () => {
  it('"Lo he vuelto a ver" apunta otro aunque ya haya uno hoy', () => {
    const id = add();
    setStatus(id, 'completed');
    logWatch(id);
    expect(watches(id)).toHaveLength(2);
  });

  it('apuntar una fecha antigua no mueve "la última vez" hacia atrás', () => {
    const id = add();
    logWatch(id, '2024-06-01T20:00:00.000Z');
    logWatch(id, '2022-01-01T20:00:00.000Z');
    expect(get(id).finishedAt).toBe('2024-06-01T20:00:00.000Z');
  });

  it('borrar el último visionado recoloca la fecha en el anterior', () => {
    const id = add();
    logWatch(id, '2022-01-01T20:00:00.000Z');
    logWatch(id, '2024-06-01T20:00:00.000Z');
    const last = raw
      .prepare(`SELECT id FROM movies_watches WHERE watched_at LIKE '2024%'`)
      .get() as { id: string };
    removeWatch(last.id);
    expect(watches(id)).toEqual(['2022-01-01T20:00:00.000Z']);
    expect(get(id).finishedAt).toBe('2022-01-01T20:00:00.000Z');
  });
});

describe('fecha del visionado', () => {
  it('apuntar uno de otro día lo deja con esa fecha y marca Vista', () => {
    const id = add();
    logWatch(id, '2025-03-14T12:00:00.000Z');
    expect(watches(id)).toEqual(['2025-03-14T12:00:00.000Z']);
    expect(get(id).status).toBe('completed');
    expect(get(id).finishedAt).toBe('2025-03-14T12:00:00.000Z');
  });

  it('cambiar la fecha del de hoy a una antigua recoloca "la última vez"', () => {
    const id = add();
    logWatch(id, '2022-01-01T20:00:00.000Z');
    logWatch(id);
    const todays = raw
      .prepare('SELECT id FROM movies_watches WHERE title_id = ? AND watched_at LIKE ?')
      .get(id, `${today()}%`) as { id: string };
    setWatchDate(todays.id, '2023-07-10T12:00:00.000Z');
    expect(watches(id)).toEqual(['2022-01-01T20:00:00.000Z', '2023-07-10T12:00:00.000Z']);
    expect(get(id).finishedAt).toBe('2023-07-10T12:00:00.000Z');
  });

  it('el día elegido en el calendario se guarda en ese mismo día', () => {
    const iso = pickedDayIso(new Date(2024, 0, 1));
    const back = new Date(iso);
    expect([back.getFullYear(), back.getMonth(), back.getDate()]).toEqual([2024, 0, 1]);
  });
});

describe('temporadas vistas', () => {
  const seasons = serializeSeasons([
    { season: 1, name: 'T1', episodes: 9, year: 2022 },
    { season: 2, name: 'T2', episodes: 10, year: 2025 },
    { season: 3, name: 'T3', episodes: 0, year: null }, // anunciada
  ]);
  const series = () => add({ kind: 'series', title: 'Separación', seasonsJson: seasons });

  it('una marcada no cambia el estado; todas las emitidas → Vista con visionado', () => {
    const id = series();
    toggleWatchedSeason(get(id), 1);
    expect(get(id).status).toBe('wishlist');
    expect(watches(id)).toHaveLength(0);

    toggleWatchedSeason(get(id), 2);
    expect(get(id).status).toBe('completed');
    expect(get(id).watchedSeasonsJson).toBe('[1,2]');
    expect(watches(id)).toHaveLength(1);
  });

  it('desmarcar una tras completarla vuelve a Deseada y quita el visionado de hoy', () => {
    const id = series();
    toggleWatchedSeason(get(id), 1);
    toggleWatchedSeason(get(id), 2);
    toggleWatchedSeason(get(id), 2);
    expect(get(id).status).toBe('wishlist');
    expect(get(id).finishedAt).toBeNull();
    expect(watches(id)).toHaveLength(0);
  });

  it('una serie abandonada sigue abandonada al marcar temporadas sueltas', () => {
    const id = add({ kind: 'series', status: 'dropped', seasonsJson: seasons });
    toggleWatchedSeason(get(id), 1);
    expect(get(id).status).toBe('dropped');
  });

  it('desmarcar todas deja una Deseada como Deseada', () => {
    const id = series();
    toggleWatchedSeason(get(id), 1);
    updateMovie(id, { status: 'wishlist' });
    toggleWatchedSeason(get(id), 1);
    expect(get(id).status).toBe('wishlist');
    expect(get(id).watchedSeasonsJson).toBeNull();
  });
});

describe('borrado lógico y tmdb_id', () => {
  it('softDelete oculta y restore devuelve, con su historial', () => {
    const id = add({ tmdbId: 1 });
    setStatus(id, 'completed');
    softDelete(id);
    expect(findByTmdbId(1)).toBeUndefined();
    restore(id);
    expect(findByTmdbId(1)?.id).toBe(id);
    expect(watches(id)).toHaveLength(1);
  });

  it('no deja dos títulos vivos con el mismo tmdb_id, pero sí tras borrar uno', () => {
    const id = add({ tmdbId: 7 });
    expect(() => add({ tmdbId: 7 })).toThrow();
    softDelete(id);
    expect(() => add({ tmdbId: 7 })).not.toThrow();
  });
});

describe('añadir desde TMDB a medias', () => {
  it('guarda el tipo que le digo (una recomendación de serie es una serie)', () => {
    addWishlistFromTmdb({
      kind: 'series',
      tmdbId: 99,
      title: 'The Bear',
      year: 2022,
      posterUrl: null,
      collectionId: null,
      collectionName: null,
    });
    const row = findByTmdbId(99)!;
    expect(row.kind).toBe('series');
    expect(row.status).toBe('wishlist');
    expect(isPartial(row)).toBe(true);
  });

  it('tmdbColumns la completa y deja de estar a medias sin tocar título ni estado', () => {
    const id = add({ tmdbId: 5, title: 'Mi título', status: 'dropped' });
    expect(isPartial(get(id))).toBe(true);
    updateMovie(
      id,
      tmdbColumns(
        {
          title: 'Otro',
          year: 2021,
          genres: 'Ciencia ficción',
          overview: 'Arena.',
          posterUrl: null,
          backdropUrl: null,
          runtimeMinutes: 155,
          totalSeasons: null,
          seasons: [],
          collectionId: 1,
          collectionName: 'Dune',
        },
        5,
      ),
    );
    const e = get(id);
    expect(e).toMatchObject({ title: 'Mi título', status: 'dropped', runtimeMinutes: 155, collectionName: 'Dune' });
    expect(isPartial(e)).toBe(false);
  });

  it('una fila con reseña mía no se considera a medias', () => {
    const id = add({ tmdbId: 6, notes: 'Me encantó' });
    expect(isPartial(get(id))).toBe(false);
  });
});

describe('lecturas puntuales', () => {
  it('randomWishlist: "Menos de 2 h" deja fuera lo que no tiene duración', () => {
    add({ title: 'Larga', runtimeMinutes: 180 });
    add({ title: 'Sin duración' });
    const corta = add({ title: 'Corta', runtimeMinutes: 90 });
    add({ title: 'Vista corta', runtimeMinutes: 80, status: 'completed' });
    for (let i = 0; i < 20; i++) expect(randomWishlist({ maxMinutes: 120 })?.id).toBe(corta);
  });

  it('randomWishlist por tipo y sin nada que encaje', () => {
    const s = add({ kind: 'series', title: 'Serie' });
    add({ title: 'Peli' });
    expect(randomWishlist({ kind: 'series' })?.id).toBe(s);
    softDelete(s);
    expect(randomWishlist({ kind: 'series' })).toBeUndefined();
  });

  it('recommendationSource cae en cascada', () => {
    expect(recommendationSource()).toBeUndefined();
    add({ title: 'Sin TMDB', rating: 10 });
    expect(recommendationSource()).toBeUndefined();

    const latest = add({ title: 'Última', tmdbId: 1 });
    expect(recommendationSource()).toEqual({ entry: expect.objectContaining({ id: latest }), liked: false });

    const meh = add({ title: 'Regular', tmdbId: 2 });
    setRating(meh, 6);
    expect(recommendationSource()).toEqual({ entry: expect.objectContaining({ id: meh }), liked: false });

    const fav = add({ title: 'Favorita', tmdbId: 3 });
    setRating(fav, 9);
    expect(recommendationSource()).toEqual({ entry: expect.objectContaining({ id: fav }), liked: true });
  });

  it('recommendationSource no cruza películas y series', () => {
    add({ title: 'Peli', tmdbId: 1, rating: 10 });
    const serie = add({ kind: 'series', title: 'Serie', tmdbId: 2, rating: 6 });
    expect(recommendationSource('series')?.entry.id).toBe(serie);
  });
});

describe('migración 26', () => {
  it('pasa lo que estaba En curso a Deseada, con su fecha y sus temporadas', () => {
    const id = add({ kind: 'series', status: 'watching', watchedSeasonsJson: '[1]' });
    const before = get(id).updatedAt;
    const vista = add({ status: 'completed' });

    raw.exec(MOVIES_MIGRATION_V6);

    expect(get(id).status).toBe('wishlist');
    expect(get(id).updatedAt > before).toBe(true);
    expect(get(id).watchedSeasonsJson).toBe('[1]');
    expect(get(vista).status).toBe('completed');
  });
});
