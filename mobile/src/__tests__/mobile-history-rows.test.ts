import { describe, expect, it } from "@jest/globals";

import { mergeHistoryRows } from "@/history-rows";

describe("mergeHistoryRows", () => {
  it("adds the next page after the rows already shown", () => {
    expect(mergeHistoryRows([{ id: "a" }], [{ id: "b" }])).toEqual([{ id: "a" }, { id: "b" }]);
  });

  it("drops a row that is already on the page, including a repeat inside the new page", () => {
    expect(mergeHistoryRows([{ id: "a" }, { id: "b" }], [{ id: "b" }, { id: "c" }, { id: "c" }])).toEqual([
      { id: "a" },
      { id: "b" },
      { id: "c" },
    ]);
  });

  it("keeps the current page when the next page adds nothing", () => {
    const current = [{ id: "a" }];
    expect(mergeHistoryRows(current, [{ id: "a" }])).toBe(current);
    expect(mergeHistoryRows(current, [])).toBe(current);
  });
});
