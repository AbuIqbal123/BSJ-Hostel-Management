import type { HallRole, PermissionKind } from "@/session";
import { formatWhen, formatWhenParts, hallNow } from "@/format-when";
import { record, text as str, type Json } from "@/json";

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
  unread: number;
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
    unread: num(body.notifications_unread_count),
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

export type OutingKind = "ordinary" | "late_night" | "home_going";

export type OutRow = {
  id: string;
  name: string;
  room: string;
  place: string;
  backBy: string;
  late: boolean;
  sortKey: string;
  kind: OutingKind | null;
  block: string;
};

function outingKind(value: unknown): OutingKind | null {
  return value === "ordinary" || value === "late_night" || value === "home_going" ? value : null;
}

/** Today's back-by shows the clock; a later day shows the date. Late always shows the clock. */
function backByLabel(iso: string | null, late: boolean): string {
  const parts = iso ? formatWhenParts(iso) : null;
  if (!parts) {
    return "";
  }
  if (late) {
    return `Late, ${parts.clock}`;
  }
  const today = formatWhenParts(hallNow().toISOString())?.day;
  return parts.day === today ? parts.clock : shortDay(parts.day);
}

/** `13 October 2026` to `13 Oct`. */
export function shortDay(day: string): string {
  const [date, month] = day.split(" ");
  return `${date} ${month?.slice(0, 3) ?? ""}`.trim();
}

/** One `state=out` page: late comes from the row, the block from `block_name`. */
export function readOutRows(value: unknown): OutRow[] {
  return items(value).flatMap((item) => {
    const id = str(item.id);
    const name = str(item.full_name);
    const room = str(item.room_label);
    if (!id || !name || !room) {
      return [];
    }
    const back = str(item.expected_return_at);
    const late = item.state === "late";
    return [
      {
        id,
        name,
        room,
        place: str(item.outside_destination) ?? "",
        backBy: backByLabel(back, late),
        late,
        sortKey: back ?? "",
        kind: outingKind(item.outing_type),
        block: str(item.block_name) ?? "",
      },
    ];
  });
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

/** Section title for the hall day a request was submitted. */
export function submittedDay(iso: string): string {
  const day = formatWhenParts(iso)?.day ?? "";
  const now = hallNow();
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
  outing: string;
  place: string;
  facts: { label: string; value: string }[];
  timeliness: string;
  late: boolean;
  reason: string;
};

const OUTING_WORDS: Record<string, string> = {
  ordinary: "Ordinary",
  late_night: "Late-night",
  home_going: "Home going",
};

const TIMELINESS: Record<string, string> = {
  on_time: "On time",
  within_grace: "Within grace",
  late: "Late",
};

function clockFact(label: string, iso: string | null): { label: string; value: string }[] {
  const parts = iso ? formatWhenParts(iso) : null;
  return parts ? [{ label, value: `${parts.clock}, ${shortDay(parts.day)}` }] : [];
}

function scanBase(body: Record<string, unknown>) {
  return {
    name: str(body.full_name) ?? "",
    room: str(body.room_label) ?? "",
    outing: "",
    place: "",
    facts: [],
    timeliness: "",
    late: false,
    reason: "",
  };
}

export function scanRefusal(message: string, details: Record<string, unknown> | null): ScanResult {
  return { ...scanBase(details ?? {}), kind: "refused", reason: trimStop(message) };
}

export function readScan(value: unknown): ScanResult | null {
  const body = record(value);
  if (!body) {
    return null;
  }
  if (body.outcome === "exit_recorded") {
    const outing = record(body.outing);
    return {
      ...scanBase(body),
      kind: "leave",
      outing: OUTING_WORDS[str(outing?.outing_type) ?? ""] ?? "",
      place: str(outing?.place) ?? "",
      facts: [
        ...clockFact("Out", str(outing?.exited_at) ?? str(outing?.recorded_at)),
        ...clockFact("Back by", str(outing?.expected_return_at)),
      ],
    };
  }
  if (body.outcome === "return_recorded") {
    const returned = record(body.return_record);
    const timeliness = str(returned?.return_timeliness) ?? "";
    const due = str(returned?.expected_return_at);
    const minutes = num(returned?.minutes_late);
    const late = timeliness === "late";
    return {
      ...scanBase(body),
      kind: "return",
      outing: OUTING_WORDS[str(returned?.outing_type) ?? ""] ?? "",
      place: str(returned?.place) ?? "",
      facts: [
        ...clockFact("Back", str(returned?.returned_at)),
        ...(due ? [{ label: "Due by", value: formatWhen(due) }] : []),
      ],
      timeliness: late && minutes > 0 ? `Late by ${lateSpan(minutes)}` : (TIMELINESS[timeliness] ?? ""),
      late,
    };
  }
  return null;
}

export type LateReturn = {
  id: string;
  name: string;
  room: string;
  block: string;
  kind: OutingKind;
  dueAt: string;
  returnedAt: string | null;
  minutesLate: number;
};

export function readLateReturns(value: unknown): LateReturn[] {
  return items(value).flatMap((item) => {
    const id = str(item.id);
    const kind = outingKind(item.source);
    const dueAt = str(item.due_at);
    if (!id || !kind || !dueAt) {
      return [];
    }
    return [
      {
        id,
        name: str(item.resident_name) ?? "",
        room: str(item.room_label) ?? "",
        block: str(item.block_name) ?? "",
        kind,
        dueAt,
        returnedAt: str(item.returned_at),
        minutesLate: num(item.minutes_late),
      },
    ];
  });
}

/** `45 min`, `2 h 10 min`, or `3 days`. Used as `Late by …` on the scan card and by `lateFor`. */
function lateSpan(minutes: number): string {
  if (minutes < 60) {
    return `${minutes} min`;
  }
  if (minutes < 24 * 60) {
    const rest = minutes % 60;
    return rest ? `${Math.floor(minutes / 60)} h ${rest} min` : `${minutes / 60} h`;
  }
  const days = Math.floor(minutes / (24 * 60));
  return `${days} ${days === 1 ? "day" : "days"}`;
}

/** How late: minutes, hours, or days. */
export function lateFor(minutes: number): string {
  return `${lateSpan(Math.max(0, minutes))} late`;
}

function clockDay(iso: string | null): string {
  const parts = iso ? formatWhenParts(iso) : null;
  return parts ? `${parts.clock}, ${shortDay(parts.day)}` : "";
}

export function dueLabel(dueAt: string): string {
  const when = clockDay(dueAt);
  return when ? `due ${when}` : "";
}

/** `due 9:30 PM, 13 Oct`, then `back 10:05 PM, 13 Oct` once she has returned. */
export function lateDetail(row: LateReturn): string {
  const back = row.returnedAt ? `back ${clockDay(row.returnedAt)}` : "";
  return [row.room, OUTING_WORDS[row.kind], dueLabel(row.dueAt), back].filter(Boolean).join(" · ");
}
