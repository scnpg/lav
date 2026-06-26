import { useCallback, useEffect, useRef, useState } from "react";

export interface AsyncState<T> {
  data: T | null;
  loading: boolean;
  /** Human-readable message, safe to render directly in an error state. */
  error: string | null;
  refresh: () => void;
}

/**
 * Small shared data-fetching hook so every screen gets the same
 * loading/error/empty handling shape instead of re-implementing it. Not a
 * full caching layer (no react-query here on purpose, to keep dependencies
 * minimal for this MVP) - just race-condition-safe loading/error/refresh.
 */
export function useAsync<T>(fn: () => Promise<T>, deps: unknown[]): AsyncState<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const requestId = useRef(0);
  const fnRef = useRef(fn);
  fnRef.current = fn;

  const run = useCallback(() => {
    const id = ++requestId.current;
    setLoading(true);
    setError(null);
    fnRef.current().then(
      (result) => {
        if (requestId.current !== id) return;
        setData(result);
        setLoading(false);
      },
      (err: unknown) => {
        if (requestId.current !== id) return;
        setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
        setLoading(false);
      }
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  useEffect(() => {
    run();
  }, [run]);

  return { data, loading, error, refresh: run };
}
