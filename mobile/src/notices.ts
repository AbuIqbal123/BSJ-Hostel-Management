import { formatWhenParts } from "@/format-when";
import { isRecord, type HallRole } from "@/session";
import { pushTarget } from "@/push";
import { shortDay } from "@/staff";

/** One inbox card, staff or resident. `status` is the outcome line, or null while it waits. */
export type Notice = {
  id: string;
  title: string;
  detail: string;
  when: string;
  at: string;
  unread: boolean;
  needsAction: boolean;
  status: string | null;
  target: string | null;
};

export type NoticePage = { items: Notice[]; next: string | null };

type Json = Record<string, unknown>;

/** `15 Oct, 1:46 AM` on the hall clock, short enough to share a line with the room. */
function shortWhen(iso: string): string {
  const parts = formatWhenParts(iso);
  return parts ? `${shortDay(parts.day)}, ${parts.clock}` : "";
}

function str(value: unknown): string {
  return typeof value === "string" ? value : "";
}

const OUTCOME_WORDS: Record<string, string> = {
  approved: "Approved",
  declined: "Declined",
  cancelled: "Cancelled",
  returned: "Back",
};

function outcomeLine(item: Json): string | null {
  const word = OUTCOME_WORDS[str(item.outcome)];
  if (!word) {
    return item.needs_action === true ? "Needs action" : null;
  }
  const by = str(item.decided_by_name).trim();
  return by && (word === "Approved" || word === "Declined") ? `${word} by ${by}` : word;
}

const STAFF_TITLES: Record<string, (name: string) => string> = {
  permission_requested: (name) => `${name} asked for a permission`,
  guest_stay_requested: (name) => `${name} asked for a guest stay`,
  resident_late: (name) => `${name} is late back`,
};

function staffCard(item: Json, role: HallRole): Notice | null {
  const title = STAFF_TITLES[str(item.kind)];
  if (!title || !str(item.id)) {
    return null;
  }
  const name = str(item.resident_name) || "A resident";
  return {
    id: str(item.id),
    title: item.kind === "resident_late" && item.outcome === "returned" ? `${name} was late back` : title(name),
    detail: [str(item.room_label), str(item.block_name)].filter(Boolean).join(" · "),
    when: shortWhen(str(item.occurred_at)),
    at: str(item.occurred_at),
    unread: item.unread === true,
    needsAction: item.needs_action === true,
    status: outcomeLine(item),
    // A decided request has nothing left to review; its outcome is on the card.
    target: item.kind !== "resident_late" && item.outcome ? null : pushTarget(role, item),
  };
}

function residentTitle(item: Json): string | null {
  const word = item.outcome === "approved" ? "approved" : "declined";
  switch (item.kind) {
    case "permission_decided":
      return `Your permission was ${word}`;
    case "guest_stay_decided":
      return `Your guest stay was ${word}`;
    case "resident_late":
      return item.outcome === "returned" ? "You were late back" : "You are late back";
    default:
      return null;
  }
}

function residentCard(item: Json): Notice | null {
  const title = residentTitle(item);
  if (!title || !str(item.id)) {
    return null;
  }
  const what = item.kind === "guest_stay_decided" ? str(item.guest_name) : str(item.place);
  const by = str(item.decided_by_name).trim();
  return {
    id: str(item.id),
    title,
    detail: what,
    when: shortWhen(str(item.occurred_at)),
    at: str(item.occurred_at),
    unread: item.unread === true,
    needsAction: item.needs_action === true,
    status: item.kind === "resident_late" ? (item.needs_action === true ? "Head back now" : "Back") : by ? `By ${by}` : null,
    target: pushTarget("resident", item),
  };
}

/** Reads one `{items, next_cursor}` page. Rows the app does not know are skipped. */
export function readNoticePage(value: unknown, role: HallRole): NoticePage {
  const body = isRecord(value) ? value : {};
  const list = Array.isArray(body.items) ? body.items.filter(isRecord) : [];
  const items = list.flatMap((item) => {
    const card = role === "resident" ? residentCard(item) : staffCard(item, role);
    return card ? [card] : [];
  });
  return { items, next: typeof body.next_cursor === "string" ? body.next_cursor : null };
}

/** The unread count a read route hands back, so the bell and app badge follow at once. */
export function readUnreadCount(value: unknown): number | null {
  const count = isRecord(value) ? value.unread_count : null;
  return typeof count === "number" && count >= 0 ? count : null;
}
