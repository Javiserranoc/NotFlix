/**
 * Texto "plegado" para buscar: minúsculas y sin tildes ni diéresis, así que
 * "amelie" encuentra "Amélie" y "ÉL" encuentra "él".
 *
 * Se hace aquí y no con LIKE de SQLite porque ese solo ignora mayúsculas en
 * ASCII: "Él" y "él" son distintos para él.
 */
const FOLD: Record<string, string> = {
  á: 'a', à: 'a', â: 'a', ä: 'a', ã: 'a', å: 'a',
  é: 'e', è: 'e', ê: 'e', ë: 'e',
  í: 'i', ì: 'i', î: 'i', ï: 'i',
  ó: 'o', ò: 'o', ô: 'o', ö: 'o', õ: 'o', ø: 'o',
  ú: 'u', ù: 'u', û: 'u', ü: 'u',
  ñ: 'n', ç: 'c', ý: 'y', ÿ: 'y',
};

export const foldText = (s: string) => s.toLowerCase().replace(/[^\x00-\x7f]/g, (ch) => FOLD[ch] ?? ch);

/** ¿`text` contiene `query`, sin mirar mayúsculas ni tildes? Consulta vacía = sí. */
export const matchesText = (text: string, query: string) => foldText(text).includes(foldText(query.trim()));

/**
 * Orden de texto plano (fechas ISO, `YYYY-MM-DD`, ids).
 */
export const byText = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);

/**
 * Orden alfabético de nombres sin mirar mayúsculas ni tildes ("Ñoquis" tras
 * "Nata", "Árbol" junto a "Arroz"). Pliega en cada comparación: para listas
 * pequeñas; con cientos de elementos, plegar una vez antes de ordenar.
 */
export const byName = (a: string, b: string) => byText(foldText(a), foldText(b));
