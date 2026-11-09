/**
 * Desglose de temporadas de una serie. Es INFORMACIÓN, no progreso: no hay
 * nada que marcar. Se guarda como JSON en `movies_titles.seasons_json` porque
 * viene gratis en la misma llamada de TMDB que rellena la ficha, y así se
 * pinta sin red y sin una tabla nueva.
 */
export type MovieSeason = {
  /** Número de temporada (1, 2, 3…). Los "Especiales" (0) se descartan antes. */
  season: number;
  name: string;
  /** Episodios que TMDB conoce. 0 = anunciada pero sin estrenar. */
  episodes: number;
  year: number | null;
};

export const serializeSeasons = (seasons: MovieSeason[]): string | null =>
  seasons.length > 0 ? JSON.stringify(seasons) : null;

function isSeason(v: unknown): v is MovieSeason {
  if (typeof v !== 'object' || v === null) return false;
  const s = v as Record<string, unknown>;
  return (
    typeof s.season === 'number' &&
    typeof s.name === 'string' &&
    typeof s.episodes === 'number' &&
    (typeof s.year === 'number' || s.year === null)
  );
}

/**
 * Lee la columna. Lo que hay en la BD pudo escribirlo una versión anterior de
 * la app, así que se valida fila a fila y cualquier cosa rara se ignora en
 * lugar de reventar la pantalla.
 */
export function parseSeasons(json: string | null): MovieSeason[] {
  if (!json) return [];
  try {
    const raw: unknown = JSON.parse(json);
    if (!Array.isArray(raw)) return [];
    return raw.filter(isSeason).sort((a, b) => a.season - b.season);
  } catch {
    return [];
  }
}

/** Solo las que se pueden ver ya. */
export const airedSeasons = (seasons: MovieSeason[]) => seasons.filter((s) => s.episodes > 0);

/**
 * Totales de la serie: episodios emitidos y, si sabemos cuánto dura uno,
 * minutos que cuesta verla entera.
 */
export function seasonsTotals(seasons: MovieSeason[], runtimeMinutes: number | null) {
  const episodes = airedSeasons(seasons).reduce((n, s) => n + s.episodes, 0);
  return { episodes, minutes: runtimeMinutes && episodes > 0 ? episodes * runtimeMinutes : null };
}

// ---------- Temporadas vistas ----------

/**
 * Números de temporada que ya he visto. Se guarda como JSON en
 * `watched_seasons`. Es seguimiento por TEMPORADA: un toque marca una entera,
 * que es el detalle que pedía la app sin caer en marcar episodios.
 */
export function parseWatchedSeasons(json: string | null): number[] {
  if (!json) return [];
  try {
    const raw: unknown = JSON.parse(json);
    if (!Array.isArray(raw)) return [];
    return [...new Set(raw.filter((n): n is number => typeof n === 'number' && Number.isFinite(n)))].sort(
      (a, b) => a - b,
    );
  } catch {
    return [];
  }
}

export const serializeWatchedSeasons = (seasons: number[]): string | null =>
  seasons.length > 0 ? JSON.stringify([...new Set(seasons)].sort((a, b) => a - b)) : null;

/** Añade o quita una temporada de la lista de vistas. */
export const toggleSeason = (watched: number[], season: number): number[] =>
  watched.includes(season) ? watched.filter((n) => n !== season) : [...watched, season];

/**
 * Minutos de las temporadas vistas. Si no hay ninguna marcada (datos de antes
 * de la v4, o una serie que no se ha ido marcando) cae a todas las emitidas,
 * para no perder horas que sí se vieron.
 */
export function watchedMinutes(
  seasons: MovieSeason[],
  watched: number[],
  runtimeMinutes: number | null,
): number {
  if (!runtimeMinutes) return 0;
  const aired = airedSeasons(seasons);
  const counted = watched.length > 0 ? aired.filter((s) => watched.includes(s.season)) : aired;
  return counted.reduce((n, s) => n + s.episodes, 0) * runtimeMinutes;
}
