import { router } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { Icon } from '../../core/ui/Icon';
import { PressScale } from '../../core/ui/PressScale';
import { useMoviesKind } from '../components/KindSwitch';
import { MoviesMarquee } from '../components/MoviesMarquee';
import { RecommendedRow } from '../components/RecommendedRow';
import { formatRating, movieMeta, Poster } from '../components/MovieRow';
import { useTabBarSpace } from '../components/MoviesTabBar';
import { KIND_META, STATUS_CHOICES } from '../enums';
import { useMovieCounts, useRecentlyWatched, useWishlist } from '../repo';
import { formatHours, useMovieStats } from '../stats';
import { BRICK, DISPLAY, GOLD, INK, moviesTheme as th, sectionTitle, stickerFace } from '../theme';

/**
 * Inicio del módulo: responde a "¿qué veo esta noche?", no es una lista.
 * La lista completa vive en Biblioteca.
 */
export function MoviesHomeScreen() {
  const kind = useMoviesKind();
  const counts = useMovieCounts(kind);
  const wishlist = useWishlist(6, kind);
  const recent = useRecentlyWatched(kind, 3);
  const thisYear = new Date().getFullYear();
  const stats = useMovieStats(thisYear, kind);
  const bottom = useTabBarSpace();
  const total = STATUS_CHOICES.reduce((n, s) => n + counts[s], 0);
  const label = KIND_META[kind].label.toLowerCase();
  const search = `/buscar?kind=${kind}` as never;

  return (
    <View style={styles.root}>
      <ScrollView contentContainerStyle={{ paddingBottom: bottom }} showsVerticalScrollIndicator={false}>
        <MoviesMarquee
          counts={counts}
          minutes={formatHours(stats.minutes)}
          onSearch={() => router.push('/biblioteca?buscar=1' as never)}
        />

        {total === 0 ? (
          /* Biblioteca vacía: una sola cosa que hacer, y grande. */
          <Animated.View entering={FadeInDown.duration(300)} style={styles.emptyBox}>
            <Icon name="filmstrip-box-multiple" size={44} color={th.border} />
            <Text style={styles.emptyTitle}>Aún no hay {KIND_META[kind].plural.toLowerCase()}</Text>
            <Text style={styles.emptyText}>
              Busca una {label} y se guarda con su póster, su sinopsis y su duración.
            </Text>
            <PressScale onPress={() => router.push(search)} style={styles.emptyBtn}>
              <Icon name="magnify" size={20} color={INK} />
              <Text style={styles.emptyBtnText}>Buscar mi primera {label}</Text>
            </PressScale>
            <Pressable hitSlop={8} onPress={() => router.push(`/edit?kind=${kind}` as never)}>
              <Text style={styles.emptyLink}>o añadirlo a mano</Text>
            </Pressable>
          </Animated.View>
        ) : (
        <View style={styles.body}>
          {/* La ruleta: el atajo para cuando no sabes qué ver. */}
          <PressScale onPress={() => router.push(`/ruleta?kind=${kind}` as never)} style={styles.roulette}>
            <Icon name="dice-multiple" size={26} color={GOLD} />
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={styles.rouletteTitle}>¿Qué vemos?</Text>
              <Text style={styles.muted}>
                {counts.wishlist > 0
                  ? `Que la suerte elija de tus ${counts.wishlist} deseadas`
                  : 'Añade algo a tu lista y la suerte elegirá'}
              </Text>
            </View>
            <Icon name="chevron-right" size={20} color={th.textMuted} />
          </PressScale>

          {/* Tu lista */}
          <Animated.View entering={FadeInDown.delay(60).duration(280)} style={{ gap: 10 }}>
            <View style={styles.sectionHead}>
              <Text style={styles.sectionLabel}>TU LISTA</Text>
              <Pressable hitSlop={8} onPress={() => router.push('/biblioteca' as never)}>
                <Text style={styles.link}>Ver todo</Text>
              </Pressable>
            </View>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.shelf}
            >
              {wishlist.map((e) => (
                <PressScale key={e.id} onPress={() => router.push(`/titulo/${e.id}` as never)}>
                  <Poster entry={e} width={96} />
                </PressScale>
              ))}
              <Pressable onPress={() => router.push(search)} style={styles.addTile}>
                <Icon name="plus" size={20} color={th.textMuted} />
                <Text style={[styles.muted, { fontSize: 11 }]}>Añadir</Text>
              </Pressable>
            </ScrollView>
          </Animated.View>

          {/* Con `key`: el título de partida se elige al montar, y cada tipo tiene el suyo. */}
          <RecommendedRow key={kind} kind={kind} />

          {/* Lo último que viste */}
          {recent.length > 0 ? (
            <Animated.View entering={FadeInDown.delay(120).duration(280)} style={{ gap: 4 }}>
              <Text style={[styles.sectionLabel, { paddingHorizontal: 20, marginBottom: 6 }]}>
                LO ÚLTIMO QUE VISTE
              </Text>
              {recent.map((e) => (
                <PressScale
                  key={e.id}
                  onPress={() => router.push(`/titulo/${e.id}` as never)}
                  style={styles.recentRow}
                  scaleTo={0.985}
                >
                  <Poster entry={e} width={36} />
                  <View style={{ flex: 1, gap: 2 }}>
                    <Text style={styles.recentTitle} numberOfLines={1}>
                      {e.title}
                    </Text>
                    <Text style={[styles.muted, { fontSize: 12 }]} numberOfLines={1}>
                      {movieMeta(e)}
                    </Text>
                  </View>
                  {e.rating != null ? (
                    <View style={styles.rating}>
                      <Icon name="star" size={15} color={GOLD} />
                      <Text style={styles.ratingText}>{formatRating(e.rating)}</Text>
                    </View>
                  ) : null}
                </PressScale>
              ))}
            </Animated.View>
          ) : null}
        </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: th.background },
  body: { paddingTop: 20, gap: 20 },
  roulette: {
    marginHorizontal: 20,
    height: 76,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: GOLD,
    backgroundColor: th.surface,
    boxShadow: `3px 4px 0 ${BRICK}`,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingHorizontal: 16,
    overflow: 'hidden',
  },
  rouletteTitle: { color: th.text, fontFamily: DISPLAY, textTransform: 'uppercase', fontSize: 20, lineHeight: 24 },
  muted: { color: th.textMuted, fontSize: 12 },
  sectionHead: { flexDirection: 'row', alignItems: 'baseline', paddingHorizontal: 20 },
  sectionLabel: { ...sectionTitle, flex: 1 },
  link: { color: GOLD, fontSize: 12, fontWeight: '700' },
  shelf: { paddingHorizontal: 20, paddingBottom: 4, gap: 10 },
  addTile: {
    width: 96,
    height: 144,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: th.border,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  recentRow: {
    marginHorizontal: 20,
    height: 58,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  recentTitle: { color: th.text, fontSize: 15, fontWeight: '600' },
  rating: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  ratingText: { color: th.text, fontSize: 14, fontWeight: '700', fontVariant: ['tabular-nums'] },
  emptyBox: { alignItems: 'center', gap: 14, paddingTop: 54, paddingHorizontal: 34 },
  emptyTitle: { color: th.text, fontFamily: DISPLAY, textTransform: 'uppercase', fontSize: 26, lineHeight: 32, letterSpacing: 0.5, textAlign: 'center' },
  emptyText: { color: th.textMuted, fontSize: 14, lineHeight: 20, textAlign: 'center' },
  emptyBtn: {
    marginTop: 6,
    height: 50,
    paddingHorizontal: 20,
    borderRadius: 16,
    ...stickerFace,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
  },
  emptyBtnText: { color: INK, fontSize: 15, fontWeight: '800' },
  emptyLink: { color: th.textMuted, fontSize: 13, fontWeight: '600' },
});
