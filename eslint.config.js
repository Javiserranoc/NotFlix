// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ['dist/*'],
  },
  {
    rules: {
      // Reanimated se usa mutando `sharedValue.value` y leyendo refs fuera del
      // render: es su API, no un error. Por eso la regla está apagada.
      'react-hooks/immutability': 'off',
      'react-hooks/refs': 'off',
    },
  },
  {
    // En los tests, jest.mock necesita require() dentro de su fábrica (se
    // eleva por encima de los import), y los módulos que leen el entorno al
    // cargarse se importan con require tras prepararlo.
    files: ['**/__tests__/**'],
    rules: { '@typescript-eslint/no-require-imports': 'off' },
  },
]);
