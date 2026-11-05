import { describe, expect, it } from "@jest/globals";

import {
  forgetAllScopedListCaches,
  forgetCachedLists,
  openCachedList,
  rememberFirstPage,
  scopedListCache,
  type ListSnapshot,
} from "@/list-cache";

type Row = { id: string };

describe("list cache", () => {
  it("remembers only the first page", () => {
    const cache = new Map<string, ListSnapshot<Row>>();
    rememberFirstPage(cache, "a", 0, { items: [{ id: "1" }], total: 2 });
    rememberFirstPage(cache, "a", 1, { items: [{ id: "2" }], total: 2 });
    expect(cache.get("a")).toEqual({ rows: [{ id: "1" }], total: 2, error: null });
  });

  it("remembers a first-page error", () => {
    const cache = new Map<string, ListSnapshot<Row>>();
    rememberFirstPage(cache, "a", 0, { error: "Could not load" });
    expect(cache.get("a")).toEqual({ rows: null, total: 0, error: "Could not load" });
  });

  it("restores a hit and refreshes quietly, or clears on a miss", () => {
    const cache = new Map<string, ListSnapshot<Row>>();
    cache.set("hit", { rows: [{ id: "1" }], total: 1, error: null });
    const calls: string[] = [];
    const list = {
      revise: () => {
        calls.push("revise");
      },
      clear: () => {
        calls.push("clear");
      },
      load: () => {
        calls.push("load");
      },
    };
    openCachedList(cache, "hit", list);
    expect(calls).toEqual(["revise", "load"]);
    calls.length = 0;
    openCachedList(cache, "miss", list);
    expect(calls).toEqual(["clear", "load"]);
  });

  it("drops named keys", () => {
    const cache = new Map<string, ListSnapshot<Row>>([
      ["a", { rows: [], total: 0, error: null }],
      ["b", { rows: [], total: 0, error: null }],
    ]);
    forgetCachedLists(cache, ["a"]);
    expect([...cache.keys()]).toEqual(["b"]);
  });

  it("keeps a scoped cache across callers until sign-out clears it", () => {
    forgetAllScopedListCaches();
    const a = scopedListCache<Row>("office-audit");
    a.set("all", { rows: [{ id: "1" }], total: 1, error: null });
    expect(scopedListCache<Row>("office-audit").get("all")?.rows).toEqual([{ id: "1" }]);
    forgetAllScopedListCaches();
    expect(scopedListCache<Row>("office-audit").size).toBe(0);
  });
});
