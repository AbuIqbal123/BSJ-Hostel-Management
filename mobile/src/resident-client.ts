/**
 * Resident domain types and JSON readers for the phone session.
 */

import { readGuestDecisions, type GuestDecision } from "@/guest-decisions";
import { pageQuery } from "@/list-page";
import { isRecord } from "@/json";

export type HallRole = "resident" | "gate" | "warden" | "provost";

export type HallUser = {
  id: string;
  role: HallRole;
  full_name: string;
  username: string;
  status: "active" | "suspended";
};

export type StoredSession = {
  accessToken: string;
  refreshToken: string;
  user: HallUser;
};

export type OnboardBody = {
  full_name: string;
  enrolment_number: string;
  password: string;
  phone: string;
  block_id: string;
  room_id: string;
  guardian_name: string;
  guardian_phone: string;
  course?: string;
};

export type UpcomingOuting = {
  id: string;
  place: string;
  startsAt: string | null;
  expectedReturnAt: string;
  canModify: boolean;
};

export type CurrentOuting = {
  id: string;
  outingType: "ordinary" | "late_night" | "home_going";
  status: "planned" | "outside";
  permissionId: string | null;
  expectedReturnAt: string;
};

export type ResidentHome = {
  fullName: string;
  enrolment: string | null;
  course: string | null;
  hallName: string | null;
  blockName: string | null;
  roomLabel: string | null;
  out: boolean;
  permissionsRequested: number;
  permissionsRejected: number;
  ordinaryReturns: number;
  lateNightReturns: number;
  homeGoingReturns: number;
  guestStays: number;
  windowOpen: boolean;
  upcoming: UpcomingOuting[];
  notificationsUnread: number;
  currentOuting: CurrentOuting | null;
  /** Approved permissions for return reminders. Null when that read failed. */
  approvedPermissions: HallPermission[] | null;
};

export type ResidentHomeResult =
  | { error: string; home?: undefined }
  | { error: null; home: ResidentHome };

export type HallPass = {
  fullName: string;
  roomLabel: string;
  place: string | null;
  outingType: "ordinary" | "late_night" | "home_going" | null;
  expectedReturnAt: string | null;
  qrVisible: boolean;
  qrPayload: string | null;
  qrVisibleFrom: string | null;
  qrVisibleUntil: string | null;
};

export type HallPassResult =
  | { error: string; pass?: undefined }
  | { error: null; pass: HallPass };

export type HistoryKind = "late_night" | "home_going" | "guest_stay" | "outing";

export type HistoryNoticeKind =
  | "guest_stay_decided"
  | "guest_stay_roommate_decided"
  | "guest_stay_roommate_recorded";

export type HistoryItem = {
  id: string;
  kind: HistoryKind;
  place: string | null;
  who: string | null;
  startedAt: string;
  endedAt: string;
  exitRecordedBy: string | null;
  returnRecordedBy: string | null;
  unused: boolean;
  noticeKind: HistoryNoticeKind | null;
  hostName: string | null;
  actorName: string | null;
  decision: "approved" | "rejected" | null;
  guestStayId: string | null;
};

export type HistoryResult =
  | { error: string; items?: undefined }
  | { error: null; items: HistoryItem[]; next: string | null };

export type GuestStayCard = {
  id: string;
  guestName: string;
  hostName: string;
  hostRoomLabel: string;
  startDate: string;
  endDate: string;
  status: "pending" | "approved" | "rejected" | "cancelled" | "departed";
  paymentStatus: "unpaid" | "paid";
  bucket: string;
};

export type GuestStay = GuestStayCard & {
  relation: string;
  reason: string;
  arrivedAt: string | null;
  decisionNote: string | null;
  decisions: GuestDecision[];
  roommateApprovalRequired: boolean;
  waitingOnRoommate: boolean;
  waitingOnProvost: boolean;
};

export type GuestStayCreate = {
  guest_name: string;
  relation: string;
  guest_start_date: string;
  guest_end_date: string;
  reason: string;
};

export type GuestWhen = "upcoming" | "past";

export type GuestListResult =
  | { error: string; items?: undefined; total?: undefined }
  | { error: null; items: GuestStayCard[]; total: number };

export type GuestResult =
  | { error: string; stay?: undefined }
  | { error: null; stay: GuestStay };

export type DestinationItem = {
  id: string;
  name: string;
  /** The free-text choice (`source: custom`), whatever its display name. */
  other: boolean;
};

export type DestinationResult =
  | { error: string; items?: undefined }
  | { error: null; items: DestinationItem[] };

export type PlanOutingBody = {
  destination_id: string;
  starts_at: string;
  expected_return_at: string;
  destination_text?: string;
};

export type PermissionKind = "late_night" | "home_going";

export type PermissionStatus =
  | "pending"
  | "approved"
  | "rejected"
  | "cancelled"
  | "in_use"
  | "completed"
  | "expired";

export type HallPermission = {
  id: string;
  permissionType: PermissionKind;
  status: PermissionStatus;
  shortPlace: string;
  destinationDetail: string | null;
  address: string | null;
  reason: string;
  departureAt: string;
  expectedReturnAt: string;
  decisionNote: string | null;
  decidedBy: string | null;
  createdAt: string;
};

export type PermissionListResult =
  | { error: string; items?: undefined; total?: undefined }
  | { error: null; items: HallPermission[]; total: number };

export type PermissionResult =
  | { error: string; permission?: undefined }
  | { error: null; permission: HallPermission };

export type PermissionCreate =
  | {
      permission_type: "late_night";
      short_place: string;
      reason: string;
      departure_at: string;
      expected_return_at: string;
      destination_detail?: string;
    }
  | {
      permission_type: "home_going";
      short_place: string;
      address: string;
      reason: string;
      departure_at: string;
      expected_return_at: string;
    };

export function outingPayload(body: PlanOutingBody): Record<string, string> {
  const payload: Record<string, string> = {
    destination_id: body.destination_id,
    starts_at: body.starts_at,
    expected_return_at: body.expected_return_at,
  };
  if (body.destination_text !== undefined) {
    payload.destination_text = body.destination_text;
  }
  return payload;
}

export function permissionPayload(body: PermissionCreate): Record<string, string> {
  const payload: Record<string, string> = {
    permission_type: body.permission_type,
    short_place: body.short_place,
    reason: body.reason,
    departure_at: body.departure_at,
    expected_return_at: body.expected_return_at,
  };
  if (body.permission_type === "late_night") {
    if (body.destination_detail !== undefined) {
      payload.destination_detail = body.destination_detail;
    }
    return payload;
  }
  payload.address = body.address;
  return payload;
}

export type StaffReply =
  | { ok: true; data: unknown }
  | { ok: false; message: string; details: Record<string, unknown> | null; code: string | null };

export type StaffFile = { uri: string; name: string; type: string };

export type StaffPreview =
  | { ok: true; uri: string; contentType: string }
  | { ok: false; message: string; code: string | null };


function readUpcoming(value: Record<string, unknown>): UpcomingOuting[] {
  if (!("upcoming_outings" in value) || !Array.isArray(value.upcoming_outings)) {
    return [];
  }
  const items: UpcomingOuting[] = [];
  for (const item of value.upcoming_outings) {
    if (
      !isRecord(item) ||
      typeof item.id !== "string" ||
      item.id.length === 0 ||
      typeof item.place !== "string" ||
      typeof item.expected_return_at !== "string" ||
      typeof item.can_modify !== "boolean"
    ) {
      continue;
    }
    if (item.starts_at !== null && typeof item.starts_at !== "string") {
      continue;
    }
    items.push({
      id: item.id,
      place: item.place,
      startsAt: item.starts_at,
      expectedReturnAt: item.expected_return_at,
      canModify: item.can_modify,
    });
  }
  return items;
}

function readCurrentOuting(value: unknown): CurrentOuting | null {
  if (
    !isRecord(value) ||
    typeof value.id !== "string" ||
    value.id.length === 0 ||
    typeof value.expected_return_at !== "string"
  ) {
    return null;
  }
  if (value.status !== "planned" && value.status !== "outside") {
    return null;
  }
  if (value.outing_type !== "ordinary" && value.outing_type !== "late_night" && value.outing_type !== "home_going") {
    return null;
  }
  if (value.permission_id !== null && value.permission_id !== undefined && typeof value.permission_id !== "string") {
    return null;
  }
  return {
    id: value.id,
    outingType: value.outing_type,
    status: value.status,
    permissionId: typeof value.permission_id === "string" ? value.permission_id : null,
    expectedReturnAt: value.expected_return_at,
  };
}

export function readResidentHome(value: unknown): ResidentHome | null {
  if (
    !isRecord(value) ||
    !isRecord(value.resident) ||
    typeof value.ordinary_outing_active !== "boolean"
  ) {
    return null;
  }
  const resident = value.resident;
  if (resident.presence !== "inside" && resident.presence !== "outside") {
    return null;
  }
  if (typeof resident.full_name !== "string" || resident.full_name.length === 0) {
    return null;
  }
  const roomLabel = typeof resident.room_label === "string" ? resident.room_label : null;
  const count = (value: unknown) =>
    typeof value === "number" && Number.isInteger(value) && value >= 0 ? value : 0;
  return {
    fullName: resident.full_name,
    enrolment: textOrNull(resident.enrolment_number),
    course: textOrNull(resident.course),
    hallName: textOrNull(resident.hall_name),
    blockName: textOrNull(resident.block_name),
    roomLabel,
    out: resident.presence === "outside",
    permissionsRequested: count(resident.permissions_requested),
    permissionsRejected: count(resident.permissions_rejected),
    ordinaryReturns: count(resident.ordinary_returns),
    lateNightReturns: count(resident.late_night_returns),
    homeGoingReturns: count(resident.home_going_returns),
    guestStays: count(resident.guest_stays),
    windowOpen: value.ordinary_outing_active,
    upcoming: readUpcoming(value),
    notificationsUnread: count(value.notifications_unread_count),
    currentOuting: readCurrentOuting(value.current_outing),
    approvedPermissions: null,
  };
}

export function readHallPass(value: unknown): HallPass | null {
  if (!isRecord(value) || typeof value.qr_visible !== "boolean") {
    return null;
  }
  if (typeof value.full_name !== "string" || value.full_name.length === 0) {
    return null;
  }
  if (typeof value.room_label !== "string") {
    return null;
  }
  if (value.qr_payload !== null && typeof value.qr_payload !== "string") {
    return null;
  }
  if (value.qr_visible_from !== null && typeof value.qr_visible_from !== "string") {
    return null;
  }
  if (value.qr_visible_until !== null && typeof value.qr_visible_until !== "string") {
    return null;
  }
  const payload = typeof value.qr_payload === "string" && value.qr_payload.length > 0 ? value.qr_payload : null;
  if (value.qr_visible && payload === null) {
    return null;
  }
  return {
    fullName: value.full_name,
    roomLabel: value.room_label,
    place: textOrNull(value.place),
    outingType:
      value.outing_type === "ordinary" || value.outing_type === "late_night" || value.outing_type === "home_going"
        ? value.outing_type
        : null,
    expectedReturnAt: textOrNull(value.expected_return_at),
    qrVisible: value.qr_visible,
    qrPayload: value.qr_visible ? payload : null,
    qrVisibleFrom: typeof value.qr_visible_from === "string" ? value.qr_visible_from : null,
    qrVisibleUntil: typeof value.qr_visible_until === "string" ? value.qr_visible_until : null,
  };
}

function textOrNull(field: unknown): string | null {
  return typeof field === "string" && field.length > 0 ? field : null;
}

const HISTORY_KINDS = ["late_night", "home_going", "guest_stay", "outing"] as const;

const HISTORY_NOTICES = [
  "guest_stay_decided",
  "guest_stay_roommate_decided",
  "guest_stay_roommate_recorded",
] as const;

function historyNotice(value: unknown): HistoryNoticeKind | null {
  return HISTORY_NOTICES.find((kind) => kind === value) ?? null;
}

function historyKind(value: unknown): HistoryKind | null {
  return HISTORY_KINDS.find((kind) => kind === value) ?? null;
}

export function readHistory(value: unknown): HistoryItem[] | null {
  if (!isRecord(value) || !Array.isArray(value.items)) {
    return null;
  }
  const items: HistoryItem[] = [];
  for (const item of value.items) {
    if (!isRecord(item)) {
      return null;
    }
    const kind = historyKind(item.kind);
    if (
      kind === null ||
      typeof item.id !== "string" ||
      typeof item.started_at !== "string" ||
      typeof item.ended_at !== "string" ||
      typeof item.unused !== "boolean"
    ) {
      return null;
    }
    if (item.place !== null && typeof item.place !== "string") {
      return null;
    }
    if (item.who !== null && typeof item.who !== "string") {
      return null;
    }
    if (item.exit_recorded_by !== null && typeof item.exit_recorded_by !== "string") {
      return null;
    }
    if (item.return_recorded_by !== null && typeof item.return_recorded_by !== "string") {
      return null;
    }
    items.push({
      id: item.id,
      kind,
      place: typeof item.place === "string" && item.place.length > 0 ? item.place : null,
      who: typeof item.who === "string" && item.who.length > 0 ? item.who : null,
      startedAt: item.started_at,
      endedAt: item.ended_at,
      exitRecordedBy: typeof item.exit_recorded_by === "string" ? item.exit_recorded_by : null,
      returnRecordedBy: typeof item.return_recorded_by === "string" ? item.return_recorded_by : null,
      unused: item.unused,
      noticeKind: historyNotice(item.notice_kind),
      hostName: textOrNull(item.host_name),
      actorName: textOrNull(item.actor_name),
      decision: item.decision === "approved" || item.decision === "rejected" ? item.decision : null,
      guestStayId: textOrNull(item.guest_stay_id),
    });
  }
  return items;
}

const GUEST_STATUS = ["pending", "approved", "rejected", "cancelled", "departed"] as const;

function guestStatus(value: unknown): GuestStayCard["status"] | null {
  return GUEST_STATUS.find((status) => status === value) ?? null;
}

function readGuestCard(item: Record<string, unknown>): GuestStayCard | null {
  const status = guestStatus(item.status);
  if (!status || (item.payment_status !== "unpaid" && item.payment_status !== "paid")) {
    return null;
  }
  if (
    typeof item.id !== "string" ||
    typeof item.guest_name !== "string" ||
    typeof item.host_name !== "string" ||
    typeof item.host_room_label !== "string" ||
    typeof item.guest_start_date !== "string" ||
    typeof item.guest_end_date !== "string" ||
    typeof item.bucket !== "string"
  ) {
    return null;
  }
  return {
    id: item.id,
    guestName: item.guest_name,
    hostName: item.host_name,
    hostRoomLabel: item.host_room_label,
    startDate: item.guest_start_date,
    endDate: item.guest_end_date,
    status,
    paymentStatus: item.payment_status,
    bucket: item.bucket,
  };
}

function readFlag(value: unknown): boolean | null {
  return typeof value === "boolean" ? value : null;
}

export function guestListQuery(when: GuestWhen, offset: number): string {
  return `when=${when}&${pageQuery(offset)}`;
}

export function readTotal(value: unknown): number | null {
  if (!isRecord(value) || typeof value.total !== "number" || !Number.isInteger(value.total) || value.total < 0) {
    return null;
  }
  return value.total;
}

export function readGuestPage(value: unknown): GuestStayCard[] | null {
  if (!isRecord(value) || !Array.isArray(value.items)) {
    return null;
  }
  const items: GuestStayCard[] = [];
  for (const item of value.items) {
    if (!isRecord(item)) {
      return null;
    }
    const card = readGuestCard(item);
    if (!card) {
      return null;
    }
    items.push(card);
  }
  return items;
}

export function readGuestStay(value: unknown): GuestStay | null {
  if (!isRecord(value)) {
    return null;
  }
  const card = readGuestCard(value);
  const decisions = readGuestDecisions(value.decisions);
  const roommateApprovalRequired = readFlag(value.roommate_approval_required);
  const waitingOnRoommate = readFlag(value.waiting_on_roommate);
  const waitingOnProvost = readFlag(value.waiting_on_provost);
  if (
    !card ||
    !decisions ||
    roommateApprovalRequired === null ||
    waitingOnRoommate === null ||
    waitingOnProvost === null ||
    typeof value.relation !== "string" ||
    typeof value.reason !== "string"
  ) {
    return null;
  }
  return {
    ...card,
    relation: value.relation,
    reason: value.reason,
    arrivedAt: textOrNull(value.arrived_at),
    decisionNote: textOrNull(value.decision_note),
    decisions,
    roommateApprovalRequired,
    waitingOnRoommate,
    waitingOnProvost,
  };
}

export function readDestinations(value: unknown): DestinationItem[] | null {
  if (!isRecord(value) || !Array.isArray(value.items)) {
    return null;
  }
  const items: DestinationItem[] = [];
  for (const item of value.items) {
    if (
      !isRecord(item) ||
      typeof item.id !== "string" ||
      item.id.length === 0 ||
      typeof item.name !== "string"
    ) {
      return null;
    }
    items.push({ id: item.id, name: item.name, other: item.source === "custom" });
  }
  return items;
}

const PERMISSION_KINDS: readonly PermissionKind[] = ["late_night", "home_going"];
const PERMISSION_STATUSES: readonly PermissionStatus[] = [
  "pending",
  "approved",
  "rejected",
  "cancelled",
  "in_use",
  "completed",
  "expired",
];

function permissionKind(value: unknown): PermissionKind | null {
  if (typeof value === "string" && (PERMISSION_KINDS as readonly string[]).includes(value)) {
    return value as PermissionKind;
  }
  return null;
}

function permissionStatus(value: unknown): PermissionStatus | null {
  if (typeof value === "string" && (PERMISSION_STATUSES as readonly string[]).includes(value)) {
    return value as PermissionStatus;
  }
  return null;
}

function optionalString(value: unknown): string | null | undefined {
  if (value === null || value === undefined) {
    return null;
  }
  if (typeof value === "string") {
    return value;
  }
  return undefined;
}

export function readPermission(value: unknown): HallPermission | null {
  if (!isRecord(value)) {
    return null;
  }
  const kind = permissionKind(value.permission_type);
  const status = permissionStatus(value.status);
  const destinationDetail = optionalString(value.destination_detail);
  const address = optionalString(value.address);
  const decisionNote = optionalString(value.decision_note);
  const decidedBy = optionalString(value.decided_by);
  const { id, short_place, reason, departure_at, expected_return_at, created_at } = value;
  if (
    typeof id !== "string" ||
    id.length === 0 ||
    kind === null ||
    status === null ||
    typeof short_place !== "string" ||
    typeof reason !== "string" ||
    typeof departure_at !== "string" ||
    typeof expected_return_at !== "string" ||
    typeof created_at !== "string" ||
    destinationDetail === undefined ||
    address === undefined ||
    decisionNote === undefined ||
    decidedBy === undefined
  ) {
    return null;
  }
  return {
    id,
    permissionType: kind,
    status,
    shortPlace: short_place,
    destinationDetail,
    address,
    reason,
    departureAt: departure_at,
    expectedReturnAt: expected_return_at,
    decisionNote,
    decidedBy,
    createdAt: created_at,
  };
}

export function readPermissionPage(value: unknown): HallPermission[] | null {
  if (!isRecord(value) || !Array.isArray(value.items)) {
    return null;
  }
  const items: HallPermission[] = [];
  for (const item of value.items) {
    const row = readPermission(item);
    if (!row) {
      return null;
    }
    items.push(row);
  }
  return items;
}
