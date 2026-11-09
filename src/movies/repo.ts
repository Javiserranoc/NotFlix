import { and, asc, count, desc, eq, inArray, isNotNull, isNull, like, lte, type SQL, sql } from 'drizzle-orm';
import { useMemo } from 'react';

import { db } from '../core/db/client';
import { nowIso, uuidv7 } from '../core/db/sync';
import { useLiveQuery } from '../core/db/useLiveQuery';
import { matchesText } from '../core/text';
import { MOVIE_STATUSES, type MovieKind, type MovieStatus } from './enums';
import {
  airedSeasons,
  parseSeasons,
  parseWatchedSeasons,
  serializeSeasons,
  serializeWatchedSeasons,
  toggleSeason,
} from './seasons';
import { type MovieEntry, moviesTitles as t, moviesWatches as w, type NewMovie } from './schema';
import type { TmdbDetails } from './tmdb';

/** Criterios de orden de la biblioteca. El valor se guarda solo en la UI. */
export const MOVIE_SORTS = ['recent', 'rating', 'year', 'title'] as const;
export type MovieSort = (typeof MOVIE_SORTS)[number];
export const SORT_LABEL: Record<MovieSort, string> = {
  recent: 'Lo último',
  rating: 'Mejor nota',
  year: 'Más reciente',
  title: 'A-Z',
};

export type MoviesFilter = { status?: MovieStatus; kind?: MovieKind; query?: string; sort?: MovieSort };

// ---------- Lecturas reactivas (hooks) ----------

export function useMovies(f: MoviesFilter): MovieEntry[] {
  const conds: SQL[] = [isNull(t.deletedAt)];
  if (f.status) conds.push(eq(t.status, f.status));
  if (f.kind) conds.push(eq(t.kind, f.kind));
  const q = f.query?.trim() ?? '';

  // En SQLite los NULL son los más pequeños, así que con DESC las pelis sin
  // nota y sin año caen al final solas, que es lo que se espera.
  const order =
    f.sort === 'rating'
      ? desc(t.rating)
      : f.sort === 'year'
        ? desc(t.year)
        : f.sort === 'title'
          ? asc(sql`lower(${t.title})`)
          : desc(t.updatedAt);

  const { data } = useLiveQuery(db.select().from(t).where(and(...conds)).orderBy(order), [f.status, f.kind, f.sort]);
  // El texto se filtra aquí y no con LIKE: SQLite solo ignora mayúsculas en
  // ASCII, y "amelie" tiene que encontrar "Amélie". Son cientos de filas, no
  // millones, así que en JS sobra.
  return useMemo(() => (data ?? []).filter((e) => !q || matchesText(e.title, q)), [data, q]);
}

export function useMovie(id: string): MovieEntry | undefined {
  const { data } = useLiveQuery(db.select().from(t).where(eq(t.id, id)).limit(1), [id]);
  return data?.[0];
}

/** Recuento por estado, de un tipo o de todo. */
export function useMovieCounts(kind?: MovieKind): Record<MovieStatus, number> {
  const { data } = useLiveQuery(
    db
      .select({ status: t.status, n: count() })
      .from(t)
      .where(and(isNull(t.deletedAt), kind ? eq(t.kind, kind) : undefined))
      .groupBy(t.status),
    [kind],
  );
  return useMemo(() => {
    const out = Object.fromEntries(MOVIE_STATUSES.map((s) => [s, 0])) as Record<MovieStatus, number>;
    for (const row of data ?? []) out[row.status] = row.n;
    return out;
  }, [data]);
}

/** Lo último que he visto de un tipo, para el inicio. */
export function useRecentlyWatched(kind: MovieKind, limit = 3): MovieEntry[] {
  const { data } = useLiveQuery(
    db
      .select()
      .from(t)
      .where(and(isNull(t.deletedAt), eq(t.status, 'completed'), eq(t.kind, kind)))
      .orderBy(desc(t.finishedAt))
      .limit(limit),
    [kind, limit],
  );
  return data ?? [];
}

/** Lo que quiero ver, lo más reciente primero. Sin `kind`, de todo (la ruleta). */
export function useWishlist(limit = 12, kind?: MovieKind): MovieEntry[] {
  const { data } = useLiveQuery(
    db
      .select()
      .from(t)
      .where(and(isNull(t.deletedAt), eq(t.status, 'wishlist'), kind ? eq(t.kind, kind) : undefined))
      .orderBy(desc(t.updatedAt))
      .limit(limit),
    [limit, kind],
  );
  return data ?? [];
}

export function randomWishlist(filter: { kind?: MovieKind; maxMinutes?: number } = {}): MovieEntry | undefined {
  const conds: SQL[] = [isNull(t.deletedAt), eq(t.status, 'wishlist')];
  if (filter.kind) conds.push(eq(t.kind, filter.kind));
  // Con "tengo hora y media" solo entran las que sabemos que caben.
  if (filter.maxMinutes) conds.push(lte(t.runtimeMinutes, filter.maxMinutes));
  return db.select().from(t).where(and(...conds)).orderBy(sql`random()`).limit(1).all()[0];
}

/**
 * De donde salen las recomendaciones del inicio. Antes hacia falta tener algo
 * puntuado con 8 o mas y la fila no aparecia casi nunca; ahora cae en cascada:
 * lo mejor puntuado -> cualquier cosa puntuada -> lo ultimo que anadiste, con
 * tal de que venga de TMDB. `liked` dice si el titulo se eligio por su nota,
 * que es lo que cambia el rotulo de la fila.
 *
 * Lectura puntual a proposito: la fila no debe cambiar sola mientras miras el
 * inicio.
 */
export function recommendationSource(kind?: MovieKind): { entry: MovieEntry; liked: boolean } | undefined {
  const ofKind = kind ? eq(t.kind, kind) : undefined;
  const rated = db
    .select()
    .from(t)
    .where(and(isNull(t.deletedAt), isNotNull(t.rating), isNotNull(t.tmdbId), ofKind))
    .orderBy(desc(t.rating), desc(t.updatedAt))
    .limit(1)
    .all()[0];
  if (rated) return { entry: rated, liked: (rated.rating ?? 0) >= 8 };

  const latest = db
    .select()
    .from(t)
    .where(and(isNull(t.deletedAt), isNotNull(t.tmdbId), ofKind))
    .orderBy(desc(t.updatedAt))
    .limit(1)
    .all()[0];
  return latest ? { entry: latest, liked: false } : undefined;
}

/**
 * ¿Ya tengo este título de TMDB? Lo consulto antes de rellenar el formulario,
 * porque el índice único parcial de `tmdb_id` rechazaría el insert.
 */
export function findByTmdbId(tmdbId: number): MovieEntry | undefined {
  return db
    .select()
    .from(t)
    .where(and(isNull(t.deletedAt), eq(t.tmdbId, tmdbId)))
    .limit(1)
    .all()[0];
}

// ---------- Escrituras (síncronas; updatedAt se renueva vía $onUpdateFn) ----------

export function insertMovie(values: NewMovie) {
  db.insert(t).values(values).run();
}

/**
 * Igual que insertMovie, pero genera el id aqui y lo devuelve, para poder
 * navegar a la ficha del titulo recien creado. sql.js es
 * sincrono, asi que no hace falta esperar nada.
 */
export function insertMovieReturningId(values: Omit<NewMovie, 'id'>): string {
  const id = uuidv7();
  db.insert(t).values({ ...values, id }).run();
  return id;
}

export function updateMovie(id: string, changes: Partial<NewMovie>) {
  db.update(t).set(changes).where(eq(t.id, id)).run();
}

/**
 * Cambia el estado y mantiene el historial al día. Volver a pulsar el estado
 * que ya tiene no hace nada: si no, tocar "Vista" en algo visto el año pasado
 * apuntaría un visionado de hoy.
 */
export function setStatus(id: string, status: MovieStatus, previous?: MovieStatus) {
  if (status === previous) return;
  const at = nowIso();
  updateMovie(id, { status, finishedAt: status === 'completed' ? at : null });
  // Marcar Vista deja constancia en el historial; volver atras borra la de hoy.
  if (status === 'completed') logWatchOncePerDay(id, at);
  else removeTodaysWatch(id);
}

/**
 * "Lo he vuelto a ver": apunta otro visionado aunque ya haya uno hoy. Marcar
 * el estado usa `logWatchOncePerDay`, que no duplica al toquetearlo.
 * `finished_at` queda en el más reciente, no en el que acabas de apuntar.
 */
export function logWatch(titleId: string, watchedAt = nowIso()) {
  db.insert(w).values({ titleId, watchedAt }).run();
  updateMovie(titleId, { status: 'completed', finishedAt: latestWatch(titleId) ?? watchedAt });
}

/** Fecha del visionado más reciente que queda vivo, o null. */
function latestWatch(titleId: string): string | null {
  const row = db
    .select({ at: w.watchedAt })
    .from(w)
    .where(and(isNull(w.deletedAt), eq(w.titleId, titleId)))
    .orderBy(desc(w.watchedAt))
    .limit(1)
    .all()[0];
  return row?.at ?? null;
}

function logWatchOncePerDay(titleId: string, at: string) {
  const day = at.slice(0, 10);
  const existing = db
    .select()
    .from(w)
    .where(and(isNull(w.deletedAt), eq(w.titleId, titleId), like(w.watchedAt, `${day}%`)))
    .limit(1)
    .all();
  if (existing.length === 0) db.insert(w).values({ titleId, watchedAt: at }).run();
}

function removeTodaysWatch(titleId: string) {
  const day = nowIso().slice(0, 10);
  db.update(w)
    .set({ deletedAt: nowIso() })
    .where(and(isNull(w.deletedAt), eq(w.titleId, titleId), like(w.watchedAt, `${day}%`)))
    .run();
}

/**
 * Borrado logico de un visionado suelto. `finished_at` del titulo se recoloca
 * en el visionado mas reciente que quede, para que "la ultima vez" no se quede
 * apuntando a una fecha que ya no existe.
 */
export const removeWatch = (id: string) => changeWatch(id, { deletedAt: nowIso() });

/**
 * Cambia la fecha de un visionado ya apuntado (marcaste Vista hoy, pero la
 * viste en el cine en marzo).
 */
export const setWatchDate = (id: string, watchedAt: string) => changeWatch(id, { watchedAt });

/** Cambia un visionado y recoloca `finished_at` del título en el más reciente que quede. */
function changeWatch(id: string, changes: Pick<Partial<typeof w.$inferInsert>, 'watchedAt' | 'deletedAt'>) {
  const row = db.select({ titleId: w.titleId }).from(w).where(eq(w.id, id)).get();
  if (!row) return;
  db.update(w).set(changes).where(eq(w.id, id)).run();
  updateMovie(row.titleId, { finishedAt: latestWatch(row.titleId) });
}

/** El historial de un titulo, de lo mas reciente a lo mas antiguo. */
export function useWatches(titleId: string) {
  const { data } = useLiveQuery(
    db
      .select()
      .from(w)
      .where(and(isNull(w.deletedAt), eq(w.titleId, titleId)))
      .orderBy(desc(w.watchedAt)),
    [titleId],
  );
  return data ?? [];
}

/**
 * Todos los visionados con los datos de su titulo. Es la base de las
 * estadisticas: cuenta veces vistas, no titulos distintos.
 */
export function useWatchLog() {
  const { data } = useLiveQuery(
    db
      .select({ watchId: w.id, watchedAt: w.watchedAt, title: t })
      .from(w)
      .innerJoin(t, eq(w.titleId, t.id))
      .where(and(isNull(w.deletedAt), isNull(t.deletedAt)))
      .orderBy(desc(w.watchedAt)),
  );
  return data ?? [];
}

export function setRating(id: string, rating: number | null) {
  updateMovie(id, { rating });
}

/**
 * Marca o desmarca una temporada entera y ajusta el estado solo: todas las
 * emitidas -> Vista; si deja de tenerlas todas, una Vista vuelve a Deseada. A
 * medias no cambia nada: una serie abandonada sigue abandonada con lo que viste.
 */
export function toggleWatchedSeason(e: MovieEntry, season: number) {
  const watched = toggleSeason(parseWatchedSeasons(e.watchedSeasonsJson), season);
  const aired = airedSeasons(parseSeasons(e.seasonsJson));
  const allSeen = aired.length > 0 && aired.every((s) => watched.includes(s.season));

  const status: MovieStatus = allSeen ? 'completed' : e.status === 'completed' ? 'wishlist' : e.status;

  const at = nowIso();
  updateMovie(e.id, {
    watchedSeasonsJson: serializeWatchedSeasons(watched),
    status,
    finishedAt: status === 'completed' ? (e.finishedAt ?? at) : null,
  });
  if (status === 'completed' && e.status !== 'completed') logWatchOncePerDay(e.id, at);
  // Igual que setStatus: si deja de estar Vista, el visionado de hoy se va.
  if (status !== 'completed' && e.status === 'completed') removeTodaysWatch(e.id);
}

/**
 * Añade a la lista de deseadas algo de TMDB (una parte de una saga o una
 * recomendación) con lo poco que trae la lista. Queda a medias a propósito
 * (sin duración ni géneros) para que el toque sea inmediato: la ficha la
 * completa sola al abrirla (`isPartial`).
 */
export function addWishlistFromTmdb(values: {
  kind: MovieKind;
  tmdbId: number;
  title: string;
  year: number | null;
  posterUrl: string | null;
  collectionId: number | null;
  collectionName: string | null;
}) {
  insertMovie({
    kind: values.kind,
    status: 'wishlist',
    title: values.title,
    year: values.year,
    posterUrl: values.posterUrl,
    tmdbId: values.tmdbId,
    collectionId: values.collectionId,
    collectionName: values.collectionName,
    tmdbSyncedAt: nowIso(),
  });
}

/**
 * Lo que una ficha de TMDB rellena en `movies_titles`. Un solo sitio para que
 * añadir desde la búsqueda y completar una fila a medias guarden lo mismo.
 */
export function tmdbColumns(d: TmdbDetails, tmdbId: number) {
  return {
    year: d.year,
    genres: d.genres,
    posterUrl: d.posterUrl,
    backdropUrl: d.backdropUrl,
    overview: d.overview,
    runtimeMinutes: d.runtimeMinutes,
    totalSeasons: d.totalSeasons,
    seasonsJson: serializeSeasons(d.seasons),
    collectionId: d.collectionId,
    collectionName: d.collectionName,
    tmdbId,
    tmdbSyncedAt: nowIso(),
  } satisfies Partial<NewMovie>;
}

/**
 * Fila "a medias": la dejó un toque en la saga o en las recomendaciones, con
 * solo título, año y póster. No tiene nada que hayas escrito tú, así que al
 * abrirla se puede completar desde TMDB sin pisar nada.
 */
export const isPartial = (e: MovieEntry) =>
  e.tmdbId != null && !e.genres && !e.overview && e.runtimeMinutes == null && !e.notes;

/** Los títulos de una saga que ya tengo, por su id de TMDB. */
export function findByTmdbIds(ids: number[]): MovieEntry[] {
  if (ids.length === 0) return [];
  return db
    .select()
    .from(t)
    .where(and(isNull(t.deletedAt), inArray(t.tmdbId, ids)))
    .all();
}

export function softDelete(id: string) {
  updateMovie(id, { deletedAt: nowIso() });
}

export function restore(id: string) {
  updateMovie(id, { deletedAt: null });
}
