import { useLocalSearchParams } from 'expo-router';

import { MovieDetailScreen } from '../../movies/screens/MovieDetailScreen';

export default function MovieDetailRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <MovieDetailScreen id={id} />;
}
