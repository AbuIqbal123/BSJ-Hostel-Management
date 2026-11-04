import { describe, expect, it } from "@jest/globals";

import type { ListSnapshot } from "@/list-cache";
import {
  markNoticeReadInCache,
  markNoticesReadUpToInCache,
  noticeListKey,
  readNoticePage,
  readUnreadCount,
  type Notice,
} from "@/notices";

const when = "2026-10-15T08:16:00Z";

describe("readNoticePage", () => {
  it("keeps a waiting staff request open and closes one that is already decided", () => {
    const page = readNoticePage(
      {
        items: [
          {
            id: "wait",
            kind: "permission_requested",
            resident_name: "Aisha Khan",
            room_label: "A-12",
            block_name: "Block A",
            occurred_at: when,
            unread: true,
            needs_action: true,
            record_id: "perm-wait",
          },
          {
            id: "done",
            kind: "permission_requested",
            resident_name: "Fatima Khan",
            room_label: "B-3",
            occurred_at: when,
            unread: false,
            needs_action: false,
            outcome: "approved",
            decided_by_name: "Sara Malik",
            record_id: "perm-done",
          },
        ],
        next_cursor: "next",
      },
      "warden",
    );
    expect(page.next).toBe("next");
    expect(page.items[0]?.target).toBe("/staff/requests?tab=permissions&open=perm-wait");
    expect(page.items[0]?.title).toBe("Aisha Khan asked for a permission");
    expect(page.items[1]?.target).toBeNull();
    expect(page.items[1]?.status).toBe("Approved by Sara Malik");
  });

  it("still opens a late return after she is back", () => {
    const page = readNoticePage(
      {
        items: [
          {
            id: "late",
            kind: "resident_late",
            resident_name: "Aisha Khan",
            room_label: "A-12",
            occurred_at: when,
            unread: false,
            outcome: "returned",
            record_id: "outing",
          },
        ],
      },
      "provost",
    );
    expect(page.items[0]?.title).toBe("Aisha Khan was late back");
    expect(page.items[0]?.target).toBe("/staff/out?tab=late");
  });

  it("reads a resident decision and skips a kind the phone does not know", () => {
    const page = readNoticePage(
      {
        items: [
          {
            id: "note",
            kind: "permission_decided",
            outcome: "approved",
            place: "Library",
            decided_by_name: "Sara Malik",
            occurred_at: when,
            unread: true,
            record_id: "perm",
          },
          { id: "odd", kind: "hall_closed", occurred_at: when },
          { kind: "permission_decided", occurred_at: when },
        ],
      },
      "resident",
    );
    expect(page.items).toHaveLength(1);
    expect(page.items[0]?.title).toBe("Your permission was approved");
    expect(page.items[0]?.detail).toBe("Library");
    expect(page.items[0]?.status).toBe("By Sara Malik");
    expect(page.items[0]?.target).toBe("/permission?id=perm");
  });

  it("reads a guest stay and a late line for the resident", () => {
    const page = readNoticePage(
      {
        items: [
          {
            id: "stay",
            kind: "guest_stay_decided",
            outcome: "declined",
            guest_name: "Amina",
            decided_by_name: "Sara Malik",
            occurred_at: when,
            record_id: "stay",
          },
          {
            id: "stay-yes",
            kind: "guest_stay_decided",
            outcome: "approved",
            guest_name: "Noor",
            decided_by_name: "Halima Begum",
            occurred_at: when,
            record_id: "stay-yes",
          },
          {
            id: "late",
            kind: "resident_late",
            outcome: "returned",
            occurred_at: when,
            needs_action: false,
            record_id: "outing",
          },
        ],
      },
      "resident",
    );
    expect(page.items[0]?.title).toBe("Your guest stay has been rejected by Sara Malik");
    expect(page.items[0]?.detail).toBe("Amina");
    expect(page.items[1]?.title).toBe("Your guest stay has been approved by Halima Begum");
    expect(page.items[2]?.title).toBe("You were late back");
    expect(page.items[2]?.status).toBe("Back");
    expect(page.items[2]?.target).toBe("/pass");
  });

  it("reads a roommate request, her decision, and the host's notice", () => {
    const page = readNoticePage(
      {
        items: [
          {
            id: "ask",
            kind: "guest_stay_roommate_requested",
            guest_name: "Noor Khan",
            guest_start_date: "2026-10-02",
            guest_end_date: "2026-10-04",
            host_name: "Aisha Khan",
            occurred_at: when,
            unread: true,
            needs_action: true,
            record_id: "stay",
          },
          {
            id: "host",
            kind: "guest_stay_roommate_decided",
            outcome: "declined",
            actor_name: "Zaynab Ali",
            guest_name: "Noor Khan",
            guest_start_date: "2026-10-02",
            guest_end_date: "2026-10-04",
            occurred_at: when,
            record_id: "stay",
          },
          {
            id: "own",
            kind: "guest_stay_roommate_recorded",
            outcome: "approved",
            host_name: "Aisha Khan",
            guest_name: "Noor Khan",
            occurred_at: when,
            record_id: "stay",
          },
        ],
      },
      "resident",
    );
    expect(page.items[0]?.title).toBe("Your roommate has requested a guest stay");
    expect(page.items[0]?.detail).toBe("Noor Khan, 02 October 2026 to 04 October 2026");
    expect(page.items[0]?.target).toBe("/guest?id=stay");
    expect(page.items[1]?.title).toBe("Your roommate Zaynab Ali declined the guest stay");
    expect(page.items[2]?.title).toBe("You approved Aisha Khan's guest stay");
  });
});

describe("readUnreadCount", () => {
  it("accepts a zero count and refuses a missing or negative one", () => {
    expect(readUnreadCount({ unread_count: 0 })).toBe(0);
    expect(readUnreadCount({ unread_count: 3 })).toBe(3);
    expect(readUnreadCount({ unread_count: -1 })).toBeNull();
    expect(readUnreadCount({})).toBeNull();
    expect(readUnreadCount(null)).toBeNull();
  });
});

describe("notice list cache", () => {
  const card = (id: string, unread: boolean, at = when): Notice => ({
    id,
    title: id,
    detail: "",
    when: "",
    at,
    unread,
    needsAction: false,
    status: null,
    target: null,
  });

  it("keys All, Unread, and search apart so a return visit can skip the false empty", () => {
    expect(noticeListKey("all", "", null, null)).toBe("all|||");
    expect(noticeListKey("unread", "", null, null)).toBe("unread|||");
    expect(noticeListKey("all", "  Noor  ", "2026-10-01", null)).toBe("all|Noor|2026-10-01|");
    expect(noticeListKey("all", "a".repeat(100), null, null)).toBe(`all|${"a".repeat(80)}||`);
  });

  it("marks one card read across filters and drops it from Unread", () => {
    const cache = new Map<string, ListSnapshot<Notice>>([
      ["all|||", { rows: [card("a", true), card("b", true)], total: 2, error: null }],
      ["unread|||", { rows: [card("a", true), card("b", true)], total: 2, error: null }],
    ]);
    markNoticeReadInCache(cache, "a");
    expect(cache.get("all|||")?.rows?.map((row) => [row.id, row.unread])).toEqual([
      ["a", false],
      ["b", true],
    ]);
    expect(cache.get("unread|||")?.rows?.map((row) => row.id)).toEqual(["b"]);
  });

  it("marks every card at or before up_to read and clears Unread when none remain", () => {
    const cache = new Map<string, ListSnapshot<Notice>>([
      [
        "all|||",
        {
          rows: [card("new", true, "2026-10-16T00:00:00Z"), card("old", true, "2026-10-15T00:00:00Z")],
          total: 2,
          error: null,
        },
      ],
      [
        "unread|||",
        {
          rows: [card("new", true, "2026-10-16T00:00:00Z"), card("old", true, "2026-10-15T00:00:00Z")],
          total: 2,
          error: null,
        },
      ],
    ]);
    markNoticesReadUpToInCache(cache, "2026-10-16T00:00:00Z");
    expect(cache.get("all|||")?.rows?.every((row) => !row.unread)).toBe(true);
    expect(cache.get("unread|||")?.rows).toEqual([]);
  });
});
