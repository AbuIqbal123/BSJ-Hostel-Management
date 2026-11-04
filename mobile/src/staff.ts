import { formatWhen, formatWhenParts, hallNow } from "@/format-when";
import { readGuestDecisions, type GuestDecision } from "@/guest-decisions";
import { record, text as str, type Json } from "@/json";
import type { HallRole, PermissionKind } from "@/session";
import { shortDay, type OutingKind } from "@/staff-gate";

export {
  lateDetail,
  lateFor,
  dueLabel,
  readActivity,
  readLateReturns,
  readScan,
  scanRefusal,
  shortDay,
  trimStop,
  type GateEvent,
  type LateReturn,
  type OutingKind,
  type ScanResult,
} from "@/staff-gate";

export function homePath(role: HallRole): "/home" | "/staff" {
  return role === "resident" ? "/home" : "/staff";
}

/** Gate accounts may scan and read gate activity only. */
export function readsRegister(role: HallRole): boolean {
  return role === "warden" || role === "provost";
}

/** Only the provost approves or rejects late-night, home going, and guest stays. */
export function decidesRequests(role: HallRole): boolean {
  return role === "provost";
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

export type GuestDetail = {
  relation: string;
  reason: string;
  days: number;
  decisions: GuestDecision[];
  roommateApprovalRequired: boolean;
  waitingOnRoommate: boolean;
  waitingOnProvost: boolean;
};

export function readGuestDetail(value: unknown): GuestDetail | null {
  const body = record(value);
  if (!body) {
    return null;
  }
  return {
    relation: str(body.relation) ?? "",
    reason: str(body.reason) ?? "",
    days: num(body.inclusive_days),
    decisions: readGuestDecisions(body.decisions) ?? [],
    roommateApprovalRequired: body.roommate_approval_required === true,
    waitingOnRoommate: body.waiting_on_roommate === true,
    waitingOnProvost: body.waiting_on_provost === true,
  };
}

function decisionFact(decision: GuestDecision): { label: string; value: string } {
  const word = decision.decision === "approved" ? "approved" : "declined";
  return {
    label: decision.role === "roommate" ? "Roommate" : "Provost",
    value: `${decision.actorName} ${word} · ${formatWhen(decision.decidedAt)}`,
  };
}

/** The queue drops a guest stay only once the stay itself is approved or rejected. */
export function shouldRemoveGuestAfterDecision(status: string): boolean {
  return status === "approved" || status === "rejected";
}

/** Fact rows for the staff review sheet: recorded decisions, then who is still waiting. */
export function guestDecisionFacts(detail: GuestDetail): { label: string; value: string }[] {
  const facts = detail.decisions.map(decisionFact);
  if (detail.roommateApprovalRequired && detail.waitingOnRoommate) {
    facts.push({ label: "Roommate", value: "waiting" });
  }
  if (detail.waitingOnProvost) {
    facts.push({ label: "Provost", value: "waiting" });
  }
  return facts;
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

