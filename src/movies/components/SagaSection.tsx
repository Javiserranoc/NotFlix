import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';

import { Icon } from '../../core/ui/Icon';
import { showToast } from '../../core/toast';
import { addWishlistFromTmdb, findByTmdbIds } from '../repo';
import type { MovieEntry } from '../schema';
import { STATUS_META } from '../enums';
import { fetchCollection, type TmdbCollection, useTmdbEnabled } from '../tmdb';
import { GOLD, moviesTheme as th } from '../theme';

/**
 * "¿Y la siguiente?": las partes de la saga en orden de estreno, marcando las
 * que ya tengo y ofreciendo añadir la que falta con un toque.
 *
 * La saga se pide a TMDB al abrir la ficha y no se guarda: crece con el tiempo
 * (Dune ya lista la parte de 2026) y un caché nuestro envejecería. Sin red no
 * se pinta nada y el resto de la ficha funciona igual.
 */
export function SagaSection({ entry: e }: { entry: MovieEntry }) {
  const collectionId = e.collectionId;
  const tmdbOn = useTmdbEnabled();
  /**
   * El resultado lleva pegada la saga que lo produjo, así que "cargando" se
   * deduce de que no coincida con la de ahora. El efecto solo escribe estado
   * dentro de sus callbacks (regla react-hooks/set-state-in-effect).
   */
  const [loaded, setLoaded] = useState<{ id: number | null; saga: TmdbCollection | null }>({
    id: null,
    saga: null,
  });

  useEffect(() => {
    if (!tmdbOn || collectionId == null) return;
    const ctrl = new AbortController();
    fetchCollection(collectionId, ctrl.signal)
      .then((c) => setLoaded({ id: collectionId, saga: c }))
      .catch((err: unknown) => {
        if (err instanceof Error && err.name === 'AbortError') return;
        setLoaded({ id: collectionId, saga: null }); // Sin saga: no se pinta.
      });
    return () => ctrl.abort();
  }, [tmdbOn, collectionId]);

  const loading = loaded.id !== collectionId;
  const saga = loaded.id === collectionId ? loaded.saga : null;

  if (collectionId == null) return null;
  if (loading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="small" color={th.textMuted} />
        <Text style={styles.muted}>Buscando la saga…</Text>
      </View>
    );
  }
  if (!saga || saga.parts.length < 2) return null;

  const mine = new Map(findByTmdbIds(saga.parts.map((p) => p.tmdbId)).map((m) => [m.tmdbId, m]));
  const index = saga.parts.findIndex((p) => p.tmdbId === e.tmdbId);
  /** La siguiente: la primera estrenada, posterior a esta, que no he visto. */
  const next = saga.parts.find((p, i) => {
    if (i <= index || !p.released) return false;
    const m = mine.get(p.tmdbId);
    return !m || m.status !== 'completed';
  });

  const add = (part: (typeof saga.parts)[number]) => {
    addWishlistFromTmdb({
      kind: 'movie', // las sagas de TMDB solo agrupan películas
      tmdbId: part.tmdbId,
      title: part.title,
      year: part.year,
      posterUrl: part.posterUrl,
      collectionId: saga.id,
      collectionName: saga.name,
    });
    showToast(`${part.title} a tu lista`);
  };

  return (
    <Animated.View entering={FadeIn.duration(260)} style={{ gap: 12 }}>
      <View style={styles.head}>
        <Text style={styles.label}>SAGA</Text>
        <Text style={styles.sagaName} numberOfLines={1}>
          {saga.name}
        </Text>
      </View>

      {next ? (
        <Pressable
          onPress={() => {
            const m = mine.get(next.tmdbId);
            if (m) router.push(`/titulo/${m.id}` as never);
            else add(next);
          }}
          style={({ pressed }) => [styles.next, pressed && { opacity: 0.9 }]}
        >
          <Icon name={mine.has(next.tmdbId) ? 'arrow-right-circle' : 'plus-circle'} size={22} color={GOLD} />
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={styles.nextLabel}>La siguiente</Text>
            <Text style={styles.nextTitle} numberOfLines={1}>
              {next.title}
              {next.year ? ` · ${next.year}` : ''}
            </Text>
          </View>
          <Text style={styles.nextAction}>{mine.has(next.tmdbId) ? 'Ver' : 'Añadir'}</Text>
        </Pressable>
      ) : null}

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.shelf}>
        {saga.parts.map((p, i) => {
          const m = mine.get(p.tmdbId);
          const isThis = p.tmdbId === e.tmdbId;
          return (
            <Pressable
              key={p.tmdbId}
              onPress={() => (m ? router.push(`/titulo/${m.id}` as never) : p.released ? add(p) : undefined)}
              style={({ pressed }) => [styles.part, pressed && { opacity: 0.85 }]}
            >
              <View style={[styles.partPoster, isThis && { borderColor: GOLD, borderWidth: 2 }]}>
                {p.posterUrl ? (
                  <Animated.Image source={{ uri: p.posterUrl }} style={styles.poster} entering={FadeIn} />
                ) : (
                  <View style={[styles.poster, styles.posterEmpty]}>
                    <Icon name="movie-open-outline" size={18} color={th.textMuted} />
                  </View>
                )}
                {m ? (
                  <View style={[styles.dot, { backgroundColor: STATUS_META[m.status].color }]} />
                ) : !p.released ? (
                  <View style={styles.soon}>
                    <Text style={styles.soonText}>{p.year ?? '—'}</Text>
                  </View>
                ) : (
                  <View style={styles.missing}>
                    <Icon name="plus" size={13} color={th.text} />
                  </View>
                )}
              </View>
              <Text style={[styles.partTitle, isThis && { color: GOLD }]} numberOfLines={2}>
                {i + 1}. {p.title}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'baseline', gap: 10 },
  label: { color: th.textMuted, fontSize: 11, fontWeight: '600', letterSpacing: 1.2 },
  sagaName: { flex: 1, color: th.text, fontSize: 13, fontWeight: '600' },
  muted: { color: th.textMuted, fontSize: 12 },
  loading: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  next: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    height: 62,
    paddingHorizontal: 14,
    borderRadius: 14,
    backgroundColor: th.surface,
    borderWidth: 1,
    borderColor: th.border,
  },
  nextLabel: { color: th.textMuted, fontSize: 11, letterSpacing: 0.6 },
  nextTitle: { color: th.text, fontSize: 15, fontWeight: '700' },
  nextAction: { color: GOLD, fontSize: 13, fontWeight: '800' },
  shelf: { gap: 10, paddingRight: 4 },
  part: { width: 74, gap: 5 },
  partPoster: { width: 74, height: 111, borderRadius: 8, overflow: 'hidden', backgroundColor: th.surfaceHigh },
  poster: { width: '100%', height: '100%' },
  posterEmpty: { alignItems: 'center', justifyContent: 'center' },
  partTitle: { color: th.textMuted, fontSize: 11, lineHeight: 14 },
  dot: { position: 'absolute', top: 6, right: 6, width: 10, height: 10, borderRadius: 5 },
  missing: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: 'rgba(14,10,11,0.75)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  soon: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(14,10,11,0.8)',
    paddingVertical: 2,
    alignItems: 'center',
  },
  soonText: { color: th.textMuted, fontSize: 10, fontWeight: '700' },
});
