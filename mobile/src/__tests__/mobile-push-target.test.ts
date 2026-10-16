import { describe, expect, it } from "@jest/globals";

import { pushTarget } from "@/push-target";

describe("pushTarget", () => {
  it("opens the resident record, or the hall pass for a late or ending reminder", () => {
    expect(pushTarget("resident", { kind: "permission_decided", record_id: "perm 1" })).toBe(
      "/permission?id=perm%201",
    );
    expect(pushTarget("resident", { kind: "guest_stay_decided", record_id: "stay" })).toBe("/guest?id=stay");
    expect(pushTarget("resident", { kind: "resident_late", record_id: "outing" })).toBe("/pass");
    expect(pushTarget("resident", { kind: "outing_ending", record_id: "outing" })).toBe("/pass");
  });

  it("opens the staff sheet, or the late tab", () => {
    expect(pushTarget("warden", { kind: "permission_requested", record_id: "perm" })).toBe(
      "/staff/requests?tab=permissions&open=perm",
    );
    expect(pushTarget("provost", { kind: "guest_stay_requested", record_id: "stay" })).toBe(
      "/staff/requests?tab=guests&open=stay",
    );
    expect(pushTarget("warden", { kind: "resident_late" })).toBe("/staff/out?tab=late");
  });

  it("opens nothing for gate, an unknown kind, or a record tap with no id", () => {
    expect(pushTarget("gate", { kind: "permission_requested", record_id: "perm" })).toBeNull();
    expect(pushTarget("resident", { kind: "permission_decided" })).toBeNull();
    expect(pushTarget("resident", { kind: "other", record_id: "x" })).toBeNull();
    expect(pushTarget("warden", { kind: "other", record_id: "x" })).toBeNull();
  });
});
