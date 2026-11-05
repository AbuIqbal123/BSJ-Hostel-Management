import fs from "fs";
import path from "path";

import { afterEach, beforeEach, describe, expect, it, jest } from "@jest/globals";

import {
  forgetOrdinaryHours,
  readOrdinaryHours,
  rememberOrdinaryHours,
  type OrdinaryHours,
} from "@/ordinary-hours";
import {
  hallAt,
  hallDay,
  leaveNote,
  notBefore,
  proposalLeave,
  proposalReturn,
  returnNote,
} from "@/outing-when";

const inventory = JSON.parse(
  fs.readFileSync(
    path.join(__dirname, "../../../backend/tests/artifacts/hall-inventory.json"),
    "utf8",
  ),
) as { hall_settings: unknown[] };

const artifactHours = readOrdinaryHours(inventory.hall_settings[0]);
if (!artifactHours) {
  throw new Error("hall-inventory.json must include ordinary hours");
}

const BEFORE = "These hours fall outside ordinary hours.";
const AFTER =
  "These hours fall outside ordinary hours. Please request permission from the Permissions tab";

describe("ordinary hours from hall settings", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date("2026-09-30T00:30:00Z"));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("treats 5 Nov 18:00 IST as inside the seeded window", () => {
    expect(leaveNote(hallAt("2026-11-05", 18, 0), artifactHours)).toBeNull();
  });

  it("matches backend edges on 1 October", () => {
    expect(leaveNote(hallAt("2026-10-01", 18, 30), artifactHours)).toBeNull();
    expect(leaveNote(hallAt("2026-10-01", 18, 31), artifactHours)).toBe(AFTER);
    expect(leaveNote(hallAt("2026-10-01", 5, 59), artifactHours)).toBe(BEFORE);
    expect(leaveNote(hallAt("2026-10-01", 6, 0), artifactHours)).toBeNull();
  });

  it("allows 18:00 on a summer day under the same seeded window", () => {
    expect(leaveNote(hallAt("2026-09-30", 18, 0), artifactHours)).toBeNull();
  });

  it("uses the hours argument, not a hardcoded winter end", () => {
    const earlyWinter: OrdinaryHours = {
      ...artifactHours,
      winterOutingEnd: "17:30",
    };
    expect(leaveNote(hallAt("2026-11-05", 18, 0), earlyWinter)).toBe(AFTER);
  });

  it("skips the hours note when home has not loaded yet", () => {
    expect(leaveNote(hallAt("2026-11-05", 19, 0), null)).toBeNull();
  });

  it("keeps before-start copy free of Permissions", () => {
    const note = leaveNote(hallAt("2026-10-01", 5, 59), artifactHours);
    expect(note).toBe(BEFORE);
    expect(note).not.toMatch(/Permissions/);
  });

  it("points after-end times to the Permissions tab", () => {
    expect(returnNote(hallAt("2026-10-01", 12, 0), hallAt("2026-10-01", 18, 31), artifactHours)).toBe(
      AFTER,
    );
  });

  it("proposes Leave at the ordinary start and Return at the end", () => {
    const day = hallAt("2026-11-05", 12, 0);
    const leave = proposalLeave(artifactHours, day);
    const back = proposalReturn(artifactHours, day);
    expect(hallDay(leave)).toBe("2026-11-05");
    expect(hallDay(back)).toBe("2026-11-05");
    expect(leaveNote(leave, artifactHours)).toBeNull();
    expect(returnNote(leave, back, artifactHours)).toBeNull();
    expect(leave.toISOString()).toBe(hallAt("2026-11-05", 6, 0).toISOString());
    expect(back.toISOString()).toBe(hallAt("2026-11-05", 18, 30).toISOString());
  });

  it("follows a summer window that wraps the new year", () => {
    const wrapped: OrdinaryHours = {
      ...artifactHours,
      summerOutingEnd: "18:30",
      winterOutingEnd: "17:30",
      summerSeasonStart: "11-01",
      winterSeasonStart: "03-01",
    };
    const day = hallAt("2026-11-05", 12, 0);
    expect(leaveNote(hallAt("2026-11-05", 18, 0), wrapped)).toBeNull();
    expect(proposalReturn(wrapped, day).toISOString()).toBe(hallAt("2026-11-05", 18, 30).toISOString());
    // 1 Apr is winter under a Nov–Feb summer; 18:00 is after the winter end.
    expect(leaveNote(hallAt("2027-04-01", 18, 0), wrapped)).toBe(AFTER);
  });

  it("moves unset Back by onto the Leave day", () => {
    rememberOrdinaryHours(artifactHours);
    const leave = hallAt("2026-11-06", 10, 0);
    const next = notBefore(leave, null);
    expect(next).not.toBeNull();
    expect(hallDay(next!)).toBe("2026-11-06");
    expect(next!.toISOString()).toBe(proposalReturn(artifactHours, leave).toISOString());
    expect(returnNote(leave, next, artifactHours)).toBeNull();
    forgetOrdinaryHours();
  });
});
