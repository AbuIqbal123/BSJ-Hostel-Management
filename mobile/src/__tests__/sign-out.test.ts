import { describe, expect, it } from "@jest/globals";

import { SIGNED_OUT_NOTICE, SIGNED_OUT_PARAM, signedOutNotice } from "@/sign-out";

describe("signedOutNotice", () => {
  it("names a deliberate sign-out for the sign-in screen", () => {
    expect(signedOutNotice(SIGNED_OUT_PARAM)).toBe(SIGNED_OUT_NOTICE);
    expect(signedOutNotice([SIGNED_OUT_PARAM])).toBe(SIGNED_OUT_NOTICE);
  });

  it("ignores other or missing params", () => {
    expect(signedOutNotice(undefined)).toBeNull();
    expect(signedOutNotice("")).toBeNull();
    expect(signedOutNotice("other")).toBeNull();
  });
});
