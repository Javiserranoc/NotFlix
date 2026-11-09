import { formatRating, formatRuntime, movieMeta } from '../components/MovieRow';
import type { MovieEntry } from '../schema';
import { serializeSeasons } from '../seasons';
import { formatDate, formatHours, titleMinutes } from '../stats';


const entry = (e: Partial<MovieEntry>): MovieEntry => ({
  id: 'x',
  createdAt: '',
  updatedAt: '',
  deletedAt: null,
  kind: 'movie',
  title: 'T',
  year: null,
  status: 'wishlist',
  rating: null,
  posterUrl: null,
  genres: '',
  notes: '',
  finishedAt: null,
  tmdbId: null,
  runtimeMinutes: null,
  backdropUrl: null,
  overview: '',
  totalSeasons: null,
  tmdbSyncedAt: null,
  seasonsJson: null,
  watchedSeasonsJson: null,
  collectionId: null,
  collectionName: null,
  ...e,
});

const seasons = serializeSeasons([
  { season: 1, name: 'T1', episodes: 9, year: 2022 },
  { season: 2, name: 'T2', episodes: 10, year: 2025 },
  { season: 3, name: 'T3', episodes: 0, year: null },
]);

describe('titleMinutes', () => {
  it('una película es su duración', () => {
    expect(titleMinutes(entry({ runtimeMinutes: 155 }))).toBe(155);
  });

  it('una serie suma solo las temporadas marcadas', () => {
    expect(titleMinutes(entry({ kind: 'series', runtimeMinutes: 50, seasonsJson: seasons, watchedSeasonsJson: '[2]' }))).toBe(500);
  });

  it('sin duración es 0, no una suposición', () => {
    expect(titleMinutes(entry({ kind: 'series', seasonsJson: seasons }))).toBe(0);
  });
});

describe('formatos', () => {
  it.each([
    ['2024-03-11T21:00:00.000Z', '11 de marzo de 2024'],
    ['2025-12-01', '1 de diciembre de 2025'],
    ['2025', '2025'],
    ['2025-13-01', '2025'],
  ])('formatDate(%p) = %p', (iso, out) => {
    expect(formatDate(iso)).toBe(out);
  });

  it.each([
    [0, '—'],
    [48, '48 min'],
    [120, '2 h'],
    [1520, '25 h 20 min'],
  ])('formatHours(%p) = %p', (min, out) => {
    expect(formatHours(min)).toBe(out);
  });

  it('formatRuntime y formatRating', () => {
    expect(formatRuntime(142)).toBe('2 h 22 min');
    expect(formatRuntime(60)).toBe('1 h');
    expect(formatRuntime(48)).toBe('48 min');
    expect(formatRating(8)).toBe('8');
    expect(formatRating(8.5)).toBe('8.5');
  });
});

describe('movieMeta', () => {
  it('película: tipo, año y duración', () => {
    expect(movieMeta(entry({ year: 2021, runtimeMinutes: 155 }))).toBe('Película · 2021 · 2 h 35 min');
  });

  it('serie sin marcar: el total de temporadas', () => {
    expect(movieMeta(entry({ kind: 'series', totalSeasons: 2, seasonsJson: seasons }))).toBe('Serie · 2 temporadas');
  });

  it('serie marcando: el progreso sobre las emitidas', () => {
    expect(movieMeta(entry({ kind: 'series', totalSeasons: 2, seasonsJson: seasons, watchedSeasonsJson: '[1]' }))).toBe(
      'Serie · 1/2 temporadas',
    );
  });
});
