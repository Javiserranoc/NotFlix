/** Valores guardados por nombre en SQLite: se pueden añadir, no renombrar. */
export const MOVIE_KINDS = ['movie', 'series'] as const;
export type MovieKind = (typeof MOVIE_KINDS)[number];

/** Lee un `kind` de los parámetros de una ruta. */
export const asKind = (value?: string): MovieKind | undefined => MOVIE_KINDS.find((k) => k === value);

/** `watching` ya no se ofrece, pero sigue aquí por la regla de no renombrar (la migración 26 lo vació). */
export const MOVIE_STATUSES = ['wishlist', 'watching', 'completed', 'dropped'] as const;
export type MovieStatus = (typeof MOVIE_STATUSES)[number];

/** Los estados que se pueden elegir y se enseñan. */
export const STATUS_CHOICES = ['wishlist', 'completed', 'dropped'] as const satisfies readonly MovieStatus[];

export const KIND_META: Record<MovieKind, { label: string; plural: string; icon: string }> = {
  movie: { label: 'Película', plural: 'Películas', icon: 'movie-open' },
  series: { label: 'Serie', plural: 'Series', icon: 'television-classic' },
};

export const STATUS_META: Record<MovieStatus, { label: string; color: string; icon: string }> = {
  wishlist: { label: 'Deseada', color: '#F2B233', icon: 'bookmark' },
  watching: { label: 'En curso', color: '#4FA3FF', icon: 'play-circle' },
  completed: { label: 'Vista', color: '#3CCB7F', icon: 'check-circle' },
  dropped: { label: 'Abandonada', color: '#8E8A93', icon: 'close-circle' },
};
