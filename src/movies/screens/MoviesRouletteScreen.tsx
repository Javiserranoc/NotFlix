import { LinearGradient } from 'expo-linear-gradient';
import { router, Stack } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import Animated, { FadeIn, useAnimatedStyle, useSharedValue, withSequence, withSpring, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon } from '../../core/ui/Icon';
import { PressScale } from '../../core/ui/PressScale';
import { movieMeta, Poster } from '../components/MovieRow';
import type { MovieKind } from '../enums';
import { randomWishlist, useWishlist } from '../repo';
import type { MovieEntry } from '../schema';
import { DISPLAY, GOLD, moviesTheme as th } from '../theme';

/** Se sortea entre películas o entre series, nunca las dos a la vez. */
const FILTERS = [
  { id: 'movies', label: 'Películas', filter: { kind: 'movie' as const } },
  { id: 'short', label: 'Menos de 2 h', filter: { kind: 'movie' as const, maxMinutes: 120 } },
  { id: 'series', label: 'Series', filter: { kind: 'series' as const } },
] as const;

type FilterId = (typeof FILTERS)[number]['id'];
type Filter = { kind?: 'movie' | 'series'; maxMinutes?: number };

/** El mismo criterio que `randomWishlist`, para los pósters que pasan girando. */
const fits = (e: MovieEntry, f: Filter) =>
  (!f.kind || e.kind === f.kind) &&
  (!f.maxMinutes || (e.runtimeMinutes != null && e.runtimeMinutes <= f.maxMinutes));

/** Cuántos pósters pasan volando antes de parar, y cuánto frena cada uno. */
const TICKS = 11;
const FIRST_TICK_MS = 55;
const SLOWDOWN_MS = 17;

/** Lo que ocupa todo menos el póster: cabecera, textos, filtros, botones y huecos. */
const RESERVED_HEIGHT = 430;
const MIN_POSTER = 110;
const MAX_POSTER = 210;

/**
 * "¿Qué vemos?": sortea un título de la lista de deseadas. La animación no es
 * adorno: sin ella el resultado aparece de golpe y no se distingue de haber
 * abierto una ficha cualquiera. Al pasar pósters y frenar, el sorteo se ve.
 */
export function MoviesRouletteScreen({ kind }: { kind?: MovieKind }) {
  const pool = useWishlist(30);
  const firstFilter: FilterId = kind === 'series' ? 'series' : 'movies';
  const [filterId, setFilterId] = useState<FilterId>(firstFilter);
  const [pick, setPick] = useState<MovieEntry | undefined>();
  /** Póster que se ve mientras gira (no es el resultado). */
  const [flash, setFlash] = useState<MovieEntry | undefined>();
  const [spinning, setSpinning] = useState(false);
  /** El filtro elegido no deja nada: se dice, en vez de un póster vacío mudo. */
  const [noMatch, setNoMatch] = useState(false);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  const pop = useSharedValue(1);
  const wobble = useSharedValue(0);

  const clearTimers = useCallback(() => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
  }, []);

  useEffect(() => clearTimers, [clearTimers]);

  const spin = useCallback(
    (id: FilterId) => {
      clearTimers();
      const filter: Filter = FILTERS.find((f) => f.id === id)?.filter ?? {};
      const chosen = randomWishlist(filter);
      setNoMatch(!chosen);
      if (!chosen) {
        setPick(undefined);
        setFlash(undefined);
        setSpinning(false);
        return;
      }

      // Los pósters que pasan volando son los que podrían salir: con "Serie"
      // no tiene sentido ver pasar películas. Empieza en un punto al azar
      // para que dos sorteos seguidos no repitan la misma secuencia.
      const matching = pool.filter((e) => fits(e, filter));
      const reel = matching.length > 0 ? matching : [chosen];
      const offset = Math.floor(Math.random() * reel.length);
      setSpinning(true);
      setPick(undefined);

      let at = 0;
      let step = FIRST_TICK_MS;
      for (let i = 0; i < TICKS; i++) {
        at += step;
        step += SLOWDOWN_MS; // cada vuelta tarda un poco más: frena
        const item = reel[(offset + i) % reel.length]!;
        timers.current.push(
          setTimeout(() => setFlash(item), at),
        );
      }

      timers.current.push(
        setTimeout(() => {
          setFlash(undefined);
          setPick(chosen);
          setSpinning(false);
          pop.value = withSequence(withTiming(1.08, { duration: 130 }), withSpring(1, { damping: 9, stiffness: 180 }));
          wobble.value = withSequence(withTiming(-2, { duration: 90 }), withSpring(0, { damping: 8 }));
        }, at + step),
      );
    },
    [clearTimers, pool, pop, wobble],
  );

  // Primer sorteo en cuanto hay lista.
  const started = useRef(false);
  useEffect(() => {
    if (started.current || pool.length === 0) return;
    started.current = true;
    spin(firstFilter);
  }, [pool.length, spin, firstFilter]);

  const card = useAnimatedStyle(() => ({
    transform: [{ scale: pop.value }, { rotate: `${wobble.value}deg` }],
  }));

  const insets = useSafeAreaInsets();
  // El póster cede el sitio que falte: en un iPhone pequeño, a 210 de ancho
  // empujaba los filtros debajo de los botones.
  const free = useWindowDimensions().height - insets.top - insets.bottom - RESERVED_HEIGHT;
  const posterWidth = Math.round(Math.max(MIN_POSTER, Math.min(MAX_POSTER, (free * 2) / 3)));

  const shown = flash ?? pick;
  const activeFilter: Filter = FILTERS.find((f) => f.id === filterId)?.filter ?? {};
  const matching = pool.filter((e) => fits(e, activeFilter)).length;

  return (
    <View style={styles.root}>
      <Stack.Screen options={{ title: '¿Qué vemos?' }} />
      <LinearGradient
        colors={['#3A0B14', 'rgba(58,11,20,0)']}
        style={styles.curtain}
        pointerEvents="none"
      />

      <View style={styles.middle}>
        <Text style={styles.intro}>
          {matching > 0
            ? `De tus ${matching} deseadas, la suerte dice:`
            : pool.length > 0
              ? 'Aquí no hay nada que sortear'
              : 'Tu lista de deseadas está vacía'}
        </Text>

        {shown ? (
          <Animated.View style={[styles.posterWrap, card]}>
            <Poster entry={shown} width={posterWidth} />
          </Animated.View>
        ) : (
          <View style={[styles.posterWrap, styles.posterEmpty, { width: posterWidth, height: posterWidth * 1.5 }]}>
            <Icon name="dice-multiple-outline" size={40} color={th.textMuted} />
          </View>
        )}

        {pick && !spinning ? (
          <Animated.View entering={FadeIn.duration(220)} style={styles.info}>
            <Text style={styles.title}>{pick.title}</Text>
            <Text style={styles.muted}>{movieMeta(pick)}</Text>
            {pick.genres ? <Text style={[styles.muted, { fontSize: 12 }]}>{pick.genres}</Text> : null}
          </Animated.View>
        ) : (
          <View style={styles.info}>
            {noMatch && pool.length > 0 ? (
              <Text style={[styles.muted, { textAlign: 'center' }]}>
                {filterId === 'short'
                  ? 'Nada de tu lista dura menos de 2 h.\nSolo entran los que tienen duración.'
                  : 'Nada de tu lista encaja con este filtro.'}
              </Text>
            ) : (
              <Text style={styles.title}>{spinning ? '…' : ''}</Text>
            )}
          </View>
        )}

        <View style={styles.filters}>
          {FILTERS.map((f) => {
            const active = filterId === f.id;
            return (
              <Pressable
                key={f.id}
                onPress={() => {
                  setFilterId(f.id);
                  spin(f.id);
                }}
                style={[
                  styles.chip,
                  { borderColor: active ? th.accent : th.border, backgroundColor: active ? th.accent : 'transparent' },
                ]}
              >
                <Text style={[styles.chipText, { color: active ? th.onAccent : th.text }]}>{f.label}</Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <View style={[styles.actions, { paddingBottom: insets.bottom + 20 }]}>
        <PressScale
          disabled={!pick || spinning}
          onPress={() => pick && router.replace(`/titulo/${pick.id}` as never)}
          style={[styles.primary, (!pick || spinning) && { opacity: 0.4 }]}
        >
          <Text style={styles.primaryText}>Ver su ficha</Text>
        </PressScale>
        <PressScale
          disabled={spinning || pool.length === 0}
          onPress={() => spin(filterId)}
          style={[styles.secondary, (spinning || pool.length === 0) && { opacity: 0.5 }]}
        >
          <Icon name="dice-multiple" size={20} color={GOLD} />
          <Text style={styles.secondaryText}>Otra</Text>
        </PressScale>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: th.background },
  curtain: { position: 'absolute', left: 0, right: 0, top: 0, height: 260, opacity: 0.85 },
  middle: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 20, paddingHorizontal: 28 },
  intro: { color: th.textMuted, fontSize: 13, textAlign: 'center' },
  posterWrap: {
    borderRadius: 14,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.65,
    shadowRadius: 26,
    shadowOffset: { width: 0, height: 14 },
    elevation: 18,
  },
  posterEmpty: {
    backgroundColor: th.surface,
    borderWidth: 1,
    borderColor: th.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  info: { alignItems: 'center', gap: 6, minHeight: 74 },
  title: { color: th.text, fontFamily: DISPLAY, fontSize: 34, lineHeight: 36, textAlign: 'center' },
  muted: { color: th.textMuted, fontSize: 14 },
  filters: { flexDirection: 'row', gap: 7 },
  chip: {
    height: 32,
    paddingHorizontal: 13,
    borderRadius: 99,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipText: { fontSize: 13, fontWeight: '700' },
  actions: { paddingHorizontal: 20, gap: 10 },
  primary: {
    height: 52,
    borderRadius: 16,
    backgroundColor: th.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryText: { color: th.onAccent, fontSize: 16, fontWeight: '700' },
  secondary: {
    height: 52,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: th.border,
    backgroundColor: th.surface,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 9,
  },
  secondaryText: { color: th.text, fontSize: 16, fontWeight: '700' },
});
