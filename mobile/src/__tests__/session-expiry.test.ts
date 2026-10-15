import { describe, expect, it } from "@jest/globals";

import { refreshEffect, singleFlight } from "@/session-refresh";

describe("refreshEffect", () => {
  const sent = "refresh-a";

  it("ends the session on 401", () => {
    expect(refreshEffect(401, sent, sent)).toBe("end");
  });

  it("keeps the session on a network error, 500, 429, 400 and 422", () => {
    for (const status of ["network", 500, 503, 429, 400, 422] as const) {
      expect(refreshEffect(status, sent, sent)).toBe("keep");
    }
  });

  it("applies a 200", () => {
    expect(refreshEffect(200, sent, sent)).toBe("apply");
  });

  it("keeps a newer session instead of ending or overwriting it", () => {
    expect(refreshEffect(401, sent, "refresh-b")).toBe("keep");
    expect(refreshEffect(200, sent, "refresh-b")).toBe("keep");
    expect(refreshEffect(401, sent, null)).toBe("keep");
  });
});

describe("one refresh for parallel 401s", () => {
  it("shares one in-flight call", async () => {
    const slot: { current: Promise<string> | null } = { current: null };
    let calls = 0;
    const refresh = () =>
      singleFlight(slot, async () => {
        calls += 1;
        await new Promise((resolve) => setTimeout(resolve, 5));
        return "once";
      });
    const [first, second] = await Promise.all([refresh(), refresh()]);
    expect(calls).toBe(1);
    expect(first).toBe("once");
    expect(second).toBe("once");
  });
});
