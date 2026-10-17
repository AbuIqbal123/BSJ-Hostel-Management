import Constants from "expo-constants";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

import { endingReminderAt } from "@/reminder";
import { ignore } from "@/safe";

export { pushTarget, type PushData } from "@/push-target";

/** Push and local notifications only exist on a real phone build, never on web. */
export const pushSupported = Platform.OS !== "web";

const OUTING_ENDING = "outing-ending";

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
      ignore();
    }
  }
}

/**
 * One notification slot per reminder (`outing-ending:<id>`).
 * Slots that are no longer in the plan, including the old shared slot, are cancelled.
 * A phone without notification permission, or Android without Firebase, fails quietly.
 */
export async function syncReturnReminders(
  reminders: Array<{ id: string; expectedReturnAt: string }>,
): Promise<void> {
  if (!pushSupported || !returnRemindersOpen) {
    return;
  }
  try {
    const wanted = new Map<string, { id: string; at: Date }>();
    for (const item of reminders) {
      const at = endingReminderAt(item.expectedReturnAt);
      if (at) {
        wanted.set(`${OUTING_ENDING}:${item.id}`, { id: item.id, at });
      }
    }
    const scheduled = await Notifications.getAllScheduledNotificationsAsync();
    await Promise.all(
      scheduled
        .filter((item) => item.identifier.startsWith(OUTING_ENDING))
        .map((item) => Notifications.cancelScheduledNotificationAsync(item.identifier)),
    );
    if (!returnRemindersOpen) {
      return;
    }
    const { status } = await Notifications.getPermissionsAsync();
    if (status !== "granted") {
      return;
    }
    for (const [identifier, slot] of wanted) {
      if (!returnRemindersOpen) {
        return;
      }
      await Notifications.scheduleNotificationAsync({
        identifier,
        content: {
          title: "Back in 15 minutes",
          body: "Your outing ends soon. Show your hall pass at the gate",
          data: { kind: "outing_ending", record_id: slot.id },
        },
        trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: slot.at },
      });
    }
  } catch {
    // Missing permission or a push service must not surface an error.
    ignore();
  }
}

/** Keeps the app icon badge in step with the inbox after a read. */
export function setBadge(count: number) {
  if (pushSupported && returnRemindersOpen) {
    void Notifications.setBadgeCountAsync(count).catch(ignore);
  }
}
