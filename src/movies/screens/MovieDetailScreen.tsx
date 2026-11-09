import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, type ViewStyle, View } from 'react-native';
import Animated, {
  Extrapolation,
  FadeInDown,
  interpolate,
  type SharedValue,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { pickDay } from '../../core/ui/DatePicker';
import { Icon } from '../../core/ui/Icon';
import { StatusChip } from '../../core/ui/StatusChip';
import { showToast } from '../../core/toast';
import { formatRating, formatRuntime, movieMeta, Poster } from '../components/MovieRow';
import { STATUS_CHOICES, STATUS_META } from '../enums';
import { SagaSection } from '../components/SagaSection';
import {
  isPartial,
  logWatch,
  removeWatch,
  setRating,
  setStatus,
  setWatchDate,
  softDelete,
  tmdbColumns,
  toggleWatchedSeason,
  updateMovie,
  useMovie,
  useWatches,
} from '../repo';
import type { MovieEntry } from '../schema';
import { airedSeasons, parseSeasons, parseWatchedSeasons, seasonsTotals } from '../seasons';
import { formatDate, pickedDayIso } from '../stats';
import { fetchDetails, useTmdbEnabled } from '../tmdb';
import { BRICK, CREAM, DISPLAY, GOLD, INK, moviesTheme as th, sectionTitle, stickerText, VELVET } from '../theme';

/** Alto de la cabecera; el parallax se calcula contra el. */
const HERO_HEIGHT = 300;

/** Selector de la fecha de un visionado, sin días futuros. */
function pickWatchDay(current: string | undefined, onPicked: (iso: string) => void) {
  pickDay(current ? new Date(current) : new Date(), (day) => onPicked(pickedDayIso(day)));
}

export function MovieDetailScreen({ id }: { id: string }) {
  const e = useMovie(id);
  const tmdbOn = useTmdbEnabled();
  const [confirmDelete, setConfirmDelete] = useState(false);
  /** Poner la nota es el gesto que mas se repite: se ofrece al marcar Vista. */
  const [askRating, setAskRating] = useState(false);
  const watches = useWatches(id);
  // El desplazamiento vive en el hilo de UI: el backdrop se mueve sin pasar por
  // JS, asi que no se entrecorta aunque la ficha sea larga.
  const scrollY = useSharedValue(0);
  const onScroll = useAnimatedScrollHandler((ev) => {
    scrollY.value = ev.contentOffset.y;
  });
  const insets = useSafeAreaInsets();

  // Lo añadido desde una saga o una recomendación entra a medias (título y
  // póster). Al abrirlo se completa solo desde TMDB: antes había que buscarlo
  // otra vez a mano. Si no hay red se queda como está y no pasa nada.
  const partialKind = e && !e.deletedAt && isPartial(e) ? e.kind : null;
  const partialTmdbId = partialKind ? e?.tmdbId : null;
  useEffect(() => {
    if (!tmdbOn || partialKind == null || partialTmdbId == null) return;
    const ctrl = new AbortController();
    fetchDetails(partialKind, partialTmdbId, ctrl.signal)
      .then((d) => updateMovie(id, tmdbColumns(d, partialTmdbId)))
      .catch(() => {});
    return () => ctrl.abort();
  }, [tmdbOn, id, partialKind, partialTmdbId]);

  if (!e || e.deletedAt) {
    return (
      <View style={[styles.root, styles.gone]}>
        <Text style={styles.muted}>{e ? 'Este título ya no existe' : ''}</Text>
        {e ? (
          <Pressable onPress={() => router.back()} style={styles.goneBtn}>
            <Icon name="arrow-left" size={18} color={th.text} />
            <Text style={styles.btnText}>Volver</Text>
          </Pressable>
        ) : null}
      </View>
    );
  }

  const seasons = parseSeasons(e.seasonsJson);
  const aired = airedSeasons(seasons);
  const watched = parseWatchedSeasons(e.watchedSeasonsJson);
  const totals = seasonsTotals(seasons, e.runtimeMinutes);
  const watchedEpisodes = aired
    .filter((x) => watched.includes(x.season))
    .reduce((n, x) => n + x.episodes, 0);

  return (
    <View style={styles.root}>
      {/* La barra es nuestra (cristal sobre el backdrop), no la del Stack. */}
      <View style={StyleSheet.absoluteFill}>
        <Animated.ScrollView
          contentContainerStyle={styles.content}
          onScroll={onScroll}
          scrollEventThrottle={16}
          showsVerticalScrollIndicator={false}
        >
          <Hero entry={e} scrollY={scrollY} />

          <View style={styles.body}>
            <Section label="Estado">
              <View style={styles.wrap}>
                {STATUS_CHOICES.map((s) => {
                  const m = STATUS_META[s];
                  const active = e.status === s;
                  return (
                    <Pressable
                      key={s}
                      onPress={() => {
                        if (active) return;
                        setStatus(e.id, s, e.status);
                        if (s === 'completed' && e.rating == null) setAskRating(true);
                      }}
                      style={[
                        styles.choice,
                        { borderColor: active ? m.color : th.border, backgroundColor: active ? m.color + '40' : 'transparent' },
                      ]}
                    >
                      <Icon name={m.icon} size={16} color={m.color} />
                      <Text style={styles.choiceText}>{m.label}</Text>
                    </Pressable>
                  );
                })}
              </View>
            </Section>

            {askRating && e.rating == null ? (
              <Animated.View entering={FadeInDown.duration(220)} style={styles.askCard}>
                <View style={styles.askHead}>
                  <Icon name="star-outline" size={18} color={GOLD} />
                  <Text style={styles.askText}>¿Qué nota le pones?</Text>
                  <Pressable hitSlop={8} onPress={() => setAskRating(false)}>
                    <Text style={styles.askLater}>Luego</Text>
                  </Pressable>
                </View>
                <RatingRow
                  rating={e.rating}
                  onPick={(v) => {
                    setRating(e.id, v);
                    setAskRating(false);
                  }}
                />
              </Animated.View>
            ) : null}

            {e.kind === 'series' && seasons.length > 0 ? (
              <Section
                label={`Temporadas${aired.length > 0 ? ` · ${watched.length} de ${aired.length} vistas` : ''}`}
              >
                <View style={styles.seasons}>
                  {seasons.map((x, i) => {
                    const name = x.name === `Temporada ${x.season}` ? '' : x.name;
                    const seen = watched.includes(x.season);
                    const unaired = x.episodes === 0;
                    return (
                      <Pressable
                        key={x.season}
                        disabled={unaired}
                        onPress={() => toggleWatchedSeason(e, x.season)}
                       
                        style={[styles.seasonRow, i === seasons.length - 1 && { borderBottomWidth: 0 }]}
                      >
                        <Icon
                          name={seen ? 'check-circle' : unaired ? 'clock-outline' : 'circle-outline'}
                          size={20}
                          color={seen ? STATUS_META.completed.color : th.textMuted}
                        />
                        <Text style={[styles.seasonNum, seen && { color: STATUS_META.completed.color }]}>
                          T{x.season}
                        </Text>
                        <Text style={styles.seasonName} numberOfLines={1}>
                          {name}
                        </Text>
                        <Text style={styles.seasonMeta}>
                          {unaired ? 'sin estrenar' : `${x.episodes} ep.`}
                          {x.year ? ` · ${x.year}` : ''}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
                <Text style={[styles.muted, { fontSize: 12 }]}>
                  {watched.length > 0
                    ? `${watchedEpisodes} de ${totals.episodes} episodios${
                        e.runtimeMinutes ? ` · ${formatRuntime(watchedEpisodes * e.runtimeMinutes)} vistos` : ''
                      }`
                    : `${totals.episodes} episodios${
                        totals.minutes ? ` · ${formatRuntime(totals.minutes)} en total` : ''
                      } · toca una temporada para marcarla`}
                </Text>
              </Section>
            ) : null}

            {/* Historial: una peli vista tres veces son tres visionados. */}
            {watches.length > 0 || e.status === 'completed' ? (
              <Section label={watches.length > 1 ? `Visto ${watches.length} veces` : 'Cuándo lo vi'}>
                <View style={styles.seasons}>
                  {watches.map((v, i) => {
                    const when = formatDate(v.watchedAt);
                    return (
                      <View
                        key={v.id}
                        style={[styles.seasonRow, i === watches.length - 1 && { borderBottomWidth: 0 }]}
                      >
                        {/* Tocar la fecha la cambia: marcar Vista apunta hoy, y a menudo fue otro día. */}
                        <Pressable
                          onPress={() => pickWatchDay(v.watchedAt, (at) => setWatchDate(v.id, at))}
                          style={styles.watchDate}
                          accessibilityLabel={`Cambiar la fecha: ${when}`}
                        >
                          <Icon name="calendar-edit" size={18} color={th.textMuted} />
                          <Text style={[styles.text, { flex: 1, fontSize: 14 }]}>{when}</Text>
                        </Pressable>
                        <Pressable hitSlop={10} onPress={() => removeWatch(v.id)} accessibilityLabel="Quitar">
                          <Icon name="close" size={16} color={th.textMuted} />
                        </Pressable>
                      </View>
                    );
                  })}
                </View>
                <View style={styles.row}>
                  <Pressable onPress={() => logWatch(e.id)} style={[styles.againBtn, { flex: 1 }]}>
                    <Icon name="repeat" size={17} color={GOLD} />
                    <Text style={styles.againText}>Lo he vuelto a ver</Text>
                  </Pressable>
                  <Pressable
                    onPress={() => pickWatchDay(undefined, (at) => logWatch(e.id, at))}
                    style={[styles.againBtn, { paddingHorizontal: 14 }]}
                  >
                    <Icon name="calendar-plus" size={17} color={GOLD} />
                    <Text style={styles.againText}>Otro día…</Text>
                  </Pressable>
                </View>
              </Section>
            ) : null}

            <SagaSection entry={e} />

            <Section label="Mi nota">
              <RatingRow rating={e.rating} onPick={(v) => setRating(e.id, e.rating === v ? null : v)} />
              <Text style={[styles.muted, { fontSize: 11 }]}>Toca la misma nota para quitarla</Text>
            </Section>

            {e.overview ? (
              <Section label="Sinopsis">
                <Text style={[styles.text, styles.paragraph]}>{e.overview}</Text>
              </Section>
            ) : null}

            {e.notes ? (
              <Section label="Mi reseña">
                <Text style={[styles.text, styles.paragraph]}>{e.notes}</Text>
              </Section>
            ) : null}
          </View>
        </Animated.ScrollView>
        <TopBar title={e.title} scrollY={scrollY} />
      </View>

      <GlassBar
        onEdit={() => router.push(`/edit?id=${e.id}` as never)}
        onDelete={() => setConfirmDelete(true)}
      />

      {/* Flota sobre la ficha: dentro del scroll no se veía si habías bajado. */}
      {confirmDelete ? (
        <Animated.View
          entering={FadeInDown.duration(200)}
          style={[styles.confirm, { bottom: insets.bottom + 16 }]}
        >
          <Text style={styles.confirmText}>¿Eliminar “{e.title}”?</Text>
          <View style={styles.row}>
            <Pressable style={[styles.btn, { backgroundColor: th.surface }]} onPress={() => setConfirmDelete(false)}>
              <Text style={styles.btnText}>Cancelar</Text>
            </Pressable>
            <Pressable
              style={[styles.btn, { backgroundColor: th.accent }]}
              onPress={() => {
                softDelete(e.id);
                showToast('Eliminado');
                router.back();
              }}
            >
              <Text style={[styles.btnText, { color: th.onAccent }]}>Eliminar</Text>
            </Pressable>
          </View>
        </Animated.View>
      ) : null}
    </View>
  );
}

/**
 * Barra flotante sobre la carátula: atrás, editar y eliminar en tres botones de
 * cristal. Van encima del *backdrop*: difuminan lo que hay debajo en vez de
 * taparlo con un fondo sólido.
 */
function GlassBar({
  onEdit,
  onDelete,
}: {
  onEdit: () => void;
  onDelete: () => void;
}) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.glassBar, { top: insets.top + 8 }]} pointerEvents="box-none">
      <GlassButton icon="arrow-left" label="Atrás" onPress={() => router.back()} />
      <View style={{ flex: 1 }} />
      <GlassButton icon="pencil" label="Editar" onPress={onEdit} />
      <GlassButton icon="trash-can-outline" label="Eliminar" onPress={onDelete} />
    </View>
  );
}

function GlassButton({
  icon,
  label,
  onPress,
}: {
  icon: string;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [styles.glassBtn, pressed && { opacity: 0.75 }]}
    >
      <View style={styles.glassTint} />
      <Icon name={icon} size={20} color={th.text} />
    </Pressable>
  );
}

/**
 * Fondo de la barra de arriba. Con la carátula a la vista no hay nada (los
 * botones flotan sobre la imagen); al bajar aparece la sala con el título, y
 * las secciones ya no pasan por debajo de los botones a pelo.
 */
function TopBar({ title, scrollY }: { title: string; scrollY: SharedValue<number> }) {
  const insets = useSafeAreaInsets();
  const style = useAnimatedStyle(() => ({
    opacity: interpolate(scrollY.value, [HERO_HEIGHT - 120, HERO_HEIGHT - 50], [0, 1], Extrapolation.CLAMP),
  }));
  return (
    <Animated.View
      pointerEvents="none"
      style={[styles.topBar, { height: insets.top + 58, paddingTop: insets.top + 8, paddingBottom: 8 }, style]}
    >
      <Text style={styles.topTitle} numberOfLines={1}>
        {title}
      </Text>
    </Animated.View>
  );
}

/**
 * Cabecera de la ficha: el *backdrop* de TMDB difuminado, un degradado que lo
 * funde con el fondo y el póster flotando encima. Sin *backdrop* se cae al
 * terciopelo del tema, así que los títulos añadidos a mano no se ven pelados.
 */
function Hero({ entry: e, scrollY }: { entry: MovieEntry; scrollY: SharedValue<number> }) {
  const insets = useSafeAreaInsets();
  const st = STATUS_META[e.status];

  // El backdrop se queda atras y se apaga al subir la ficha.
  const backdrop = useAnimatedStyle(() => ({
    transform: [
      { translateY: scrollY.value * 0.4 },
      { scale: interpolate(scrollY.value, [0, HERO_HEIGHT], [1, 1.12], Extrapolation.CLAMP) },
    ],
    opacity: interpolate(scrollY.value, [0, HERO_HEIGHT * 0.8], [1, 0.15], Extrapolation.CLAMP),
  }));

  return (
    <View style={[styles.hero, { paddingTop: insets.top + 56 }, !e.backdropUrl && { backgroundColor: VELVET }]}>
      {e.backdropUrl ? (
        <Animated.View style={[StyleSheet.absoluteFill, backdrop]}>
          <Image
            source={{ uri: e.backdropUrl }}
            style={StyleSheet.absoluteFill}
            contentFit="cover"
            blurRadius={14}
            transition={220}
            cachePolicy="memory-disk"
          />
        </Animated.View>
      ) : null}
      {/* Oscurece arriba (los iconos de la cabecera van encima) y funde abajo. */}
      <LinearGradient
        colors={['rgba(18,6,8,0.72)', 'rgba(18,6,8,0.25)', 'rgba(18,6,8,0.82)', th.background]}
        locations={[0, 0.32, 0.78, 1]}
        style={StyleSheet.absoluteFill}
      />
      <View style={styles.heroRow}>
        <View style={styles.posterShadow}>
          <Poster entry={e} width={104} />
        </View>
        <View style={styles.heroText}>
          <Text style={styles.title} numberOfLines={3}>
            {e.title}
          </Text>
          <Text style={styles.muted}>{movieMeta(e)}</Text>
          {e.genres ? (
            <Text style={styles.genres} numberOfLines={2}>
              {e.genres}
            </Text>
          ) : null}
          <StatusChip label={st.label} color={st.color} icon={st.icon} />
        </View>
        {e.rating != null ? (
          <View style={styles.ticket}>
            <Text style={styles.ticketNum}>{formatRating(e.rating)}</Text>
            <Text style={styles.ticketLabel}>NOTA</Text>
          </View>
        ) : null}
      </View>
    </View>
  );
}

/** Las diez casillas de la nota. Se usan en la ficha y al marcar Vista. */
function RatingRow({ rating, onPick }: { rating: number | null; onPick: (v: number) => void }) {
  return (
    <View style={styles.ratingRow}>
      {Array.from({ length: 10 }, (_, i) => i + 1).map((v) => {
        const on = rating != null && v <= rating;
        return (
          <Pressable
            key={v}
            hitSlop={4}
            onPress={() => onPick(v)}
            style={[styles.ratingCell, { backgroundColor: on ? GOLD : th.surfaceHigh }]}
          >
            <Text style={[styles.ratingNum, { color: on ? INK : th.textMuted }]}>{v}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <Animated.View entering={FadeInDown.duration(240)} style={{ gap: 10 }}>
      <Text style={styles.sectionLabel}>{label.toUpperCase()}</Text>
      {children}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: th.background },
  gone: { alignItems: 'center', justifyContent: 'center', gap: 16 },
  goneBtn: {
    height: 44,
    paddingHorizontal: 18,
    borderRadius: 12,
    backgroundColor: th.surfaceHigh,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  content: { paddingBottom: 48 },
  body: { padding: 20, gap: 26 },
  glassBar: { position: 'absolute', left: 14, right: 14, flexDirection: 'row', gap: 10 },
  glassBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: CREAM,
  },
  glassTint: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(18,6,8,0.55)',
    backdropFilter: 'blur(14px)',
  } as ViewStyle,
  // Recorta el backdrop: con el parallax baja más despacio que la ficha y, sin
  // recortar, se salía por debajo y asomaba detrás de las secciones.
  hero: { paddingBottom: 22, paddingHorizontal: 20, backgroundColor: th.surface, overflow: 'hidden' },
  topBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    backgroundColor: th.background,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: th.border,
    paddingLeft: 14 + 42 + 12,
    paddingRight: 14 + 42 * 2 + 10 + 12,
    justifyContent: 'center',
  },
  topTitle: { color: th.text, fontFamily: DISPLAY, textTransform: 'uppercase', fontSize: 19, letterSpacing: 0.4, height: 42, lineHeight: 46 },
  heroRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 16 },
  heroText: { flex: 1, gap: 6 },
  posterShadow: { borderRadius: 8 },
  title: { ...stickerText(2, 2), fontSize: 26, lineHeight: 32, letterSpacing: 0.4 },
  genres: { color: th.textMuted, fontSize: 12 },
  ticket: {
    backgroundColor: GOLD,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: INK,
    boxShadow: `2px 3px 0 ${BRICK}`,
    transform: [{ rotate: '4deg' }],
    paddingVertical: 7,
    paddingHorizontal: 9,
    alignItems: 'center',
    gap: 1,
  },
  ticketNum: { color: INK, fontSize: 20, fontWeight: '800', fontVariant: ['tabular-nums'] },
  ticketLabel: { color: INK, fontSize: 8, fontWeight: '800', letterSpacing: 1.1 },
  muted: { color: th.textMuted, fontSize: 14 },
  text: { color: th.text, fontSize: 16 },
  paragraph: { lineHeight: 24 },
  seasons: { backgroundColor: th.surface, borderRadius: 14, overflow: 'hidden' },
  seasonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    height: 48,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: th.border,
  },
  seasonNum: { color: th.text, fontSize: 15, fontWeight: '800', width: 30, fontVariant: ['tabular-nums'] },
  seasonName: { color: th.textMuted, fontSize: 13, flex: 1 },
  seasonMeta: { color: th.text, fontSize: 13, fontVariant: ['tabular-nums'] },
  sectionLabel: sectionTitle,
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  choice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderRadius: 99,
    paddingHorizontal: 12,
    height: 36,
  },
  choiceText: { color: th.text, fontSize: 13, fontWeight: '600' },
  ratingRow: { flexDirection: 'row', gap: 5 },
  ratingCell: { flex: 1, height: 36, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  ratingNum: { fontSize: 13, fontWeight: '700', fontVariant: ['tabular-nums'] },
  confirm: {
    position: 'absolute',
    left: 16,
    right: 16,
    backgroundColor: th.surfaceHigh,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: th.border,
    padding: 16,
    gap: 12,
    shadowColor: '#000',
    shadowOpacity: 0.6,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 8 },
    elevation: 20,
  },
  askCard: {
    backgroundColor: th.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: GOLD + '55',
    padding: 14,
    gap: 12,
  },
  askHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  againBtn: {
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: th.border,
    backgroundColor: th.surface,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  againText: { color: th.text, fontSize: 14, fontWeight: '700' },
  watchDate: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12 },
  askText: { flex: 1, color: th.text, fontSize: 15, fontWeight: '700' },
  askLater: { color: th.textMuted, fontSize: 13, fontWeight: '700' },
  confirmText: { color: th.text, fontSize: 15, fontWeight: '600' },
  row: { flexDirection: 'row', gap: 10 },
  btn: { flex: 1, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  btnText: { color: th.text, fontSize: 14, fontWeight: '700' },
});
