/** Gate guest list, arrival, and departure. The page size is not a cap on guests. */

import { type Json, record, str } from "@/json";

export const SEND_TO_WARDEN = "Send this guest to the warden to pay";
export const NOT_EXPECTED = "That guest is not expected now";
export const ALREADY_ARRIVED = "This guest has already arrived";
export const NOT_IN_HALL = "That guest is not in the hall";

export type GateGuest = {
  id: string;
  guestName: string;
  hostName: string;
  hostRoom: string;
  start: string;
  end: string;
  paymentStatus: "paid" | "unpaid";
  bucket: string;
};

export type GateOccupancy = { inHall: number; shouldHaveLeft: number };

export function arrivalRefusal(code: string | null, bucket: string): string | null {
  if (code === "payment_required") {
    return SEND_TO_WARDEN;
  }
  if (code === "guest_not_expected") {
    return bucket === "in_hall" || bucket === "should_have_left" ? ALREADY_ARRIVED : NOT_EXPECTED;
  }
  return null;
}

export function departureRefusal(code: string | null): string | null {
  if (code === "guest_not_in_hall") {
    return NOT_IN_HALL;
  }
  return null;
}

export function gateGuestLine(guest: GateGuest): string {
  if (guest.bucket === "should_have_left") {
    return "Should have left";
  }
  if (guest.bucket === "in_hall") {
    return "In the hall";
  }
  return guest.paymentStatus === "paid" ? "Paid" : "Not paid";
}

function guest(item: Json): GateGuest | null {
  const payment = item.payment_status;
  if (payment !== "paid" && payment !== "unpaid") {
    return null;
  }
  const id = str(item.id);
  const guestName = str(item.guest_name);
  const hostName = str(item.host_name);
  const hostRoom = str(item.host_room_label);
  const start = str(item.guest_start_date);
  const end = str(item.guest_end_date);
  const bucket = str(item.bucket);
  if (!id || !guestName || !hostName || !hostRoom || !start || !end || !bucket) {
    return null;
  }
  return { id, guestName, hostName, hostRoom, start, end, paymentStatus: payment, bucket };
}

export function readGateGuests(value: unknown): { items: GateGuest[]; total: number } | null {
  const body = record(value);
  if (!body || !Array.isArray(body.items) || typeof body.total !== "number") {
    return null;
  }
  const items: GateGuest[] = [];
  for (const item of body.items) {
    const row = record(item);
    const parsed = row ? guest(row) : null;
    if (!parsed) {
      return null;
    }
    items.push(parsed);
  }
  return { items, total: body.total };
}

export function readOccupancy(value: unknown): GateOccupancy | null {
  const body = record(value);
  if (!body || typeof body.guests_in_hall_count !== "number" || typeof body.guests_should_have_left_count !== "number") {
    return null;
  }
  return { inHall: body.guests_in_hall_count, shouldHaveLeft: body.guests_should_have_left_count };
}

export function readGateMessage(value: unknown): string | null {
  const message = str(record(value)?.message);
  return message && message.length > 0 ? message : null;
}
