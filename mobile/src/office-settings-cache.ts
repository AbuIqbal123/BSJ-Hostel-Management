/** Last-good office settings for the signed-in session. Survives screen remounts. */

import type { HallHours, HallNotices } from "@/office";

let hours: HallHours | null = null;
let notices: HallNotices | null = null;

export function rememberOfficeHours(next: HallHours): void {
  hours = next;
}

export function rememberOfficeNotices(next: HallNotices): void {
  notices = next;
}

export function readOfficeHoursCache(): HallHours | null {
  return hours;
}

export function readOfficeNoticesCache(): HallNotices | null {
  return notices;
}

export function forgetOfficeSettings(): void {
  hours = null;
  notices = null;
}
