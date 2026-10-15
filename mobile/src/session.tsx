import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import Constants from "expo-constants";
import * as SecureStore from "expo-secure-store";
import * as Notifications from "expo-notifications";
import { AppState, Platform } from "react-native";

import { allowReturnReminders, clearNotificationSurface, PUSH_TOKEN_KEY, pushToken } from "@/push";
import { refreshEffect, registerPushToken, singleFlight } from "@/session-refresh";
import { trimStop } from "@/staff";

const SESSION_KEY = "bsj.session";

export type HallRole = "resident" | "gate" | "warden" | "provost";

export type HallUser = {
  id: string;
  role: HallRole;
  full_name: string;
  username: string;
  status: "active" | "suspended";
};

type StoredSession = {
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
  currentOuting: { id: string; expectedReturnAt: string } | null;
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
};

export type HistoryResult =
  | { error: string; items?: undefined }
  | { error: null; items: HistoryItem[]; next: string | null };

export type GuestStayCard = {
  id: string;
  guestName: string;
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
};

export type GuestStayCreate = {
  guest_name: string;
  relation: string;
  guest_start_date: string;
  guest_end_date: string;
  reason: string;
};

export type GuestListResult =
  | { error: string; items?: undefined }
  | { error: null; items: GuestStayCard[] };

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
  | { error: string; items?: undefined }
  | { error: null; items: HallPermission[] };

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

function outingPayload(body: PlanOutingBody): Record<string, string> {
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

function permissionPayload(body: PermissionCreate): Record<string, string> {
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
  | { ok: false; message: string; details: Record<string, unknown> | null };

type SessionValue = {
  ready: boolean;
  user: HallUser | null;
  signIn: (username: string, password: string) => Promise<string | null>;
  signOut: () => Promise<void>;
  deleteAccount: (password: string) => Promise<string | null>;
  onboard: (body: OnboardBody) => Promise<string | null>;
  checkEnrolment: (enrolmentNumber: string) => Promise<string | null>;
  changePassword: (currentPassword: string, newPassword: string) => Promise<string | null>;
  loadResidentHome: () => Promise<ResidentHomeResult>;
  loadDestinations: () => Promise<DestinationResult>;
  planOuting: (body: PlanOutingBody) => Promise<string | null>;
  updateOuting: (outingId: string, body: PlanOutingBody) => Promise<string | null>;
  cancelOuting: (outingId: string) => Promise<HallFailure | null>;
  loadPermissions: () => Promise<PermissionListResult>;
  loadPermission: (permissionId: string) => Promise<PermissionResult>;
  submitPermission: (body: PermissionCreate) => Promise<string | null>;
  updatePermission: (permissionId: string, body: PermissionCreate) => Promise<string | null>;
  cancelPermission: (permissionId: string) => Promise<HallFailure | null>;
  loadHallPass: () => Promise<HallPassResult>;
  loadHistory: (filters?: {
    kind?: HistoryKind | "all";
    from?: string | null;
    to?: string | null;
    cursor?: string | null;
  }) => Promise<HistoryResult>;
  loadGuestStays: () => Promise<GuestListResult>;
  loadGuestStay: (guestStayId: string) => Promise<GuestResult>;
  submitGuestStay: (body: GuestStayCreate) => Promise<string | null>;
  updateGuestStay: (guestStayId: string, body: GuestStayCreate) => Promise<string | null>;
  cancelGuestStay: (guestStayId: string) => Promise<HallFailure | null>;
  /** Reads and writes under /api/v1 for any signed-in role. A body makes it a POST. */
  staffRequest: (path: string, body?: unknown) => Promise<StaffReply>;
};

const SessionContext = createContext<SessionValue | null>(null);

const LOCAL_HALL = "http://127.0.0.1:8000";
const RENDER_HALL = "https://bsj-hostel-api.onrender.com";

function explicitHall(): string | null {
  const configured = process.env.EXPO_PUBLIC_API_URL;
  if (configured) {
    return configured.replace(/\/$/, "");
  }
  // Release builds talk to the hall on Render. Expo Go still finds the laptop.
  if (!__DEV__) {
    return RENDER_HALL;
  }
  return null;
}

// Localhost is the phone itself, or the Android emulator. Only then use the
// computer Expo Go already reached, or the emulator's host alias.
function devMachineHall(): string | null {
  const host = Constants.expoConfig?.hostUri?.split(":")[0];
  if (host && host !== "localhost" && host !== "127.0.0.1") {
    return `http://${host}:8000`;
  }
  if (Platform.OS === "android") {
    return "http://10.0.2.2:8000";
  }
  return null;
}

let resolvedHall: string | null = null;

export async function hallFetch(path: string, init: RequestInit): Promise<Response> {
  const explicit = explicitHall();
  if (explicit) {
    return fetch(`${explicit}${path}`, init);
  }
  if (resolvedHall) {
    return fetch(`${resolvedHall}${path}`, init);
  }
  try {
    const response = await fetch(`${LOCAL_HALL}${path}`, init);
    resolvedHall = LOCAL_HALL;
    return response;
  } catch {
    const fallback = devMachineHall();
    if (!fallback) {
      throw new Error("The hall could not be reached.");
    }
    const response = await fetch(`${fallback}${path}`, init);
    resolvedHall = fallback;
    return response;
  }
}

type HallFailure = {
  code: string | null;
  message: string;
};

export async function errorMessage(response: Response): Promise<string> {
  return (await hallFailure(response)).message;
}

async function hallFailure(response: Response): Promise<HallFailure> {
  try {
    const body = (await response.json()) as { error?: { code?: unknown; message?: unknown } };
    const message =
      typeof body.error?.message === "string" && body.error.message.length > 0
        ? body.error.message
        : "The hall could not be reached";
    const code = typeof body.error?.code === "string" ? body.error.code : null;
    return { code, message: trimStop(message) };
  } catch {
    return { code: null, message: "The hall could not be reached" };
  }
}

const lockedOutingIds = new Set<string>();
let leftOutingId: string | null = null;

export function lockOuting(id: string) {
  lockedOutingIds.add(id);
}

export function noteOutingLeft(id: string) {
  leftOutingId = id;
}

export function takeOutingLeft(): string | null {
  const id = leftOutingId;
  leftOutingId = null;
  return id;
}

export function outingLocked(id: string): boolean {
  return lockedOutingIds.has(id);
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

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

function readCurrentOuting(value: unknown): ResidentHome["currentOuting"] {
  if (!isRecord(value) || typeof value.id !== "string" || typeof value.expected_return_at !== "string") {
    return null;
  }
  if (value.status !== "planned" && value.status !== "outside") {
    return null;
  }
  return { id: value.id, expectedReturnAt: value.expected_return_at };
}

function readResidentHome(value: unknown): ResidentHome | null {
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
  };
}

function readHallPass(value: unknown): HallPass | null {
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

function historyKind(value: unknown): HistoryKind | null {
  return HISTORY_KINDS.find((kind) => kind === value) ?? null;
}

function readHistory(value: unknown): HistoryItem[] | null {
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
    typeof item.guest_start_date !== "string" ||
    typeof item.guest_end_date !== "string" ||
    typeof item.bucket !== "string"
  ) {
    return null;
  }
  return {
    id: item.id,
    guestName: item.guest_name,
    startDate: item.guest_start_date,
    endDate: item.guest_end_date,
    status,
    paymentStatus: item.payment_status,
    bucket: item.bucket,
  };
}

function readGuestPage(value: unknown): GuestStayCard[] | null {
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

function readGuestStay(value: unknown): GuestStay | null {
  if (!isRecord(value)) {
    return null;
  }
  const card = readGuestCard(value);
  if (!card || typeof value.relation !== "string" || typeof value.reason !== "string") {
    return null;
  }
  return {
    ...card,
    relation: value.relation,
    reason: value.reason,
    arrivedAt: textOrNull(value.arrived_at),
    decisionNote: textOrNull(value.decision_note),
  };
}

function readDestinations(value: unknown): DestinationItem[] | null {
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

function readPermission(value: unknown): HallPermission | null {
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

function readPermissionPage(value: unknown): HallPermission[] | null {
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

async function readSession(): Promise<StoredSession | null> {
  const raw = await SecureStore.getItemAsync(SESSION_KEY);
  if (!raw) {
    return null;
  }
  try {
    const parsed = JSON.parse(raw) as StoredSession;
    if (!parsed.accessToken || !parsed.user?.full_name) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function SessionProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [session, setSession] = useState<StoredSession | null>(null);
  const sessionRef = useRef(session);

  useEffect(() => {
    let active = true;
    readSession()
      .then((stored) => {
        if (!active) {
          return;
        }
        sessionRef.current = stored;
        setSession(stored);
      })
      .finally(() => {
        if (active) {
          setReady(true);
        }
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    sessionRef.current = session;
  }, [session]);

  const pushTokenRef = useRef<string | null>(null);

  const signIn = useCallback(async (username: string, password: string) => {
    try {
      const response = await hallFetch("/api/v1/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: username.trim(), password }),
      });
      if (!response.ok) {
        return await errorMessage(response);
      }
      const body = (await response.json()) as {
        access_token: string;
        refresh_token: string;
        user: HallUser;
      };
      const next: StoredSession = {
        accessToken: body.access_token,
        refreshToken: body.refresh_token,
        user: body.user,
      };
      sessionRef.current = next;
      allowReturnReminders();
      await SecureStore.setItemAsync(SESSION_KEY, JSON.stringify(next));
      setSession(next);
      return null;
    } catch {
      return "The hall could not be reached";
    }
  }, []);

  const onboard = useCallback(async (body: OnboardBody) => {
    const payload: Record<string, string> = {
      full_name: body.full_name.trim(),
      enrolment_number: body.enrolment_number.trim(),
      password: body.password,
      phone: body.phone.trim(),
      block_id: body.block_id,
      room_id: body.room_id,
      guardian_name: body.guardian_name.trim(),
      guardian_phone: body.guardian_phone.trim(),
    };
    const course = body.course?.trim();
    if (course) {
      payload.course = course;
    }
    try {
      const response = await hallFetch("/api/v1/auth/onboard", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (response.status === 201) {
        return null;
      }
      return await errorMessage(response);
    } catch {
      return "The hall could not be reached";
    }
  }, []);

  const checkEnrolment = useCallback(async (enrolmentNumber: string) => {
    try {
      const response = await hallFetch("/api/v1/auth/onboard/enrolment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enrolment_number: enrolmentNumber.trim() }),
      });
      if (response.status === 204) {
        return null;
      }
      return await errorMessage(response);
    } catch {
      return "The hall could not be reached";
    }
  }, []);

  const endSession = useCallback(async () => {
    pushTokenRef.current = null;
    await clearNotificationSurface();
    try {
      await SecureStore.deleteItemAsync(PUSH_TOKEN_KEY);
    } catch {
      // The key may already be gone.
    }
    sessionRef.current = null;
    setSession(null);
    try {
      await SecureStore.deleteItemAsync(SESSION_KEY);
    } catch {
      // The key may already be gone.
    }
  }, []);

  const changePassword = useCallback(async (currentPassword: string, newPassword: string) => {
    if (!sessionRef.current) {
      return "Sign in again";
    }
    try {
      const response = await authorized("/api/v1/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          current_password: currentPassword,
          new_password: newPassword,
        }),
      });
      if (response.status === 204) {
        await endSession();
        return null;
      }
      return await errorMessage(response);
    } catch {
      return "The hall could not be reached";
    }
  }, [endSession]);

  const renewing = useRef<Promise<StoredSession | null> | null>(null);

  const renew = useCallback(async (): Promise<StoredSession | null> => {
    if (renewing.current) {
      return renewing.current;
    }
    return singleFlight(renewing, async (): Promise<StoredSession | null> => {
      const current = sessionRef.current;
      if (!current?.refreshToken) {
        return null;
      }
      const sent = current.refreshToken;
      let status: number | "network" = "network";
      let body: { access_token: string; refresh_token: string; user: HallUser } | null = null;
      try {
        const response = await hallFetch("/api/v1/auth/refresh", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ refresh_token: sent }),
        });
        status = response.status;
        if (response.status === 200) {
          body = (await response.json()) as {
            access_token: string;
            refresh_token: string;
            user: HallUser;
          };
        }
      } catch {
        status = "network";
      }
      const effect = refreshEffect(status, sent, sessionRef.current?.refreshToken ?? null);
      if (effect === "end") {
        await endSession();
        return null;
      }
      if (effect === "keep") {
        return sessionRef.current?.refreshToken === sent ? null : sessionRef.current;
      }
      if (!body) {
        return null;
      }
      if (sessionRef.current?.refreshToken !== sent) {
        return sessionRef.current;
      }
      const next: StoredSession = {
        accessToken: body.access_token,
        refreshToken: body.refresh_token,
        user: body.user,
      };
      sessionRef.current = next;
      await SecureStore.setItemAsync(SESSION_KEY, JSON.stringify(next));
      setSession(next);
      return next;
    });
  }, [endSession]);

  const authorized = useCallback(
    async (path: string, init: RequestInit = {}): Promise<Response> => {
      const send = (token: string) => {
        const headers = new Headers(init.headers);
        headers.set("Authorization", `Bearer ${token}`);
        return hallFetch(path, { ...init, headers });
      };
      const current = sessionRef.current;
      if (!current) {
        return new Response(null, { status: 401 });
      }
      const response = await send(current.accessToken);
      if (response.status !== 401) {
        return response;
      }
      const next = await renew();
      if (!next) {
        return response;
      }
      return send(next.accessToken);
    },
    [renew],
  );

  const signOut = useCallback(async () => {
    const current = sessionRef.current;
    const token = pushTokenRef.current;
    if (current) {
      const headers = {
        Authorization: `Bearer ${current.accessToken}`,
        "Content-Type": "application/json",
      };
      try {
        if (token) {
          await hallFetch("/api/v1/devices/push-token", {
            method: "DELETE",
            headers,
            body: JSON.stringify({ token }),
          });
        }
        await hallFetch("/api/v1/auth/logout", { method: "POST", headers });
      } catch {
        // The phone still signs out when the hall cannot be reached.
      }
    }
    await endSession();
  }, [endSession]);

  const signedInAs = session?.user.id ?? null;

  // Ask for push after sign-in, never before. Gate staff are not asked. Android without Firebase fails quietly.
  useEffect(() => {
    const role = session?.user.role;
    if (!signedInAs || !role || role === "gate" || Platform.OS === "web") {
      return;
    }
    let active = true;
    let saved: string | null = null;
    let refused = false;

    const post = async (token: string): Promise<number | "error"> => {
      try {
        const response = await authorized("/api/v1/devices/push-token", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token, platform: Platform.OS === "ios" ? "ios" : "android" }),
        });
        return response.status;
      } catch {
        return "error";
      }
    };

    const attempt = async (token: string) => {
      if (!active || refused) {
        return;
      }
      const outcome = await registerPushToken(token, post);
      if (!active) {
        return;
      }
      if (outcome === "refused") {
        refused = true;
        return;
      }
      if (outcome !== "saved") {
        return;
      }
      saved = token;
      pushTokenRef.current = token;
      try {
        await SecureStore.setItemAsync(PUSH_TOKEN_KEY, token);
      } catch {
        // The next foreground tries the save again.
      }
    };

    const onToken = (event: { data: string }) => {
      if (event.data && event.data !== saved) {
        void attempt(event.data);
      }
    };
    let removeListener = () => {};
    try {
      removeListener = Notifications.addPushTokenListener(onToken).remove;
    } catch {
      // No push service on this phone.
    }

    void pushToken()
      .then((token) => {
        if (active && token) {
          return attempt(token);
        }
      })
      .catch(() => undefined);

    const foreground = AppState.addEventListener("change", (state) => {
      if (state !== "active" || saved || refused) {
        return;
      }
      void pushToken()
        .then((token) => {
          if (active && token) {
            return attempt(token);
          }
        })
        .catch(() => undefined);
    });

    return () => {
      active = false;
      removeListener();
      foreground.remove();
    };
  }, [authorized, session?.user.role, signedInAs]);

  const loadResidentHome = useCallback(async (): Promise<ResidentHomeResult> => {
    if (!sessionRef.current) {
      return { error: "Sign in again" };
    }
    try {
      const expired = await authorized("/api/v1/me/expire-passed", { method: "POST" });
      if (!expired.ok) {
        return { error: await errorMessage(expired) };
      }
      const homeResponse = await authorized("/api/v1/me/home", { method: "GET" });
      if (!homeResponse.ok) {
        return { error: await errorMessage(homeResponse) };
      }
      const home = readResidentHome(await homeResponse.json());
      if (!home) {
        return { error: "The hall could not be reached" };
      }
      return { error: null, home };
    } catch {
      return { error: "The hall could not be reached" };
    }
  }, [authorized]);

  const loadHistory = useCallback(
    async (filters?: {
      kind?: HistoryKind | "all";
      from?: string | null;
      to?: string | null;
      cursor?: string | null;
    }): Promise<HistoryResult> => {
      if (!sessionRef.current) {
        return { error: "Sign in again" };
      }
      const query = new URLSearchParams();
      if (filters?.kind && filters.kind !== "all") {
        query.set("kind", filters.kind);
      }
      if (filters?.from && filters.from.length > 0) {
        query.set("from", filters.from);
      }
      if (filters?.to && filters.to.length > 0) {
        query.set("to", filters.to);
      }
      if (filters?.cursor) {
        query.set("cursor", filters.cursor);
      }
      const suffix = query.toString();
      const path = suffix.length > 0 ? `/api/v1/me/history?${suffix}` : "/api/v1/me/history";
      try {
        const response = await authorized(path, { method: "GET" });
        if (!response.ok) {
          return { error: await errorMessage(response) };
        }
        const body: unknown = await response.json();
        const items = readHistory(body);
        if (!items) {
          return { error: "The hall could not be reached" };
        }
        const next = isRecord(body) && typeof body.next_cursor === "string" ? body.next_cursor : null;
        return { error: null, items, next };
      } catch {
        return { error: "The hall could not be reached" };
      }
    },
    [],
  );

  const loadGuestStays = useCallback(async (): Promise<GuestListResult> => {
    if (!sessionRef.current) {
      return { error: "Sign in again" };
    }
    try {
      const response = await authorized("/api/v1/me/guest-stays?limit=50", { method: "GET" });
      if (!response.ok) {
        return { error: await errorMessage(response) };
      }
      const items = readGuestPage(await response.json());
      if (!items) {
        return { error: "The hall could not be reached" };
      }
      return { error: null, items };
    } catch {
      return { error: "The hall could not be reached" };
    }
  }, []);

  const loadGuestStay = useCallback(async (guestStayId: string): Promise<GuestResult> => {
    if (!sessionRef.current) {
      return { error: "Sign in again" };
    }
    try {
      const response = await authorized(`/api/v1/me/guest-stays/${encodeURIComponent(guestStayId)}`, { method: "GET" });
      if (!response.ok) {
        return { error: await errorMessage(response) };
      }
      const stay = readGuestStay(await response.json());
      if (!stay) {
        return { error: "The hall could not be reached" };
      }
      return { error: null, stay };
    } catch {
      return { error: "The hall could not be reached" };
    }
  }, []);

  const submitGuestStay = useCallback(async (body: GuestStayCreate) => {
    if (!sessionRef.current) {
      return "Sign in again";
    }
    try {
      const response = await authorized("/api/v1/me/guest-stays", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (response.status === 201) {
        return null;
      }
      return await errorMessage(response);
    } catch {
      return "The hall could not be reached";
    }
  }, []);

  const updateGuestStay = useCallback(async (guestStayId: string, body: GuestStayCreate) => {
    if (!sessionRef.current) {
      return "Sign in again";
    }
    try {
      const response = await authorized(`/api/v1/me/guest-stays/${encodeURIComponent(guestStayId)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (response.status === 200) {
        return null;
      }
      return await errorMessage(response);
    } catch {
      return "The hall could not be reached";
    }
  }, []);

  const cancelGuestStay = useCallback(async (guestStayId: string) => {
    if (!sessionRef.current) {
      return { code: null, message: "Sign in again" };
    }
    try {
      const response = await authorized(`/api/v1/me/guest-stays/${encodeURIComponent(guestStayId)}/cancel`, { method: "POST" });
      if (response.status === 200) {
        return null;
      }
      return await hallFailure(response);
    } catch {
      return { code: null, message: "The hall could not be reached" };
    }
  }, []);

  const loadHallPass = useCallback(async (): Promise<HallPassResult> => {
    if (!sessionRef.current) {
      return { error: "Sign in again" };
    }
    try {
      const response = await authorized("/api/v1/me/hall-pass", { method: "GET" });
      if (!response.ok) {
        return { error: await errorMessage(response) };
      }
      const pass = readHallPass(await response.json());
      if (!pass) {
        return { error: "The hall could not be reached" };
      }
      return { error: null, pass };
    } catch {
      return { error: "The hall could not be reached" };
    }
  }, []);

  const loadDestinations = useCallback(async (): Promise<DestinationResult> => {
    if (!sessionRef.current) {
      return { error: "Sign in again" };
    }
    try {
      const response = await authorized("/api/v1/destinations", { method: "GET" });
      if (!response.ok) {
        return { error: await errorMessage(response) };
      }
      const items = readDestinations(await response.json());
      if (!items) {
        return { error: "The hall could not be reached" };
      }
      return { error: null, items };
    } catch {
      return { error: "The hall could not be reached" };
    }
  }, []);

  const planOuting = useCallback(async (body: PlanOutingBody) => {
    if (!sessionRef.current) {
      return "Sign in again";
    }
    try {
      const response = await authorized("/api/v1/me/outings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(outingPayload(body)),
      });
      if (response.status === 201) {
        return null;
      }
      return await errorMessage(response);
    } catch {
      return "The hall could not be reached";
    }
  }, []);

  const updateOuting = useCallback(async (outingId: string, body: PlanOutingBody) => {
    if (!sessionRef.current) {
      return "Sign in again";
    }
    try {
      const response = await authorized(`/api/v1/me/outings/${outingId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(outingPayload(body)),
      });
      if (response.status === 200) {
        return null;
      }
      return await errorMessage(response);
    } catch {
      return "The hall could not be reached";
    }
  }, []);

  const cancelOuting = useCallback(async (outingId: string) => {
    if (!sessionRef.current) {
      return { code: null, message: "Sign in again" };
    }
    try {
      const response = await authorized(`/api/v1/me/outings/${outingId}/cancel`, { method: "POST" });
      if (response.status === 200) {
        return null;
      }
      return await hallFailure(response);
    } catch {
      return { code: null, message: "The hall could not be reached" };
    }
  }, []);

  const loadPermissions = useCallback(async (): Promise<PermissionListResult> => {
    if (!sessionRef.current) {
      return { error: "Sign in again" };
    }
    try {
      await authorized("/api/v1/me/expire-passed", { method: "POST" });
      const response = await authorized("/api/v1/me/permissions?limit=500", { method: "GET" });
      if (!response.ok) {
        return { error: await errorMessage(response) };
      }
      const items = readPermissionPage(await response.json());
      if (!items) {
        return { error: "The hall could not be reached" };
      }
      return { error: null, items };
    } catch {
      return { error: "The hall could not be reached" };
    }
  }, []);

  const loadPermission = useCallback(async (permissionId: string): Promise<PermissionResult> => {
    if (!sessionRef.current) {
      return { error: "Sign in again" };
    }
    try {
      await authorized("/api/v1/me/expire-passed", { method: "POST" });
      const response = await authorized(`/api/v1/me/permissions/${encodeURIComponent(permissionId)}`, { method: "GET" });
      if (!response.ok) {
        return { error: await errorMessage(response) };
      }
      const permission = readPermission(await response.json());
      if (!permission) {
        return { error: "The hall could not be reached" };
      }
      return { error: null, permission };
    } catch {
      return { error: "The hall could not be reached" };
    }
  }, []);

  const submitPermission = useCallback(async (body: PermissionCreate) => {
    if (!sessionRef.current) {
      return "Sign in again";
    }
    try {
      const response = await authorized("/api/v1/me/permissions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(permissionPayload(body)),
      });
      if (response.status === 201) {
        return null;
      }
      return await errorMessage(response);
    } catch {
      return "The hall could not be reached";
    }
  }, []);

  const updatePermission = useCallback(async (permissionId: string, body: PermissionCreate) => {
    if (!sessionRef.current) {
      return "Sign in again";
    }
    try {
      const response = await authorized(
        `/api/v1/me/permissions/${encodeURIComponent(permissionId)}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(permissionPayload(body)),
        },
      );
      if (response.status === 200) {
        return null;
      }
      return await errorMessage(response);
    } catch {
      return "The hall could not be reached";
    }
  }, []);

  const cancelPermission = useCallback(async (permissionId: string) => {
    if (!sessionRef.current) {
      return { code: null, message: "Sign in again" };
    }
    try {
      const response = await authorized(`/api/v1/me/permissions/${encodeURIComponent(permissionId)}/cancel`, { method: "POST" });
      if (response.status === 200) {
        return null;
      }
      return await hallFailure(response);
    } catch {
      return { code: null, message: "The hall could not be reached" };
    }
  }, []);

  const deleteAccount = useCallback(
    async (password: string) => {
      if (!sessionRef.current) {
        return "Sign in again";
      }
      try {
        const response = await authorized("/api/v1/me/account/delete", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ password }),
        });
        if (response.status === 204) {
          await endSession();
          return null;
        }
        return await errorMessage(response);
      } catch {
        return "The hall could not be reached";
      }
    },
    [authorized, endSession],
  );

  const staffRequest = useCallback(async (path: string, body?: unknown): Promise<StaffReply> => {
    const unreachable = { ok: false as const, message: "The hall could not be reached", details: null };
    if (!sessionRef.current) {
      return { ...unreachable, message: "Sign in again" };
    }
    try {
      const response = await authorized(
        `/api/v1${path}`,
        body === undefined
          ? { method: "GET" }
          : { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) },
      );
      const json: unknown = await response.json().catch(() => null);
      if (response.ok) {
        return { ok: true, data: json };
      }
      const error = (json as { error?: { message?: unknown; details?: unknown } } | null)?.error;
      return {
        ok: false,
        message: trimStop(
          typeof error?.message === "string" && error.message ? error.message : unreachable.message,
        ),
        details:
          error?.details && typeof error.details === "object"
            ? (error.details as Record<string, unknown>)
            : null,
      };
    } catch {
      return unreachable;
    }
  }, []);

  const value = useMemo<SessionValue>(
    () => ({
      ready,
      user: session?.user ?? null,
      signIn,
      signOut,
      deleteAccount,
      onboard,
      checkEnrolment,
      changePassword,
      loadResidentHome,
      loadDestinations,
      planOuting,
      updateOuting,
      cancelOuting,
      loadPermissions,
      loadPermission,
      submitPermission,
      updatePermission,
      cancelPermission,
      loadHallPass,
      loadHistory,
      loadGuestStays,
      loadGuestStay,
      submitGuestStay,
      updateGuestStay,
      cancelGuestStay,
      staffRequest,
    }),
    [
      ready,
      session,
      signIn,
      signOut,
      deleteAccount,
      onboard,
      checkEnrolment,
      changePassword,
      loadResidentHome,
      loadDestinations,
      planOuting,
      updateOuting,
      cancelOuting,
      loadPermissions,
      loadPermission,
      submitPermission,
      updatePermission,
      cancelPermission,
      loadHallPass,
      loadHistory,
      loadGuestStays,
      loadGuestStay,
      submitGuestStay,
      updateGuestStay,
      cancelGuestStay,
      staffRequest,
    ],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionValue {
  const value = useContext(SessionContext);
  if (!value) {
    throw new Error("Session is missing.");
  }
  return value;
}

export function roleLabel(role: HallRole): string {
  switch (role) {
    case "resident":
      return "Resident";
    case "gate":
      return "Gate";
    case "warden":
      return "Warden";
    case "provost":
      return "Provost";
  }
}
