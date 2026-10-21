import { record, text as str, type Json } from "@/json";
import { passwordRulesMet } from "@/password-rules";

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

const MONTH_LENGTH = [0, 31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
const CLOCK = /^([01][0-9]|2[0-3]):([0-5][0-9])$/;
const SEASON = /^(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])$/;
const PHONE = /^\+[1-9][0-9]{7,14}$/;

export const LATE_PLACEHOLDERS = ["{resident_name}", "{room}", "{expected_return_local}", "{hall_name}"] as const;
export const RETURN_PLACEHOLDERS = ["{resident_name}", "{room}", "{returned_at_local}", "{hall_name}"] as const;

export const REISSUE_CONFIRM = {
  title: "Reissue hall pass",
  message: "The old QR stops working",
  action: "Reissue",
} as const;

export const RESET_CONFIRM = {
  title: "Reset password",
  message: "Sessions end",
  action: "Reset",
} as const;

export const REGISTER_CSV_HEADER =
  "record_type,full_name,enrolment_number,room_label,block_code,course,presence,state,place,exited_at,expected_return_at,grace_ends_at,returned_at,outing_type,guardian_name,guardian_phone,guest_name,relation,host_name,host_room_label,guest_start_date,guest_end_date,payment_status,guest_bucket,arrived_at,departed_at";

function int(value: unknown): number | null {
  return typeof value === "number" && Number.isInteger(value) ? value : null;
}

function oneOf<T extends string>(value: unknown, allowed: readonly T[]): T | null {
  return typeof value === "string" && (allowed as readonly string[]).includes(value) ? (value as T) : null;
}

export function runsOffice(role: string): boolean {
  return role === "provost";
}

export function officeMessage(message: string, details: Record<string, unknown> | null = null): string {
  const line = (value: string) => value.trim().replace(/\.$/, "");
  if (details) {
    for (const value of Object.values(details)) {
      if (typeof value === "string" && value.trim()) {
        return line(value);
      }
      if (Array.isArray(value) && typeof value[0] === "string" && value[0].trim()) {
        return line(value[0]);
      }
    }
  }
  return line(message);
}

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

export function templateProblem(template: string, placeholders: readonly string[]): string | null {
  if (template.trim().length === 0) {
    return "Write the message";
  }
  const missing = placeholders.filter((item) => !template.includes(item));
  return missing.length > 0 ? `Keep ${missing.join(", ")}` : null;
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

export function e164(value: string): string | null {
  const trimmed = value.trim();
  return PHONE.test(trimmed) ? trimmed : null;
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

export type HallNotices = { late: string; back: string };

export function readNotices(value: unknown): HallNotices | null {
  const body = record(value);
  const late = str(body?.late_sms_template);
  const back = str(body?.return_sms_template);
  return late !== null && back !== null ? { late, back } : null;
}

export function noticesPatch(before: HallNotices, after: HallNotices): Json {
  const body: Json = {};
  if (before.late !== after.late) {
    body.late_sms_template = after.late;
  }
  if (before.back !== after.back) {
    body.return_sms_template = after.back;
  }
  return body;
}

export type OfficeBlock = {
  id: string;
  code: string;
  name: string;
  floors: number | null;
  roomCount: number;
  bedsPerRoom: number;
  status: "active" | "inactive";
};

export function readBlock(value: unknown): OfficeBlock | null {
  const body = record(value);
  if (!body) {
    return null;
  }
  const id = str(body.id);
  const code = str(body.code);
  const name = str(body.name);
  const floors = body.floors === null ? null : int(body.floors);
  const roomCount = int(body.room_count);
  const bedsPerRoom = int(body.beds_per_room);
  const status = oneOf(body.status, ["active", "inactive"] as const);
  if (!id || !code || !name || floors === undefined || roomCount === null || bedsPerRoom === null || !status) {
    return null;
  }
  if (body.floors !== null && floors === null) {
    return null;
  }
  return { id, code, name, floors, roomCount, bedsPerRoom, status };
}

export function readBlocks(value: unknown): OfficeBlock[] | null {
  if (!Array.isArray(value)) {
    return null;
  }
  const blocks = value.map(readBlock);
  return blocks.every((block) => block !== null) ? blocks : null;
}

export type OfficeRoom = {
  id: string;
  blockId: string;
  number: string;
  label: string;
  bedCount: number;
  status: "active" | "inactive";
};

export function readRoom(value: unknown): OfficeRoom | null {
  const body = record(value);
  if (!body) {
    return null;
  }
  const id = str(body.id);
  const blockId = str(body.block_id);
  const number = str(body.number);
  const label = str(body.label);
  const bedCount = int(body.bed_count);
  const status = oneOf(body.status, ["active", "inactive"] as const);
  if (!id || !blockId || number === null || !label || bedCount === null || !status) {
    return null;
  }
  return { id, blockId, number, label, bedCount, status };
}

export function readRooms(value: unknown): OfficeRoom[] | null {
  if (!Array.isArray(value)) {
    return null;
  }
  const rooms = value.map(readRoom);
  return rooms.every((room) => room !== null) ? rooms : null;
}

export type OfficePlace = {
  id: string;
  name: string;
  source: "preset" | "custom";
  status: "active" | "inactive";
};

export function readPlace(value: unknown): OfficePlace | null {
  const body = record(value);
  if (!body) {
    return null;
  }
  const id = str(body.id);
  const name = str(body.name);
  const source = oneOf(body.source, ["preset", "custom"] as const);
  const status = oneOf(body.status, ["active", "inactive"] as const);
  return id && name && source && status ? { id, name, source, status } : null;
}

export function readPlaces(value: unknown): OfficePlace[] | null {
  const items = record(value)?.items;
  if (!Array.isArray(items)) {
    return null;
  }
  const places = items.map(readPlace);
  return places.every((place) => place !== null) ? places : null;
}

export function hiddenFromResidents(place: OfficePlace): boolean {
  return place.status === "inactive";
}

/** The resident catalog is the active rows. Admin keeps the inactive ones. */
export function residentCatalog(places: OfficePlace[]): OfficePlace[] {
  return places.filter((place) => !hiddenFromResidents(place));
}

export type OfficeResident = {
  id: string;
  fullName: string;
  enrolmentNumber: string;
  course: string | null;
  roomId: string;
  roomLabel: string;
  phone: string | null;
  guardianName: string;
  guardianPhone: string;
  status: "active" | "suspended";
  presence: "inside" | "outside";
};

export function readResident(value: unknown): OfficeResident | null {
  const body = record(value);
  if (!body) {
    return null;
  }
  const id = str(body.id);
  const fullName = str(body.full_name);
  const enrolmentNumber = str(body.enrolment_number);
  const course = body.course === null || body.course === undefined ? null : str(body.course);
  const roomId = str(body.room_id);
  const roomLabel = str(body.room_label);
  const phone = body.phone === null || body.phone === undefined ? null : str(body.phone);
  const guardianName = str(body.guardian_name);
  const guardianPhone = str(body.guardian_phone);
  const status = oneOf(body.status, ["active", "suspended"] as const);
  const presence = oneOf(body.presence, ["inside", "outside"] as const);
  if (
    !id ||
    !fullName ||
    !enrolmentNumber ||
    course === undefined ||
    (body.course !== null && body.course !== undefined && course === null) ||
    !roomId ||
    !roomLabel ||
    phone === undefined ||
    (body.phone !== null && body.phone !== undefined && phone === null) ||
    !guardianName ||
    !guardianPhone ||
    !status ||
    !presence ||
    "qr_payload" in body ||
    "temporary_password" in body
  ) {
    return null;
  }
  return {
    id,
    fullName,
    enrolmentNumber,
    course,
    roomId,
    roomLabel,
    phone,
    guardianName,
    guardianPhone,
    status,
    presence,
  };
}

export type IssuedPass = { qrPayload: string; fullName: string; roomLabel: string };

export function readPass(value: unknown): IssuedPass | null {
  const body = record(value);
  const qrPayload = str(body?.qr_payload);
  const fullName = str(body?.full_name);
  const roomLabel = str(body?.room_label);
  return qrPayload && fullName && roomLabel ? { qrPayload, fullName, roomLabel } : null;
}

export function readCreatedResident(value: unknown): { account: OfficeResident; pass: IssuedPass } | null {
  const body = record(value);
  const account = readResident(body?.account);
  const pass = readPass(body?.hall_pass);
  return account && pass ? { account, pass } : null;
}

export type OfficeStaff = {
  id: string;
  fullName: string;
  username: string;
  role: "gate" | "warden" | "provost";
  jobTitle: string;
  status: "active" | "suspended";
};

export function readStaffAccount(value: unknown): OfficeStaff | null {
  const body = record(value);
  if (!body || "temporary_password" in body || "password" in body) {
    return null;
  }
  const id = str(body.id);
  const fullName = str(body.full_name);
  const username = str(body.username);
  const role = oneOf(body.role, ["gate", "warden", "provost"] as const);
  const jobTitle = str(body.job_title);
  const status = oneOf(body.status, ["active", "suspended"] as const);
  return id && fullName && username && role && jobTitle && status
    ? { id, fullName, username, role, jobTitle, status }
    : null;
}

export function readPage<T>(value: unknown, readOne: (row: unknown) => T | null): { items: T[]; total: number } | null {
  const body = record(value);
  const rows = body?.items;
  const total = int(body?.total);
  if (!Array.isArray(rows) || total === null) {
    return null;
  }
  const items = rows.map(readOne);
  return items.every((item) => item !== null) ? { items, total } : null;
}

export type ResidentDraft = {
  fullName: string;
  enrolmentNumber: string;
  course: string;
  roomId: string;
  phone: string;
  guardianName: string;
  guardianPhone: string;
  status: "active" | "suspended";
  temporaryPassword: string;
};

export function residentCreate(draft: ResidentDraft): Json | string {
  const phone = e164(draft.phone);
  const guardianPhone = e164(draft.guardianPhone);
  if (draft.fullName.trim().length < 1 || draft.fullName.trim().length > 120) {
    return "Enter her name";
  }
  if (draft.enrolmentNumber.trim().length < 1 || draft.enrolmentNumber.trim().length > 40) {
    return "Enter her enrolment number";
  }
  if (!draft.roomId) {
    return "Choose a room";
  }
  if (!phone) {
    return "Enter her phone with the country code";
  }
  if (draft.guardianName.trim().length < 1 || draft.guardianName.trim().length > 120) {
    return "Enter the guardian's name";
  }
  if (!guardianPhone) {
    return "Enter the guardian phone with the country code";
  }
  if (draft.course.trim().length > 120) {
    return "Use 120 characters or fewer for the course";
  }
  if (!passwordRulesMet(draft.temporaryPassword) || draft.temporaryPassword.length > 200) {
    return "Set a temporary password";
  }
  const body: Json = {
    full_name: draft.fullName.trim(),
    enrolment_number: draft.enrolmentNumber.trim(),
    room_id: draft.roomId,
    phone,
    guardian_name: draft.guardianName.trim(),
    guardian_phone: guardianPhone,
    temporary_password: draft.temporaryPassword,
  };
  if (draft.course.trim()) {
    body.course = draft.course.trim();
  }
  return body;
}

export function residentPatch(before: OfficeResident, draft: ResidentDraft): Json | string {
  const phone = draft.phone.trim() === "" ? null : e164(draft.phone);
  const guardianPhone = e164(draft.guardianPhone);
  if (draft.fullName.trim().length < 1 || draft.fullName.trim().length > 120) {
    return "Enter her name";
  }
  if (draft.enrolmentNumber.trim().length < 1 || draft.enrolmentNumber.trim().length > 40) {
    return "Enter her enrolment number";
  }
  if (!draft.roomId) {
    return "Choose a room";
  }
  if (draft.phone.trim() !== "" && !phone) {
    return "Enter her phone with the country code";
  }
  if (draft.guardianName.trim().length < 1) {
    return "Enter the guardian's name";
  }
  if (!guardianPhone) {
    return "Enter the guardian phone with the country code";
  }
  if (draft.course.trim().length > 120) {
    return "Use 120 characters or fewer for the course";
  }
  const body: Json = {};
  if (draft.fullName.trim() !== before.fullName) {
    body.full_name = draft.fullName.trim();
  }
  if (draft.enrolmentNumber.trim() !== before.enrolmentNumber) {
    body.enrolment_number = draft.enrolmentNumber.trim();
  }
  if ((draft.course.trim() || null) !== before.course) {
    body.course = draft.course.trim() || null;
  }
  if (draft.roomId !== before.roomId) {
    body.room_id = draft.roomId;
  }
  if (phone !== before.phone) {
    body.phone = phone;
  }
  if (draft.guardianName.trim() !== before.guardianName) {
    body.guardian_name = draft.guardianName.trim();
  }
  if (guardianPhone !== before.guardianPhone) {
    body.guardian_phone = guardianPhone;
  }
  if (draft.status !== before.status) {
    body.status = draft.status;
  }
  return body;
}

export type StaffDraft = {
  fullName: string;
  username: string;
  role: "gate" | "warden" | "provost";
  jobTitle: string;
  status: "active" | "suspended";
  temporaryPassword: string;
};

export function staffCreate(draft: StaffDraft): Json | string {
  if (draft.fullName.trim().length < 1 || draft.fullName.trim().length > 120) {
    return "Enter a name";
  }
  if (draft.username.trim().length < 1 || draft.username.trim().length > 80) {
    return "Enter a username";
  }
  if (draft.jobTitle.trim().length < 1 || draft.jobTitle.trim().length > 80) {
    return "Enter the post";
  }
  if (!passwordRulesMet(draft.temporaryPassword) || draft.temporaryPassword.length > 200) {
    return "Set a temporary password";
  }
  return {
    full_name: draft.fullName.trim(),
    username: draft.username.trim(),
    role: draft.role,
    job_title: draft.jobTitle.trim(),
    temporary_password: draft.temporaryPassword,
  };
}

export function staffPatch(before: OfficeStaff, draft: StaffDraft): Json | string {
  if (draft.fullName.trim().length < 1 || draft.fullName.trim().length > 120) {
    return "Enter a name";
  }
  if (draft.jobTitle.trim().length < 1 || draft.jobTitle.trim().length > 80) {
    return "Enter the post";
  }
  const body: Json = {};
  if (draft.fullName.trim() !== before.fullName) {
    body.full_name = draft.fullName.trim();
  }
  if (draft.jobTitle.trim() !== before.jobTitle) {
    body.job_title = draft.jobTitle.trim();
  }
  if (draft.status !== before.status) {
    body.status = draft.status;
  }
  return body;
}

export function passwordBody(value: string): Json | string {
  if (!passwordRulesMet(value) || value.length > 200) {
    return "Set a temporary password";
  }
  return { temporary_password: value };
}

export type SmsRow = {
  id: string;
  notice: "late_notice" | "return_notice";
  phone: string;
  body: string;
  status: "sent" | "failed";
  at: string;
  residentName: string | null;
};

export function readSms(value: unknown): SmsRow | null {
  const body = record(value);
  if (!body) {
    return null;
  }
  const id = str(body.id);
  const notice = oneOf(body.notice_type, ["late_notice", "return_notice"] as const);
  const phone = str(body.recipient_phone);
  const text = str(body.body);
  const status = oneOf(body.status, ["sent", "failed"] as const);
  const at = str(body.created_at);
  const residentName = body.resident_name === undefined ? null : str(body.resident_name);
  if (!id || !notice || !phone || text === null || !status || !at || residentName === null && body.resident_name !== undefined) {
    return null;
  }
  return { id, notice, phone, body: text, status, at, residentName };
}

export type AuditRow = {
  id: string;
  at: string;
  actor: string | null;
  action: string;
  summary: string;
};

export function readAudit(value: unknown): AuditRow | null {
  const body = record(value);
  if (!body) {
    return null;
  }
  const id = str(body.id);
  const at = str(body.occurred_at);
  const actor = body.actor_name === null || body.actor_name === undefined ? null : str(body.actor_name);
  const action = str(body.action);
  const summary = str(body.summary);
  if (
    !id ||
    !at ||
    (body.actor_name != null && actor === null) ||
    !action ||
    summary === null ||
    "password" in body ||
    "temporary_password" in body ||
    "refresh_token" in body ||
    "qr_payload" in body
  ) {
    return null;
  }
  return { id, at, actor, action, summary };
}

export function registerCsv(value: string): string | null {
  const header = value.split(/\r?\n/, 1)[0];
  return header === REGISTER_CSV_HEADER ? value : null;
}

export function noticeLabel(notice: SmsRow["notice"]): string {
  return notice === "late_notice" ? "Late notice" : "Return notice";
}
