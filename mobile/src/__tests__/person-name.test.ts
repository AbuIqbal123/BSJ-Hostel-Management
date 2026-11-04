import { describe, expect, it } from "@jest/globals";
import { welcomeName } from "@/person-name";

describe("welcomeName", () => {
  it("keeps a single given name", () => {
    expect(welcomeName("Fatima")).toBe("Fatima");
  });

  it("uses only the first given name when a surname would wrap the greeting", () => {
    expect(welcomeName("Fatima Khan")).toBe("Fatima");
  });

  it("trims space and ignores extra parts", () => {
    expect(welcomeName("  Aisha Begum Noor  ")).toBe("Aisha");
  });

  it("returns empty when there is no name", () => {
    expect(welcomeName("   ")).toBe("");
  });
});
