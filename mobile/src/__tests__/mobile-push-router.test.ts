import { describe, expect, it } from "@jest/globals";

import { responseKey } from "@/reminder";

describe("responseKey", () => {
  it("keys a tap by the notification identifier and its date", () => {
    expect(responseKey("outing-ending:library", 1000)).toBe("outing-ending:library:1000");
    expect(responseKey("outing-ending:library", 2000)).not.toBe(responseKey("outing-ending:library", 1000));
  });

  it("keeps two different notifications apart when they share a date", () => {
    expect(responseKey("a", 1000)).not.toBe(responseKey("b", 1000));
  });
});
