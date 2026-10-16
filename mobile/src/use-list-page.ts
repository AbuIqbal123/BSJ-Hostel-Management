import { useCallback, useEffect, useRef, useState } from "react";

import {
  acceptFailure,
  acceptPage,
  mergeById,
  olderAvailable,
  shouldKeepPaging,
  shouldRequestNext,
  type Listed,
} from "@/list-page";
import { useDelayedLoading } from "@/use-delayed-loading";

export type OffsetPage<T> = { items: T[]; total: number };
export type CursorPage<T> = { items: T[]; next: string | null };
export type PageFailure = { error: string };

type Shared<T> = {
  idOf: (item: T) => string;
  /** A short list asks for the next page on its own. Manual lists wait for loadNext. */
  auto?: boolean;
};

type OffsetArgs<T> = Shared<T> & {
  mode?: "offset";
  loadPage: (offset: number) => Promise<OffsetPage<T> | PageFailure>;
};

type CursorArgs<T> = Shared<T> & {
  mode: "cursor";
  loadPage: (cursor: string | null) => Promise<CursorPage<T> | PageFailure>;
};

export type ListArgs<T> = OffsetArgs<T> | CursorArgs<T>;

const EMPTY: Listed<never> = { rows: null, total: 0, error: null, pageError: null };

function isFailure<T>(result: OffsetPage<T> | CursorPage<T> | PageFailure): result is PageFailure {
  return "error" in result;
}

/**
 * One list: the first page, the next page, a failed refresh, a retry, and the
 * delayed skeleton. Callers pass pageQuery(offset) into the request.
 */
export function useListPage<T>(args: ListArgs<T>) {
  const mode = args.mode ?? "offset";
  const auto = args.auto ?? true;
  const [state, setState] = useState<Listed<T>>(EMPTY);
  const [refreshing, setRefreshing] = useState(false);
  const [paging, setPaging] = useState(false);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [contentH, setContentH] = useState(0);
  const [viewH, setViewH] = useState(0);
  const pagingRef = useRef(false);
  const stallRef = useRef<number | null>(null);
  const request = useRef(0);
  const stateRef = useRef(state);
  const nextRef = useRef(nextCursor);
  const loadRef = useRef(args.loadPage);
  const idRef = useRef(args.idOf);
  stateRef.current = state;
  nextRef.current = nextCursor;
  loadRef.current = args.loadPage;
  idRef.current = args.idOf;

  const showListSkeleton =
    useDelayedLoading((state.rows === null || refreshing) && state.error === null) && state.error === null;
  const showPageSkeleton = useDelayedLoading(paging) && state.pageError === null;

  const load = useCallback(
    (fromPull = false) => {
      const id = ++request.current;
      stallRef.current = null;
      pagingRef.current = false;
      setPaging(false);
      if (fromPull) {
        setRefreshing(true);
      }
      if (mode === "cursor") {
        void (loadRef.current as CursorArgs<T>["loadPage"])(null).then((result) => {
          if (id !== request.current) {
            return;
          }
          if (fromPull) {
            setRefreshing(false);
          }
          if (isFailure(result)) {
            setState((current) => acceptFailure(current, 0, result.error));
            return;
          }
          const cursor = result.next;
          setNextCursor(cursor);
          setState({
            rows: result.items,
            total: cursor ? result.items.length + 1 : result.items.length,
            error: null,
            pageError: null,
          });
        });
        return;
      }
      void (loadRef.current as OffsetArgs<T>["loadPage"])(0).then((result) => {
        if (id !== request.current) {
          return;
        }
        if (fromPull) {
          setRefreshing(false);
        }
        if (isFailure(result)) {
          setState((current) => acceptFailure(current, 0, result.error));
          return;
        }
        const next = acceptPage(EMPTY, 0, result.items, result.total, idRef.current);
        if ((next.rows?.length ?? 0) === 0 && result.total > 0) {
          stallRef.current = 0;
        }
        setState(next);
      });
    },
    [mode],
  );

  const loadNext = useCallback(
    (force = false) => {
      if (pagingRef.current) {
        return;
      }
      const current = stateRef.current;
      if (mode === "cursor") {
        const cursor = nextRef.current;
        if (!cursor || (!force && current.pageError !== null)) {
          return;
        }
        pagingRef.current = true;
        setPaging(true);
        const id = request.current;
        void (loadRef.current as CursorArgs<T>["loadPage"])(cursor).then((result) => {
          pagingRef.current = false;
          setPaging(false);
          if (id !== request.current) {
            return;
          }
          if (isFailure(result)) {
            setState((listed) => ({ ...listed, pageError: result.error }));
            return;
          }
          setNextCursor(result.next);
          setState((listed) => {
            const rows = mergeById(listed.rows ?? [], result.items, 1, idRef.current);
            return {
              rows,
              total: result.next ? rows.length + 1 : rows.length,
              error: null,
              pageError: null,
            };
          });
        });
        return;
      }
      const offset = current.rows?.length ?? 0;
      if (force) {
        stallRef.current = null;
      }
      if (current.rows !== null && offset >= current.total) {
        return;
      }
      if (!force && !shouldRequestNext(offset, current.total, false, current.pageError !== null)) {
        return;
      }
      pagingRef.current = true;
      setPaging(true);
      const id = request.current;
      void (loadRef.current as OffsetArgs<T>["loadPage"])(offset).then((result) => {
        pagingRef.current = false;
        setPaging(false);
        if (id !== request.current) {
          return;
        }
        setState((listed) => {
          if (isFailure(result)) {
            return acceptFailure(listed, offset, result.error);
          }
          const before = listed.rows?.length ?? 0;
          const next = acceptPage(listed, offset, result.items, result.total, idRef.current);
          const after = next.rows?.length ?? 0;
          if (offset > 0 && after <= before) {
            stallRef.current = offset;
          }
          return next;
        });
      });
    },
    [mode],
  );

  const loaded = state.rows?.length ?? 0;
  const stalled = stallRef.current === loaded;
  const filling =
    auto &&
    mode === "offset" &&
    shouldKeepPaging(loaded, state.total, paging, state.pageError !== null, contentH, viewH, stalled);

  useEffect(() => {
    if (filling) {
      loadNext();
    }
  }, [filling, loadNext]);

  const hasMore =
    mode === "cursor"
      ? state.rows === null
        ? state.error === null
        : nextCursor !== null && state.pageError === null
      : olderAvailable(state);

  const clear = useCallback(() => {
    request.current += 1;
    stallRef.current = null;
    pagingRef.current = false;
    setPaging(false);
    setRefreshing(false);
    setNextCursor(null);
    setState(EMPTY);
  }, []);
  const refresh = useCallback(() => load(true), [load]);
  const retry = useCallback(() => load(false), [load]);
  const noteSize = useCallback((contentHeight: number, viewportHeight: number) => {
    setContentH(contentHeight);
    setViewH(viewportHeight);
  }, []);
  const replaceRows = useCallback((update: (rows: T[] | null) => T[] | null) => {
    setState((current) => ({ ...current, rows: update(current.rows) }));
  }, []);
  const revise = useCallback((change: (current: Listed<T>) => Listed<T>) => {
    setState((current) => change(current));
  }, []);

  return {
    rows: state.rows,
    total: state.total,
    error: state.error,
    pageError: state.pageError,
    refreshing,
    showListSkeleton,
    showPageSkeleton,
    filling,
    hasMore,
    load,
    clear,
    refresh,
    retry,
    loadNext,
    noteSize,
    replaceRows,
    revise,
  };
}

/** Read every page. A screen that is looking up one record uses this instead of writing limit=. */
export async function collectPages<T>(
  loadPage: (offset: number) => Promise<OffsetPage<T> | PageFailure>,
): Promise<T[] | string> {
  const items: T[] = [];
  let offset = 0;
  let total = 0;
  do {
    const page = await loadPage(offset);
    if (isFailure(page)) {
      return page.error;
    }
    items.push(...page.items);
    total = page.total;
    if (page.items.length === 0) {
      break;
    }
    offset += page.items.length;
  } while (offset < total);
  return items;
}
