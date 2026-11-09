import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon } from '../../core/ui/Icon';
import { type MovieStatus, STATUS_CHOICES, STATUS_META } from '../enums';
import { CREAM, INK, OXBLOOD, stickerText } from '../theme';
import { Wordmark } from './Brand';
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
      <View style={styles.identity}>
        <View style={{ flex: 1, alignItems: 'flex-start' }}>
          <Wordmark size={26} />
        </View>
        <Pressable hitSlop={6} onPress={onSearch} accessibilityRole="button" accessibilityLabel="Buscar" style={styles.round}>
          <Icon name="magnify" size={19} color={CREAM} />
        </Pressable>
        <Pressable hitSlop={6} onPress={() => router.push('/ajustes')} accessibilityRole="button" accessibilityLabel="Ajustes" style={styles.round}>
          <Icon name="cog-outline" size={19} color={CREAM} />
        </Pressable>
      </View>

      <View style={styles.switch}>
        <KindSwitch />
      </View>

      <View style={styles.middle}>
        <Text style={styles.headline}>
          {counts.completed} {counts.completed === 1 ? 'VISTA' : 'VISTAS'}
        </Text>
        <View style={styles.captionPill}>
          <Text style={styles.caption}>
            {counts.wishlist} {counts.wishlist === 1 ? 'deseada' : 'deseadas'}
            {minutes !== '—' ? ` · ${minutes} este año` : ''}
          </Text>
        </View>
      </View>

      <View style={styles.bar}>
        {segments.length > 0 ? (
          segments.map((s) => (
            <View key={s.color} style={[styles.segment, { flexGrow: s.count, backgroundColor: s.color }]} />
          ))
        ) : (
          <View style={[styles.segment, { flexGrow: 1, backgroundColor: OXBLOOD }]} />
        )}
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: {
    paddingHorizontal: 20,
    paddingBottom: 18,
    borderBottomWidth: 3,
    borderBottomColor: CREAM,
    backgroundColor: OXBLOOD,
    overflow: 'hidden',
  },
  identity: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  round: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: INK,
    alignItems: 'center',
    justifyContent: 'center',
  },
  switch: { paddingTop: 14 },
  middle: { paddingTop: 18, paddingBottom: 14, gap: 8, alignItems: 'flex-start' },
  headline: {
    ...stickerText(3, 3),
    fontSize: 50,
    lineHeight: 56,
    letterSpacing: 1,
    transform: [{ rotate: '-2deg' }],
  },
  captionPill: { backgroundColor: INK, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 },
  caption: { color: CREAM, fontSize: 13, fontWeight: '600' },
  bar: {
    flexDirection: 'row',
    gap: 3,
    padding: 3,
    borderRadius: 8,
    backgroundColor: INK,
  },
  segment: { height: 7, borderRadius: 4 },
});
