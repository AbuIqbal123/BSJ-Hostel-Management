/** Hall clock, season labels, and hours settings. */

import { MONTHS } from "@/format-when";
import { record, text as str, type Json } from "@/json";

function int(value: unknown): number | null {
  return typeof value === "number" && Number.isInteger(value) ? value : null;
}

const MONTH_LENGTH = [0, 31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
const CLOCK = /^([01][0-9]|2[0-3]):([0-5][0-9])$/;
const SEASON = /^(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])$/;

/** `06:30` is shown as `6:30 AM`. `18:30` is `6:30 PM`. */
export function clockLabel(stored: string): string {
  const match = CLOCK.exec(stored);
  if (!match) {
    return stored;
  }
  const hour24 = Number(match[1]);
  const marker = hour24 >= 12 ? "PM" : "AM";
  return `${hour24 % 12 || 12}:${match[2]} ${marker}`;
}

/** Accepts `6:30 PM` or the stored `18:30`. */
export function parseClock(value: string): string | null {
  const trimmed = value.trim().replace(/\s+/g, " ");
  const twelve = /^(\d{1,2}):(\d{2})\s*([AaPp][Mm])$/.exec(trimmed);
  if (twelve) {
    const hour = Number(twelve[1]);
    const minute = Number(twelve[2]);
    if (hour < 1 || hour > 12 || minute > 59) {
      return null;
    }
    const pm = twelve[3].toUpperCase() === "PM";
    const hour24 = hour === 12 ? (pm ? 12 : 0) : pm ? hour + 12 : hour;
    return `${String(hour24).padStart(2, "0")}:${twelve[2]}`;
  }
  const stored = CLOCK.exec(trimmed);
  return stored ? `${stored[1]}:${stored[2]}` : null;
}

/** `04-01` is shown as `01 April`. */
export function seasonLabel(stored: string): string {
  const match = SEASON.exec(stored);
  if (!match || !monthDay(Number(match[1]), Number(match[2]))) {
    return stored;
  }
  return `${match[2]} ${MONTHS[Number(match[1]) - 1]}`;
}

/** Accepts `01 April`, `1 April`, or the stored `04-01`. */
export function parseSeason(value: string): string | null {
  const trimmed = value.trim().replace(/\s+/g, " ");
  const stored = SEASON.exec(trimmed);
  if (stored) {
    return monthDay(Number(stored[1]), Number(stored[2])) ? trimmed : null;
  }
  const words = /^(\d{1,2})\s+([A-Za-z]+)$/.exec(trimmed);
  if (!words) {
    return null;
  }
  const month = MONTHS.findIndex((name) => name.toLowerCase() === words[2].toLowerCase()) + 1;
  const day = Number(words[1]);
  if (!monthDay(month, day)) {
    return null;
  }
  return `${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function monthDay(month: number, day: number): boolean {
  return month >= 1 && month <= 12 && day >= 1 && day <= MONTH_LENGTH[month];
}

export function bounded(value: string, min: number, max: number, empty: string, range: string): number | string {
  const trimmed = value.trim();
  if (!/^\d+$/.test(trimmed)) {
    return empty;
  }
  const parsed = Number(trimmed);
  if (parsed < min || parsed > max) {
    return range;
  }
  return parsed;
}

export type HallHours = {
  hallName: string;
  universityName: string;
  timezone: string;
  graceMinutes: number;
  summerStart: string;
  summerEnd: string;
  winterStart: string;
  winterEnd: string;
  summerSeason: string;
  winterSeason: string;
  permissionLeadMinutes: number;
  guestMaxDays: number;
  guestMinLeadDays: number;
  scanWindowSeconds: number;
};

export function readHours(value: unknown): HallHours | null {
  const body = record(value);
  if (!body) {
    return null;
  }
  const hallName = str(body.hall_name);
  const universityName = str(body.university_name);
  const timezone = str(body.timezone);
  const graceMinutes = int(body.grace_minutes);
  const summerStart = str(body.summer_outing_start);
  const summerEnd = str(body.summer_outing_end);
  const winterStart = str(body.winter_outing_start);
  const winterEnd = str(body.winter_outing_end);
  const summerSeason = str(body.summer_season_start);
  const winterSeason = str(body.winter_season_start);
  const permissionLeadMinutes = int(body.permission_lead_minutes);
  const guestMaxDays = int(body.guest_max_inclusive_days);
  const guestMinLeadDays = int(body.guest_min_lead_days);
  const scanWindowSeconds = int(body.scan_duplicate_window_seconds);
  if (
    hallName === null ||
    universityName === null ||
    timezone === null ||
    graceMinutes === null ||
    summerStart === null ||
    summerEnd === null ||
    winterStart === null ||
    winterEnd === null ||
    summerSeason === null ||
    winterSeason === null ||
    permissionLeadMinutes === null ||
    guestMaxDays === null ||
    guestMinLeadDays === null ||
    scanWindowSeconds === null
  ) {
    return null;
  }
  return {
    hallName,
    universityName,
    timezone,
    graceMinutes,
    summerStart,
    summerEnd,
    winterStart,
    winterEnd,
    summerSeason,
    winterSeason,
    permissionLeadMinutes,
    guestMaxDays,
    guestMinLeadDays,
    scanWindowSeconds,
  };
}

const HOUR_FIELDS: [keyof HallHours, string][] = [
  ["hallName", "hall_name"],
  ["universityName", "university_name"],
  ["graceMinutes", "grace_minutes"],
  ["summerStart", "summer_outing_start"],
  ["summerEnd", "summer_outing_end"],
  ["winterStart", "winter_outing_start"],
  ["winterEnd", "winter_outing_end"],
  ["summerSeason", "summer_season_start"],
  ["winterSeason", "winter_season_start"],
  ["permissionLeadMinutes", "permission_lead_minutes"],
  ["guestMaxDays", "guest_max_inclusive_days"],
  ["guestMinLeadDays", "guest_min_lead_days"],
  ["scanWindowSeconds", "scan_duplicate_window_seconds"],
];

export type HoursFields = {
  hallName: string;
  universityName: string;
  grace: string;
  summerStart: string;
  summerEnd: string;
  winterStart: string;
  winterEnd: string;
  summerSeason: string;
  winterSeason: string;
  permissionLead: string;
  guestMax: string;
  guestLead: string;
  scanWindow: string;
};

export function hoursFromFields(before: HallHours, fields: HoursFields): HallHours | string {
  if (fields.hallName.trim().length < 1 || fields.hallName.trim().length > 160) {
    return "Enter the hall name";
  }
  if (fields.universityName.trim().length < 1 || fields.universityName.trim().length > 160) {
    return "Enter the university name";
  }
  const grace = bounded(fields.grace, 0, 180, "Enter the grace", "Grace is from 0 to 180 minutes");
  const lead = bounded(fields.permissionLead, 0, 180, "Enter the permission lead", "Permission lead is from 0 to 180 minutes");
  const guestMax = bounded(fields.guestMax, 1, 30, "Enter the guest stay length", "A guest stay is from 1 to 30 days");
  const guestLead = bounded(fields.guestLead, 0, 14, "Enter the guest lead", "Guest lead is from 0 to 14 days");
  const scanWindow = bounded(fields.scanWindow, 0, 600, "Enter the scan window", "The scan window is from 0 to 600 seconds");
  const summerStart = parseClock(fields.summerStart);
  const summerEnd = parseClock(fields.summerEnd);
  const winterStart = parseClock(fields.winterStart);
  const winterEnd = parseClock(fields.winterEnd);
  const summerSeason = parseSeason(fields.summerSeason);
  const winterSeason = parseSeason(fields.winterSeason);
  if (typeof grace === "string") {
    return grace;
  }
  if (typeof lead === "string") {
    return lead;
  }
  if (typeof guestMax === "string") {
    return guestMax;
  }
  if (typeof guestLead === "string") {
    return guestLead;
  }
  if (typeof scanWindow === "string") {
    return scanWindow;
  }
  if (!summerStart || !summerEnd || !winterStart || !winterEnd) {
    return "Use a time like 6:30 PM";
  }
  if (!summerSeason || !winterSeason) {
    return "Use a date like 01 April";
  }
  return {
    ...before,
    hallName: fields.hallName.trim(),
    universityName: fields.universityName.trim(),
    graceMinutes: grace,
    summerStart,
    summerEnd,
    winterStart,
    winterEnd,
    summerSeason,
    winterSeason,
    permissionLeadMinutes: lead,
    guestMaxDays: guestMax,
    guestMinLeadDays: guestLead,
    scanWindowSeconds: scanWindow,
  };
}

export function hoursPatch(before: HallHours, after: HallHours): Json {
  const body: Json = {};
  for (const [key, name] of HOUR_FIELDS) {
    if (before[key] !== after[key]) {
      body[name] = after[key];
    }
  }
  return body;
}

