// Configuración de Metro: la de Expo, con un solo cambio.
const path = require('node:path');
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

/**
 * `expo-router` importa `expo-symbols` desde sus pestañas NATIVAS (NativeTabs),
 * para convertir nombres de Material Symbols en iconos. No las usamos (cada
 * módulo pinta su barra con `expo-router/ui`), pero Metro no descarta código
 * sin usar y aquel import mete en el paquete la fuente Material Symbols: 944 KB.
 *
 * Solo para ESE archivo, `expo-symbols` se resuelve a un sustituto vacío.
 * Cualquier otro import de `expo-symbols` sigue yendo al paquete real.
 * Si algún día se usan NativeTabs con iconos `md`, hay que quitar esto.
 */
const SYMBOLS_STUB = path.join(__dirname, 'stubs', 'expo-symbols.js');
const fromNativeTabs = (origin) => /expo-router[\\/]build[\\/]native-tabs[\\/]/.test(origin);

const resolveRequest = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName === 'expo-symbols' && fromNativeTabs(context.originModulePath)) {
    return { type: 'sourceFile', filePath: SYMBOLS_STUB };
  }
  return (resolveRequest ?? context.resolveRequest)(context, moduleName, platform);
};

module.exports = config;
