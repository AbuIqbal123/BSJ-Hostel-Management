import { describe, expect, it } from "@jest/globals";

import { shouldRemoveGuestAfterDecision } from "@/staff";

describe("staff guest queue after a decision", () => {
  it("keeps a stay that is still pending", () => {
    expect(shouldRemoveGuestAfterDecision("pending")).toBe(false);
  });

  it("drops a stay once it is approved or rejected", () => {
    expect(shouldRemoveGuestAfterDecision("approved")).toBe(true);
    expect(shouldRemoveGuestAfterDecision("rejected")).toBe(true);
  });

  it("keeps a stay the decision did not finish", () => {
    expect(shouldRemoveGuestAfterDecision("cancelled")).toBe(false);
    expect(shouldRemoveGuestAfterDecision("")).toBe(false);
  });
});
