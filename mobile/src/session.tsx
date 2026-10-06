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
import { Platform } from "react-native";

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
  roomLabel: string | null;
  out: boolean;
  windowOpen: boolean;
  upcoming: UpcomingOuting[];
  notificationsUnread: boolean;
};

export type ResidentHomeResult =
  | { error: string; home?: undefined }
  | { error: null; home: ResidentHome };

export type HallPass = {
  fullName: string;
  roomLabel: string;
  place: string | null;
  startsAt: string | null;
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
  | { error: null; items: HistoryItem[] };

export type HallNotification = {
  id: string;
  permissionId: string;
  permissionType: "late_night" | "home_going";
  decision: "approved" | "rejected";
  place: string;
  departureAt: string;
  expectedReturnAt: string;
  decidedBy: string;
  createdAt: string;
  unread: boolean;
};

export type NotificationListResult =
  | { error: string; items?: undefined }
  | { error: null; items: HallNotification[] };

export type MarkNotificationsReadResult =
  | { error: string; marked?: undefined }
  | { error: null; marked: number };

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

type SessionValue = {
  ready: boolean;
  user: HallUser | null;
  signIn: (username: string, password: string) => Promise<string | null>;
  signOut: () => Promise<void>;
  onboard: (body: OnboardBody) => Promise<string | null>;
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
  }) => Promise<HistoryResult>;
  loadNotifications: () => Promise<NotificationListResult>;
  markNotificationsRead: () => Promise<MarkNotificationsReadResult>;
  loadGuestStays: () => Promise<GuestListResult>;
  loadGuestStay: (guestStayId: string) => Promise<GuestResult>;
  submitGuestStay: (body: GuestStayCreate) => Promise<string | null>;
  updateGuestStay: (guestStayId: string, body: GuestStayCreate) => Promise<string | null>;
  cancelGuestStay: (guestStayId: string) => Promise<HallFailure | null>;
};

const SessionContext = createContext<SessionValue | null>(null);

const LOCAL_HALL = "http://127.0.0.1:8000";

function explicitHall(): string | null {
  const configured = process.env.EXPO_PUBLIC_API_URL;
  if (!configured) {
    return null;
  }
  return configured.replace(/\/$/, "");
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
    return { code, message };
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

function isRecord(value: unknown): value is Record<string, unknown> {
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

function readResidentHome(value: unknown): ResidentHome | null {
  if (
    !isRecord(value) ||
    !isRecord(value.resident) ||
    typeof value.ordinary_outing_active !== "boolean" ||
    typeof value.notifications_unread !== "boolean"
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
  return {
    fullName: resident.full_name,
    roomLabel,
    out: resident.presence === "outside",
    windowOpen: value.ordinary_outing_active,
    upcoming: readUpcoming(value),
    notificationsUnread: value.notifications_unread,
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
    startsAt: textOrNull(value.starts_at),
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

function readNotifications(value: unknown): HallNotification[] | null {
  if (!isRecord(value) || !Array.isArray(value.items)) {
    return null;
  }
  const items: HallNotification[] = [];
  for (const item of value.items) {
    if (!isRecord(item)) {
      return null;
    }
    if (item.permission_type !== "late_night" && item.permission_type !== "home_going") {
      return null;
    }
    if (item.decision !== "approved" && item.decision !== "rejected") {
      return null;
    }
    if (
      typeof item.id !== "string" ||
      typeof item.permission_id !== "string" ||
      typeof item.place !== "string" ||
      typeof item.departure_at !== "string" ||
      typeof item.expected_return_at !== "string" ||
      typeof item.decided_by !== "string" ||
      typeof item.created_at !== "string" ||
      typeof item.unread !== "boolean"
    ) {
      return null;
    }
    items.push({
      id: item.id,
      permissionId: item.permission_id,
      permissionType: item.permission_type,
      decision: item.decision,
      place: item.place,
      departureAt: item.departure_at,
      expectedReturnAt: item.expected_return_at,
      decidedBy: item.decided_by,
      createdAt: item.created_at,
      unread: item.unread,
    });
  }
  return items;
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
    items.push({ id: item.id, name: item.name });
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

async function expirePassed(token: string): Promise<void> {
  try {
    await hallFetch("/api/v1/me/expire-passed", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    });
  } catch {
    // Listing still runs when expiry cannot be reached.
  }
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

  const changePassword = useCallback(async (currentPassword: string, newPassword: string) => {
    const current = sessionRef.current;
    if (!current) {
      return "Sign in again";
    }
    try {
      const response = await hallFetch("/api/v1/auth/change-password", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${current.accessToken}`,
        },
        body: JSON.stringify({
          current_password: currentPassword,
          new_password: newPassword,
        }),
      });
      if (response.status === 204) {
        sessionRef.current = null;
        setSession(null);
        await SecureStore.deleteItemAsync(SESSION_KEY);
        return null;
      }
      return await errorMessage(response);
    } catch {
      return "The hall could not be reached";
    }
  }, []);

  const signOut = useCallback(async () => {
    const current = sessionRef.current;
    sessionRef.current = null;
    setSession(null);
    await SecureStore.deleteItemAsync(SESSION_KEY);
    if (!current) {
      return;
    }
    try {
      await hallFetch("/api/v1/auth/logout", {
        method: "POST",
        headers: { Authorization: `Bearer ${current.accessToken}` },
      });
    } catch {
      // The phone session is already cleared.
    }
  }, []);

  const renew = useCallback(async (): Promise<StoredSession | null> => {
    const current = sessionRef.current;
    if (!current?.refreshToken) {
      return null;
    }
    try {
      const response = await hallFetch("/api/v1/auth/refresh", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refresh_token: current.refreshToken }),
      });
      if (!response.ok) {
        return null;
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
      await SecureStore.setItemAsync(SESSION_KEY, JSON.stringify(next));
      setSession(next);
      return next;
    } catch {
      return null;
    }
  }, []);

  const loadResidentHome = useCallback(async (): Promise<ResidentHomeResult> => {
    let current = sessionRef.current;
    if (!current) {
      return { error: "Sign in again" };
    }
    const call = (token: string, path: string, method: string) =>
      hallFetch(path, { method, headers: { Authorization: `Bearer ${token}` } });
    try {
      let expired = await call(current.accessToken, "/api/v1/me/expire-passed", "POST");
      if (expired.status === 401) {
        const renewed = await renew();
        if (!renewed) {
          return { error: "Sign in again" };
        }
        current = renewed;
        expired = await call(current.accessToken, "/api/v1/me/expire-passed", "POST");
      }
      if (!expired.ok) {
        return { error: await errorMessage(expired) };
      }
      const homeResponse = await call(current.accessToken, "/api/v1/me/home", "GET");
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
  }, [renew]);

  const loadHistory = useCallback(
    async (filters?: {
      kind?: HistoryKind | "all";
      from?: string | null;
      to?: string | null;
    }): Promise<HistoryResult> => {
      const current = sessionRef.current;
      if (!current) {
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
      const suffix = query.toString();
      const path = suffix.length > 0 ? `/api/v1/me/history?${suffix}` : "/api/v1/me/history";
      try {
        const response = await hallFetch(path, {
          method: "GET",
          headers: { Authorization: `Bearer ${current.accessToken}` },
        });
        if (!response.ok) {
          return { error: await errorMessage(response) };
        }
        const items = readHistory(await response.json());
        if (!items) {
          return { error: "The hall could not be reached" };
        }
        return { error: null, items };
      } catch {
        return { error: "The hall could not be reached" };
      }
    },
    [],
  );

  const loadNotifications = useCallback(async (): Promise<NotificationListResult> => {
    const current = sessionRef.current;
    if (!current) {
      return { error: "Sign in again" };
    }
    try {
      const response = await hallFetch("/api/v1/me/notifications", {
        method: "GET",
        headers: { Authorization: `Bearer ${current.accessToken}` },
      });
      if (!response.ok) {
        return { error: await errorMessage(response) };
      }
      const items = readNotifications(await response.json());
      if (!items) {
        return { error: "The hall could not be reached" };
      }
      return { error: null, items };
    } catch {
      return { error: "The hall could not be reached" };
    }
  }, []);

  const markNotificationsRead = useCallback(async (): Promise<MarkNotificationsReadResult> => {
    const current = sessionRef.current;
    if (!current) {
      return { error: "Sign in again" };
    }
    try {
      const response = await hallFetch("/api/v1/me/notifications/read", {
        method: "POST",
        headers: { Authorization: `Bearer ${current.accessToken}` },
      });
      if (!response.ok) {
        return { error: await errorMessage(response) };
      }
      const body: unknown = await response.json();
      if (!isRecord(body) || typeof body.marked !== "number") {
        return { error: "The hall could not be reached" };
      }
      return { error: null, marked: body.marked };
    } catch {
      return { error: "The hall could not be reached" };
    }
  }, []);

  const loadGuestStays = useCallback(async (): Promise<GuestListResult> => {
    const current = sessionRef.current;
    if (!current) {
      return { error: "Sign in again" };
    }
    try {
      const response = await hallFetch("/api/v1/me/guest-stays?limit=50", {
        method: "GET",
        headers: { Authorization: `Bearer ${current.accessToken}` },
      });
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
    const current = sessionRef.current;
    if (!current) {
      return { error: "Sign in again" };
    }
    try {
      const response = await hallFetch(`/api/v1/me/guest-stays/${encodeURIComponent(guestStayId)}`, {
        method: "GET",
        headers: { Authorization: `Bearer ${current.accessToken}` },
      });
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
    const current = sessionRef.current;
    if (!current) {
      return "Sign in again";
    }
    try {
      const response = await hallFetch("/api/v1/me/guest-stays", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${current.accessToken}`,
        },
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
    const current = sessionRef.current;
    if (!current) {
      return "Sign in again";
    }
    try {
      const response = await hallFetch(`/api/v1/me/guest-stays/${encodeURIComponent(guestStayId)}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${current.accessToken}`,
        },
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
    const current = sessionRef.current;
    if (!current) {
      return { code: null, message: "Sign in again" };
    }
    try {
      const response = await hallFetch(
        `/api/v1/me/guest-stays/${encodeURIComponent(guestStayId)}/cancel`,
        {
          method: "POST",
          headers: { Authorization: `Bearer ${current.accessToken}` },
        },
      );
      if (response.status === 200) {
        return null;
      }
      return await hallFailure(response);
    } catch {
      return { code: null, message: "The hall could not be reached" };
    }
  }, []);

  const loadHallPass = useCallback(async (): Promise<HallPassResult> => {
    const current = sessionRef.current;
    if (!current) {
      return { error: "Sign in again" };
    }
    try {
      const response = await hallFetch("/api/v1/me/hall-pass", {
        method: "GET",
        headers: { Authorization: `Bearer ${current.accessToken}` },
      });
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
    const current = sessionRef.current;
    if (!current) {
      return { error: "Sign in again" };
    }
    try {
      const response = await hallFetch("/api/v1/destinations", {
        method: "GET",
        headers: { Authorization: `Bearer ${current.accessToken}` },
      });
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
    const current = sessionRef.current;
    if (!current) {
      return "Sign in again";
    }
    try {
      const response = await hallFetch("/api/v1/me/outings", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${current.accessToken}`,
        },
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
    const current = sessionRef.current;
    if (!current) {
      return "Sign in again";
    }
    try {
      const response = await hallFetch(`/api/v1/me/outings/${outingId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${current.accessToken}`,
        },
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
    const current = sessionRef.current;
    if (!current) {
      return { code: null, message: "Sign in again" };
    }
    try {
      const response = await hallFetch(`/api/v1/me/outings/${outingId}/cancel`, {
        method: "POST",
        headers: { Authorization: `Bearer ${current.accessToken}` },
      });
      if (response.status === 200) {
        return null;
      }
      return await hallFailure(response);
    } catch {
      return { code: null, message: "The hall could not be reached" };
    }
  }, []);

  const loadPermissions = useCallback(async (): Promise<PermissionListResult> => {
    const current = sessionRef.current;
    if (!current) {
      return { error: "Sign in again" };
    }
    try {
      await expirePassed(current.accessToken);
      const response = await hallFetch("/api/v1/me/permissions?limit=500", {
        method: "GET",
        headers: { Authorization: `Bearer ${current.accessToken}` },
      });
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
    const current = sessionRef.current;
    if (!current) {
      return { error: "Sign in again" };
    }
    try {
      await expirePassed(current.accessToken);
      const response = await hallFetch(
        `/api/v1/me/permissions/${encodeURIComponent(permissionId)}`,
        {
          method: "GET",
          headers: { Authorization: `Bearer ${current.accessToken}` },
        },
      );
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
    const current = sessionRef.current;
    if (!current) {
      return "Sign in again";
    }
    try {
      const response = await hallFetch("/api/v1/me/permissions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${current.accessToken}`,
        },
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
    const current = sessionRef.current;
    if (!current) {
      return "Sign in again";
    }
    try {
      const response = await hallFetch(
        `/api/v1/me/permissions/${encodeURIComponent(permissionId)}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${current.accessToken}`,
          },
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
    const current = sessionRef.current;
    if (!current) {
      return { code: null, message: "Sign in again" };
    }
    try {
      const response = await hallFetch(
        `/api/v1/me/permissions/${encodeURIComponent(permissionId)}/cancel`,
        {
          method: "POST",
          headers: { Authorization: `Bearer ${current.accessToken}` },
        },
      );
      if (response.status === 200) {
        return null;
      }
      return await hallFailure(response);
    } catch {
      return { code: null, message: "The hall could not be reached" };
    }
  }, []);

  const value = useMemo<SessionValue>(
    () => ({
      ready,
      user: session?.user ?? null,
      signIn,
      signOut,
      onboard,
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
      loadNotifications,
      markNotificationsRead,
      loadGuestStays,
      loadGuestStay,
      submitGuestStay,
      updateGuestStay,
      cancelGuestStay,
    }),
    [
      ready,
      session,
      signIn,
      signOut,
      onboard,
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
      loadNotifications,
      markNotificationsRead,
      loadGuestStays,
      loadGuestStay,
      submitGuestStay,
      updateGuestStay,
      cancelGuestStay,
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
