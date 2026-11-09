import { byName, byText, foldText, matchesText } from '../text';

describe('foldText', () => {
  it('quita tildes, diéresis y eñes y pasa a minúsculas', () => {
    expect(foldText('Él Niño Pingüino ÁÉÍÓÚ Çà')).toBe('el nino pinguino aeiou ca');
  });

  it('deja en paz lo que no sabe plegar', () => {
    expect(foldText('東京 · Ω')).toBe('東京 · ω');
  });
});

describe('matchesText', () => {
  it.each([
    ['Amélie', 'amelie'],
    ['El laberinto del fauno', 'LABERINTO'],
    ['Él', 'él'],
    ['Pingüino', 'pinguino'],
    ['Cualquier cosa', '   '],
  ])('%p contiene %p', (text, query) => {
    expect(matchesText(text, query)).toBe(true);
  });

  it('no encuentra lo que no está', () => {
    expect(matchesText('Dune', 'oppenheimer')).toBe(false);
  });
});

describe('byText y byName', () => {
  it('byText ordena fechas ISO como texto', () => {
    expect(['2026-10-02', '2025-12-31', '2026-01-15'].sort(byText)).toEqual(['2025-12-31', '2026-01-15', '2026-10-02']);
  });

  it('byName ignora mayúsculas y tildes', () => {
    expect(['plátano', 'Arroz', 'Árbol', 'leche', 'Zumo'].sort(byName)).toEqual([
      'Árbol',
      'Arroz',
      'leche',
      'plátano',
      'Zumo',
    ]);
  });
});
