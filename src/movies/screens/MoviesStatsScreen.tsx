import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, FadeInDown, LinearTransition } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon } from '../../core/ui/Icon';
import { PressScale } from '../../core/ui/PressScale';
import { KindSwitch, useMoviesKind } from '../components/KindSwitch';
import { Poster } from '../components/MovieRow';
import { RatingSeal } from '../components/RatingSeal';
import { useTabBarSpace } from '../components/MoviesTabBar';
import { KIND_META, type MovieKind } from '../enums';
import { updateMovie } from '../repo';
import { serializeSeasons } from '../seasons';
import { formatHours, useMovieStats } from '../stats';
import { fetchDetails, useTmdbEnabled } from '../tmdb';
import { nowIso } from '../../core/db/sync';
import { DISPLAY, GOLD, moviesTheme as th, sectionTitle, stickerText } from '../theme';

const MONTHS = ['E', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D'];

/** Números: lo que llevas visto, en horas, meses y géneros. */
export function MoviesStatsScreen() {
  const kind = useMoviesKind();
  // Con `key`: al cambiar de tipo vuelve al año en curso y olvida el aviso de "arreglados".
  return <Stats key={kind} kind={kind} />;
}

function Stats({ kind }: { kind: MovieKind }) {
  const insets = useSafeAreaInsets();
  const bottom = useTabBarSpace();
  const thisYear = new Date().getFullYear();
  const [year, setYear] = useState<number | null>(thisYear);
  const s = useMovieStats(year, kind);
  const tmdbOn = useTmdbEnabled();
  // El año en curso siempre tiene chip: es el que está elegido al entrar, y
  // en enero, sin nada visto aún, la fila no tenía ninguno marcado.
  const years = s.years.includes(thisYear) ? s.years : [thisYear, ...s.years];
  const [fixing, setFixing] = useState(false);
  const [fixedCount, setFixedCount] = useState<number | null>(null);

  /** Los que se pueden arreglar solos son los que vinieron de TMDB. */
  const fixable = s.withoutRuntime.filter((e) => e.tmdbId != null);

  /**
   * Rellena la duración pidiéndola a TMDB, uno a uno. Si alguno falla se sigue
   * con los demás: es mejor arreglar cuatro de cinco que ninguno.
   */
  const fixRuntimes = async () => {
    setFixing(true);
    setFixedCount(null);
    let done = 0;
    for (const e of fixable) {
      try {
        const d = await fetchDetails(e.kind, e.tmdbId as number);
        if (d.runtimeMinutes) {
          updateMovie(e.id, {
            runtimeMinutes: d.runtimeMinutes,
            totalSeasons: e.kind === 'series' ? d.totalSeasons : null,
            seasonsJson: e.kind === 'series' ? serializeSeasons(d.seasons) : e.seasonsJson,
            tmdbSyncedAt: nowIso(),
          });
          done += 1;
        }
      } catch {
        // Ese se queda sin duración; seguimos.
      }
    }
    setFixing(false);
    setFixedCount(done);
  };

  const maxMonth = Math.max(1, ...s.byMonth);
  const maxGenre = Math.max(1, ...s.genres.map((g) => g.count));
  const currentMonth = new Date().getMonth();

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: bottom, gap: 22 }}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.titleRow}>
          <Text style={styles.title}>NÚMEROS</Text>
          <KindSwitch />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 7 }}>
            <YearChip label="Todo" active={year == null} onPress={() => setYear(null)} />
            {years.map((y) => (
              <YearChip key={y} label={String(y)} active={year === y} onPress={() => setYear(y)} />
            ))}
          </ScrollView>
        </View>

        {/* Dos cifras grandes, como una marquesina. */}
        <Animated.View key={`n-${year ?? 'all'}`} entering={FadeIn.duration(240)} style={styles.numbers}>
          <View style={styles.numberCard}>
            <Text style={styles.bigNumber}>{s.watched}</Text>
            <Text style={styles.numberLabel}>
              {s.watched === 1 ? 'vez que ves algo' : 'veces que has visto algo'}
              {s.watched !== s.titles ? ` · ${s.titles} títulos` : ''}
            </Text>
          </View>
          <View style={styles.numberCard}>
            <Text style={[styles.bigNumber, { color: GOLD }]}>{formatHours(s.minutes)}</Text>
            <Text style={styles.numberLabel}>{kind === 'movie' ? 'en la butaca' : 'en el sofá'}</Text>
          </View>
        </Animated.View>

        {s.watched === 0 ? (
          <Text style={styles.empty}>
            Nada visto {year == null ? 'todavía' : `en ${year}`}. Marca algo como Vista y aparecerá aquí.
          </Text>
        ) : (
          <>
            {/* Por mes: solo tiene sentido dentro de un año. */}
            {year != null ? (
              <Section label="POR MES">
                <View style={styles.chart}>
                  {s.byMonth.map((n, i) => (
                    <Animated.View
                      key={i}
                      layout={LinearTransition.duration(280)}
                      style={[
                        styles.bar,
                        {
                          height: Math.max(3, (n / maxMonth) * 104),
                          backgroundColor: n === 0 ? th.border : i === currentMonth ? GOLD : th.accent,
                        },
                      ]}
                    />
                  ))}
                </View>
                <View style={styles.months}>
                  {MONTHS.map((m, i) => (
                    <Text
                      key={i}
                      style={[styles.monthLabel, i === currentMonth && { color: GOLD, fontWeight: '700' }]}
                    >
                      {m}
                    </Text>
                  ))}
                </View>
              </Section>
            ) : null}

            {s.genres.length > 0 ? (
              <Section label="TUS GÉNEROS">
                {s.genres.map((g) => (
                  <View key={g.name} style={styles.genreRow}>
                    <Text style={styles.genreName} numberOfLines={1}>
                      {g.name}
                    </Text>
                    <View style={styles.track}>
                      <Animated.View
                        layout={LinearTransition.duration(280)}
                        style={[styles.fill, { width: `${(g.count / maxGenre) * 100}%` }]}
                      />
                    </View>
                    <Text style={styles.genreCount}>{g.count}</Text>
                  </View>
                ))}
              </Section>
            ) : null}

            {s.best.length > 0 ? (
              <Section label="TUS MEJORES NOTAS">
                <View style={styles.shelf}>
                  {s.best.map((e) => (
                    <PressScale key={e.id} onPress={() => router.push(`/titulo/${e.id}` as never)}>
                      <View style={styles.bestPoster}>
                        <Poster entry={e} width={74} />
                        <View style={styles.seal}>
                          <RatingSeal rating={e.rating ?? 0} size={30} />
                        </View>
                      </View>
                    </PressScale>
                  ))}
                </View>
              </Section>
            ) : null}

            {/* Honestidad con los datos: sin duración, las horas se quedan cortas. */}
            {s.withoutRuntime.length > 0 ? (
              <View style={styles.fixBox}>
                <Text style={styles.note}>
                  {s.withoutRuntime.length}{' '}
                  {s.withoutRuntime.length === 1
                    ? `${KIND_META[kind].label.toLowerCase()} no tiene`
                    : `${KIND_META[kind].plural.toLowerCase()} no tienen`}{' '}
                  duración, así que
                  las horas de arriba se quedan cortas.
                </Text>
                {fixable.length > 0 && tmdbOn ? (
                  <PressScale onPress={fixRuntimes} disabled={fixing} style={styles.fixBtn}>
                    {fixing ? (
                      <ActivityIndicator size="small" color={th.text} />
                    ) : (
                      <Icon name="cloud-download-outline" size={17} color={th.text} />
                    )}
                    <Text style={styles.fixText}>
                      {fixing ? 'Completando…' : `Completar ${fixable.length} desde TMDB`}
                    </Text>
                  </PressScale>
                ) : (
                  <Text style={styles.note}>
                    {fixable.length > 0
                      ? 'Sin la key de TMDB no se pueden completar solos: ponles la duración a mano desde su ficha.'
                      : 'Ninguno viene de TMDB: ponles la duración a mano desde su ficha.'}
                  </Text>
                )}
                {fixedCount != null ? (
                  <Text style={styles.note}>
                    {fixedCount === 0
                      ? 'TMDB no da duración para ninguno.'
                      : `${fixedCount} ${fixedCount === 1 ? 'arreglado' : 'arreglados'}.`}
                  </Text>
                ) : null}
              </View>
            ) : null}
          </>
        )}
      </ScrollView>
    </View>
  );
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <Animated.View entering={FadeInDown.duration(260)} style={{ gap: 12 }}>
      <Text style={styles.sectionLabel}>{label}</Text>
      {children}
    </Animated.View>
  );
}

function YearChip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      style={[styles.yearChip, { borderColor: active ? th.accent : th.border, backgroundColor: active ? th.accent : 'transparent' }]}
    >
      <Text style={[styles.yearText, { color: active ? th.onAccent : th.textMuted }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: th.background },
  titleRow: { paddingTop: 14, gap: 12 },
  title: { ...stickerText(2, 2), fontSize: 30, lineHeight: 36, letterSpacing: 0.5 },
  yearChip: {
    height: 30,
    paddingHorizontal: 12,
    borderRadius: 99,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  yearText: { fontSize: 12, fontWeight: '700', fontVariant: ['tabular-nums'] },
  numbers: { flexDirection: 'row', gap: 12 },
  numberCard: {
    flex: 1,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: th.border,
    backgroundColor: th.surface,
    padding: 16,
    gap: 2,
    overflow: 'hidden',
  },
  bigNumber: { color: th.text, fontFamily: DISPLAY, textTransform: 'uppercase', fontSize: 30, lineHeight: 38 },
  numberLabel: { color: th.textMuted, fontSize: 12 },
  sectionLabel: sectionTitle,
  chart: { flexDirection: 'row', alignItems: 'flex-end', gap: 6, height: 104 },
  months: { flexDirection: 'row', gap: 6 },
  bar: { flex: 1, borderTopLeftRadius: 4, borderTopRightRadius: 4 },
  monthLabel: { flex: 1, color: th.textMuted, fontSize: 9, textAlign: 'center' },
  genreRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  genreName: { width: 92, color: th.text, fontSize: 13 },
  track: { flex: 1, height: 10, borderRadius: 5, backgroundColor: th.surfaceHigh, overflow: 'hidden' },
  fill: { height: 10, borderRadius: 5, backgroundColor: th.accent },
  genreCount: { width: 18, color: th.textMuted, fontSize: 12, textAlign: 'right', fontVariant: ['tabular-nums'] },
  shelf: { flexDirection: 'row', gap: 10 },
  bestPoster: { borderRadius: 8 },
  seal: { position: 'absolute', top: -6, right: -5, transform: [{ rotate: '8deg' }] },
  empty: { color: th.textMuted, fontSize: 14, lineHeight: 21, marginTop: 8 },
  note: { color: th.textMuted, fontSize: 11, lineHeight: 16, opacity: 0.85 },
  fixBox: {
    gap: 10,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: th.border,
    backgroundColor: th.surface,
  },
  fixBtn: {
    height: 42,
    borderRadius: 12,
    backgroundColor: th.surfaceHigh,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  fixText: { color: th.text, fontSize: 13, fontWeight: '700' },
});
