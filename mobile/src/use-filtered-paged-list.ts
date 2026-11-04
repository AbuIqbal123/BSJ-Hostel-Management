/**
 * Offset list with filter cache and focus reload.
 * Screens own filter state and the cache key; this owns paging + first-page cache.
 */

import { useCallback, useEffect, useRef } from "react";
import { useFocusEffect } from "expo-router";

import {
  forgetCachedLists,
  openCachedList,
  rememberFirstPage,
  type ListSnapshot,
} from "@/list-cache";
import { useListPage, type OffsetPage, type PageFailure } from "@/use-list-page";

export type FilteredPage<T> = OffsetPage<T> | PageFailure;

type Args<T, F> = {
  idOf: (item: T) => string;
  /** Committed filters (include a debounced search string when needed). */
  filters: F;
  /** Stable string for the current filters — drives cache open/switch. */
  filterKey: string;
  loadPage: (filters: F, offset: number) => Promise<FilteredPage<T>>;
  /** When true (default), each focus reloads the current filter. */
  reloadOnFocus?: boolean;
};

export function useFilteredPagedList<T, F>(args: Args<T, F>) {
  const { idOf, filters, filterKey, loadPage, reloadOnFocus = true } = args;
  const filtersRef = useRef(filters);
  const loadRef = useRef(loadPage);
  const keyRef = useRef(filterKey);
  const cacheRef = useRef(new Map<string, ListSnapshot<T>>());
  filtersRef.current = filters;
  loadRef.current = loadPage;
  keyRef.current = filterKey;

  const list = useListPage<T>({
    idOf,
    loadPage: async (offset) => {
      const key = keyRef.current;
      const current = filtersRef.current;
      const result = await loadRef.current(current, offset);
      rememberFirstPage(cacheRef.current, key, offset, result);
      return result;
    },
  });

  useEffect(() => {
    openCachedList(cacheRef.current, filterKey, list);
  }, [filterKey, list.clear, list.load, list.revise]);

  useFocusEffect(
    useCallback(() => {
      if (!reloadOnFocus) {
        return;
      }
      list.load();
    }, [list.load, reloadOnFocus]),
  );

  const forget = useCallback((keys: string[]) => {
    forgetCachedLists(cacheRef.current, keys);
  }, []);

  const remember = useCallback((key: string, snapshot: ListSnapshot<T>) => {
    cacheRef.current.set(key, snapshot);
  }, []);

  return {
    ...list,
    filterKey,
    forget,
    remember,
  };
}
