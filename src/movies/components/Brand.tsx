import { StyleSheet, Text, View } from 'react-native';

import { BRICK, CREAM, INK, stickerText } from '../theme';

const DOTS = [0, 60, 120, 180, 240, 300];

/** El rollo de película que hace de "O" en el logo. */
export function Reel({ size }: { size: number }) {
  const dot = size * 0.21;
  const orbit = size * 0.28;
  return (
    <View style={[styles.reel, { width: size, height: size, borderRadius: size / 2, borderWidth: size * 0.07 }]}>
      {DOTS.map((a) => {
        const rad = (a * Math.PI) / 180;
        return (
          <View
            key={a}
            style={{
              position: 'absolute',
              width: dot,
              height: dot,
              borderRadius: dot / 2,
              backgroundColor: BRICK,
              transform: [{ translateX: Math.sin(rad) * orbit }, { translateY: -Math.cos(rad) * orbit }],
            }}
          />
        );
      })}
    </View>
  );
}

/** El logo en una línea, para las cabeceras. */
export function Wordmark({ size = 24 }: { size?: number }) {
  const text = [stickerText(1.5, 1.5), { fontSize: size, lineHeight: size * 1.2 }];
  return (
    <View style={styles.wordmark} accessibilityRole="header" accessibilityLabel="NotFlix">
      <Text style={text}>N</Text>
      <Reel size={size * 0.94} />
      <Text style={text}>T</Text>
      <Text style={[text, { marginLeft: size * 0.28 }]}>FLIX</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  reel: { backgroundColor: CREAM, borderColor: INK, alignItems: 'center', justifyContent: 'center' },
  wordmark: { flexDirection: 'row', alignItems: 'center', gap: 1 },
});
