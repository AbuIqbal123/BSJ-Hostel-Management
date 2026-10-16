import { syncReturnReminders } from "@/push";
import { reminderPlan } from "@/reminder";
import type { ResidentHome } from "@/session";

/**
 * Replaces the phone's return reminders from a Home payload.
 * A failed permissions read leaves the existing reminders alone.
 */
export function syncResidentReminders(home: ResidentHome): void {
  if (home.approvedPermissions === null) {
    return;
  }
  void syncReturnReminders(
    reminderPlan({
      out: home.out,
      current: home.currentOuting,
      plans: home.upcoming,
      permissions: home.approvedPermissions,
    }),
  );
}
