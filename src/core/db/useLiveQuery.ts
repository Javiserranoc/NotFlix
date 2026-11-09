import { useMemo, useSyncExternalStore } from 'react';

import { getDbVersion, subscribeDb } from './client';

/** Consulta que se repite sola cada vez que cambia la base o cambian `deps`. */
export function useLiveQuery<T>(query: { all(): T[] }, deps: readonly unknown[] = []): { data: T[] } {
  const version = useSyncExternalStore(subscribeDb, getDbVersion);
  // `query` es un objeto nuevo en cada render: lo que la identifica son `deps`.
  const key = JSON.stringify(deps);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const data = useMemo(() => query.all(), [version, key]);
  return { data };
}
