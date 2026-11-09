import { useLocalSearchParams } from 'expo-router';

import { MoviesLibraryScreen } from '../../movies/screens/MoviesLibraryScreen';

export default function MoviesLibraryRoute() {
  // ?buscar=1 llega desde la lupa de Inicio: abre el teclado puesto.
  const { buscar } = useLocalSearchParams<{ buscar?: string }>();
  return <MoviesLibraryScreen autoFocus={buscar === '1'} />;
}
