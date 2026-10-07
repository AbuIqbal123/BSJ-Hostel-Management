import type { GuestStayCard, HistoryKind, PermissionStatus } from "@/session";
import type { HallColors } from "@/theme/colors";

export function guestLine(item: GuestStayCard): string {
  if (item.bucket === "in_hall") {
    return "In the hall";
  }
  if (item.bucket === "should_have_left") {
    return "Should have left";
  }
  if (item.status === "approved" && item.paymentStatus === "unpaid") {
    return "Approved, not yet paid";
  }
  if (item.status === "pending") {
    return "Pending";
  }
  if (item.status === "approved") {
    return "Approved";
  }
  if (item.status === "rejected") {
    return "Rejected";
  }
  if (item.status === "cancelled") {
    return "Cancelled";
  }
  return "Departed";
}

export function kindLabel(kind: HistoryKind): string {
  switch (kind) {
    case "late_night":
      return "Late-night";
    case "home_going":
      return "Home going";
    case "guest_stay":
      return "Guest stay";
    case "outing":
      return "Outing";
  }
}

export function statusSentence(status: PermissionStatus): string {
  switch (status) {
    case "pending":
      return "Pending";
    case "approved":
      return "Approved";
    case "rejected":
      return "Rejected";
    case "cancelled":
      return "Cancelled";
    case "in_use":
      return "Out";
    case "completed":
      return "Completed";
    case "expired":
      return "Expired";
  }
}

export function statusTone(status: PermissionStatus, colors: HallColors) {
  if (status === "approved" || status === "in_use") {
    return { color: colors.forest, border: colors.forest, background: colors.approvedBg };
  }
  if (status === "rejected") {
    return { color: colors.danger, border: colors.danger, background: colors.dangerBg };
  }
  if (status === "pending") {
    return { color: colors.pending, border: colors.pending, background: colors.pendingBg };
  }
  return { color: colors.inkSoft, border: colors.line, background: colors.surface };
}
