import { useEffect, useState } from 'react';

import { searchTitles, type TmdbHit, useTmdbEnabled } from './tmdb';

/** Nada de una petición por letra. */
const DEBOUNCE_MS = 350;
const MIN_CHARS = 2;

export type TmdbSearchState = { hits: TmdbHit[]; loading: boolean; error: string | null };

/** Resultado guardado junto al texto que lo produjo. */
type Result = { query: string; hits: TmdbHit[]; error: string | null };
const EMPTY: Result = { query: '', hits: [], error: null };

/**
 * Busca en TMDB mientras escribes, con debounce y cancelando la petición
 * anterior (AbortController), así que lo que se pinta es siempre la respuesta
 * del texto actual.
 *
 * El resultado lleva pegado su propio texto y "cargando" se deduce de que no
 * coincida con el de ahora. Así el efecto solo escribe estado dentro de sus
 * callbacks, nunca de forma síncrona (regla react-hooks/set-state-in-effect).
 */
export function useTmdbSearch(query: string, enabled = true): TmdbSearchState {
  const [result, setResult] = useState<Result>(EMPTY);
  const tmdbOn = useTmdbEnabled();
  const q = query.trim();
  const active = enabled && tmdbOn && q.length >= MIN_CHARS;

  useEffect(() => {
    if (!active) return;
    const ctrl = new AbortController();
    const timer = setTimeout(() => {
      searchTitles(q, ctrl.signal)
        .then((hits) => setResult({ query: q, hits, error: null }))
        .catch((e: unknown) => {
          if (e instanceof Error && e.name === 'AbortError') return;
          setResult({ query: q, hits: [], error: e instanceof Error ? e.message : 'Error al buscar' });
        });
    }, DEBOUNCE_MS);

    return () => {
      clearTimeout(timer);
      ctrl.abort();
    };
  }, [q, active]);

  const fresh = result.query === q;
  return {
    hits: active && fresh ? result.hits : [],
    error: active && fresh ? result.error : null,
    loading: active && !fresh,
  };
}
