import { Image } from 'expo-image';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { useEffect, useState } from 'react';

import { Icon } from '../../core/ui/Icon';
import { showToast } from '../../core/toast';
import { PressScale } from '../../core/ui/PressScale';
import type { MovieKind } from '../enums';
import { addWishlistFromTmdb, findByTmdbIds, recommendationSource } from '../repo';
import { fetchRecommendations, type TmdbHit, useTmdbEnabled } from '../tmdb';
import { CREAM, GOLD, INK, moviesTheme as th, sectionTitle } from '../theme';

/**
 * "Porque te gustó X": la lista de parecidos que da TMDB a partir de un título
 * tuyo. Sin LLM: es su propia recomendación.
 *
 * Se pide al abrir Inicio y no se guarda. Si no hay red la fila no aparece: es
 * un extra, no parte de la app. El título de partida sale de
 * `recommendationSource()`, que ya no exige tener nada puntuado con 8.
 */
export function RecommendedRow({ kind }: { kind: MovieKind }) {
  const tmdbOn = useTmdbEnabled();
  // Se elige una vez al montar: cada "+" de la fila renueva `updated_at`, y
  // sin fijarla el título de partida saltaría al recién añadido y la fila
  // entera cambiaría bajo el dedo. Si al montar no había ninguno, se sigue
  // buscando en cada render hasta que aparezca.
  const [initial] = useState(() => recommendationSource(kind));
  const picked = initial ?? recommendationSource(kind);
  const source = picked?.entry;
  const sourceId = source?.tmdbId ?? null;
  const sourceKind = source?.kind ?? null;

  const [loaded, setLoaded] = useState<{ id: number | null; hits: TmdbHit[] }>({ id: null, hits: [] });

  useEffect(() => {
    if (!tmdbOn || sourceKind == null || sourceId == null) return;
    const ctrl = new AbortController();
    fetchRecommendations(sourceKind, sourceId, ctrl.signal)
      .then((hits) => setLoaded({ id: sourceId, hits }))
      .catch((err: unknown) => {
        if (err instanceof Error && err.name === 'AbortError') return;
        setLoaded({ id: sourceId, hits: [] });
      });
    return () => ctrl.abort();
    // Solo el id y el tipo: `source` es una fila nueva en cada render y pedirla
    // como dependencia dispararia una peticion por render.
  }, [tmdbOn, sourceId, sourceKind]);

  if (source == null || sourceId == null || loaded.id !== sourceId) return null;

  // Lo que ya tengo no es una recomendación.
  const mine = new Set(findByTmdbIds(loaded.hits.map((h) => h.tmdbId)).map((m) => m.tmdbId));
  const hits = loaded.hits.filter((h) => !mine.has(h.tmdbId)).slice(0, 8);
  if (hits.length === 0) return null;

  const add = (hit: TmdbHit) => {
    addWishlistFromTmdb({
      kind: hit.kind, // si partimos de una serie, lo parecido son series
      tmdbId: hit.tmdbId,
      title: hit.title,
      year: hit.year,
      posterUrl: hit.posterUrl,
      collectionId: null,
      collectionName: null,
    });
    showToast(`${hit.title} a tu lista`);
  };

  return (
    <Animated.View entering={FadeIn.duration(300)} style={{ gap: 10 }}>
      <Text style={styles.label} numberOfLines={1}>
        {picked?.liked ? 'PORQUE TE GUSTÓ' : 'PARECIDAS A'} {source.title.toUpperCase()}
      </Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.shelf}>
        {hits.map((h) => (
          <PressScale key={h.tmdbId} onPress={() => add(h)} style={styles.item}>
            <View style={styles.poster}>
              {h.posterUrl ? (
                <Image source={{ uri: h.posterUrl }} style={StyleSheet.absoluteFill} contentFit="cover" />
              ) : null}
              <View style={styles.plus}>
                <Icon name="plus" size={13} color={INK} />
              </View>
            </View>
            <Text style={styles.title} numberOfLines={2}>
              {h.title}
            </Text>
          </PressScale>
        ))}
      </ScrollView>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  label: { ...sectionTitle, paddingHorizontal: 20 },
  shelf: { paddingHorizontal: 20, paddingBottom: 4, gap: 10 },
  item: { width: 84, gap: 5 },
  poster: {
    width: 84,
    height: 126,
    borderRadius: 8,
    backgroundColor: th.surfaceHigh,
    borderWidth: 2,
    borderColor: CREAM,
    overflow: 'hidden',
  },
  plus: {
    position: 'absolute',
    bottom: 5,
    right: 5,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: GOLD,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { color: th.textMuted, fontSize: 11, lineHeight: 14 },
});
