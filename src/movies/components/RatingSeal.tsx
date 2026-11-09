import { StyleSheet, Text, View } from 'react-native';

import { Icon } from '../../core/ui/Icon';
import { formatRating } from './MovieRow';
import { GOLD, INK } from '../theme';

/**
 * Sello de la nota para las portadas: un decagrama dorado con el número
 * dentro, como el "premiado" estampado en los carteles de cine antiguos.
 *
 * Es un glifo de MaterialCommunityIcons, no un SVG, así que no añade
 * dependencias y escala sin perder filo.
 */
export function RatingSeal({ rating, size = 34 }: { rating: number; size?: number }) {
  return (
    <View style={[styles.root, { width: size, height: size }]}>
      <Icon name="decagram" size={size} color={GOLD} />
      <Text style={[styles.number, { fontSize: size * 0.36, lineHeight: size * 0.42 }]}>
        {formatRating(rating)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { alignItems: 'center', justifyContent: 'center' },
  number: {
    position: 'absolute',
    color: INK,
    fontWeight: '900',
    fontVariant: ['tabular-nums'],
    letterSpacing: -0.3,
  },
});
