import { useLocalSearchParams } from 'expo-router';

import { asKind } from '../movies/enums';
import { MoviesRouletteScreen } from '../movies/screens/MoviesRouletteScreen';

export default function MoviesRouletteRoute() {
  const { kind } = useLocalSearchParams<{ kind?: string }>();
  return <MoviesRouletteScreen kind={asKind(kind)} />;
}
