import { describe, expect, it } from "@jest/globals";

import { ROOM_FULL_MESSAGE, signupRecovery } from "@/onboard-room";

describe("signupRecovery", () => {
  it("sends a full room back to the room step and asks for a fresh list", () => {
    expect(signupRecovery(ROOM_FULL_MESSAGE)).toEqual({ step: 2, refetchRooms: true });
  });

  it("sends a taken enrolment back to the first step without reloading rooms", () => {
    expect(signupRecovery("That enrolment number is already an account")).toEqual({
      step: 0,
      refetchRooms: false,
    });
  });

  it("leaves any other refusal on the step she submitted", () => {
    expect(signupRecovery("The hall could not be reached")).toBeNull();
  });
});
