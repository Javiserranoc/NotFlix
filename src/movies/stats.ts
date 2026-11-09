import { useMemo } from 'react';

import { byName } from '../core/text';
import type { MovieKind } from './enums';
import { useWatchLog } from './repo';
import type { MovieEntry } from './schema';
import { parseSeasons, parseWatchedSeasons, watchedMinutes } from './seasons';

/**
 * Minutos que me he pasado viendo un título. En una película es su duración;
 * en una serie, los minutos por episodio por los episodios de las temporadas
 * que he marcado como vistas. Sin duración devuelve 0: preferimos quedarnos
 * cortos antes que inventar horas.
 */
export function titleMinutes(e: MovieEntry): number {
  if (!e.runtimeMinutes) return 0;
  if (e.kind === 'movie') return e.runtimeMinutes;
  return watchedMinutes(parseSeasons(e.seasonsJson), parseWatchedSeasons(e.watchedSeasonsJson), e.runtimeMinutes);
}

const yearOf = (iso: string | null) => {
  const y = parseInt((iso ?? '').slice(0, 4), 10);
  return Number.isFinite(y) ? y : null;
};

export type GenreCount = { name: string; count: number };

export type MovieStats = {
  /** Años con algo visto, el más reciente primero. */
  years: number[];
  /** Veces vistas: una peli vista dos veces cuenta dos. */
  watched: number;
  /** Títulos distintos detrás de esas veces. */
  titles: number;
  /** Minutos vistos: en la butaca (películas) o en el sofá (series, por las temporadas marcadas). */
  minutes: number;
  /** 12 posiciones, enero a diciembre. */
  byMonth: number[];
  genres: GenreCount[];
  /** Mejor puntuados del año, de mayor a menor. */
  best: MovieEntry[];
  /** Vistas sin duración: los minutos se quedan cortos hasta rellenarla. */
  withoutRuntime: MovieEntry[];
};

/**
 * Estadísticas de un tipo y del año elegido (`null` = todo), calculadas sobre
 * el HISTORIAL de visionados, no sobre los títulos: una peli vista dos veces
 * cuenta dos veces y suma sus minutos dos veces, que es lo que se espera de un
 * diario.
 */
export function movieStats(
  log: readonly { watchedAt: string; title: MovieEntry }[],
  year: number | null,
  kind: MovieKind,
): MovieStats {
  const ofKind = log.filter((r) => r.title.kind === kind);
  const years = [...new Set(ofKind.map((r) => yearOf(r.watchedAt)).filter((y): y is number => y != null))].sort(
    (a, b) => b - a,
  );

  const rows = year == null ? ofKind : ofKind.filter((r) => yearOf(r.watchedAt) === year);

  const byMonth = Array.from({ length: 12 }, () => 0);
  const genreMap = new Map<string, number>();
  const missing = new Map<string, MovieEntry>();
  const titles = new Map<string, MovieEntry>();
  let minutes = 0;

  for (const r of rows) {
    const e = r.title;
    titles.set(e.id, e);

    const month = parseInt(r.watchedAt.slice(5, 7), 10);
    if (month >= 1 && month <= 12) byMonth[month - 1] += 1;

    const m = titleMinutes(e);
    minutes += m;
    if (m === 0) missing.set(e.id, e);

    for (const raw of e.genres.split(',')) {
      const g = raw.trim();
      if (!g) continue;
      genreMap.set(g, (genreMap.get(g) ?? 0) + 1);
    }
  }

  const genres = [...genreMap.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count || byName(a.name, b.name))
    .slice(0, 5);

  const best = [...titles.values()]
    .filter((e) => e.rating != null)
    .sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0))
    .slice(0, 4);

  return {
    years,
    watched: rows.length,
    titles: titles.size,
    minutes,
    byMonth,
    genres,
    best,
    withoutRuntime: [...missing.values()],
  };
}

export function useMovieStats(year: number | null, kind: MovieKind): MovieStats {
  const log = useWatchLog();
  return useMemo(() => movieStats(log, year, kind), [log, year, kind]);
}

/** "2024-03-11T…" -> "11 de marzo de 2024". Sin Intl, que en Hermes no siempre está. */
const MESES = [
  'enero',
  'febrero',
  'marzo',
  'abril',
  'mayo',
  'junio',
  'julio',
  'agosto',
  'septiembre',
  'octubre',
  'noviembre',
  'diciembre',
];

export function formatDate(iso: string): string {
  const y = iso.slice(0, 4);
  const m = parseInt(iso.slice(5, 7), 10);
  const d = parseInt(iso.slice(8, 10), 10);
  if (!Number.isFinite(m) || !Number.isFinite(d) || m < 1 || m > 12) return y;
  return `${d} de ${MESES[m - 1]} de ${y}`;
}

/**
 * Un día elegido en el calendario, como fecha ISO de visionado. Se guarda a
 * mediodía local: a medianoche, en UTC caería en el día anterior.
 */
export function pickedDayIso(day: Date): string {
  return new Date(day.getFullYear(), day.getMonth(), day.getDate(), 12).toISOString();
}

/** 1520 -> "25 h 20 min"; 48 -> "48 min"; 0 -> "—". */
export function formatHours(minutes: number): string {
  if (minutes <= 0) return '—';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (!h) return `${m} min`;
  return m ? `${h} h ${m} min` : `${h} h`;
}
