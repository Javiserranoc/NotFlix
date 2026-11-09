/**
 * El cliente de TMDB contra respuestas grabadas a mano, sin red: lo que se
 * prueba es cómo interpretamos lo que devuelve (duraciones de serie, temporada
 * 0, sinopsis sin traducir, errores), que es donde ya nos equivocamos una vez.
 */

type Tmdb = typeof import('../tmdb');

/** Respuestas por ruta; la clave es `path` o `path?language=xx`. */
function mockFetch(routes: Record<string, unknown | number>) {
  const calls: string[] = [];
  global.fetch = jest.fn(async (input: string | URL | Request) => {
    const url = new URL(String(input));
    calls.push(url.pathname + url.search);
    const path = url.pathname.replace('/3', '');
    const lang = url.searchParams.get('language');
    const body = routes[`${path}?language=${lang}`] ?? routes[path];
    if (body === undefined) return new Response('{}', { status: 404 });
    if (typeof body === 'number') return new Response('{}', { status: body });
    return new Response(JSON.stringify(body), { status: 200 });
  }) as typeof fetch;
  return calls;
}

/** La key sale de Ajustes; aquí se sustituye por la que pida cada test. */
let mockKey = '';
jest.mock('../../core/settings', () => ({
  getSetting: () => mockKey,
  useSetting: () => mockKey,
}));

function load(key = 'test-key'): Tmdb {
  mockKey = key;
  let mod!: Tmdb;
  jest.isolateModules(() => {
    mod = require('../tmdb');
  });
  return mod;
}

describe('sin key', () => {
  it('se desactiva y no llama a nadie', async () => {
    const calls = mockFetch({});
    const tmdb = load('');
    await expect(tmdb.searchTitles('dune')).rejects.toThrow('Falta la API key');
    expect(calls).toHaveLength(0);
  });
});

describe('searchTitles', () => {
  it('descarta personas, pone el tipo y el original solo si cambia', async () => {
    mockFetch({
      '/search/multi': {
        results: [
          { id: 1, media_type: 'person', name: 'Denis Villeneuve' },
          { id: 2, media_type: 'tv', name: 'Separación', original_name: 'Severance', first_air_date: '2022-02-17' },
          { id: 3, media_type: 'movie', title: 'Dune', original_title: 'Dune', release_date: '2021-09-15', poster_path: '/p.jpg' },
          { id: 4, media_type: 'movie', title: '   ' },
        ],
      },
    });
    const hits = await load().searchTitles('sep');
    expect(hits).toEqual([
      { tmdbId: 2, kind: 'series', title: 'Separación', originalTitle: 'Severance', year: 2022, posterUrl: null },
      {
        tmdbId: 3,
        kind: 'movie',
        title: 'Dune',
        originalTitle: null,
        year: 2021,
        posterUrl: 'https://image.tmdb.org/t/p/w500/p.jpg',
      },
    ]);
  });

  it.each([
    [401, 'La API key de TMDB no es válida'],
    [429, 'limitando'],
    [500, 'TMDB ha respondido 500'],
  ])('traduce un %i a un mensaje en español', async (status, msg) => {
    mockFetch({ '/search/multi': status });
    await expect(load().searchTitles('x')).rejects.toThrow(msg);
  });

  it('sin red dice "Sin conexión"', async () => {
    global.fetch = jest.fn(async () => {
      throw new TypeError('Network request failed');
    }) as typeof fetch;
    await expect(load().searchTitles('x')).rejects.toThrow('Sin conexión con TMDB');
  });
});

describe('fetchDetails', () => {
  it('serie: duración del último episodio, sin especiales y solo temporadas emitidas', async () => {
    mockFetch({
      '/tv/95396': {
        name: 'Separación',
        first_air_date: '2022-02-17',
        overview: 'Mark lidera un equipo…',
        genres: [{ id: 1, name: 'Drama' }, { id: 2, name: 'Misterio' }],
        episode_run_time: [],
        last_episode_to_air: { runtime: 52 },
        number_of_seasons: 3,
        seasons: [
          { season_number: 0, name: 'Especiales', episode_count: 4 },
          { season_number: 2, name: 'Temporada 2', episode_count: 10, air_date: '2025-01-17' },
          { season_number: 1, name: 'Temporada 1', episode_count: 9, air_date: '2022-02-17' },
          { season_number: 3, name: '', episode_count: 0, air_date: null },
        ],
      },
    });
    const d = await load().fetchDetails('series', 95396);
    expect(d.runtimeMinutes).toBe(52);
    expect(d.genres).toBe('Drama, Misterio');
    expect(d.totalSeasons).toBe(2); // no las 3 de number_of_seasons
    expect(d.seasons).toEqual([
      { season: 1, name: 'Temporada 1', episodes: 9, year: 2022 },
      { season: 2, name: 'Temporada 2', episodes: 10, year: 2025 },
      { season: 3, name: 'Temporada 3', episodes: 0, year: null },
    ]);
    expect(d.collectionId).toBeNull();
  });

  it('película: saga y sinopsis en inglés si no está traducida', async () => {
    const calls = mockFetch({
      '/movie/438631?language=es-ES': {
        title: 'Dune',
        release_date: '2021-09-15',
        overview: '',
        runtime: 155,
        backdrop_path: '/b.jpg',
        belongs_to_collection: { id: 726871, name: 'Dune: colección' },
      },
      '/movie/438631?language=en-US': { overview: 'Paul Atreides…' },
    });
    const d = await load().fetchDetails('movie', 438631);
    expect(d.overview).toBe('Paul Atreides…');
    expect(d.runtimeMinutes).toBe(155);
    expect(d.totalSeasons).toBeNull();
    expect(d.backdropUrl).toBe('https://image.tmdb.org/t/p/w780/b.jpg');
    expect(d).toMatchObject({ collectionId: 726871, collectionName: 'Dune: colección' });
    expect(calls).toHaveLength(2);
  });

  it('una duración de 0 es "sin duración", no cero minutos', async () => {
    mockFetch({ '/movie/1': { title: 'X', overview: 'x', runtime: 0 } });
    expect((await load().fetchDetails('movie', 1)).runtimeMinutes).toBeNull();
  });
});

describe('fetchCollection', () => {
  it('ordena por estreno y deja al final lo que no tiene fecha', async () => {
    mockFetch({
      '/collection/9': {
        id: 9,
        name: 'Saga',
        parts: [
          { id: 3, title: 'Tercera', release_date: '' },
          { id: 2, title: 'Segunda', release_date: '2024-02-28' },
          { id: 1, title: 'Primera', release_date: '2021-09-15' },
          { id: 4, title: 'Futura', release_date: '2999-12-18' },
        ],
      },
    });
    const saga = await load().fetchCollection(9);
    expect(saga.parts.map((p) => [p.title, p.released])).toEqual([
      ['Primera', true],
      ['Segunda', true],
      ['Futura', false],
      ['Tercera', false],
    ]);
  });
});

describe('fetchRecommendations', () => {
  it('hereda el tipo si no viene y quita las que no tienen póster', async () => {
    mockFetch({
      '/tv/7/recommendations': {
        results: [
          { id: 10, name: 'Con póster', poster_path: '/a.jpg' },
          { id: 11, name: 'Sin póster', poster_path: null },
          { id: 12, media_type: 'movie', title: 'Peli', poster_path: '/c.jpg' },
        ],
      },
    });
    const hits = await load().fetchRecommendations('series', 7);
    expect(hits.map((h) => [h.tmdbId, h.kind])).toEqual([
      [10, 'series'],
      [12, 'movie'],
    ]);
  });
});
