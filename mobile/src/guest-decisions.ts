import { isRecord } from "@/json";

export type GuestDecision = {
  role: "roommate" | "provost";
  actorName: string;
  decision: "approved" | "rejected";
  decidedAt: string;
  note: string | null;
};

function readDecision(item: Record<string, unknown>): GuestDecision | null {
  if (item.role !== "roommate" && item.role !== "provost") {
    return null;
  }
  if (item.decision !== "approved" && item.decision !== "rejected") {
    return null;
  }
  if (typeof item.actor_name !== "string" || typeof item.decided_at !== "string") {
    return null;
  }
  if (item.note !== null && typeof item.note !== "string") {
    return null;
  }
  return {
    role: item.role,
    actorName: item.actor_name,
    decision: item.decision,
    decidedAt: item.decided_at,
    note: typeof item.note === "string" && item.note.length > 0 ? item.note : null,
  };
}

/** Recorded yeses and nos, oldest first. Null when the array or any row is not a decision. */
export function readGuestDecisions(value: unknown): GuestDecision[] | null {
  if (!Array.isArray(value)) {
    return null;
  }
  const decisions: GuestDecision[] = [];
  for (const item of value) {
    if (!isRecord(item)) {
      return null;
    }
    const decision = readDecision(item);
    if (!decision) {
      return null;
    }
    decisions.push(decision);
  }
  return decisions;
}
