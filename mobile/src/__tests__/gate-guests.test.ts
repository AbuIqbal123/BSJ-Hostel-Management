import { describe, expect, it } from "@jest/globals";

import {
  ALREADY_ARRIVED,
  NOT_EXPECTED,
  NOT_IN_HALL,
  SEND_TO_WARDEN,
  arrivalRefusal,
  departureRefusal,
  gateGuestLine,
  readGateGuests,
  readGateMessage,
  readOccupancy,
} from "@/gate-guests";

const guest = {
  id: "stay-1",
  guest_name: "Fatima Begum",
  host_name: "Aisha Khan",
  host_room_label: "B-204",
  guest_start_date: "2026-10-20",
  guest_end_date: "2026-10-22",
  payment_status: "unpaid",
  bucket: "expected",
};

describe("gate guests", () => {
  it("tells the gate to send an unpaid guest to the warden", () => {
    expect(arrivalRefusal("payment_required", "expected")).toBe(SEND_TO_WARDEN);
  });

  it("names a guest who is not expected, and one who has already arrived", () => {
    expect(arrivalRefusal("guest_not_expected", "expected")).toBe(NOT_EXPECTED);
    expect(arrivalRefusal("guest_not_expected", "in_hall")).toBe(ALREADY_ARRIVED);
    expect(arrivalRefusal("guest_not_expected", "should_have_left")).toBe(ALREADY_ARRIVED);
    expect(departureRefusal("guest_not_in_hall")).toBe(NOT_IN_HALL);
    expect(arrivalRefusal(null, "expected")).toBeNull();
  });

  it("reads a page with its total, and the dining counts", () => {
    const page = readGateGuests({ items: [guest], total: 60, limit: 50, offset: 0 });
    expect(page?.total).toBe(60);
    expect(page?.items[0]?.guestName).toBe("Fatima Begum");
    expect(gateGuestLine(page!.items[0]!)).toBe("Not paid");
    expect(readOccupancy({ guests_in_hall_count: 2, guests_should_have_left_count: 1 })).toEqual({
      inHall: 2,
      shouldHaveLeft: 1,
    });
    expect(readGateMessage({ message: "The guest is now in the hall." })).toBe("The guest is now in the hall.");
    expect(readGateGuests({ items: [guest] })).toBeNull();
  });

  it("keeps an in-hall line distinct from a guest who should have left", () => {
    expect(
      gateGuestLine({
        id: "1",
        guestName: "A",
        hostName: "B",
        hostRoom: "A-1",
        start: "2026-10-20",
        end: "2026-10-22",
        paymentStatus: "paid",
        bucket: "in_hall",
      }),
    ).toBe("In the hall");
    expect(
      gateGuestLine({
        id: "2",
        guestName: "A",
        hostName: "B",
        hostRoom: "A-1",
        start: "2026-10-20",
        end: "2026-10-22",
        paymentStatus: "paid",
        bucket: "should_have_left",
      }),
    ).toBe("Should have left");
  });
});
