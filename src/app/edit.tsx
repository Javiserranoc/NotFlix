import { useLocalSearchParams } from 'expo-router';

import { asKind } from '../movies/enums';
import { MovieEditScreen } from '../movies/screens/MovieEditScreen';

export default function MovieEditRoute() {
  const { id, kind } = useLocalSearchParams<{ id?: string; kind?: string }>();
  return <MovieEditScreen id={id} kind={asKind(kind)} />;
}
