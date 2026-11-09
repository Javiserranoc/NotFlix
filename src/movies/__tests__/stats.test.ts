import type { MovieEntry } from '../schema';
import { serializeSeasons } from '../seasons';
import { movieStats } from '../stats';


const entry = (e: Partial<MovieEntry>) =>
  ({ id: e.title, kind: 'movie', genres: '', rating: null, runtimeMinutes: null, ...e }) as MovieEntry;

const dune = entry({ title: 'Dune', genres: 'Ciencia ficción', runtimeMinutes: 155 });
const bear = entry({
  title: 'The Bear',
  kind: 'series',
  genres: 'Comedia',
  runtimeMinutes: 30,
  seasonsJson: serializeSeasons([
    { season: 1, name: 'T1', episodes: 8, year: 2022 },
    { season: 2, name: 'T2', episodes: 10, year: 2023 },
  ]),
  watchedSeasonsJson: '[1]',
});
const log = [
  { watchedAt: '2026-03-01T20:00:00.000Z', title: dune },
  { watchedAt: '2025-06-01T20:00:00.000Z', title: dune },
  { watchedAt: '2026-04-01T20:00:00.000Z', title: bear },
];

describe('movieStats', () => {
  it('las películas no ven las series', () => {
    const s = movieStats(log, null, 'movie');
    expect(s).toMatchObject({ watched: 2, titles: 1, minutes: 310, years: [2026, 2025] });
    expect(s.genres).toEqual([{ name: 'Ciencia ficción', count: 2 }]);
  });

  it('las series suman sus temporadas marcadas', () => {
    const s = movieStats(log, 2026, 'series');
    expect(s).toMatchObject({ watched: 1, titles: 1, minutes: 240, years: [2026] });
    expect(s.byMonth[3]).toBe(1);
  });

  it('avisa de lo que no tiene duración, sea del tipo que sea', () => {
    const sinDuracion = entry({ title: 'Sin datos', kind: 'series' });
    const s = movieStats([{ watchedAt: '2026-01-01T20:00:00.000Z', title: sinDuracion }], null, 'series');
    expect(s.withoutRuntime).toEqual([sinDuracion]);
  });
});
