import type { HallRole, PermissionKind } from "@/session";
import { formatHallDate, formatWhenParts } from "@/format-when";

export function homePath(role: HallRole): "/home" | "/staff" {
  return role === "resident" ? "/home" : "/staff";
}

/** Gate accounts may scan and read gate activity only. */
export function readsRegister(role: HallRole): boolean {
  return role === "warden" || role === "provost";
}

/** Copy has no full stop at the end of a line. */
export function trimStop(message: string): string {
  return message.trim().replace(/\.$/, "");
}

type Json = Record<string, unknown>;

function record(value: unknown): Json | null {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Json) : null;
}

function str(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function num(value: unknown): number {
  return typeof value === "number" ? value : 0;
}

function items(value: unknown): Json[] {
  const list = record(value)?.items;
  return Array.isArray(list) ? list.map(record).filter((item): item is Json => item !== null) : [];
}

export function readTotal(value: unknown): number {
  return num(record(value)?.total);
}

export type HallBlock = { id: string; code: string; name: string };

export type RegisterSummary = {
  out: number;
  late: number;
  pendingPermissions: number;
  pendingGuests: number;
  blocks: HallBlock[];
};

export function readSummary(value: unknown): RegisterSummary | null {
  const body = record(value);
  if (!body) {
    return null;
  }
  const blocks = Array.isArray(body.blocks) ? body.blocks.map(record) : [];
  return {
    out: num(body.outside_count) + num(body.late_count),
    late: num(body.late_count),
    pendingPermissions: num(body.pending_permission_count),
    pendingGuests: num(body.pending_guest_stay_count),
    blocks: blocks.flatMap((block) => {
      const id = str(block?.block_id);
      const code = str(block?.code);
      const name = str(block?.name);
      return id && code && name ? [{ id, code, name }] : [];
    }),
  };
}

export type GateEvent = { key: string; title: string; detail: string; at: string };

const EVENT_WORDS: Record<string, string> = {
  exit: "Went out",
  return: "Came back",
  guest_arrival: "Guest arrived",
  guest_departure: "Guest left",
};

function eventParts(item: Json): { title: string; detail: string } {
  const word = EVENT_WORDS[String(item.event)] ?? "";
  if (item.event === "exit" || item.event === "return") {
    return {
      title: str(item.resident_name) ?? "",
      detail: [str(item.room_label), word].filter(Boolean).join(" · "),
    };
  }
  return {
    title: str(item.guest_name) ?? "",
    detail: [str(item.host_room_label), word, `host ${str(item.host_name) ?? ""}`.trim()].filter(Boolean).join(" · "),
  };
}

export function readActivity(value: unknown): GateEvent[] {
  return items(value).map((item, index) => {
    const at = str(item.occurred_at) ?? "";
    return { key: `${at}-${index}`, ...eventParts(item), at: formatWhenParts(at)?.clock ?? "" };
  });
}

export type OutRow = {
  id: string;
  name: string;
  room: string;
  place: string;
  backBy: string;
  late: boolean;
  sortKey: string;
};

/** Today's back-by shows the clock; a later day shows the date. Late always shows the clock. */
function backByLabel(iso: string | null, late: boolean): string {
  const parts = iso ? formatWhenParts(iso) : null;
  if (!parts) {
    return "";
  }
  if (late) {
    return `Late, ${parts.clock}`;
  }
  const today = formatWhenParts(new Date().toISOString())?.day;
  return parts.day === today ? parts.clock : shortDay(parts.day);
}

/** `13 October 2026` to `13 Oct`. */
export function shortDay(day: string): string {
  const [date, month] = day.split(" ");
  return `${date} ${month?.slice(0, 3) ?? ""}`.trim();
}

export function readOutRows(value: unknown, late: boolean): OutRow[] {
  return items(value).flatMap((item) => {
    const id = str(item.id);
    const name = str(item.full_name);
    const room = str(item.room_label);
    if (!id || !name || !room) {
      return [];
    }
    const back = str(item.expected_return_at);
    return [
      {
        id,
        name,
        room,
        place: str(item.outside_destination) ?? "",
        backBy: backByLabel(back, late),
        late,
        sortKey: back ?? "",
      },
    ];
  });
}

/** Room labels are written as `{block code}-{number}` by the hall office. */
export function blockCode(room: string): string {
  return room.split("-")[0] ?? "";
}

/** A resident out on an approved late-night or home-going permission. */
export function permissionOutRow(item: PermissionReview): OutRow {
  return {
    id: item.residentId,
    name: item.name,
    room: item.room,
    place: item.place,
    backBy: backByLabel(item.expectedReturnAt, false),
    late: false,
    sortKey: item.expectedReturnAt,
  };
}

export type PermissionReview = {
  id: string;
  residentId: string;
  name: string;
  room: string;
  kind: PermissionKind;
  place: string;
  detail: string | null;
  reason: string;
  departureAt: string;
  expectedReturnAt: string;
  createdAt: string;
};

export function readPermissionReviews(value: unknown): PermissionReview[] {
  return items(value).flatMap((item) => {
    const id = str(item.id);
    const kind = item.permission_type;
    if (!id || (kind !== "late_night" && kind !== "home_going")) {
      return [];
    }
    return [
      {
        id,
        residentId: str(item.resident_id) ?? "",
        name: str(item.resident_name) ?? "",
        room: str(item.room_label) ?? "",
        kind,
        place: str(item.short_place) ?? "",
        detail: str(item.destination_detail),
        reason: str(item.reason) ?? "",
        departureAt: str(item.departure_at) ?? "",
        expectedReturnAt: str(item.expected_return_at) ?? "",
        createdAt: str(item.created_at) ?? "",
      },
    ];
  });
}

export type GuestReview = {
  id: string;
  guestName: string;
  hostName: string;
  hostRoom: string;
  start: string;
  end: string;
};

export function readGuestReviews(value: unknown): GuestReview[] {
  return items(value).flatMap((item) => {
    const id = str(item.id);
    if (!id) {
      return [];
    }
    return [
      {
        id,
        guestName: str(item.guest_name) ?? "",
        hostName: str(item.host_name) ?? "",
        hostRoom: str(item.host_room_label) ?? "",
        start: str(item.guest_start_date) ?? "",
        end: str(item.guest_end_date) ?? "",
      },
    ];
  });
}

export type GuestDetail = { relation: string; reason: string; days: number };

export function readGuestDetail(value: unknown): GuestDetail | null {
  const body = record(value);
  if (!body) {
    return null;
  }
  return {
    relation: str(body.relation) ?? "",
    reason: str(body.reason) ?? "",
    days: num(body.inclusive_days),
  };
}

/** `13 Oct, 7:30 PM`, or days only for home going. */
export function permissionTime(item: PermissionReview): string {
  const start = formatWhenParts(item.departureAt);
  const end = formatWhenParts(item.expectedReturnAt);
  if (!start || !end) {
    return "";
  }
  if (item.kind === "home_going") {
    return `${shortDay(start.day)} to ${shortDay(end.day)}`;
  }
  return `${shortDay(start.day)}, ${start.clock}`;
}

export function guestTime(item: GuestReview): string {
  return `${shortDay(formatHallDate(item.start))} to ${shortDay(formatHallDate(item.end))}`;
}

/** Section title for the hall day a request was submitted. */
export function submittedDay(iso: string): string {
  const day = formatWhenParts(iso)?.day ?? "";
  const now = new Date();
  const today = formatWhenParts(now.toISOString())?.day;
  const yesterday = formatWhenParts(new Date(now.getTime() - 86_400_000).toISOString())?.day;
  if (day === today) {
    return "Submitted today";
  }
  if (day === yesterday) {
    return "Submitted yesterday";
  }
  return `Submitted ${day}`;
}

export type ScanResult = {
  kind: "leave" | "return" | "refused";
  name: string;
  room: string;
  line: string;
  time: string;
};

export function readScan(value: unknown): ScanResult | null {
  const body = record(value);
  if (!body) {
    return null;
  }
  const name = str(body.full_name) ?? "";
  const room = str(body.room_label) ?? "";
  if (body.outcome === "exit_recorded") {
    const outing = record(body.outing);
    const back = formatWhenParts(str(outing?.expected_return_at) ?? "");
    return {
      kind: "leave",
      name,
      room,
      line: str(outing?.place) ?? "",
      time: back ? `Back by ${back.clock}, ${shortDay(back.day)}` : "",
    };
  }
  if (body.outcome === "return_recorded") {
    const at = formatWhenParts(str(record(body.return_record)?.returned_at) ?? "");
    return {
      kind: "return",
      name,
      room,
      line: trimStop(str(body.message) ?? ""),
      time: at ? `Back at ${at.clock}` : "",
    };
  }
  return null;
}

export type OutingKind = "ordinary" | "late_night" | "home_going";

/** The open outing on `/register/residents/{id}`: its kind and when she was due. */
export function readOpenOuting(value: unknown): { kind: OutingKind; dueAt: string } | null {
  const outing = record(record(value)?.outing);
  const kind = outing?.outing_type;
  const dueAt = str(outing?.expected_return_at);
  if (!dueAt || (kind !== "ordinary" && kind !== "late_night" && kind !== "home_going")) {
    return null;
  }
  return { kind, dueAt };
}

/** How long past the due time: minutes, hours, or days. */
export function lateBy(dueAt: string, now: Date = new Date()): string {
  const minutes = Math.max(0, Math.floor((now.getTime() - new Date(dueAt).getTime()) / 60_000));
  if (minutes < 60) {
    return `${minutes} min late`;
  }
  if (minutes < 24 * 60) {
    const rest = minutes % 60;
    return rest ? `${Math.floor(minutes / 60)} h ${rest} min late` : `${minutes / 60} h late`;
  }
  const days = Math.floor(minutes / (24 * 60));
  return `${days} ${days === 1 ? "day" : "days"} late`;
}

export function dueLabel(dueAt: string): string {
  const parts = formatWhenParts(dueAt);
  return parts ? `due ${parts.clock}, ${shortDay(parts.day)}` : "";
}
