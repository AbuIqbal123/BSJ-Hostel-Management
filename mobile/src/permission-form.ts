/** Timing checks for late-night and home-going permission forms. */

import { hallNow } from "@/format-when";
import { hallAt, hallDay, isNextHallMidnight } from "@/outing-when";

export function permissionDepartureNote(leaveAt: Date | null): string | null {
  if (!leaveAt) {
    return null;
  }
  if (leaveAt.getTime() < Date.now()) {
    return "Departure must not be in the past";
  }
  return null;
}

export function permissionReturnAfterNote(leaveAt: Date | null, backBy: Date | null): string | null {
  if (!leaveAt || !backBy) {
    return null;
  }
  if (backBy.getTime() <= leaveAt.getTime()) {
    return "Expected return must be after departure";
  }
  return null;
}

export function lateNightReturnNote(leaveAt: Date | null, backBy: Date | null): string | null {
  const order = permissionReturnAfterNote(leaveAt, backBy);
  if (order || !leaveAt || !backBy) {
    return order;
  }
  if (hallDay(leaveAt) === hallDay(backBy) || isNextHallMidnight(leaveAt, backBy)) {
    return null;
  }
  return "A late-night return has to be the same day. Only 12:00 AM can be the next day";
}

export function homeDepartureAt(day: string): Date {
  const start = hallAt(day, 0, 0);
  const now = hallNow();
  return start.getTime() < now.getTime() ? now : start;
}

export function homeReturnAt(day: string): Date {
  return hallAt(day, 23, 59);
}
