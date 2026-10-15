import { describe, expect, it } from "@jest/globals";
import { routeSettled } from "@/launch";

const resident = { role: "resident" as const };
const warden = { role: "warden" as const };

describe("routeSettled for a signed-in user", () => {
  it("settles on a top-level screen opened by link, such as change-password", () => {
    expect(routeSettled(true, resident, "change-password", false)).toBe(true);
    expect(routeSettled(true, warden, "change-password", false)).toBe(true);
  });

  it("settles on the home group", () => {
    expect(routeSettled(true, resident, "(resident)", false)).toBe(true);
    expect(routeSettled(true, warden, "staff", false)).toBe(true);
  });

  it("waits while the launch redirect is still leaving index, sign-in or signup", () => {
    for (const here of ["index", "sign-in", "onboard"]) {
      expect(routeSettled(true, resident, here, false)).toBe(false);
    }
  });
});

describe("routeSettled before the session is known or when signed out", () => {
  it("waits until the session is ready", () => {
    expect(routeSettled(false, resident, "(resident)", false)).toBe(false);
  });

  it("settles signed out only on sign-in or a signup opened from it", () => {
    expect(routeSettled(true, null, "sign-in", false)).toBe(true);
    expect(routeSettled(true, null, "onboard", true)).toBe(true);
    expect(routeSettled(true, null, "change-password", false)).toBe(false);
  });
});
