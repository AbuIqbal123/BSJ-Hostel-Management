import { describe, expect, it } from "@jest/globals";
import { formatChipDay, formatHallDate, formatWhen } from "@/format-when";

describe("hall dates keep the leading zero", () => {
  it("formats an instant on the hall clock", () => {
    // 2026-10-05 13:30 UTC is 7:00 PM in Asia/Kolkata.
    expect(formatWhen("2026-10-05T13:30:00Z")).toBe("05 October 2026, 7:00 PM");
  });

  it("formats a hall calendar date", () => {
    expect(formatHallDate("2026-10-05")).toBe("05 October 2026");
    expect(formatHallDate("2026-10-15")).toBe("15 October 2026");
  });

  it("formats a date chip as day, short month, and year", () => {
    expect(formatChipDay(new Date("2026-10-05T13:30:00Z"))).toBe("05 Oct 2026");
    expect(formatChipDay(new Date("2026-10-15T02:00:00Z"))).toBe("15 Oct 2026");
  });
});
