import { useEffect, useRef } from "react";
import * as Notifications from "expo-notifications";
import { router, type Href } from "expo-router";

import { hallRefresh } from "@/hall-refresh";
import { readUnreadCount } from "@/notices";
import { pushTarget, setBadge, type PushData } from "@/push";
import { responseKey } from "@/reminder";
import { useSession } from "@/session";

function withTap(target: string, key: string): string {
  const joiner = target.includes("?") ? "&" : "?";
  return `${target}${joiner}tap=${encodeURIComponent(key)}`;
}

/** Opens the screen a tapped push points at, cold start included, and marks that item read. */
export function PushRouter({ settled }: { settled: boolean }) {
  const { user, staffRequest } = useSession();
  const response = Notifications.useLastNotificationResponse();
  const handled = useRef<string | null>(null);

  useEffect(() => {
    if (!settled || !user) {
      return;
    }
    const received = Notifications.addNotificationReceivedListener(() => {
      hallRefresh();
    });
    return () => received.remove();
  }, [settled, user]);

  useEffect(() => {
    if (!settled || !user || !response) {
      return;
    }
    const key = responseKey(response.notification.request.identifier, response.notification.date);
    if (handled.current === key || response.actionIdentifier !== Notifications.DEFAULT_ACTION_IDENTIFIER) {
      return;
    }
    handled.current = key;
    const data = (response.notification.request.content.data ?? {}) as PushData;
    if (typeof data.notification_id === "string") {
      const base = user.role === "resident" ? "/me/notifications" : "/register/notifications";
      void staffRequest(`${base}/${encodeURIComponent(data.notification_id)}/read`, {}).then((reply) => {
        const count = reply.ok ? readUnreadCount(reply.data) : null;
        if (count !== null) {
          setBadge(count);
        } else {
          hallRefresh();
        }
      });
    }
    const target = pushTarget(user.role, data);
    if (target) {
      router.push(withTap(target, key) as Href);
    }
    void Notifications.clearLastNotificationResponseAsync().catch(() => undefined);
  }, [response, settled, staffRequest, user]);

  return null;
}
