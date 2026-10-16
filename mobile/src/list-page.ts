/** Paging rules shared by every list. A later page never drops or repeats rows. */

export const PAGE_SIZE = 50;

/** @deprecated Use PAGE_SIZE. Kept so existing imports keep working. */
export const PAGE = PAGE_SIZE;

/** The only place a screen may name `limit` and `offset` on a list request. */
export function pageQuery(offset: number): string {
  return `limit=${PAGE_SIZE}&offset=${offset}`;
}

export function placeholderMotion(reduceMotion: boolean): "shimmer" | "still" {
  return reduceMotion ? "still" : "shimmer";
}

export function mergeById<T>(current: T[], incoming: T[], offset: number, idOf: (item: T) => string): T[] {
  if (offset === 0) {
    return incoming;
  }
  const seen = new Set(current.map(idOf));
  const next = current.slice();
  for (const item of incoming) {
    const id = idOf(item);
    if (!seen.has(id)) {
      seen.add(id);
      next.push(item);
    }
  }
  return next;
}

export function hasMore(loaded: number, total: number): boolean {
  return loaded < total;
}

export function shouldRequestNext(loaded: number, total: number, busy: boolean, pageFailed: boolean): boolean {
  return hasMore(loaded, total) && !busy && !pageFailed;
}

/**
 * A filtered tab can be shorter than the screen, so the scroll never reaches the next page.
 * Keep loading until the list can scroll, it ends, a page fails, or a page adds nothing.
 */
export function shouldKeepPaging(
  loaded: number,
  total: number,
  busy: boolean,
  pageFailed: boolean,
  contentHeight: number,
  viewportHeight: number,
  stalled: boolean,
): boolean {
  if (stalled || viewportHeight <= 0 || contentHeight <= 0 || contentHeight > viewportHeight) {
    return false;
  }
  return shouldRequestNext(loaded, total, busy, pageFailed);
}

export type Listed<T> = {
  rows: T[] | null;
  total: number;
  error: string | null;
  pageError: string | null;
};

export function acceptPage<T>(
  state: Listed<T>,
  offset: number,
  items: T[],
  total: number,
  idOf: (item: T) => string,
): Listed<T> {
  const base = offset === 0 ? [] : (state.rows ?? []);
  return {
    rows: mergeById(base, items, offset, idOf),
    total,
    error: null,
    pageError: null,
  };
}

export function acceptFailure<T>(state: Listed<T>, offset: number, message: string): Listed<T> {
  const loaded = state.rows?.length ?? 0;
  if (offset === 0 && loaded === 0) {
    return { rows: null, total: state.total, error: message, pageError: null };
  }
  if (offset === 0) {
    return { ...state, error: message, pageError: null };
  }
  return { ...state, pageError: message };
}

/** Whether a "Show older" button belongs under a list that loads only on request. */
export function olderAvailable<T>(state: Listed<T>): boolean {
  if (state.rows === null) {
    return state.error === null;
  }
  return hasMore(state.rows.length, state.total) && state.pageError === null;
}
