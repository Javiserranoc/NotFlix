import type { ReactNode } from 'react';
import { Pressable, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

/**
 * Pressable que se hunde un poco al tocarlo y vuelve con muelle. Al pulsar un póster
 * se nota que ha recibido el toque antes de que cambie la pantalla.
 *
 * La animación va en el hilo de UI, así que no se pierde aunque JS esté
 * ocupado leyendo la base de datos.
 */
export function PressScale({
  children,
  style,
  scaleTo = 0.96,
  ...props
}: Omit<PressableProps, 'style'> & {
  children?: ReactNode;
  style?: StyleProp<ViewStyle>;
  scaleTo?: number;
}) {
  const pressed = useSharedValue(0);
  const animated = useAnimatedStyle(() => ({
    transform: [{ scale: 1 - pressed.value * (1 - scaleTo) }],
  }));

  return (
    <AnimatedPressable
      {...props}
      onPressIn={(ev) => {
        pressed.value = withTiming(1, { duration: 90 });
        props.onPressIn?.(ev);
      }}
      onPressOut={(ev) => {
        pressed.value = withSpring(0, { damping: 15, stiffness: 260 });
        props.onPressOut?.(ev);
      }}
      style={[style, animated]}
    >
      {children}
    </AnimatedPressable>
  );
}
