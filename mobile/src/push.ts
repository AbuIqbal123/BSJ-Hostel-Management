import Constants from "expo-constants";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

import type { HallRole } from "@/session";

/** Push and local notifications only exist on a real phone build, never on web. */
export const pushSupported = Platform.OS !== "web";

const OUTING_ENDING = "outing-ending";
const LEAD_MS = 15 * 60 * 1000;

if (pushSupported) {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: true,
    }),
  });
}

/** Stored after the hall accepts the token with 204. */
export const PUSH_TOKEN_KEY = "bsj.pushToken";

/** Closed by sign-out so a late home load cannot schedule another reminder. */
let returnRemindersOpen = true;

export function allowReturnReminders() {
  returnRemindersOpen = true;
}

export function blockReturnReminders() {
  returnRemindersOpen = false;
}

/** Asks once, after sign-in. Null when she says no, this is not a phone, or the phone has no push service. */
export async function pushToken(): Promise<string | null> {
  if (!pushSupported || !Device.isDevice) {
    return null;
  }
  try {
    if (Platform.OS === "android") {
      await Notifications.setNotificationChannelAsync("default", {
        name: "Hall",
        importance: Notifications.AndroidImportance.HIGH,
      });
    }
    let { status } = await Notifications.getPermissionsAsync();
    if (status !== "granted") {
      status = (await Notifications.requestPermissionsAsync()).status;
    }
    if (status !== "granted") {
      return null;
    }
    const projectId: unknown = Constants.expoConfig?.extra?.eas?.projectId;
    if (typeof projectId !== "string") {
      return null;
    }
    return (await Notifications.getExpoPushTokenAsync({ projectId })).data;
  } catch {
    // Android without Firebase rejects the token call. The app keeps working.
    return null;
  }
}

/** Cancels outing reminders, clears the badge, banners, and the last tap. Each step stands alone. */
export async function clearNotificationSurface(): Promise<void> {
  blockReturnReminders();
  if (!pushSupported) {
    return;
  }
  const steps: Array<() => Promise<unknown>> = [
    async () => {
      const scheduled = await Notifications.getAllScheduledNotificationsAsync();
      await Promise.all(
        scheduled
          .filter((item) => item.identifier.startsWith(OUTING_ENDING))
          .map((item) => Notifications.cancelScheduledNotificationAsync(item.identifier)),
      );
    },
    () => Notifications.setBadgeCountAsync(0),
    () => Notifications.dismissAllNotificationsAsync(),
    () => Notifications.clearLastNotificationResponseAsync(),
  ];
  for (const step of steps) {
    try {
      await step();
    } catch {
      // A missing notification permission must not stop the session from ending.
    }
  }
}

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

/** The reminder time: 15 minutes before she is due back, or null if that has passed. */
export function endingReminderAt(expectedReturnAt: string | null, now = Date.now()): Date | null {
  const due = expectedReturnAt ? Date.parse(expectedReturnAt) : Number.NaN;
  if (Number.isNaN(due) || due - LEAD_MS <= now) {
    return null;
  }
  return new Date(due - LEAD_MS);
}

/** One reminder at a time. Each home load replaces it, or clears it when she has no open outing. */
export async function scheduleOutingEnding(outing: { id: string; expectedReturnAt: string } | null) {
  if (!pushSupported || !returnRemindersOpen) {
    return;
  }
  await Notifications.cancelScheduledNotificationAsync(OUTING_ENDING).catch(() => undefined);
  const at = endingReminderAt(outing?.expectedReturnAt ?? null);
  if (!outing || !at) {
    return;
  }
  const { status } = await Notifications.getPermissionsAsync();
  if (status !== "granted") {
    return;
  }
  await Notifications.scheduleNotificationAsync({
    identifier: OUTING_ENDING,
    content: {
      title: "Back in 15 minutes",
      body: "Your outing ends soon. Show your hall pass at the gate",
      data: { kind: "outing_ending", record_id: outing.id },
    },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: at },
  });
}

/** Keeps the app icon badge in step with the inbox after a read. */
export function setBadge(count: number) {
  if (pushSupported && returnRemindersOpen) {
    void Notifications.setBadgeCountAsync(count).catch(() => undefined);
  }
}
