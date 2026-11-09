/**
 * Títulos como texto para compartir con amigos: título, año, si es serie y mi
 * nota. Nunca la reseña.
 */
import { shareList } from '../core/share';
import type { MovieKind, MovieStatus } from './enums';
import type { MovieEntry } from './schema';

const STATUS_TITLE: Record<MovieStatus, string> = {
  wishlist: 'Quiero ver',
  watching: 'Quiero ver', // ya no se ofrece: la migración 26 lo pasó a Deseada
  completed: 'Vistas',
  dropped: 'Abandonadas',
};

/** "Separación (2022, serie) · 9/10" */
export function movieLine(m: MovieEntry): string {
  const bits = [m.year, m.kind === 'series' ? 'serie' : null].filter((x) => x != null);
  const meta = bits.length > 0 ? ` (${bits.join(', ')})` : '';
  return `${m.title}${meta}${m.rating ? ` · ${m.rating}/10` : ''}`;
}

/** Cabecera según los filtros de la Biblioteca. */
export function moviesShareTitle(status?: MovieStatus, kind?: MovieKind): string {
  const base = status ? STATUS_TITLE[status] : 'Mi cine';
  const only = kind === 'movie' ? ' · películas' : kind === 'series' ? ' · series' : '';
  return `🎬 ${base}${only}`;
}

/** Abre el menú de compartir con estos títulos, en este orden. */
export function shareMovies(items: readonly MovieEntry[], status?: MovieStatus, kind?: MovieKind): void {
  shareList(moviesShareTitle(status, kind), items.map(movieLine));
}
