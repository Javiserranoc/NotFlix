import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  FlatList,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';
import Animated, { FadeIn, FadeInDown, FadeOutDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon } from '../../core/ui/Icon';
import { PressScale } from '../../core/ui/PressScale';
import { SwipeRow } from '../../core/ui/SwipeRow';
import { KindSwitch, useMoviesKind } from '../components/KindSwitch';
import { MovieRow, Poster } from '../components/MovieRow';
import { RatingSeal } from '../components/RatingSeal';
import { useTabBarSpace } from '../components/MoviesTabBar';
import { KIND_META, type MovieStatus, STATUS_CHOICES, STATUS_META } from '../enums';
import {
  MOVIE_SORTS,
  type MovieSort,
  restore,
  setStatus as markStatus,
  SORT_LABEL,
  softDelete,
  useMovies,
} from '../repo';
import type { MovieEntry } from '../schema';
import { shareMovies } from '../share';
import { GOLD, INK, moviesTheme as th, stickerFace, stickerText } from '../theme';

const COLUMNS = 3;
const GAP = 12;
const SIDE = 20;

/** Toda la biblioteca: cuadrícula de pósters, con búsqueda y filtros. */
export function MoviesLibraryScreen({ autoFocus = false }: { autoFocus?: boolean }) {
  const insets = useSafeAreaInsets();
  const bottom = useTabBarSpace();
  // El ancho real de la pantalla, no un 390 supuesto.
  const cellWidth = (useWindowDimensions().width - SIDE * 2 - GAP * (COLUMNS - 1)) / COLUMNS;
  const [status, setStatus] = useState<MovieStatus | undefined>();
  const kind = useMoviesKind();
  const [query, setQuery] = useState('');
  /** La cuadrícula luce los pósters; la lista lee mejor cuando buscas texto. */
  const [grid, setGrid] = useState(true);
  const [sort, setSort] = useState<MovieSort>('recent');
  const searchRef = useRef<TextInput>(null);
  /**
   * Lo último que borré deslizando. Deslizar es rápido y fácil de hacer sin
   * querer, así que durante unos segundos se puede deshacer (el borrado es
   * lógico: `restore` lo devuelve tal cual, con su historial).
   */
  const [undo, setUndo] = useState<MovieEntry | null>(null);
  useEffect(() => {
    if (!undo) return;
    const timer = setTimeout(() => setUndo(null), 4500);
    return () => clearTimeout(timer);
  }, [undo]);

  const items = useMovies({ status, kind, query, sort });
  const filtered = status != null;
  const meta = KIND_META[kind];

  const header = (
    <View style={styles.header}>
      <View style={styles.titleRow}>
        <Text style={styles.title}>BIBLIOTECA</Text>
        <Text style={styles.count}>
          {items.length} {(items.length === 1 ? meta.label : meta.plural).toLowerCase()}
        </Text>
        {items.length > 0 ? (
          <Pressable
            hitSlop={10}
            onPress={() => shareMovies(items, status, kind)}
            accessibilityLabel="Compartir esta lista"
            style={styles.shareBtn}
          >
            <Icon name="share-variant-outline" size={18} color={th.textMuted} />
          </Pressable>
        ) : null}
      </View>

      <KindSwitch />

      <View style={styles.search}>
        <Icon name="magnify" size={18} color={th.textMuted} />
        <TextInput
          ref={searchRef}
          autoFocus={autoFocus}
          value={query}
          onChangeText={setQuery}
          placeholder="Buscar por título"
          placeholderTextColor={th.textMuted}
          style={styles.searchInput}
        />
        {query ? (
          <Pressable hitSlop={8} onPress={() => setQuery('')} accessibilityLabel="Borrar la búsqueda">
            <Icon name="close-circle" size={18} color={th.textMuted} />
          </Pressable>
        ) : null}
      </View>

      {/* Si los chips no caben la fila se desliza, y se sale por los lados de
          la lista para que el primero y el ultimo lleguen al borde. */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.chipsScroll}
        contentContainerStyle={styles.chipsRow}
      >
        <Chip label="Todas" active={!status} onPress={() => setStatus(undefined)} />
        {STATUS_CHOICES.map((s) => (
          <Chip
            key={s}
            label={STATUS_META[s].label}
            color={STATUS_META[s].color}
            active={status === s}
            onPress={() => setStatus(status === s ? undefined : s)}
          />
        ))}
      </ScrollView>

      <View style={styles.tools}>
        {/* Un toque pasa al siguiente criterio: cuatro opciones no merecen un menú. */}
        <Pressable
          onPress={() => setSort(MOVIE_SORTS[(MOVIE_SORTS.indexOf(sort) + 1) % MOVIE_SORTS.length]!)}
          accessibilityLabel={`Ordenar: ${SORT_LABEL[sort]}`}
          style={styles.sortBtn}
        >
          <Icon name="sort" size={15} color={th.textMuted} />
          <Text style={styles.sortText}>{SORT_LABEL[sort]}</Text>
        </Pressable>
        <Pressable
          onPress={() => setGrid((g) => !g)}
          accessibilityLabel={grid ? 'Ver en lista' : 'Ver en cuadrícula'}
          style={styles.viewToggle}
        >
          <Icon name={grid ? 'format-list-bulleted' : 'view-grid-outline'} size={16} color={th.textMuted} />
        </Pressable>
      </View>
    </View>
  );

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <FlatList
        key={grid ? 'grid' : 'list'}
        data={items}
        keyExtractor={(e) => e.id}
        numColumns={grid ? COLUMNS : 1}
        columnWrapperStyle={grid ? { gap: GAP } : undefined}
        ListHeaderComponent={header}
        contentContainerStyle={{ paddingHorizontal: SIDE, paddingBottom: bottom, gap: grid ? GAP : 6 }}
        renderItem={({ item, index }) =>
          grid ? (
            <PosterCell
              entry={item}
              width={cellWidth}
              index={index}
              onPress={() => router.push(`/titulo/${item.id}` as never)}
            />
          ) : (
            /* En lista se puede deslizar: a la derecha la marco vista, a la
               izquierda la borro. En la cuadricula no, ahi el dedo va a los posters. */
            <SwipeRow
              left={
                item.status === 'completed'
                  ? undefined
                  : {
                      icon: 'check-circle',
                      label: 'Vista',
                      color: STATUS_META.completed.color,
                      run: () => markStatus(item.id, 'completed', item.status),
                    }
              }
              right={{
                icon: 'trash-can-outline',
                label: 'Borrar',
                color: th.accent,
                run: () => {
                  softDelete(item.id);
                  setUndo(item);
                },
              }}
            >
              <MovieRow entry={item} onPress={() => router.push(`/titulo/${item.id}` as never)} />
            </SwipeRow>
          )
        }
        ListEmptyComponent={
          filtered && !query.trim() ? (
            /* Tienes cosas, pero los filtros no dejan ver ninguna. */
            <View style={styles.emptyBox}>
              <Icon name="filter-off-outline" size={34} color={th.border} />
              <Text style={styles.empty}>Nada con estos filtros</Text>
              <PressScale
                onPress={() => setStatus(undefined)}
                style={[styles.emptyBtn, { backgroundColor: th.surfaceHigh }]}
              >
                <Icon name="close" size={18} color={th.text} />
                <Text style={[styles.emptyBtnText, { color: th.text }]}>Quitar filtros</Text>
              </PressScale>
            </View>
          ) : (
            <View style={styles.emptyBox}>
              <Icon name={query ? 'movie-search-outline' : 'filmstrip-off'} size={34} color={th.border} />
              <Text style={styles.empty}>
                {query ? `No tienes nada con “${query.trim()}”` : 'Nada por aquí todavía'}
              </Text>
              {/* En este momento lo que quieres es añadirlo, no leer un aviso. */}
              <PressScale
                onPress={() =>
                  router.push(`/buscar?kind=${kind}${query ? `&q=${encodeURIComponent(query.trim())}` : ''}` as never)
                }
                style={styles.emptyBtn}
              >
                <Icon name="magnify" size={18} color={INK} />
                <Text style={styles.emptyBtnText}>
                  {query ? `Buscar “${query.trim()}” en TMDB` : `Buscar tu primera ${meta.label.toLowerCase()}`}
                </Text>
              </PressScale>
            </View>
          )
        }
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      />

      {undo ? (
        <Animated.View
          entering={FadeInDown.duration(200)}
          exiting={FadeOutDown.duration(160)}
          style={[styles.undo, { bottom: bottom - 6 }]}
        >
          <Text style={styles.undoText} numberOfLines={1}>
            “{undo.title}” eliminado
          </Text>
          <Pressable
            hitSlop={10}
            onPress={() => {
              restore(undo.id);
              setUndo(null);
            }}
          >
            <Text style={styles.undoAction}>DESHACER</Text>
          </Pressable>
        </Animated.View>
      ) : null}
    </View>
  );
}

/**
 * Celda de la cuadrícula: el póster manda, la nota va en un sello dorado y el
 * estado en una línea de color al pie. Así se ve el estado de veinte títulos
 * sin llenar la pantalla de chips.
 */
function PosterCell({
  entry: e,
  width,
  index,
  onPress,
}: {
  entry: MovieEntry;
  width: number;
  index: number;
  onPress: () => void;
}) {
  // Las celdas aparecen en cascada, pero con el retardo topado: con cien
  // titulos no queremos que la ultima tarde tres segundos.
  const delay = Math.min(index, 8) * 35;
  return (
    <Animated.View entering={FadeIn.delay(delay).duration(240)} style={{ width }}>
      <PressScale onPress={onPress} style={{ gap: 5 }}>
        <View style={styles.cellPoster}>
          <Poster entry={e} width={width} />
          {e.rating != null ? (
            <View style={styles.seal}>
              <RatingSeal rating={e.rating} size={34} />
            </View>
          ) : null}
          <View style={[styles.statusLine, { backgroundColor: STATUS_META[e.status].color }]} />
        </View>
        <Text style={styles.cellTitle} numberOfLines={2}>
          {e.title}
        </Text>
      </PressScale>
    </Animated.View>
  );
}

function Chip({
  label,
  color,
  active,
  onPress,
}: {
  label: string;
  color?: string;
  active: boolean;
  onPress: () => void;
}) {
  const accent = color ?? th.accent;
  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.chip,
        {
          borderColor: active ? accent : th.border,
          backgroundColor: active ? (color ? accent + '40' : accent) : 'transparent',
        },
      ]}
    >
      <Text
        style={[
          styles.chipText,
          { color: active && !color ? th.onAccent : active ? th.text : th.textMuted },
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: th.background },
  header: { paddingTop: 14, paddingBottom: 16, gap: 12 },
  titleRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 10 },
  title: { ...stickerText(2, 2), flex: 1, fontSize: 30, lineHeight: 36, letterSpacing: 0.5 },
  count: { color: th.textMuted, fontSize: 13, paddingBottom: 4 },
  shareBtn: { marginLeft: 'auto', paddingBottom: 4 },
  search: {
    height: 44,
    borderRadius: 12,
    backgroundColor: th.surface,
    borderWidth: 2,
    borderColor: th.border,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 12,
  },
  searchInput: { flex: 1, color: th.text, fontSize: 15 },
  tools: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 7 },
  chipsScroll: { marginHorizontal: -SIDE, flexGrow: 0 },
  chipsRow: { flexDirection: 'row', alignItems: 'center', gap: 7, paddingHorizontal: SIDE },
  chip: {
    height: 32,
    paddingHorizontal: 13,
    borderRadius: 99,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipText: { fontSize: 13, fontWeight: '700' },
  sortBtn: {
    height: 30,
    paddingHorizontal: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: th.border,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  sortText: { color: th.textMuted, fontSize: 12, fontWeight: '600' },
  viewToggle: {
    width: 34,
    height: 30,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: th.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cellPoster: { borderRadius: 8 },
  seal: { position: 'absolute', top: -7, right: -6, transform: [{ rotate: '8deg' }] },
  statusLine: { position: 'absolute', left: 2, right: 2, bottom: 2, height: 4 },
  cellTitle: { color: th.text, fontSize: 12, fontWeight: '600' },
  emptyBox: { alignItems: 'center', gap: 14, paddingTop: 54, paddingHorizontal: 20 },
  empty: { color: th.textMuted, textAlign: 'center', fontSize: 14 },
  emptyBtn: {
    height: 46,
    paddingHorizontal: 18,
    borderRadius: 14,
    ...stickerFace,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  emptyBtnText: { color: INK, fontSize: 14, fontWeight: '800' },
  undo: {
    position: 'absolute',
    left: 16,
    right: 16,
    height: 48,
    borderRadius: 14,
    backgroundColor: th.surfaceHigh,
    borderWidth: 1,
    borderColor: th.border,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    elevation: 12,
  },
  undoText: { flex: 1, color: th.text, fontSize: 14 },
  undoAction: { color: GOLD, fontSize: 13, fontWeight: '800', letterSpacing: 0.8 },
});
