import {
  airedSeasons,
  type MovieSeason,
  parseSeasons,
  parseWatchedSeasons,
  seasonsTotals,
  serializeSeasons,
  serializeWatchedSeasons,
  toggleSeason,
  watchedMinutes,
} from '../seasons';

const S = (season: number, episodes: number, year: number | null = 2022): MovieSeason => ({
  season,
  name: `Temporada ${season}`,
  episodes,
  year,
});

// Como Separación: dos emitidas y la tercera anunciada, sin episodios.
const severance = [S(1, 9), S(2, 10, 2025), S(3, 0, null)];

describe('parseSeasons', () => {
  it('lee lo que escribe serializeSeasons', () => {
    expect(parseSeasons(serializeSeasons(severance))).toEqual(severance);
  });

  it('ordena por número aunque venga desordenado', () => {
    const json = JSON.stringify([S(2, 10), S(1, 9)]);
    expect(parseSeasons(json).map((s) => s.season)).toEqual([1, 2]);
  });

  it('descarta filas mal formadas en vez de reventar', () => {
    const json = JSON.stringify([S(1, 9), { season: '2' }, null, 7, { ...S(3, 4), year: 'x' }]);
    expect(parseSeasons(json)).toEqual([S(1, 9)]);
  });

  it.each([null, '', 'no es json', '{"a":1}', '42'])('devuelve [] con %p', (raw) => {
    expect(parseSeasons(raw)).toEqual([]);
  });

  it('serializeSeasons guarda null si no hay temporadas', () => {
    expect(serializeSeasons([])).toBeNull();
  });
});

describe('temporadas emitidas y totales', () => {
  it('las anunciadas sin episodios no cuentan como emitidas', () => {
    expect(airedSeasons(severance).map((s) => s.season)).toEqual([1, 2]);
  });

  it('suma episodios emitidos y minutos si hay duración', () => {
    expect(seasonsTotals(severance, 50)).toEqual({ episodes: 19, minutes: 950 });
  });

  it('sin duración no inventa minutos', () => {
    expect(seasonsTotals(severance, null)).toEqual({ episodes: 19, minutes: null });
  });
});

describe('temporadas vistas', () => {
  it('parseWatchedSeasons quita duplicados, basura y ordena', () => {
    // 1e999 es Infinity al parsear: no es un número de temporada.
    expect(parseWatchedSeasons('[3, 1, 1, "2", null, 1e999]')).toEqual([1, 3]);
  });

  it('parseWatchedSeasons tolera JSON roto', () => {
    expect(parseWatchedSeasons('[1,')).toEqual([]);
    expect(parseWatchedSeasons(null)).toEqual([]);
  });

  it('serializeWatchedSeasons ordena, deduplica y guarda null si está vacío', () => {
    expect(serializeWatchedSeasons([2, 1, 2])).toBe('[1,2]');
    expect(serializeWatchedSeasons([])).toBeNull();
  });

  it('toggleSeason añade y quita', () => {
    expect(toggleSeason([1], 2)).toEqual([1, 2]);
    expect(toggleSeason([1, 2], 1)).toEqual([2]);
  });
});

describe('watchedMinutes', () => {
  it('cuenta solo las temporadas marcadas', () => {
    expect(watchedMinutes(severance, [1], 50)).toBe(9 * 50);
  });

  it('sin nada marcado cae a todas las emitidas', () => {
    expect(watchedMinutes(severance, [], 50)).toBe(19 * 50);
  });

  it('marcar una sin estrenar no suma nada', () => {
    expect(watchedMinutes(severance, [3], 50)).toBe(0);
  });

  it('sin duración son 0 minutos', () => {
    expect(watchedMinutes(severance, [1, 2], null)).toBe(0);
  });
});
