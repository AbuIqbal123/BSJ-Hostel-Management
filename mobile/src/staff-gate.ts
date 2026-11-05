/** Gate activity, scan results, and late-return presentation. */

import { formatWhen, formatWhenParts, hallNow } from "@/format-when";
import { record, text as str, type Json } from "@/json";

function num(value: unknown): number {
  return typeof value === "number" ? value : 0;
}

function items(value: unknown): Json[] {
  const list = record(value)?.items;
  return Array.isArray(list) ? list.map(record).filter((item): item is Json => item !== null) : [];
}

/** Copy has no full stop at the end of a line. */
export function trimStop(message: string): string {
  return message.trim().replace(/\.$/, "");
}

/** `13 October 2026` to `13 Oct`. */
export function shortDay(day: string): string {
  const [date, month] = day.split(" ");
  return `${date} ${month?.slice(0, 3) ?? ""}`.trim();
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

/** Today's lines show the clock; older lines show a short day and the clock. */
function activityWhen(iso: string): string {
  const parts = formatWhenParts(iso);
  if (!parts) {
    return "";
  }
  const today = formatWhenParts(hallNow().toISOString())?.day;
  if (parts.day === today) {
    return parts.clock;
  }
  return `${shortDay(parts.day)} ${parts.clock}`;
}

export function readActivity(value: unknown, offset = 0): GateEvent[] {
  return items(value).map((item, index) => {
    const at = str(item.occurred_at) ?? "";
    const who = str(item.resident_name) ?? str(item.guest_name) ?? "";
    const room = str(item.room_label) ?? str(item.host_room_label) ?? "";
    return {
      key: `${at}|${String(item.event)}|${who}|${room}|${offset + index}`,
      ...eventParts(item),
      at: activityWhen(at),
    };
  });
}


export type OutingKind = "ordinary" | "late_night" | "home_going";

function outingKind(value: unknown): OutingKind | null {
  return value === "ordinary" || value === "late_night" || value === "home_going" ? value : null;
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

export const GATE_ACTIVITY_CSV_HEADER =
  "occurred_at,event,resident_name,room_label,guest_name,host_name,host_room_label";

export function gateActivityCsv(value: string): string | null {
  const header = value.split(/\r?\n/, 1)[0];
  return header === GATE_ACTIVITY_CSV_HEADER ? value : null;
}

/** Download name for the gate activity CSV (`gate-activity-2026-11-04.csv`). */
export function gateActivityExportFileName(hallDay: string): string {
  return `gate-activity-${hallDay}.csv`;
}

/** Query string for gate activity CSV export (same filters as the list, no paging). */
export function gateActivityExportQuery(filters: { event: string | null; q: string }): string {
  const search = new URLSearchParams();
  if (filters.event) {
    search.set("event", filters.event);
  }
  if (filters.q.trim()) {
    search.set("q", filters.q.trim());
  }
  const text = search.toString();
  return text ? `?${text}` : "";
}
