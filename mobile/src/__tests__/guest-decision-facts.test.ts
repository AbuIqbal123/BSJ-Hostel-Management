import { describe, expect, it } from "@jest/globals";

import { readGuestDecisions } from "@/guest-decisions";
import { guestDecisionFacts, readGuestDetail } from "@/staff";

const WHEN = "2026-09-30T13:30:00Z";
const APPROVED = "Zara Ahmed approved · 30 September 2026, 7:00 PM";
const DECLINED = "Zara Ahmed declined · 30 September 2026, 7:00 PM";
const PROVOST = "Halima Begum approved · 30 September 2026, 7:00 PM";

function decision(role: "roommate" | "provost", name: string, word: "approved" | "rejected") {
  return {
    role,
    actor_user_id: "11111111-1111-4111-8111-111111111111",
    actor_name: name,
    decision: word,
    decided_at: WHEN,
    note: null,
  };
}

function stay(over: Record<string, unknown> = {}) {
  return readGuestDetail({
    relation: "Sister",
    reason: "Family visit",
    inclusive_days: 2,
    decisions: [],
    roommate_approval_required: false,
    waiting_on_roommate: false,
    waiting_on_provost: true,
    ...over,
  });
}

describe("staff guest review decisions", () => {
  it("shows a roommate approval and a provost who is still waiting", () => {
    const detail = stay({
      decisions: [decision("roommate", "Zara Ahmed", "approved")],
      roommate_approval_required: true,
    });
    expect(detail).not.toBeNull();
    expect(guestDecisionFacts(detail!)).toEqual([
      { label: "Roommate", value: APPROVED },
      { label: "Provost", value: "waiting" },
    ]);
  });

  it("shows an approval and waiting when another roommate has not decided", () => {
    const detail = stay({
      decisions: [decision("roommate", "Zara Ahmed", "approved")],
      roommate_approval_required: true,
      waiting_on_roommate: true,
      waiting_on_provost: true,
    });
    expect(guestDecisionFacts(detail!)).toEqual([
      { label: "Roommate", value: APPROVED },
      { label: "Roommate", value: "waiting" },
      { label: "Provost", value: "waiting" },
    ]);
  });

  it("shows waiting for both when neither has approved", () => {
    const detail = stay({
      roommate_approval_required: true,
      waiting_on_roommate: true,
    });
    expect(guestDecisionFacts(detail!)).toEqual([
      { label: "Roommate", value: "waiting" },
      { label: "Provost", value: "waiting" },
    ]);
  });

  it("omits the roommate line when she lives alone", () => {
    const detail = stay();
    const notRequired = stay({ waiting_on_roommate: true, roommate_approval_required: false });
    expect(guestDecisionFacts(detail!)).toEqual([{ label: "Provost", value: "waiting" }]);
    expect(guestDecisionFacts(notRequired!)).toEqual([{ label: "Provost", value: "waiting" }]);
  });

  it("shows a decline and does not add waiting once the stay is no longer pending", () => {
    const detail = stay({
      decisions: [decision("roommate", "Zara Ahmed", "rejected")],
      roommate_approval_required: true,
      waiting_on_provost: false,
    });
    expect(guestDecisionFacts(detail!)).toEqual([{ label: "Roommate", value: DECLINED }]);
  });

  it("keeps a provost approval ahead of a roommate who is still waiting", () => {
    const detail = stay({
      decisions: [decision("provost", "Halima Begum", "approved")],
      roommate_approval_required: true,
      waiting_on_roommate: true,
      waiting_on_provost: false,
    });
    expect(guestDecisionFacts(detail!)).toEqual([
      { label: "Provost", value: PROVOST },
      { label: "Roommate", value: "waiting" },
    ]);
  });

  it("keeps the relation when the decision array is not decisions", () => {
    expect(readGuestDecisions([{ role: "host" }])).toBeNull();
    const detail = stay({ decisions: [{ role: "host" }] });
    expect(detail).toMatchObject({ relation: "Sister", decisions: [] });
    expect(readGuestDetail(null)).toBeNull();
  });
});
