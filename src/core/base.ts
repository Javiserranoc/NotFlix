import Constants from 'expo-constants';

/** Subruta donde está publicada la app ('/NotFlix' en GitHub Pages, '' en la raíz). */
export const BASE_PATH = (Constants.expoConfig?.experiments?.baseUrl ?? '').replace(/\/$/, '');
