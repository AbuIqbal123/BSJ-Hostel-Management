/** First-page snapshots so switching back to a tab or filter skips the skeleton. */

import type { Listed } from "@/list-page";

export type ListSnapshot<T> = {
  rows: T[] | null;
  total: number;
  error: string | null;
};

type CachedList<T> = {
  revise: (change: (current: Listed<T>) => Listed<T>) => void;
  clear: () => void;
  load: (fromPull?: boolean) => void;
};

/** Store the first page (or its error) under a filter key. Later pages are not cached. */
export function rememberFirstPage<T>(
  cache: Map<string, ListSnapshot<T>>,
  key: string,
  offset: number,
  result: { items: T[]; total: number } | { error: string },
): void {
  if (offset !== 0) {
    return;
  }
  if ("error" in result) {
    cache.set(key, { rows: null, total: 0, error: result.error });
    return;
  }
  cache.set(key, { rows: result.items, total: result.total, error: null });
}

/** First visit may skeleton. A return visit restores the snapshot and refreshes quietly. */
export function openCachedList<T>(
  cache: Map<string, ListSnapshot<T>>,
  key: string,
  list: CachedList<T>,
): void {
  const hit = cache.get(key);
  if (hit) {
    list.revise(() => ({
      rows: hit.rows,
      total: hit.total,
      error: hit.error,
      pageError: null,
    }));
    list.load();
    return;
  }
  list.clear();
  list.load();
}

export function forgetCachedLists(cache: Map<string, unknown>, keys: string[]): void {
  for (const key of keys) {
    cache.delete(key);
  }
}
