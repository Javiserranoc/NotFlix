import { index, integer, real, sqliteTable, text } from 'drizzle-orm/sqlite-core';

import { SYNC_COLUMNS_SQL, syncColumns } from '../core/db/sync';
import { MOVIE_KINDS, MOVIE_STATUSES } from './enums';

/**
 * Convención: prefijo `movies_`.
 *
 * Es una biblioteca de opinión, no un tracker: se apunta lo visto con su nota
 * y su reseña, y lo que se quiere ver. Deliberadamente NO hay seguimiento por
 * episodio (`season`/`episode`/`total_episodes` existieron en la v1 y las
 * borra la v2). `total_seasons` es solo informativo, para la ficha.
 *
 * Los campos de TMDB (`tmdbId`, `runtimeMinutes`, `backdropUrl`, `overview`)
 * son una COPIA hecha al guardar: TMDB autocompleta, no es la fuente de datos.
 * Así la app funciona sin red y nada de fuera pisa lo que escribes.
 */
export const moviesTitles = sqliteTable(
  'movies_titles',
  {
    ...syncColumns(),
    kind: text('kind', { enum: MOVIE_KINDS }).notNull(),
    title: text('title').notNull(),
    year: integer('year'),
    status: text('status', { enum: MOVIE_STATUSES }).notNull(),
    /** 1–10; null = sin nota */
    rating: real('rating'),
    posterUrl: text('poster_url'),
    genres: text('genres').notNull().default(''),
    /** Mi reseña. */
    notes: text('notes').notNull().default(''),
    finishedAt: text('finished_at'),
    // --- v2: TMDB ---
    /** Id en TMDB. Único entre los vivos: evita duplicar un título. */
    tmdbId: integer('tmdb_id'),
    /** Duración de la peli, o de un episodio en series. Para "horas vistas". */
    runtimeMinutes: integer('runtime_minutes'),
    backdropUrl: text('backdrop_url'),
    overview: text('overview').notNull().default(''),
    /** Informativo ("3 temporadas"), no es progreso. */
    totalSeasons: integer('total_seasons'),
    /** Última vez que se trajeron datos de TMDB. */
    tmdbSyncedAt: text('tmdb_synced_at'),
    // --- v3 ---
    /**
     * Desglose de temporadas como JSON (`MovieSeason[]` de seasons.ts). Es
     * información, no progreso: viene gratis en la llamada de la ficha de TMDB
     * y se guarda para poder pintarla sin red. Se lee siempre con
     * `parseSeasons`, que tolera cualquier basura.
     */
    seasonsJson: text('seasons_json'),
    // --- v4 ---
    /**
     * Temporadas que ya he visto, como JSON `number[]` (ver seasons.ts). Es
     * seguimiento por TEMPORADA, no por episodio: un toque marca una entera.
     */
    watchedSeasonsJson: text('watched_seasons'),
    /** Saga de TMDB (`belongs_to_collection`): permite "¿y la siguiente?". */
    collectionId: integer('collection_id'),
    collectionName: text('collection_name'),
  },
  (t) => [index('movies_titles_status_idx').on(t.status, t.deletedAt)],
);

/**
 * Un visionado. Una peli vista tres veces son tres filas aqui, asi que las
 * estadisticas cuentan veces vistas y no titulos distintos.
 *
 * `finished_at` de movies_titles se queda como "la ultima vez", que es lo que
 * usan la lista y el orden; el historial vive aqui.
 */
export const moviesWatches = sqliteTable(
  'movies_watches',
  {
    ...syncColumns(),
    titleId: text('title_id').notNull(),
    /** Fecha ISO del visionado. */
    watchedAt: text('watched_at').notNull(),
  },
  (t) => [index('movies_watches_title_idx').on(t.titleId, t.deletedAt)],
);

export type MovieWatch = typeof moviesWatches.$inferSelect;

export type MovieEntry = typeof moviesTitles.$inferSelect;
export type NewMovie = typeof moviesTitles.$inferInsert;

/**
 * Migraciones (se registran en core/db/migrations.ts).
 * NUNCA se edita una que ya se haya ejecutado en un dispositivo: solo se añaden.
 */
export const MOVIES_MIGRATION_V1 = `
CREATE TABLE IF NOT EXISTS movies_titles (${SYNC_COLUMNS_SQL},
  kind            TEXT NOT NULL,
  title           TEXT NOT NULL,
  year            INTEGER,
  status          TEXT NOT NULL,
  rating          REAL,
  poster_url      TEXT,
  genres          TEXT NOT NULL DEFAULT '',
  notes           TEXT NOT NULL DEFAULT '',
  season          INTEGER,
  episode         INTEGER,
  total_episodes  INTEGER,
  finished_at     TEXT
);
CREATE INDEX IF NOT EXISTS movies_titles_status_idx ON movies_titles (status, deleted_at);`;

/**
 * v2: se descarta el seguimiento por episodio y entran los campos de TMDB.
 * DROP COLUMN existe en SQLite desde 3.35 y ninguna de las tres columnas
 * aparece en un índice, así que se puede.
 */
export const MOVIES_MIGRATION_V2 = `
ALTER TABLE movies_titles DROP COLUMN season;
ALTER TABLE movies_titles DROP COLUMN episode;
ALTER TABLE movies_titles DROP COLUMN total_episodes;
ALTER TABLE movies_titles ADD COLUMN tmdb_id         INTEGER;
ALTER TABLE movies_titles ADD COLUMN runtime_minutes INTEGER;
ALTER TABLE movies_titles ADD COLUMN backdrop_url    TEXT;
ALTER TABLE movies_titles ADD COLUMN overview        TEXT NOT NULL DEFAULT '';
ALTER TABLE movies_titles ADD COLUMN total_seasons   INTEGER;
ALTER TABLE movies_titles ADD COLUMN tmdb_synced_at  TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS movies_titles_tmdb_idx
  ON movies_titles (tmdb_id) WHERE tmdb_id IS NOT NULL AND deleted_at IS NULL;`;

/** v3: desglose de temporadas de las series (solo informativo). */
export const MOVIES_MIGRATION_V3 = `
ALTER TABLE movies_titles ADD COLUMN seasons_json TEXT;`;

/** v4: temporadas vistas (por temporada, no por episodio) y saga. */
export const MOVIES_MIGRATION_V4 = `
ALTER TABLE movies_titles ADD COLUMN watched_seasons TEXT;
ALTER TABLE movies_titles ADD COLUMN collection_id   INTEGER;
ALTER TABLE movies_titles ADD COLUMN collection_name TEXT;`;

/**
 * v5: historial de visionados, para poder ver algo mas de una vez.
 *
 * Rellena la tabla con lo que ya habia: un visionado por cada titulo Vista con
 * fecha. Los ids se generan aqui con forma de UUID v7 (nibble de version 7 y
 * variante 8/9/a/b) porque en SQL no tenemos uuidv7(); el orden temporal de
 * esos bits no importa en filas historicas, pero la forma si, para que el dia
 * que sincronicemos no haya un id con otro formato.
 */
export const MOVIES_MIGRATION_V5 = `
CREATE TABLE IF NOT EXISTS movies_watches (${SYNC_COLUMNS_SQL},
  title_id    TEXT NOT NULL,
  watched_at  TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS movies_watches_title_idx ON movies_watches (title_id, deleted_at);
INSERT INTO movies_watches (id, created_at, updated_at, title_id, watched_at)
SELECT
  lower(hex(randomblob(4))) || '-' ||
  lower(hex(randomblob(2))) || '-7' ||
  substr(lower(hex(randomblob(2))), 2) || '-' ||
  substr('89ab', abs(random()) % 4 + 1, 1) || substr(lower(hex(randomblob(2))), 2) || '-' ||
  lower(hex(randomblob(6))),
  finished_at, finished_at, id, finished_at
FROM movies_titles
WHERE status = 'completed' AND finished_at IS NOT NULL AND deleted_at IS NULL;`;

/**
 * v6: desaparece "En curso". Lo que lo tenía aún no se ha terminado, así que
 * vuelve a Deseada; las temporadas marcadas de una serie se conservan.
 */
export const MOVIES_MIGRATION_V6 = `
UPDATE movies_titles
SET status = 'wishlist', updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
WHERE status = 'watching';`;
