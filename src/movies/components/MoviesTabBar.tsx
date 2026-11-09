import { router } from 'expo-router';
import { forwardRef, type ReactNode, useEffect } from 'react';
import { Pressable, type PressableProps, StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon } from '../../core/ui/Icon';
import { BRICK, CREAM, INK, moviesTheme as th } from '../theme';
import { useMoviesKind } from './KindSwitch';

/** Alto de la barra flotante y su margen: lo que hay que dejar libre abajo. */
export const TAB_BAR_HEIGHT = 64;
export const TAB_BAR_MARGIN = 16;

/** Espacio que cada pantalla debe reservar al final de su scroll. */
export const useTabBarSpace = () => useSafeAreaInsets().bottom + TAB_BAR_HEIGHT + TAB_BAR_MARGIN + 14;

/**
 * Barra de pestañas del módulo: flota sobre el contenido, recortada como una
 * entrada de cine (muescas en los cantos) y con el canto rojo de las pegatinas.
 *
 * La usa `TabList asChild`, así que recibe los `TabTrigger` como hijos y añade
 * el botón de añadir, que no es una pestaña sino un modal.
 */
export const MoviesTabBar = forwardRef<View, { children?: ReactNode }>(function MoviesTabBar({ children }, ref) {
  const insets = useSafeAreaInsets();
  const kind = useMoviesKind();

  return (
    <View ref={ref} style={[styles.bar, { bottom: TAB_BAR_MARGIN + insets.bottom }]}>
      {/* Muescas laterales: el troquel de la entrada. */}
      <View style={[styles.notchClip, { left: -2 }]} pointerEvents="none">
        <View style={[styles.notch, { left: -9 }]} />
      </View>
      <View style={[styles.notchClip, { right: -2 }]} pointerEvents="none">
        <View style={[styles.notch, { right: -9 }]} />
      </View>

      {children}

      <View style={styles.divider} />
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Añadir un título"
        onPress={() => router.push(`/buscar?kind=${kind}` as never)}
        style={({ pressed }) => [styles.add, pressed && { opacity: 0.85 }]}
      >
        <Icon name="plus" size={24} color={th.onAccent} />
      </Pressable>
    </View>
  );
});

/**
 * Una pestaña. `TabTrigger asChild` le pasa `onPress` y `isFocused`, así que
 * el resaltado no lo decide la pantalla: lo decide el router.
 */
export const TabItem = forwardRef<
  View,
  PressableProps & { icon: string; label: string; isFocused?: boolean }
>(function TabItem({ icon, label, isFocused, ...props }, ref) {
  // Cápsula crema: marca dónde estás y el carmesí queda para el '+'.
  const color = isFocused ? INK : th.textMuted;
  // La cápsula crece con muelle en vez de aparecer de golpe.
  const focus = useSharedValue(isFocused ? 1 : 0);
  useEffect(() => {
    focus.value = withSpring(isFocused ? 1 : 0, { damping: 16, stiffness: 220 });
  }, [isFocused, focus]);

  const capsule = useAnimatedStyle(() => ({
    opacity: focus.value,
    transform: [{ scale: 0.86 + 0.14 * focus.value }],
  }));
  const content = useAnimatedStyle(() => ({ transform: [{ translateY: -1 * focus.value }] }));

  return (
    <Pressable
      ref={ref}
      {...props}
      accessibilityRole="tab"
      accessibilityState={{ selected: isFocused }}
      style={styles.item}
    >
      <Animated.View style={[styles.capsule, capsule]} pointerEvents="none" />
      <Animated.View style={[styles.itemContent, content]}>
        <Icon name={icon} size={21} color={color} />
        <Text style={[styles.label, { color, fontWeight: isFocused ? '800' : '700' }]}>{label}</Text>
      </Animated.View>
    </Pressable>
  );
});

const styles = StyleSheet.create({
  bar: {
    position: 'absolute',
    left: TAB_BAR_MARGIN,
    right: TAB_BAR_MARGIN,
    height: TAB_BAR_HEIGHT,
    borderRadius: 22,
    backgroundColor: INK,
    borderWidth: 2,
    borderColor: CREAM,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    boxShadow: `3px 4px 0 ${BRICK}`,
  },
  // Solo asoma medio círculo: el mordisco del troquel.
  notchClip: { position: 'absolute', top: TAB_BAR_HEIGHT / 2 - 11, width: 10, height: 18, overflow: 'hidden' },
  notch: {
    position: 'absolute',
    top: 0,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: th.background,
    borderWidth: 2,
    borderColor: CREAM,
  },
  item: { flex: 1, height: 48, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  capsule: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    borderRadius: 16,
    backgroundColor: CREAM,
    boxShadow: `2px 3px 0 ${BRICK}`,
  },
  itemContent: { alignItems: 'center', gap: 2 },
  label: { fontSize: 10, letterSpacing: 0.2 },
  divider: { width: 1, height: 30, backgroundColor: th.border, marginHorizontal: 7 },
  add: {
    width: 46,
    height: 46,
    borderRadius: 15,
    backgroundColor: th.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
