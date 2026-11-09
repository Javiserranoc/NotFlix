import { Image } from 'expo-image';
import { Pressable, StyleSheet, Text, View, type ViewStyle } from 'react-native';

import { StatusChip } from '../../core/ui/StatusChip';
import { Icon } from '../../core/ui/Icon';
import { KIND_META, STATUS_META } from '../enums';
import type { MovieEntry } from '../schema';
import { airedSeasons, parseSeasons, parseWatchedSeasons } from '../seasons';
import { BRICK, CREAM, DISPLAY, GOLD, moviesTheme as th } from '../theme';

export function movieMeta(e: MovieEntry) {
  const parts: string[] = [KIND_META[e.kind].label];
  if (e.year) parts.push(String(e.year));
  if (e.kind === 'series') {
    // Si voy marcando temporadas, el progreso dice mas que el total.
    const aired = airedSeasons(parseSeasons(e.seasonsJson)).length;
    const seen = parseWatchedSeasons(e.watchedSeasonsJson).length;
    if (seen > 0 && aired > 0) parts.push(`${seen}/${aired} temporadas`);
    else if (e.totalSeasons) parts.push(e.totalSeasons === 1 ? '1 temporada' : `${e.totalSeasons} temporadas`);
  }
  if (e.runtimeMinutes) parts.push(formatRuntime(e.runtimeMinutes));
  return parts.join(' · ');
}

/** 142 -> "2 h 22 min"; 48 -> "48 min". */
export function formatRuntime(min: number) {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return h ? `${h} h${m ? ` ${m} min` : ''}` : `${m} min`;
}

export const formatRating = (r: number) => (r % 1 === 0 ? r.toFixed(0) : r.toFixed(1));

export function MovieRow({ entry: e, onPress }: { entry: MovieEntry; onPress: () => void }) {
  const st = STATUS_META[e.status];
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && { opacity: 0.9 }]}
    >
      <Poster entry={e} width={48} />
      <View style={styles.middle}>
        <Text style={styles.title} numberOfLines={1}>
          {e.title}
        </Text>
        <Text style={styles.meta}>{movieMeta(e)}</Text>
        <StatusChip label={st.label} color={st.color} icon={st.icon} />
      </View>
      {e.rating != null ? (
        <View style={styles.rating}>
          <Icon name="star" size={20} color={GOLD} />
          <Text style={styles.ratingText}>{formatRating(e.rating)}</Text>
        </View>
      ) : null}
    </Pressable>
  );
}

/** Póster: imagen si hay URL; si no, un cartel con iniciales y color estable. */
export function Poster({ entry, width }: { entry: MovieEntry; width: number }) {
  const height = width * 1.5;
  let hash = 0;
  for (const ch of entry.title) hash = (hash * 31 + ch.charCodeAt(0)) | 0;
  const hue = Math.abs(hash) % 360;
  const initials = entry.title
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join('');

  return (
    <View
      style={[
        styles.poster,
        { width, height, backgroundColor: `hsl(${hue}, 45%, 30%)` },
        width >= 70 ? styles.posterBig : styles.posterSmall,
      ]}
    >
      <Text style={[styles.initials, { fontSize: width * 0.34, lineHeight: width * 0.42 }]}>{initials}</Text>
      {entry.posterUrl ? (
        <Image source={{ uri: entry.posterUrl }} style={StyleSheet.absoluteFill} contentFit="cover" />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: 10,
    borderRadius: 16,
    backgroundColor: th.surface,
    borderWidth: 1.5,
    borderColor: th.border,
    overflow: 'hidden',
  },
  middle: { flex: 1, gap: 4 },
  title: { color: th.text, fontSize: 16, fontWeight: '700' },
  meta: { color: th.textMuted, fontSize: 12, marginBottom: 2 },
  rating: { alignItems: 'center', minWidth: 32 },
  ratingText: { color: th.text, fontSize: 14, fontWeight: '700', fontVariant: ['tabular-nums'] },
  poster: { borderRadius: 8, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', borderColor: CREAM },
  posterBig: { borderWidth: 2, boxShadow: `2px 3px 0 ${BRICK}` } as ViewStyle,
  posterSmall: { borderWidth: 1.5 },
  initials: { color: CREAM, fontFamily: DISPLAY },
});
