import type { HallRole } from "@/session";

export type PushData = { notification_id?: unknown; kind?: unknown; record_id?: unknown };

/** Where a tapped push opens. Staff and resident kinds never overlap except resident_late. */
export function pushTarget(role: HallRole, data: PushData): string | null {
  const id = typeof data.record_id === "string" ? encodeURIComponent(data.record_id) : "";
  if (role === "resident") {
    switch (data.kind) {
      case "permission_decided":
        return id ? `/permission?id=${id}` : null;
      case "guest_stay_decided":
        return id ? `/guest?id=${id}` : null;
      case "resident_late":
      case "outing_ending":
        return "/pass";
      default:
        return null;
    }
  }
  if (role === "gate") {
    return null;
  }
  switch (data.kind) {
    case "permission_requested":
      return id ? `/staff/requests?tab=permissions&open=${id}` : null;
    case "guest_stay_requested":
      return id ? `/staff/requests?tab=guests&open=${id}` : null;
    case "resident_late":
      return "/staff/out?tab=late";
    default:
      return null;
  }
}
