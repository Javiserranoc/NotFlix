import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  Extrapolation,
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { INK } from '../../movies/theme';
import { Icon } from './Icon';

/** Cuánto hay que arrastrar para que la acción cuente. */
const THRESHOLD = 96;

export type SwipeAction = { icon: string; label: string; color: string; run: () => void };

/**
 * Fila que revela una acción al arrastrarla. Hecha con Pan + Reanimated en vez
 * de con un componente de terceros para controlar dos cosas que se notan:
 *
 * - `activeOffsetX` / `failOffsetY`: el gesto solo gana si el dedo va de lado,
 *   así que la lista sigue desplazándose con normalidad en vertical.
 * - la acción se ejecuta al soltar, no al cruzar el umbral,.
 */
export function SwipeRow({
  children,
  right,
  left,
  radius = 16,
}: {
  children: ReactNode;
  /** Radio del recorte; 0 dentro de algo que ya tiene sus bordes (un ticket). */
  radius?: number;
  /** Se revela al arrastrar hacia la izquierda. */
  right?: SwipeAction;
  /** Se revela al arrastrar hacia la derecha. */
  left?: SwipeAction;
}) {
  const x = useSharedValue(0);

  const pan = Gesture.Pan()
    .activeOffsetX([-14, 14])
    .failOffsetY([-10, 10])
    .onUpdate((ev) => {
      const limit = ev.translationX > 0 ? (left ? 1 : 0) : right ? 1 : 0;
      x.value = ev.translationX * limit;
    })
    .onEnd(() => {
      const action = x.value > 0 ? left : right;
      if (Math.abs(x.value) >= THRESHOLD && action) {
        x.value = withTiming(0, { duration: 180 });
        runOnJS(action.run)();
      } else {
        x.value = withSpring(0, { damping: 18, stiffness: 240 });
      }
    });

  const row = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }] }));
  const leftStyle = useAnimatedStyle(() => ({
    opacity: interpolate(x.value, [0, THRESHOLD], [0, 1], Extrapolation.CLAMP),
  }));
  const rightStyle = useAnimatedStyle(() => ({
    opacity: interpolate(x.value, [-THRESHOLD, 0], [1, 0], Extrapolation.CLAMP),
  }));

  return (
    <View style={[styles.root, { borderRadius: radius }]}>
      {left ? (
        <Animated.View style={[styles.behind, { backgroundColor: left.color }, leftStyle]}>
          <View style={styles.action}>
            <Icon name={left.icon} size={20} color={INK} />
            <Text style={styles.label}>{left.label}</Text>
          </View>
        </Animated.View>
      ) : null}
      {right ? (
        <Animated.View
          style={[styles.behind, styles.behindRight, { backgroundColor: right.color }, rightStyle]}
        >
          <View style={styles.action}>
            <Icon name={right.icon} size={20} color={INK} />
            <Text style={styles.label}>{right.label}</Text>
          </View>
        </Animated.View>
      ) : null}

      {/* pan-y: el navegador sigue haciendo el scroll vertical (en iOS, si no, la lista se bloquea). */}
      <GestureDetector gesture={pan} touchAction="pan-y">
        <Animated.View style={row}>{children}</Animated.View>
      </GestureDetector>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { overflow: 'hidden' },
  behind: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'flex-start',
  },
  behindRight: { alignItems: 'flex-end' },
  action: { paddingHorizontal: 20, alignItems: 'center', gap: 2 },
  label: { color: INK, fontSize: 11, fontWeight: '800' },
});
