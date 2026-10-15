import { describe, expect, it } from "@jest/globals";

import { registerPushToken } from "@/session-refresh";

describe("registerPushToken", () => {
  it("saves after 204", async () => {
    const calls: string[] = [];
    const outcome = await registerPushToken("token-a", async (token) => {
      calls.push(token);
      return 204;
    });
    expect(outcome).toBe("saved");
    expect(calls).toEqual(["token-a"]);
  });

  it("retries a 500 once, then saves", async () => {
    const statuses = [500, 204];
    const outcome = await registerPushToken("token-a", async () => statuses.shift() ?? 500);
    expect(outcome).toBe("saved");
    expect(statuses).toEqual([]);
  });

  it("stops after one failed retry", async () => {
    let calls = 0;
    const outcome = await registerPushToken("token-a", async () => {
      calls += 1;
      return 503;
    });
    expect(outcome).toBe("failed");
    expect(calls).toBe(2);
  });

  it("does not retry a 422", async () => {
    let calls = 0;
    const outcome = await registerPushToken("token-a", async () => {
      calls += 1;
      return 422;
    });
    expect(outcome).toBe("refused");
    expect(calls).toBe(1);
  });

  it("treats a thrown registration as a quiet failure and retries once", async () => {
    let calls = 0;
    const outcome = await registerPushToken("token-a", async () => {
      calls += 1;
      throw new Error("no firebase");
    });
    expect(outcome).toBe("failed");
    expect(calls).toBe(2);
  });
});
