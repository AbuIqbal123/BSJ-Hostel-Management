import { describe, expect, it } from "@jest/globals";

import { notificationRowVisible } from "@/notification-settings";

describe("notificationRowVisible", () => {
  it("shows the row when a resident, warden, or provost has denied notifications on iOS or Android", () => {
    for (const role of ["resident", "warden", "provost"]) {
      expect(notificationRowVisible({ platform: "ios", role, status: "denied" })).toBe(true);
      expect(notificationRowVisible({ platform: "android", role, status: "denied" })).toBe(true);
    }
  });

  it("hides the row when permission is still open, on the web, and for gate", () => {
    expect(notificationRowVisible({ platform: "ios", role: "resident", status: "granted" })).toBe(false);
    expect(notificationRowVisible({ platform: "ios", role: "resident", status: "undetermined" })).toBe(false);
    expect(notificationRowVisible({ platform: "web", role: "resident", status: "denied" })).toBe(false);
    expect(notificationRowVisible({ platform: "ios", role: "gate", status: "denied" })).toBe(false);
    expect(notificationRowVisible({ platform: "android", role: "gate", status: "denied" })).toBe(false);
  });
});
