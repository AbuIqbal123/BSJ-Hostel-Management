import { describe, expect, it } from "@jest/globals";

import { hallMonthRange } from "@/outing-when";

describe("hallMonthRange", () => {
  it("returns the first and last hall days of this and last month", () => {
    // 5 Nov 2026 09:00 IST = 5 Nov 2026 03:30 UTC
    const midNovember = new Date("2026-11-05T03:30:00Z");
    expect(hallMonthRange(midNovember, 0)).toEqual({ from: "2026-11-01", to: "2026-11-30" });
    expect(hallMonthRange(midNovember, 1)).toEqual({ from: "2026-10-01", to: "2026-10-31" });
  });

  it("crosses the year when last month is December", () => {
    const earlyJanuary = new Date("2026-01-05T03:30:00Z");
    expect(hallMonthRange(earlyJanuary, 1)).toEqual({ from: "2025-12-01", to: "2025-12-31" });
  });
});
