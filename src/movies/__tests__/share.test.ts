import type { MovieEntry } from '../schema';
import { movieLine, moviesShareTitle } from '../share';

const entry = (m: Partial<MovieEntry>) => ({ title: 'Dune', kind: 'movie', year: null, rating: null, ...m }) as MovieEntry;

describe('movieLine', () => {
  it('título, año y nota', () => {
    expect(movieLine(entry({ year: 2021, rating: 8 }))).toBe('Dune (2021) · 8/10');
  });

  it('marca las series y aguanta datos que faltan', () => {
    expect(movieLine(entry({ title: 'Separación', kind: 'series', year: 2022 }))).toBe('Separación (2022, serie)');
    expect(movieLine(entry({ kind: 'series' }))).toBe('Dune (serie)');
    expect(movieLine(entry({}))).toBe('Dune');
  });

  it('nunca saca la reseña', () => {
    expect(movieLine(entry({ notes: 'Lenta pero preciosa' }))).toBe('Dune');
  });
});

describe('moviesShareTitle', () => {
  it('según estado y tipo', () => {
    expect(moviesShareTitle()).toBe('🎬 Mi cine');
    expect(moviesShareTitle('wishlist')).toBe('🎬 Quiero ver');
    expect(moviesShareTitle('completed', 'series')).toBe('🎬 Vistas · series');
  });
});
