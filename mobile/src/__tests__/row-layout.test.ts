import { describe, expect, it } from "@jest/globals";

import { crossesMidnight, historyPartsLayout, requestsPlaceOnOwnLine } from "@/row-layout";

const SAME_DAY = "7:00 PM to 11:00 PM, 05 October 2026";
const CROSSES = "11:00 PM, 05 October 2026 to 12:55 AM, 06 October 2026";
const HOME_RANGE = "05 October 2026 to 08 October 2026";

describe("crossesMidnight", () => {
  it("is true only when the span names two hall days around the word to", () => {
    expect(crossesMidnight(CROSSES)).toBe(true);
    expect(crossesMidnight(SAME_DAY)).toBe(false);
    expect(crossesMidnight(HOME_RANGE)).toBe(false);
    expect(crossesMidnight("")).toBe(false);
  });
});

describe("history date lines", () => {
  it("wraps only a cross-midnight date, and only to two lines, at the default size", () => {
    expect(historyPartsLayout(CROSSES, 1)).toEqual({ keepParts: 0 });
    expect(historyPartsLayout(SAME_DAY, 1)).toEqual({});
    expect(historyPartsLayout(HOME_RANGE, 1)).toEqual({});
  });

  it("drops the two-line cap for every date once the text size is larger", () => {
    expect(historyPartsLayout(CROSSES, 3.1)).toEqual({ keepParts: 0, wrapLines: 0 });
    expect(historyPartsLayout(SAME_DAY, 1.12)).toEqual({ keepParts: 0, wrapLines: 0 });
    expect(historyPartsLayout(HOME_RANGE, 2)).toEqual({ keepParts: 0, wrapLines: 0 });
  });
});

describe("requests place at a larger text size", () => {
  it("keeps the place on the kind's line at the default size", () => {
    expect(requestsPlaceOnOwnLine(3, 1)).toBe(false);
    expect(requestsPlaceOnOwnLine(1, 2)).toBe(false);
  });

  it("moves the place onto its own line above the default size", () => {
    expect(requestsPlaceOnOwnLine(3, 1.01)).toBe(true);
    expect(requestsPlaceOnOwnLine(2, 3.1)).toBe(true);
  });
});
