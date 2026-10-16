import { describe, expect, it } from "@jest/globals";

import { acceptFailure, acceptPage, hasMore, mergeById, placeholderMotion, shouldRequestNext, type Listed } from "@/list-page";

const idOf = (item: { id: string }) => item.id;
const empty: Listed<{ id: string }> = { rows: null, total: 0, error: null, pageError: null };

describe("list pages", () => {
  it("shows a still placeholder when motion is reduced", () => {
    expect(placeholderMotion(true)).toBe("still");
    expect(placeholderMotion(false)).toBe("shimmer");
  });

  it("replaces the first page and appends the next without duplicates", () => {
    const first = mergeById([], [{ id: "a" }, { id: "b" }], 0, idOf);
    const second = mergeById(first, [{ id: "b" }, { id: "c" }], 2, idOf);
    const retried = mergeById(second, [{ id: "b" }, { id: "c" }], 2, idOf);
    expect(retried.map(idOf)).toEqual(["a", "b", "c"]);
    expect(hasMore(retried.length, 3)).toBe(false);
    expect(hasMore(2, 3)).toBe(true);
  });

  it("keeps loaded rows when a later page fails, and retries that page", () => {
    const loaded = acceptPage(empty, 0, [{ id: "a" }], 3, idOf);
    const failed = acceptFailure(loaded, 1, "The hall could not be reached");
    expect(failed.rows?.map(idOf)).toEqual(["a"]);
    expect(failed.pageError).toBe("The hall could not be reached");
    expect(failed.error).toBeNull();
    expect(shouldRequestNext(1, 3, false, true)).toBe(false);
    const retried = acceptPage(failed, 1, [{ id: "a" }, { id: "b" }], 3, idOf);
    expect(retried.rows?.map(idOf)).toEqual(["a", "b"]);
    expect(retried.pageError).toBeNull();
  });

  it("uses an inline retry for a failed first page and keeps rows on a failed refresh", () => {
    const first = acceptFailure(empty, 0, "History didn't load");
    expect(first.rows).toBeNull();
    expect(first.error).toBe("History didn't load");
    const ready = acceptPage(first, 0, [{ id: "a" }], 1, idOf);
    const refreshed = acceptFailure(ready, 0, "History didn't load");
    expect(refreshed.rows?.map(idOf)).toEqual(["a"]);
    expect(refreshed.error).toBe("History didn't load");
  });
});
