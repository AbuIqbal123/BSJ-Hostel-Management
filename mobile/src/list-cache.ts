/** First-page snapshots so switching back to a tab or filter skips the skeleton. */

import type { Listed } from "@/list-page";

export type ListSnapshot<T> = {
  rows: T[] | null;
  total: number;
  error: string | null;
};

/** Survives screen unmount so Office Audit / SMS / Gate history reopen without a blank flash. */
const scopedCaches = new Map<string, Map<string, ListSnapshot<unknown>>>();

export function scopedListCache<T>(scope: string): Map<string, ListSnapshot<T>> {
  let cache = scopedCaches.get(scope);
  if (!cache) {
    cache = new Map();
    scopedCaches.set(scope, cache);
  }
  return cache as Map<string, ListSnapshot<T>>;
}

/** Call on sign-out so the next account does not see prior list rows. */
export function forgetAllScopedListCaches(): void {
  scopedCaches.clear();
}

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

/**
 * Whether a filtered list should quietly `load()` on focus.
 * Scoped screens (Audit, SMS, Gate history) skip focus reload by default —
 * remount already restores + refreshes via openCachedList. Lists that stay
 * mounted under a detail screen (Residents, Staff, Blocks) pass
 * refreshOnFocusWhenCached so a return still refetches without clearing.
 */
export function shouldQuietFocusLoad(args: {
  reloadOnFocus: boolean;
  cacheScope?: string;
  refreshOnFocusWhenCached?: boolean;
}): boolean {
  if (!args.reloadOnFocus) {
    return false;
  }
  if (args.cacheScope && !args.refreshOnFocusWhenCached) {
    return false;
  }
  return true;
}
