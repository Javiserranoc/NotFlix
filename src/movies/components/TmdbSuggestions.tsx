import { Image } from 'expo-image';
import { router } from 'expo-router';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { Icon } from '../../core/ui/Icon';
import { KIND_META } from '../enums';
import { type TmdbHit, useTmdbEnabled } from '../tmdb';
import { useTmdbSearch } from '../useTmdbSearch';
import { moviesTheme as th } from '../theme';

/**
 * Resultados de TMDB debajo del campo del título. Un toque rellena el
 * formulario. Si no hay key configurada no se pinta nada y el alta manual
 * sigue funcionando igual.
 */
export function TmdbSuggestions({
  query,
  enabled,
  onPick,
}: {
  query: string;
  enabled: boolean;
  onPick: (hit: TmdbHit) => void;
}) {
  const { hits, loading, error } = useTmdbSearch(query, enabled);
  const tmdbOn = useTmdbEnabled();

  // Sin key no hay búsqueda. Antes esto no pintaba nada y parecía que la
  // función no existía, así que lo dice en voz alta y lleva a Ajustes.
  if (!tmdbOn) {
    return (
      <Pressable style={styles.notice} onPress={() => router.push('/ajustes')}>
        <Icon name="key-outline" size={16} color={th.textMuted} />
        <Text style={styles.noticeText}>
          Para buscar títulos, pon tu key de TMDB en <Text style={styles.code}>Ajustes</Text>.
        </Text>
      </Pressable>
    );
  }
  if (!enabled) return null;
  if (error) {
    return (
      <View style={styles.notice}>
        <Icon name="cloud-off-outline" size={16} color={th.textMuted} />
        <Text style={styles.noticeText}>{error}</Text>
      </View>
    );
  }
  if (loading && hits.length === 0) {
    return (
      <View style={styles.notice}>
        <ActivityIndicator size="small" color={th.textMuted} />
        <Text style={styles.noticeText}>Buscando en TMDB…</Text>
      </View>
    );
  }
  if (hits.length === 0) return null;

  return (
    <View style={styles.list}>
      {hits.map((h) => (
        <Pressable
          key={`${h.kind}-${h.tmdbId}`}
          onPress={() => onPick(h)}
          style={({ pressed }) => [styles.hit, pressed && { opacity: 0.9 }]}
        >
          <View style={styles.thumb}>
            {h.posterUrl ? (
              <Image source={{ uri: h.posterUrl }} style={StyleSheet.absoluteFill} contentFit="cover" />
            ) : (
              <Icon name={KIND_META[h.kind].icon} size={16} color={th.textMuted} />
            )}
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.title} numberOfLines={1}>
              {h.title}
            </Text>
            <Text style={styles.meta} numberOfLines={1}>
              {KIND_META[h.kind].label}
              {h.year ? ` · ${h.year}` : ''}
              {h.originalTitle ? ` · ${h.originalTitle}` : ''}
            </Text>
          </View>
          <Icon name="arrow-down-left" size={18} color={th.textMuted} />
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  list: {
    backgroundColor: th.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: th.border,
    overflow: 'hidden',
    marginTop: -8,
  },
  hit: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 8 },
  thumb: {
    width: 34,
    height: 51,
    borderRadius: 4,
    backgroundColor: th.surfaceHigh,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { color: th.text, fontSize: 15, fontWeight: '600' },
  meta: { color: th.textMuted, fontSize: 12, marginTop: 2 },
  notice: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: -4, paddingHorizontal: 2 },
  noticeText: { color: th.textMuted, fontSize: 12, flex: 1, lineHeight: 17 },
  code: { color: th.text, fontWeight: '700' },
});
