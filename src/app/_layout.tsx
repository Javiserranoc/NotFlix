import { BebasNeue_400Regular, useFonts } from '@expo-google-fonts/bebas-neue';
import { Stack } from 'expo-router';
import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { startDatabase } from '../core/db/storage';
import { setupPwa } from '../core/pwa';
import { loadSettings } from '../core/settings';
import { DatePickerHost } from '../core/ui/DatePicker';
import { ToastHost } from '../core/ui/Toast';
import { moviesTheme as th } from '../movies/theme';

/**
 * Aunque se abra una ficha directamente (recargar, un enlace), las pestañas
 * quedan debajo: en iOS no hay botón físico y "atrás" tiene que llevar a algún sitio.
 */
export const unstable_settings = { initialRouteName: '(tabs)' };

export default function RootLayout() {
  // Bebas Neue es la tipografía de titulares (theme.DISPLAY).
  const [fontsLoaded, fontError] = useFonts({ BebasNeue_400Regular });
  const [dbReady, setDbReady] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    Promise.all([startDatabase(), loadSettings()])
      .then(() => setDbReady(true))
      .catch((e) => {
        console.error('[db] No se ha podido abrir', e);
        setFailed(true);
      });
    setupPwa();
  }, []);

  if (failed) {
    return (
      <View style={{ flex: 1, backgroundColor: th.background, alignItems: 'center', justifyContent: 'center', padding: 32 }}>
        <Text style={{ color: th.text, fontSize: 16, textAlign: 'center' }}>
          No se ha podido abrir tu biblioteca. Cierra la app y vuelve a abrirla.
        </Text>
      </View>
    );
  }
  // Sin la fuente la app sigue: una tipografía no puede dejarla en blanco.
  if ((!fontsLoaded && !fontError) || !dbReady) return <View style={{ flex: 1, backgroundColor: th.background }} />;

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: th.background }}>
      <SafeAreaProvider>
        <Stack
          screenOptions={{
            headerStyle: { backgroundColor: th.background },
            headerTintColor: th.text,
            headerShadowVisible: false,
            contentStyle: { backgroundColor: th.background },
            headerBackTitle: 'Atrás',
          }}
        >
          {/* Las pestañas viven en su grupo; lo demás se abre por encima de la barra. */}
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="titulo/[id]" options={{ headerShown: false }} />
          <Stack.Screen name="buscar" options={{ title: 'Añadir un título' }} />
          <Stack.Screen name="ruleta" options={{ title: '¿Qué vemos?' }} />
          <Stack.Screen name="edit" options={{ title: '' }} />
          <Stack.Screen name="ajustes" options={{ title: 'Ajustes' }} />
        </Stack>
        <ToastHost />
        <DatePickerHost />
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
