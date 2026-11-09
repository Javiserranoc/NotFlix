import { createContext, type ReactNode, useContext, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Icon } from '../../core/ui/Icon';
import { KIND_META, MOVIE_KINDS, type MovieKind } from '../enums';
import { GOLD, moviesTheme as th } from '../theme';

const KindContext = createContext<{ kind: MovieKind; setKind: (k: MovieKind) => void }>({
  kind: 'movie',
  setKind: () => {},
});

/** Películas o series: lo comparten las tres pestañas, así que va por encima de ellas. */
export function MoviesKindProvider({ children }: { children: ReactNode }) {
  const [kind, setKind] = useState<MovieKind>('movie');
  const value = useMemo(() => ({ kind, setKind }), [kind]);
  return <KindContext.Provider value={value}>{children}</KindContext.Provider>;
}

export const useMoviesKind = () => useContext(KindContext).kind;

/** El selector de arriba de cada pestaña. El oro marca dónde estás, como en la barra. */
export function KindSwitch() {
  const { kind, setKind } = useContext(KindContext);
  return (
    <View style={styles.root} accessibilityRole="tablist">
      {MOVIE_KINDS.map((k) => {
        const active = kind === k;
        const color = active ? '#1A1206' : th.textMuted;
        return (
          <Pressable
            key={k}
            onPress={() => setKind(k)}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            style={[styles.option, active && { backgroundColor: GOLD }]}
          >
            <Icon name={KIND_META[k].icon} size={16} color={color} />
            <Text style={[styles.label, { color }]}>{KIND_META[k].plural}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flexDirection: 'row',
    gap: 4,
    padding: 3,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: th.border,
    backgroundColor: 'rgba(0,0,0,0.32)',
  },
  option: {
    flex: 1,
    height: 36,
    borderRadius: 9,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
  },
  label: { fontSize: 13, fontWeight: '800' },
});
