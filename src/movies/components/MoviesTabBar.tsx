import { router } from 'expo-router';
import { forwardRef, type ReactNode, useEffect } from 'react';
import { Pressable, type PressableProps, StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon } from '../../core/ui/Icon';
import { GOLD, moviesTheme as th } from '../theme';
import { useMoviesKind } from './KindSwitch';

/** Alto de la barra flotante y su margen: lo que hay que dejar libre abajo. */
export const TAB_BAR_HEIGHT = 64;
export const TAB_BAR_MARGIN = 16;

/** Espacio que cada pantalla debe reservar al final de su scroll. */
export const useTabBarSpace = () => useSafeAreaInsets().bottom + TAB_BAR_HEIGHT + TAB_BAR_MARGIN + 14;

/**
 * Barra de pestañas del módulo: flota sobre el contenido y está recortada como
 * una entrada de cine (muescas en los cantos y perforaciones doradas arriba).
 *
 * La usa `TabList asChild`, así que recibe los `TabTrigger` como hijos y añade
 * el botón de añadir, que no es una pestaña sino un modal.
 */
export const MoviesTabBar = forwardRef<View, { children?: ReactNode }>(function MoviesTabBar({ children }, ref) {
  const insets = useSafeAreaInsets();
  const kind = useMoviesKind();

  return (
    <View ref={ref} style={[styles.bar, { bottom: TAB_BAR_MARGIN + insets.bottom }]}>
      {/* Perforaciones de película en el borde de arriba. */}
      <View style={styles.perforations} pointerEvents="none">
        {Array.from({ length: 22 }, (_, i) => (
          <View key={i} style={styles.hole} />
        ))}
      </View>
      {/* Muescas laterales: el troquel de la entrada. */}
      <View style={[styles.notch, { left: -7 }]} pointerEvents="none" />
      <View style={[styles.notch, { right: -7 }]} pointerEvents="none" />

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
  // Capsula dorada: el oro marca donde estas y el carmesi queda para el '+'.
  const color = isFocused ? '#1A1206' : th.textMuted;
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
    backgroundColor: '#171013',
    borderWidth: 1,
    borderColor: th.border,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    shadowColor: '#000',
    shadowOpacity: 0.65,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 16,
  },
  perforations: {
    position: 'absolute',
    left: 16,
    right: 16,
    top: 0,
    height: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    overflow: 'hidden',
  },
  hole: { width: 7, height: 1, backgroundColor: GOLD, opacity: 0.3 },
  notch: {
    position: 'absolute',
    top: TAB_BAR_HEIGHT / 2 - 6,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: th.background,
  },
  item: { flex: 1, height: 48, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  capsule: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    borderRadius: 16,
    backgroundColor: GOLD,
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
