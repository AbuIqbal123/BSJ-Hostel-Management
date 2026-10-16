/**
 * Return reminders are local. The hall does not send them.
 *
 * One known limit: a reminder still fires if she returns early or does not
 * use the outing. The phone learns that only on the next Home load, and
 * there is no daylight-saving shift because the hall clock is fixed at UTC+5:30.
 */

const LEAD_MS = 15 * 60 * 1000;

export type ReminderKind = "ordinary" | "late_night" | "home_going";

export type ReminderCurrent = {
  id: string;
  outingType: ReminderKind;
  status: string;
  permissionId: string | null;
  expectedReturnAt: string;
};

export type ReminderPlan = {
  id: string;
  startsAt: string | null;
  expectedReturnAt: string;
};

export type ReminderPermission = {
  id: string;
  permissionType: ReminderKind;
  status: string;
  departureAt: string;
  expectedReturnAt: string;
};

export type ReturnReminder = {
  id: string;
  expectedReturnAt: string;
};

function instant(value: string | null): number {
  return value ? Date.parse(value) : Number.NaN;
}

/** Intervals overlap when each starts before the other ends. A missing start cannot prove it. */
function overlaps(plan: ReminderPlan, permission: ReminderPermission): boolean {
  const start = instant(plan.startsAt);
  const end = instant(plan.expectedReturnAt);
  const leave = instant(permission.departureAt);
  const back = instant(permission.expectedReturnAt);
  if ([start, end, leave, back].some((value) => Number.isNaN(value))) {
    return false;
  }
  return start < back && leave < end;
}

/**
 * While she is out, only that outing is reminded, and never a home-going trip.
 * Otherwise each ordinary plan and each approved late-night permission gets its
 * own reminder. An ordinary plan that overlaps an approved permission is dropped,
 * because the permission is what the gate will use.
 */
export function reminderPlan(input: {
  out: boolean;
  current: ReminderCurrent | null;
  plans: ReminderPlan[];
  permissions: ReminderPermission[];
}): ReturnReminder[] {
  if (input.out) {
    const current = input.current;
    if (!current || current.status !== "outside") {
      return [];
    }
    if (current.outingType !== "ordinary" && current.outingType !== "late_night") {
      return [];
    }
    return [{ id: current.id, expectedReturnAt: current.expectedReturnAt }];
  }
  const approved = input.permissions.filter((item) => item.status === "approved");
  const plans = input.plans.filter((plan) => !approved.some((permission) => overlaps(plan, permission)));
  const late = approved.filter((item) => item.permissionType === "late_night");
  return [
    ...plans.map((plan) => ({ id: plan.id, expectedReturnAt: plan.expectedReturnAt })),
    ...late.map((item) => ({ id: item.id, expectedReturnAt: item.expectedReturnAt })),
  ];
}

/** 15 minutes before she is due back, or null once that moment has passed. */
export function endingReminderAt(expectedReturnAt: string | null, now = Date.now()): Date | null {
  const due = instant(expectedReturnAt);
  if (Number.isNaN(due) || due - LEAD_MS <= now) {
    return null;
  }
  return new Date(due - LEAD_MS);
}

/** A later tap of the same notification is a new tap when its date differs. */
export function responseKey(identifier: string, date: number): string {
  return `${identifier}:${date}`;
}
