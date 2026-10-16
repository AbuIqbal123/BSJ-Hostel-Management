import { describe, expect, it } from "@jest/globals";

import { endingReminderAt, reminderPlan, type ReminderPermission, type ReminderPlan } from "@/reminder";

const NOW = Date.parse("2026-10-15T08:00:00Z");

function plan(id: string, startsAt: string | null, expectedReturnAt: string): ReminderPlan {
  return { id, startsAt, expectedReturnAt };
}

function permission(
  id: string,
  permissionType: ReminderPermission["permissionType"],
  status: ReminderPermission["status"],
  departureAt: string,
  expectedReturnAt: string,
): ReminderPermission {
  return { id, permissionType, status, departureAt, expectedReturnAt };
}

describe("reminderPlan", () => {
  it("schedules one reminder per ordinary plan", () => {
    const reminders = reminderPlan({
      out: false,
      current: null,
      plans: [
        plan("morning", "2026-10-15T09:00:00Z", "2026-10-15T12:00:00Z"),
        plan("afternoon", "2026-10-15T13:00:00Z", "2026-10-15T16:00:00Z"),
      ],
      permissions: [],
    });
    expect(reminders).toEqual([
      { id: "morning", expectedReturnAt: "2026-10-15T12:00:00Z" },
      { id: "afternoon", expectedReturnAt: "2026-10-15T16:00:00Z" },
    ]);
  });

  it("schedules an approved late-night permission before an outing exists", () => {
    const reminders = reminderPlan({
      out: false,
      current: null,
      plans: [],
      permissions: [
        permission("late", "late_night", "approved", "2026-10-15T14:00:00Z", "2026-10-15T18:30:00Z"),
      ],
    });
    expect(reminders).toEqual([{ id: "late", expectedReturnAt: "2026-10-15T18:30:00Z" }]);
  });

  it("drops an ordinary plan that overlaps an approved permission", () => {
    const reminders = reminderPlan({
      out: false,
      current: null,
      plans: [
        plan("library", "2026-10-15T10:00:00Z", "2026-10-15T14:00:00Z"),
        plan("market", "2026-10-16T04:00:00Z", "2026-10-16T08:00:00Z"),
      ],
      permissions: [
        permission("late", "late_night", "approved", "2026-10-15T12:00:00Z", "2026-10-15T18:30:00Z"),
      ],
    });
    expect(reminders.map((item) => item.id)).toEqual(["market", "late"]);
  });

  it("lets an approved home-going permission win the overlap and does not remind for it", () => {
    const reminders = reminderPlan({
      out: false,
      current: null,
      plans: [plan("library", "2026-10-15T10:00:00Z", "2026-10-15T14:00:00Z")],
      permissions: [
        permission("home", "home_going", "approved", "2026-10-15T04:00:00Z", "2026-10-17T12:00:00Z"),
      ],
    });
    expect(reminders).toEqual([]);
  });

  it("keeps an ordinary plan that only touches a permission at one instant", () => {
    const reminders = reminderPlan({
      out: false,
      current: null,
      plans: [plan("library", "2026-10-15T08:00:00Z", "2026-10-15T12:00:00Z")],
      permissions: [
        permission("late", "late_night", "approved", "2026-10-15T12:00:00Z", "2026-10-15T18:00:00Z"),
      ],
    });
    expect(reminders.map((item) => item.id)).toEqual(["library", "late"]);
  });

  it("keeps an ordinary plan whose start is missing, because that cannot prove an overlap", () => {
    const reminders = reminderPlan({
      out: false,
      current: null,
      plans: [plan("old", null, "2026-10-15T12:00:00Z")],
      permissions: [
        permission("late", "late_night", "approved", "2026-10-15T08:00:00Z", "2026-10-15T18:00:00Z"),
      ],
    });
    expect(reminders.map((item) => item.id)).toEqual(["old", "late"]);
  });

  it("ignores cancelled, expired, pending, and in-use permissions", () => {
    const reminders = reminderPlan({
      out: false,
      current: null,
      plans: [plan("library", "2026-10-15T08:00:00Z", "2026-10-15T11:00:00Z")],
      permissions: [
        permission("cancelled", "late_night", "cancelled", "2026-10-15T14:00:00Z", "2026-10-15T18:00:00Z"),
        permission("expired", "late_night", "expired", "2026-10-15T14:00:00Z", "2026-10-15T18:00:00Z"),
        permission("pending", "late_night", "pending", "2026-10-15T14:00:00Z", "2026-10-15T18:00:00Z"),
        permission("used", "late_night", "in_use", "2026-10-15T14:00:00Z", "2026-10-15T18:00:00Z"),
      ],
    });
    expect(reminders).toEqual([{ id: "library", expectedReturnAt: "2026-10-15T11:00:00Z" }]);
  });

  it("schedules only the outing she is on", () => {
    const reminders = reminderPlan({
      out: true,
      current: {
        id: "out-now",
        outingType: "ordinary",
        status: "outside",
        permissionId: null,
        expectedReturnAt: "2026-10-15T12:00:00Z",
      },
      plans: [plan("later", "2026-10-16T04:00:00Z", "2026-10-16T08:00:00Z")],
      permissions: [
        permission("late", "late_night", "approved", "2026-10-16T12:00:00Z", "2026-10-16T18:00:00Z"),
      ],
    });
    expect(reminders).toEqual([{ id: "out-now", expectedReturnAt: "2026-10-15T12:00:00Z" }]);
  });

  it("uses the late-night outing id while she is out, not the permission id", () => {
    const reminders = reminderPlan({
      out: true,
      current: {
        id: "outing-late",
        outingType: "late_night",
        status: "outside",
        permissionId: "late",
        expectedReturnAt: "2026-10-15T18:30:00Z",
      },
      plans: [],
      permissions: [
        permission("late", "late_night", "approved", "2026-10-15T14:00:00Z", "2026-10-15T18:30:00Z"),
      ],
    });
    expect(reminders).toEqual([{ id: "outing-late", expectedReturnAt: "2026-10-15T18:30:00Z" }]);
  });

  it("schedules nothing for home-going, a missing outing, or a planned outing while she is out", () => {
    const home = reminderPlan({
      out: true,
      current: {
        id: "home",
        outingType: "home_going",
        status: "outside",
        permissionId: "home-permission",
        expectedReturnAt: "2026-10-17T12:00:00Z",
      },
      plans: [plan("later", "2026-10-16T04:00:00Z", "2026-10-16T08:00:00Z")],
      permissions: [],
    });
    const missing = reminderPlan({ out: true, current: null, plans: [], permissions: [] });
    const planned = reminderPlan({
      out: true,
      current: {
        id: "planned",
        outingType: "ordinary",
        status: "planned",
        permissionId: null,
        expectedReturnAt: "2026-10-15T12:00:00Z",
      },
      plans: [],
      permissions: [],
    });
    expect(home).toEqual([]);
    expect(missing).toEqual([]);
    expect(planned).toEqual([]);
  });
});

describe("endingReminderAt", () => {
  it("is 15 minutes before the return", () => {
    const at = endingReminderAt("2026-10-15T12:00:00Z", NOW);
    expect(at?.toISOString()).toBe("2026-10-15T11:45:00.000Z");
  });

  it("is null when that moment has passed, or the time is missing", () => {
    expect(endingReminderAt("2026-10-15T08:14:00Z", NOW)).toBeNull();
    expect(endingReminderAt("2026-10-15T08:15:00Z", NOW)).toBeNull();
    expect(endingReminderAt(null, NOW)).toBeNull();
    expect(endingReminderAt("not-a-time", NOW)).toBeNull();
  });
});
