import type { TextStyle, ViewStyle } from 'react-native';

/** La paleta sale del icono: tinta, crema, carmesí y oro. */
export const INK = '#120608';
export const CREAM = '#FFF6E0';
export const CRIMSON = '#D7263D';
export const BRICK = '#C4162E';
export const OXBLOOD = '#7C0D22';
export const GOLD = '#F2B233';
export const VELVET = '#3A0B14';

/** Siempre oscuro y cálido; lo vistoso va en las pegatinas. */
export const moviesTheme = {
  dark: true,
  background: INK,
  surface: '#261113',
  surfaceHigh: '#38181C',
  text: CREAM,
  textMuted: '#C9B09F',
  border: '#5A2A2E',
  accent: CRIMSON,
  onAccent: CREAM,
};

/** Titulares, siempre con `textTransform: 'uppercase'`: su minúscula es irregular. La carga `useFonts` en el _layout raíz. */
export const DISPLAY = 'LuckiestGuy_400Regular';

/** Cara de pegatina: crema con canto rojo sin difuminar, como las letras del icono. */
export const stickerFace = {
  backgroundColor: CREAM,
  borderWidth: 2,
  borderColor: INK,
  boxShadow: `3px 4px 0 ${BRICK}`,
} as ViewStyle;

const ring = (w: number, color: string) =>
  [[-w, 0], [w, 0], [0, -w], [0, w], [-w, -w], [w, -w], [-w, w], [w, w]]
    .map(([x, y]) => `${x}px ${y}px 0 ${color}`)
    .join(', ');

/**
 * Letras de cartel: cara crema, canto rojo y contorno de tinta. Es para títulos
 * grandes; va en `textShadow` porque la app solo existe en web y RN no acumula sombras.
 */
export const stickerText = (edge = 2, stroke = 2) =>
  ({
    fontFamily: DISPLAY,
    textTransform: 'uppercase',
    color: CREAM,
    textShadow: `${edge}px ${edge}px 0 ${BRICK}, ${ring(stroke, INK)}, ${edge + stroke}px ${edge + stroke}px 0 ${INK}`,
  }) as TextStyle;

/** Rótulo de sección. */
export const sectionTitle: TextStyle = {
  color: CREAM,
  fontFamily: DISPLAY,
  textTransform: 'uppercase',
  fontSize: 17,
  lineHeight: 21,
  letterSpacing: 0.5,
};
