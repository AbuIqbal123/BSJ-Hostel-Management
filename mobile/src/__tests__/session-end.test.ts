import { describe, expect, it } from "@jest/globals";

import { runEach } from "@/session-refresh";

type Phone = {
  closed: boolean;
  reminders: string[];
  badge: number;
  banners: number;
  lastTap: string | null;
  pushToken: string | null;
  session: string | null;
};

function phone(): Phone {
  return {
    closed: false,
    reminders: ["outing-ending"],
    badge: 3,
    banners: 1,
    lastTap: "tap",
    pushToken: "ExponentPushToken[test]",
    session: "stored",
  };
}

/** The same order endSession uses. A thrown step does not skip the rest. */
async function endSession(store: Phone, fail: string | null = null): Promise<void> {
  await runEach([
    () => {
      store.closed = true;
      if (fail === "close") {
        throw new Error("close");
      }
    },
    () => {
      store.reminders = [];
      if (fail === "reminders") {
        throw new Error("reminders");
      }
    },
    () => {
      store.badge = 0;
      if (fail === "badge") {
        throw new Error("badge");
      }
    },
    () => {
      store.banners = 0;
    },
    () => {
      store.lastTap = null;
    },
    () => {
      store.pushToken = null;
    },
    () => {
      store.session = null;
    },
  ]);
}

describe("endSession", () => {
  it("clears reminders, the badge, banners, the last tap, the push token and the session", async () => {
    const store = phone();
    await endSession(store);
    expect(store).toEqual({
      closed: true,
      reminders: [],
      badge: 0,
      banners: 0,
      lastTap: null,
      pushToken: null,
      session: null,
    });
  });

  it("finishes the later steps when an earlier step throws", async () => {
    const store = phone();
    await endSession(store, "reminders");
    expect(store.closed).toBe(true);
    expect(store.session).toBeNull();
    expect(store.pushToken).toBeNull();
    expect(store.badge).toBe(0);
  });

  it("is safe to run again after the session has already ended", async () => {
    const store = phone();
    await endSession(store);
    await endSession(store);
    expect(store.session).toBeNull();
    expect(store.pushToken).toBeNull();
    expect(store.reminders).toEqual([]);
  });
});
