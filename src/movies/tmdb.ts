/**
 * Cliente de TMDB. Solo AUTOCOMPLETA: lo que se elige aquí se copia a
 * `movies_titles` al guardar y la respuesta se tira. No se cachean búsquedas
 * ni se guarda su JSON, así que la app entera funciona sin red y nada de
 * fuera pisa lo que escribes.
 *
 * La key es gratuita (themoviedb.org → ajustes → API) y se pega en Ajustes,
 * que la guarda en este dispositivo (`core/settings.ts`).
 *
 * Límites: el viejo tope de 40 peticiones / 10 s se retiró en 2019. Hoy TMDB
 * habla de "unas 40 por segundo" y no publica cuota diaria, así que con el
 * debounce de useTmdbSearch sobra. Igualmente se trata el 429.
 */

import { getSetting, useSetting } from '../core/settings';
import { byText } from '../core/text';
import type { MovieSeason } from './seasons';

/**
 * false = no hay key: la búsqueda se oculta y el alta manual sigue igual. Se
 * repinta en cuanto se guarda la key en Ajustes.
 */
export const useTmdbEnabled = () => useSetting('tmdbKey').length > 0;

const API = 'https://api.themoviedb.org/3';
const IMG = 'https://image.tmdb.org/t/p';
const LANG = 'es-ES';

export const posterUrl = (path?: string | null) => (path ? `${IMG}/w500${path}` : null);
export const backdropUrl = (path?: string | null) => (path ? `${IMG}/w780${path}` : null);

/** Error con mensaje ya listo para enseñar en la UI. */
export class TmdbError extends Error {}

async function get<T>(
  path: string,
  params: Record<string, string>,
  signal?: AbortSignal,
  key = getSetting('tmdbKey'),
): Promise<T> {
  if (!key) throw new TmdbError('Falta la API key de TMDB (ponla en Ajustes)');
  const qs = new URLSearchParams({ api_key: key, language: LANG, ...params });
  let res: Response;
  try {
    res = await fetch(`${API}${path}?${qs}`, { signal });
  } catch (e) {
    if (e instanceof Error && e.name === 'AbortError') throw e;
    throw new TmdbError('Sin conexión con TMDB');
  }
  if (!res.ok) {
    if (res.status === 401) throw new TmdbError('La API key de TMDB no es válida');
    if (res.status === 404) throw new TmdbError('TMDB no encuentra ese título');
    if (res.status === 429) throw new TmdbError('TMDB está limitando las peticiones; prueba en unos segundos');
    throw new TmdbError(`TMDB ha respondido ${res.status}`);
  }
  return (await res.json()) as T;
}

// ---------- Búsqueda ----------

export type TmdbHit = {
  tmdbId: number;
  kind: 'movie' | 'series';
  /** Título en español si TMDB lo tiene traducido. */
  title: string;
  /** Original, solo si es distinto del anterior ("Separación" → "Severance"). */
  originalTitle: string | null;
  year: number | null;
  posterUrl: string | null;
};

type MultiResult = {
  id: number;
  media_type: 'movie' | 'tv' | 'person';
  title?: string;
  name?: string;
  original_title?: string;
  original_name?: string;
  release_date?: string;
  first_air_date?: string;
  poster_path?: string | null;
};

const yearOf = (date?: string) => {
  const y = parseInt((date ?? '').slice(0, 4), 10);
  return Number.isFinite(y) ? y : null;
};

/** Pelis y series que coinciden con el texto. Las personas se descartan. */
export async function searchTitles(query: string, signal?: AbortSignal): Promise<TmdbHit[]> {
  const { results } = await get<{ results: MultiResult[] }>(
    '/search/multi',
    { query, include_adult: 'false' },
    signal,
  );
  return results
    .filter((r) => r.media_type === 'movie' || r.media_type === 'tv')
    .slice(0, 8)
    .map((r) => {
      const title = (r.title ?? r.name ?? '').trim();
      const original = (r.original_title ?? r.original_name ?? '').trim();
      return {
        tmdbId: r.id,
        kind: r.media_type === 'tv' ? ('series' as const) : ('movie' as const),
        title,
        originalTitle: original && original !== title ? original : null,
        year: yearOf(r.release_date ?? r.first_air_date),
        posterUrl: posterUrl(r.poster_path),
      };
    })
    .filter((h) => h.title.length > 0);
}

// ---------- Ficha completa ----------

export type TmdbDetails = {
  title: string;
  year: number | null;
  genres: string;
  overview: string;
  posterUrl: string | null;
  backdropUrl: string | null;
  runtimeMinutes: number | null;
  /** Solo series: temporadas ya emitidas (informativo, no es progreso). */
  totalSeasons: number | null;
  /** Solo series: desglose, incluida la anunciada sin estrenar. */
  seasons: MovieSeason[];
  /** Solo películas: saga a la que pertenece, si TMDB la tiene. */
  collectionId: number | null;
  collectionName: string | null;
};

type DetailsResponse = {
  title?: string;
  name?: string;
  release_date?: string;
  first_air_date?: string;
  overview?: string;
  poster_path?: string | null;
  backdrop_path?: string | null;
  genres?: { id: number; name: string }[];
  runtime?: number | null;
  episode_run_time?: number[];
  last_episode_to_air?: { runtime?: number | null } | null;
  number_of_seasons?: number;
  belongs_to_collection?: { id?: number; name?: string } | null;
  seasons?: {
    season_number?: number;
    name?: string;
    episode_count?: number;
    air_date?: string | null;
  }[];
};

/**
 * Datos para rellenar el formulario. En series la duración es la de un
 * episodio, que es lo que sirve para sumar horas.
 */
export async function fetchDetails(
  kind: 'movie' | 'series',
  tmdbId: number,
  signal?: AbortSignal,
): Promise<TmdbDetails> {
  const path = kind === 'series' ? `/tv/${tmdbId}` : `/movie/${tmdbId}`;
  const d = await get<DetailsResponse>(path, {}, signal);

  // Muchas fichas no están traducidas: si no hay sinopsis en español, la pido en inglés.
  let overview = (d.overview ?? '').trim();
  if (!overview) {
    try {
      const en = await get<DetailsResponse>(path, { language: 'en-US' }, signal);
      overview = (en.overview ?? '').trim();
    } catch (e) {
      if (e instanceof Error && e.name === 'AbortError') throw e;
      // La sinopsis es opcional: si falla, se queda vacía.
    }
  }

  // En las series `episode_run_time` viene vacío casi siempre (comprobado con
  // Separación, Breaking Bad y Arcane): la duración real está en el último
  // episodio emitido.
  const runtime =
    kind === 'series' ? (d.episode_run_time?.[0] ?? d.last_episode_to_air?.runtime ?? null) : d.runtime;

  // La temporada 0 son los "Especiales": fuera. Las anunciadas sin estrenar
  // (0 episodios) sí entran, para poder decir "sin estrenar" en la ficha.
  const seasons: MovieSeason[] =
    kind === 'series'
      ? (d.seasons ?? [])
          .filter((x) => typeof x.season_number === 'number' && x.season_number > 0)
          .map((x) => ({
            season: x.season_number as number,
            name: (x.name ?? '').trim() || `Temporada ${x.season_number}`,
            episodes: x.episode_count ?? 0,
            year: yearOf(x.air_date ?? undefined),
          }))
          .sort((a, b) => a.season - b.season)
      : [];

  // `number_of_seasons` cuenta también las anunciadas que aún no existen
  // (Separación decía 3 con la T3 a 0 episodios), así que cuento las emitidas.
  const aired = seasons.filter((x) => x.episodes > 0).length;

  return {
    title: (d.title ?? d.name ?? '').trim(),
    year: yearOf(d.release_date ?? d.first_air_date),
    genres: (d.genres ?? []).map((g) => g.name).join(', '),
    overview,
    posterUrl: posterUrl(d.poster_path),
    backdropUrl: backdropUrl(d.backdrop_path),
    runtimeMinutes: runtime && runtime > 0 ? runtime : null,
    totalSeasons: kind === 'series' ? (aired || d.number_of_seasons || null) : null,
    seasons,
    collectionId: d.belongs_to_collection?.id ?? null,
    collectionName: (d.belongs_to_collection?.name ?? '').trim() || null,
  };
}

// ---------- Sagas (colecciones) ----------

export type TmdbCollectionPart = {
  tmdbId: number;
  title: string;
  year: number | null;
  posterUrl: string | null;
  /** Sin fecha o con fecha futura: aún no se puede ver. */
  released: boolean;
};

export type TmdbCollection = { id: number; name: string; parts: TmdbCollectionPart[] };

/**
 * Las partes de una saga, en orden de estreno. Se pide al abrir la ficha y NO
 * se guarda: una saga crece con el tiempo (Dune ya lista la parte de 2026), y
 * un caché nuestro se quedaría viejo. Sin red, la ficha se pinta igual y este
 * bloque simplemente no aparece.
 */
export async function fetchCollection(id: number, signal?: AbortSignal): Promise<TmdbCollection> {
  const d = await get<{ id: number; name?: string; parts?: MultiResult[] }>(`/collection/${id}`, {}, signal);
  const today = new Date().toISOString().slice(0, 10);
  const parts = (d.parts ?? [])
    .map((p) => {
      const date = p.release_date ?? '';
      return {
        tmdbId: p.id,
        title: (p.title ?? p.name ?? '').trim(),
        year: yearOf(date),
        posterUrl: posterUrl(p.poster_path),
        released: date !== '' && date <= today,
        date,
      };
    })
    .filter((p) => p.title.length > 0)
    .sort((a, b) => byText(a.date || '9999', b.date || '9999'))
    .map(({ date: _date, ...p }) => p);

  return { id: d.id, name: (d.name ?? '').trim(), parts };
}

// ---------- Recomendaciones ----------

/**
 * "Porque te gusto X": lo que TMDB considera parecido a un titulo. No usa LLM
 * ni nada nuestro, es su propia lista. Se pide al vuelo y no se guarda.
 *
 * `media_type` no siempre viene en esta respuesta, asi que el tipo se hereda
 * del titulo que preguntamos.
 */
export async function fetchRecommendations(
  kind: 'movie' | 'series',
  tmdbId: number,
  signal?: AbortSignal,
): Promise<TmdbHit[]> {
  const path = kind === 'series' ? `/tv/${tmdbId}/recommendations` : `/movie/${tmdbId}/recommendations`;
  const { results } = await get<{ results: MultiResult[] }>(path, {}, signal);
  return results
    .filter((r) => r.media_type !== 'person')
    .slice(0, 12)
    .map((r) => {
      const title = (r.title ?? r.name ?? '').trim();
      const original = (r.original_title ?? r.original_name ?? '').trim();
      return {
        tmdbId: r.id,
        kind: r.media_type === 'tv' ? ('series' as const) : r.media_type === 'movie' ? ('movie' as const) : kind,
        title,
        originalTitle: original && original !== title ? original : null,
        year: yearOf(r.release_date ?? r.first_air_date),
        posterUrl: posterUrl(r.poster_path),
      };
    })
    .filter((h) => h.title.length > 0 && h.posterUrl !== null);
}

// ---------- Ajustes ----------

/**
 * Prueba una key antes de guardarla (`/configuration` es la llamada más
 * barata). Devuelve null si vale o el motivo, ya en español.
 */
export async function checkTmdbKey(key: string): Promise<string | null> {
  try {
    await get('/configuration', {}, undefined, key.trim());
    return null;
  } catch (e) {
    return e instanceof TmdbError ? e.message : 'No se pudo comprobar la key';
  }
}
