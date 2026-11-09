import { Image } from 'expo-image';
import { router, Stack } from 'expo-router';
import { useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon } from '../../core/ui/Icon';
import { PressScale } from '../../core/ui/PressScale';
import { KIND_META, type MovieKind, type MovieStatus, STATUS_META } from '../enums';
import { findByTmdbId, findByTmdbIds, insertMovieReturningId, tmdbColumns } from '../repo';
import { fetchDetails, type TmdbHit, useTmdbEnabled } from '../tmdb';
import { useTmdbSearch } from '../useTmdbSearch';
import { DISPLAY, moviesTheme as th } from '../theme';

/**
 * Añadir empieza por buscar, porque es lo que se hace el 90 % de las veces.
 * Eliges un resultado y el título entra en tu lista con todo relleno, y te
 * deja en su ficha para poner estado y nota. "A mano" sigue estando, abajo.
 *
 * Con `kind` (desde Películas o Series) solo salen las de ese tipo; sin él
 * las dos.
 */
export function MoviesSearchScreen({ initialQuery = '', kind }: { initialQuery?: string; kind?: MovieKind }) {
  const insets = useSafeAreaInsets();
  const [query, setQuery] = useState(initialQuery);
  const search = useTmdbSearch(query);
  const { loading, error } = search;
  const hits = useMemo(() => (kind ? search.hits.filter((h) => h.kind === kind) : search.hits), [search.hits, kind]);
  const noun = kind ? `una ${KIND_META[kind].label.toLowerCase()}` : 'una película o una serie';
  const tmdbOn = useTmdbEnabled();
  const [adding, setAdding] = useState<number | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  /** Lo que ya tengo de estos resultados: se marca en vez de ofrecer "+". */
  const mine = useMemo(
    () => new Map(findByTmdbIds(hits.map((h) => h.tmdbId)).map((m) => [m.tmdbId, m])),
    [hits],
  );

  const pick = async (hit: TmdbHit) => {
    // Un segundo toque mientras se trae la ficha lo añadiría dos veces.
    if (adding != null) return;
    // Si ya lo tengo, no lo duplico: abro el que hay.
    const already = findByTmdbId(hit.tmdbId);
    if (already) {
      router.replace(`/titulo/${already.id}` as never);
      return;
    }
    setAdding(hit.tmdbId);
    setFailed(null);
    try {
      const d = await fetchDetails(hit.kind, hit.tmdbId);
      const id = insertMovieReturningId({
        kind: hit.kind,
        status: 'wishlist',
        title: d.title || hit.title,
        ...tmdbColumns(d, hit.tmdbId),
      });
      router.replace(`/titulo/${id}` as never);
    } catch (e) {
      setAdding(null);
      setFailed(e instanceof Error ? e.message : 'No se ha podido añadir');
    }
  };

  return (
    <View style={styles.root}>
      <Stack.Screen options={{ title: kind ? `Añadir ${noun}` : 'Añadir un título' }} />

      <View style={styles.searchWrap}>
        <View style={styles.search}>
          <Icon name="magnify" size={20} color={th.textMuted} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder={tmdbOn ? (kind ? KIND_META[kind].label : 'Película o serie') : 'Título'}
            placeholderTextColor={th.textMuted}
            style={styles.input}
            autoFocus
            returnKeyType="search"
          />
          {query ? (
            <Pressable hitSlop={8} onPress={() => setQuery('')} accessibilityLabel="Borrar">
              <Icon name="close-circle" size={18} color={th.textMuted} />
            </Pressable>
          ) : null}
        </View>
        {!tmdbOn ? (
          <Pressable onPress={() => router.push('/ajustes')} hitSlop={6}>
            <Text style={styles.hint}>
              Sin la key de TMDB no hay búsqueda. <Text style={styles.hintLink}>Ponla en Ajustes</Text>
            </Text>
          </Pressable>
        ) : null}
        {error ? <Text style={styles.hint}>{error}</Text> : null}
        {failed ? <Text style={styles.error}>{failed}</Text> : null}
      </View>

      <FlatList
        data={hits}
        keyExtractor={(h) => `${h.kind}-${h.tmdbId}`}
        contentContainerStyle={styles.list}
        keyboardShouldPersistTaps="handled"
        renderItem={({ item: h, index }) => (
          <Animated.View entering={FadeIn.delay(Math.min(index, 6) * 30).duration(200)}>
            <PressScale onPress={() => pick(h)} style={styles.row} scaleTo={0.985}>
              <View style={styles.poster}>
                {h.posterUrl ? (
                  <Image source={{ uri: h.posterUrl }} style={StyleSheet.absoluteFill} contentFit="cover" />
                ) : (
                  <Icon name={KIND_META[h.kind].icon} size={18} color={th.textMuted} />
                )}
              </View>
              <View style={{ flex: 1, gap: 3 }}>
                <Text style={styles.title} numberOfLines={2}>
                  {h.title}
                </Text>
                <Text style={styles.meta} numberOfLines={1}>
                  {KIND_META[h.kind].label}
                  {h.year ? ` · ${h.year}` : ''}
                  {h.originalTitle ? ` · ${h.originalTitle}` : ''}
                </Text>
              </View>
              {adding === h.tmdbId ? (
                <ActivityIndicator size="small" color={th.textMuted} />
              ) : mine.has(h.tmdbId) ? (
                <Owned status={mine.get(h.tmdbId)!.status} />
              ) : (
                <Icon name="plus-circle-outline" size={22} color={th.textMuted} />
              )}
            </PressScale>
          </Animated.View>
        )}
        ListEmptyComponent={
          <View style={styles.empty}>
            {loading ? (
              <>
                <ActivityIndicator size="small" color={th.textMuted} />
                <Text style={styles.hint}>Buscando en TMDB…</Text>
              </>
            ) : (
              <>
                <Icon name="movie-search-outline" size={34} color={th.border} />
                <Text style={styles.hint}>
                  {query.trim().length >= 2
                    ? 'Nada con ese nombre en TMDB'
                    : `Escribe el título de ${noun}`}
                </Text>
              </>
            )}
          </View>
        }
      />

      <View style={[styles.footer, { paddingBottom: insets.bottom + 16 }]}>
        <PressScale
          onPress={() => router.replace((kind ? `/edit?kind=${kind}` : '/edit') as never)}
          style={styles.manual}
        >
          <Icon name="pencil-plus-outline" size={19} color={th.text} />
          <Text style={styles.manualText}>Añadirlo a mano</Text>
        </PressScale>
      </View>
    </View>
  );
}

/** "Ya la tienes", con el color de su estado. Tocarla abre su ficha. */
function Owned({ status }: { status: MovieStatus }) {
  const m = STATUS_META[status];
  return (
    <View style={styles.owned}>
      <Icon name={m.icon} size={15} color={m.color} />
      <Text style={styles.ownedText}>Ya la tienes</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: th.background },
  searchWrap: { padding: 16, gap: 8 },
  search: {
    height: 50,
    borderRadius: 14,
    backgroundColor: th.surface,
    borderWidth: 1,
    borderColor: th.accent,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
  },
  input: { flex: 1, color: th.text, fontSize: 16 },
  hint: { color: th.textMuted, fontSize: 12, lineHeight: 17, textAlign: 'center' },
  hintLink: { color: th.accent, fontWeight: '700' },
  error: { color: '#FF6B7A', fontSize: 12 },
  list: { paddingHorizontal: 16, paddingBottom: 20, gap: 8 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: 8,
    borderRadius: 14,
    backgroundColor: th.surface,
  },
  poster: {
    width: 44,
    height: 66,
    borderRadius: 6,
    backgroundColor: th.surfaceHigh,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { color: th.text, fontSize: 16, fontWeight: '600' },
  meta: { color: th.textMuted, fontSize: 12 },
  owned: { alignItems: 'center', gap: 2 },
  ownedText: { color: th.textMuted, fontSize: 10, fontWeight: '700' },
  empty: { alignItems: 'center', gap: 12, paddingTop: 60, paddingHorizontal: 40 },
  footer: { padding: 16, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: th.border },
  manual: {
    height: 50,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: th.border,
    backgroundColor: th.surface,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 9,
  },
  manualText: { color: th.text, fontSize: 15, fontWeight: '700', fontFamily: DISPLAY, letterSpacing: 0.5 },
});
