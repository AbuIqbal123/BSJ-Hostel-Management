import { describe, expect, it } from "@jest/globals";

import {
  forgetOfficeSettings,
  readOfficeNoticesCache,
  readOfficeHoursCache,
  rememberOfficeHours,
  rememberOfficeNotices,
} from "@/office-settings-cache";
import type { HallHours, HallNotices } from "@/office";

const HOURS: HallHours = {
  hallName: "Begum Sultan Jahan Hall",
  universityName: "Aligarh Muslim University",
  timezone: "Asia/Kolkata",
  graceMinutes: 30,
  summerStart: "06:00",
  summerEnd: "18:30",
  winterStart: "06:00",
  winterEnd: "17:30",
  summerSeason: "04-01",
  winterSeason: "10-01",
  permissionLeadMinutes: 30,
  guestMaxDays: 3,
  guestMinLeadDays: 1,
  scanWindowSeconds: 60,
};

const NOTICES: HallNotices = { late: "late {resident_name}", back: "back {resident_name}" };

describe("office settings cache", () => {
  it("keeps last-good hours and texts for a revisit, then forgets them on sign-out", () => {
    forgetOfficeSettings();
    expect(readOfficeHoursCache()).toBeNull();
    expect(readOfficeNoticesCache()).toBeNull();

    rememberOfficeHours(HOURS);
    rememberOfficeNotices(NOTICES);
    expect(readOfficeHoursCache()).toEqual(HOURS);
    expect(readOfficeNoticesCache()).toEqual(NOTICES);

    rememberOfficeHours({ ...HOURS, graceMinutes: 45 });
    expect(readOfficeHoursCache()?.graceMinutes).toBe(45);
    expect(readOfficeNoticesCache()).toEqual(NOTICES);

    forgetOfficeSettings();
    expect(readOfficeHoursCache()).toBeNull();
    expect(readOfficeNoticesCache()).toBeNull();
  });
});
