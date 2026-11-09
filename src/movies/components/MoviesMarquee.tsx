import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon } from '../../core/ui/Icon';
import { type MovieStatus, STATUS_CHOICES, STATUS_META } from '../enums';
import { DISPLAY, GOLD, moviesTheme as th, VELVET } from '../theme';
import { KindSwitch } from './KindSwitch';

/**
 * Marquesina: la cabecera de Inicio, con la identidad y la cifra grande.
 */
export function MoviesMarquee({
  counts,
  minutes,
  onSearch,
}: {
  counts: Record<MovieStatus, number>;
  minutes: string;
  onSearch: () => void;
}) {
  const insets = useSafeAreaInsets();
  const segments = STATUS_CHOICES.map((s) => ({ color: STATUS_META[s].color, count: counts[s] })).filter(
    (x) => x.count > 0,
  );

  return (
    <Animated.View
      entering={FadeInDown.duration(300).springify().damping(20)}
      style={[styles.root, { paddingTop: insets.top + 10 }]}
    >
      <LinearGradient
        colors={['#4E0F1C', '#2B0A12', '#16100F']}
        locations={[0, 0.56, 1]}
        style={StyleSheet.absoluteFill}
      />
      {/* Haz de proyector. */}
      <LinearGradient
        colors={['rgba(242,178,51,0.20)', 'rgba(242,178,51,0)']}
        style={styles.beam}
      />
      {/* Perforaciones de película en los cantos. */}
      <Perforations side="left" />
      <Perforations side="right" />

      <View style={styles.identity}>
        <Icon name="filmstrip" size={18} color={GOLD} />
        <Text style={styles.moduleName}>CINE &amp; SERIES</Text>
        <Pressable hitSlop={8} onPress={onSearch} accessibilityRole="button" accessibilityLabel="Buscar">
          <Icon name="magnify" size={20} color={th.text} />
        </Pressable>
        <Pressable hitSlop={8} onPress={() => router.push('/ajustes')} accessibilityRole="button" accessibilityLabel="Ajustes">
          <Icon name="cog-outline" size={20} color={th.text} />
        </Pressable>
      </View>

      <View style={styles.switch}>
        <KindSwitch />
      </View>

      <View style={styles.middle}>
        <Text style={styles.headline}>
          {counts.completed} {counts.completed === 1 ? 'VISTA' : 'VISTAS'}
        </Text>
        <Text style={styles.caption}>
          {counts.wishlist} {counts.wishlist === 1 ? 'deseada' : 'deseadas'}
          {minutes !== '—' ? ` · ${minutes} este año` : ''}
        </Text>
      </View>

      <View style={styles.bar}>
        {segments.length > 0 ? (
          segments.map((s) => (
            <View key={s.color} style={[styles.segment, { flexGrow: s.count, backgroundColor: s.color }]} />
          ))
        ) : (
          <View style={[styles.segment, { flexGrow: 1, backgroundColor: th.border }]} />
        )}
      </View>
    </Animated.View>
  );
}

/** Tira de agujeros de película pegada a un canto. */
function Perforations({ side }: { side: 'left' | 'right' }) {
  return (
    <View style={[styles.perforations, side === 'left' ? { left: 0 } : { right: 0 }]} pointerEvents="none">
      {Array.from({ length: 12 }, (_, i) => (
        <View key={i} style={styles.hole} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    paddingHorizontal: 28,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#4A1520',
    backgroundColor: VELVET,
    overflow: 'hidden',
  },
  beam: { position: 'absolute', left: 0, right: 0, top: 0, height: 130, opacity: 0.9 },
  perforations: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 15,
    justifyContent: 'space-around',
    alignItems: 'center',
  },
  hole: { width: 7, height: 11, borderRadius: 2, backgroundColor: 'rgba(0,0,0,0.62)' },
  identity: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  moduleName: { flex: 1, color: GOLD, fontSize: 11, fontWeight: '800', letterSpacing: 2 },
  switch: { paddingTop: 12 },
  middle: { paddingTop: 12, paddingBottom: 12, gap: 3 },
  headline: { color: th.text, fontFamily: DISPLAY, fontSize: 54, lineHeight: 56, letterSpacing: 0.5 },
  caption: { color: '#C9B6B9', fontSize: 13 },
  bar: { flexDirection: 'row', gap: 3 },
  segment: { height: 7, borderRadius: 4 },
});
