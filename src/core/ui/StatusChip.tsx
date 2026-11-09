import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { StyleSheet, Text, View } from 'react-native';

/** Etiqueta de estado con color (fondo tenue + texto saturado). */
export function StatusChip({ label, color, icon }: { label: string; color: string; icon?: string }) {
  return (
    <View style={[styles.chip, { backgroundColor: color + '29', borderColor: color + '59' }]}>
      {icon ? (
        <MaterialCommunityIcons
          name={icon as keyof typeof MaterialCommunityIcons.glyphMap}
          size={12}
          color={color}
        />
      ) : null}
      <Text style={[styles.text, { color }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 99,
    borderWidth: 1,
  },
  text: { fontSize: 11, fontWeight: '700', letterSpacing: 0.2 },
});
