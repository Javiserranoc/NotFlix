import { useEffect, useSyncExternalStore } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInDown, FadeOutDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { clearToast, getToast, subscribeToast } from '../toast';

/** Va una vez, en el layout raíz. */
export function ToastHost() {
  const toast = useSyncExternalStore(subscribeToast, getToast);
  const insets = useSafeAreaInsets();

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(clearToast, 2200);
    return () => clearTimeout(timer);
  }, [toast]);

  if (!toast) return null;
  return (
    <View pointerEvents="none" style={[styles.wrap, { bottom: insets.bottom + 96 }]}>
      <Animated.View key={toast.key} entering={FadeInDown.duration(180)} exiting={FadeOutDown.duration(160)} style={styles.toast}>
        <Text style={styles.text} numberOfLines={2}>
          {toast.text}
        </Text>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: 24, right: 24, alignItems: 'center' },
  toast: { backgroundColor: '#F6EEEF', borderRadius: 12, paddingHorizontal: 16, paddingVertical: 10 },
  text: { color: '#0E0A0B', fontSize: 14, fontWeight: '600', textAlign: 'center' },
});
