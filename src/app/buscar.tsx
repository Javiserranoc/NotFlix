import { useLocalSearchParams } from 'expo-router';

import { asKind } from '../movies/enums';
import { MoviesSearchScreen } from '../movies/screens/MoviesSearchScreen';

export default function MoviesSearchRoute() {
  const { q, kind } = useLocalSearchParams<{ q?: string; kind?: string }>();
  return <MoviesSearchScreen initialQuery={q ?? ''} kind={asKind(kind)} />;
}
