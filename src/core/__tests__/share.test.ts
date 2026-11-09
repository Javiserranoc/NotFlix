import { listText } from '../share';

describe('listText', () => {
  it('cabecera con el total y una línea por elemento', () => {
    expect(listText('📚 Mis deseos', ['Piranesi — Susanna Clarke', 'Dune'])).toBe(
      '📚 Mis deseos (2)\n\n• Piranesi — Susanna Clarke\n• Dune',
    );
  });

  it('corta en el tope y dice cuántos faltan', () => {
    const lines = Array.from({ length: 5 }, (_, i) => `L${i + 1}`);
    expect(listText('T', lines, 3)).toBe('T (5)\n\n• L1\n• L2\n• L3\n…y 2 más');
  });

  it('justo en el tope no añade nada', () => {
    expect(listText('T', ['a', 'b'], 2)).toBe('T (2)\n\n• a\n• b');
  });
});
