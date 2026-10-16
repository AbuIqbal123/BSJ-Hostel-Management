import { describe, expect, it } from "@jest/globals";

import {
  LATE_PLACEHOLDERS,
  REGISTER_CSV_HEADER,
  REISSUE_CONFIRM,
  RESET_CONFIRM,
  RETURN_PLACEHOLDERS,
  clockLabel,
  hiddenFromResidents,
  hoursFromFields,
  hoursPatch,
  noticesPatch,
  officeMessage,
  parseClock,
  parseSeason,
  passwordBody,
  readAudit,
  readBlocks,
  readCreatedResident,
  readHours,
  readNotices,
  readPage,
  readPlaces,
  readResident,
  readSms,
  readStaffAccount,
  registerCsv,
  residentCatalog,
  residentCreate,
  residentPatch,
  runsOffice,
  seasonLabel,
  staffCreate,
  staffPatch,
  templateProblem,
  type HallHours,
  type OfficeResident,
  type ResidentDraft,
} from "@/office";

const HOURS: HallHours = {
  hallName: "Begum Sultan Jahan Hall",
  universityName: "Aligarh Muslim University",
  timezone: "Asia/Kolkata",
  graceMinutes: 30,
  summerStart: "06:30",
  summerEnd: "18:30",
  winterStart: "06:30",
  winterEnd: "17:30",
  summerSeason: "04-01",
  winterSeason: "10-01",
  permissionLeadMinutes: 30,
  guestMaxDays: 7,
  guestMinLeadDays: 1,
  scanWindowSeconds: 60,
};

const RESIDENT: OfficeResident = {
  id: "11111111-1111-4111-8111-111111111111",
  fullName: "Amina Khan",
  enrolmentNumber: "GK1234",
  course: "MBBS",
  roomId: "22222222-2222-4222-8222-222222222222",
  roomLabel: "B-204",
  phone: "+919811112222",
  guardianName: "Yusuf Khan",
  guardianPhone: "+919876543210",
  status: "active",
  presence: "inside",
};

function draft(over: Partial<ResidentDraft> = {}): ResidentDraft {
  return {
    fullName: RESIDENT.fullName,
    enrolmentNumber: RESIDENT.enrolmentNumber,
    course: RESIDENT.course ?? "",
    roomId: RESIDENT.roomId,
    phone: RESIDENT.phone ?? "",
    guardianName: RESIDENT.guardianName,
    guardianPhone: RESIDENT.guardianPhone,
    status: RESIDENT.status,
    temporaryPassword: "Correct-Horse-1",
    ...over,
  };
}

describe("hall office display", () => {
  it("shows outing hours on a 12-hour clock and seasons as day and month", () => {
    expect(clockLabel("06:30")).toBe("6:30 AM");
    expect(clockLabel("18:30")).toBe("6:30 PM");
    expect(clockLabel("17:30")).toBe("5:30 PM");
    expect(clockLabel("00:00")).toBe("12:00 AM");
    expect(clockLabel("12:00")).toBe("12:00 PM");
    expect(parseClock("6:30 PM")).toBe("18:30");
    expect(parseClock("12:00 AM")).toBe("00:00");
    expect(parseClock("18:30")).toBe("18:30");
    expect(parseClock("13:30 AM")).toBeNull();
    expect(seasonLabel("04-01")).toBe("01 April");
    expect(seasonLabel("10-01")).toBe("01 October");
    expect(parseSeason("01 April")).toBe("04-01");
    expect(parseSeason("1 October")).toBe("10-01");
    expect(parseSeason("02-30")).toBeNull();
  });

  it("keeps inactive destinations in the office list and out of the resident catalog", () => {
    const places = readPlaces({
      items: [
        { id: "a", name: "Library", source: "preset", status: "active" },
        { id: "b", name: "Old market", source: "preset", status: "inactive" },
        { id: "c", name: "Other", source: "custom", status: "active" },
      ],
    });
    expect(places).toHaveLength(3);
    expect(places?.filter(hiddenFromResidents).map((place) => place.name)).toEqual(["Old market"]);
    expect(residentCatalog(places ?? []).map((place) => place.name)).toEqual(["Library", "Other"]);
  });

  it("sends only the hall settings that changed, and never the timezone", () => {
    const next = { ...HOURS, graceMinutes: 45, summerEnd: "18:00" };
    expect(hoursPatch(HOURS, next)).toEqual({ grace_minutes: 45, summer_outing_end: "18:00" });
    const edited = hoursFromFields(HOURS, {
      hallName: HOURS.hallName,
      universityName: HOURS.universityName,
      grace: "45",
      summerStart: "6:30 AM",
      summerEnd: "6:30 PM",
      winterStart: "6:30 AM",
      winterEnd: "5:30 PM",
      summerSeason: "01 April",
      winterSeason: "01 October",
      permissionLead: "30",
      guestMax: "7",
      guestLead: "1",
      scanWindow: "60",
    });
    expect(edited).toMatchObject({ graceMinutes: 45, summerEnd: "18:30", summerSeason: "04-01" });
    expect(
      hoursFromFields(HOURS, {
        hallName: HOURS.hallName,
        universityName: HOURS.universityName,
        grace: "200",
        summerStart: "6:30 AM",
        summerEnd: "6:30 PM",
        winterStart: "6:30 AM",
        winterEnd: "5:30 PM",
        summerSeason: "01 April",
        winterSeason: "01 October",
        permissionLead: "30",
        guestMax: "7",
        guestLead: "1",
        scanWindow: "60",
      }),
    ).toBe("Grace is from 0 to 180 minutes");
    expect(hoursPatch(HOURS, HOURS)).toEqual({});
    expect(readHours({ ...snakeHours(HOURS), timezone: "Asia/Kolkata" })?.timezone).toBe("Asia/Kolkata");
  });

  it("keeps the SMS placeholders and confirms the two destructive actions", () => {
    expect(templateProblem("Hello {resident_name}", LATE_PLACEHOLDERS)).toBe(
      "Keep {room}, {expected_return_local}, {hall_name}",
    );
    expect(templateProblem("", RETURN_PLACEHOLDERS)).toBe("Write the message");
    expect(
      templateProblem(
        "{resident_name} {room} {returned_at_local} {hall_name}",
        RETURN_PLACEHOLDERS,
      ),
    ).toBeNull();
    expect(noticesPatch({ late: "a", back: "b" }, { late: "a", back: "c" })).toEqual({
      return_sms_template: "c",
    });
    expect(REISSUE_CONFIRM.message).toBe("The old QR stops working");
    expect(RESET_CONFIRM.message).toBe("Sessions end");
    expect(REISSUE_CONFIRM.message.endsWith(".")).toBe(false);
    expect(RESET_CONFIRM.message.endsWith(".")).toBe(false);
  });

  it("builds resident and staff writes without keeping a password on the account", () => {
    const created = residentCreate(draft());
    expect(created).toMatchObject({ temporary_password: "Correct-Horse-1", phone: "+919811112222" });
    expect(created).not.toHaveProperty("password");
    expect(residentCreate(draft({ phone: "9811112222" }))).toBe("Enter her phone with the country code");
    expect(residentPatch(RESIDENT, draft({ course: "", status: "suspended" }))).toEqual({
      course: null,
      status: "suspended",
    });
    expect(residentPatch(RESIDENT, draft())).toEqual({});
    const account = readResident({
      id: RESIDENT.id,
      full_name: RESIDENT.fullName,
      enrolment_number: RESIDENT.enrolmentNumber,
      course: RESIDENT.course,
      room_id: RESIDENT.roomId,
      room_label: RESIDENT.roomLabel,
      phone: RESIDENT.phone,
      guardian_name: RESIDENT.guardianName,
      guardian_phone: RESIDENT.guardianPhone,
      status: "active",
      presence: "inside",
    });
    expect(account).toEqual(RESIDENT);
    expect(readResident({ ...accountBody(), qr_payload: "bsj:v1:secret" })).toBeNull();
    const pass = readCreatedResident({
      account: accountBody(),
      hall_pass: { qr_payload: "bsj:v1:once", full_name: "Amina Khan", room_label: "B-204" },
    });
    expect(pass?.pass.qrPayload).toBe("bsj:v1:once");
    expect(pass?.account).not.toHaveProperty("qrPayload");
    const member = staffCreate({
      fullName: "Imran Qureshi",
      username: "imran.qureshi",
      role: "gate",
      jobTitle: "Gatekeeper",
      status: "active",
      temporaryPassword: "Correct-Horse-1",
    });
    expect(member).toMatchObject({ role: "gate", temporary_password: "Correct-Horse-1" });
    expect(member).not.toHaveProperty("password");
    expect(
      readStaffAccount({
        id: "s",
        full_name: "Imran Qureshi",
        username: "imran.qureshi",
        role: "gate",
        job_title: "Gatekeeper",
        status: "active",
        temporary_password: "Correct-Horse-1",
      }),
    ).toBeNull();
    expect(
      staffPatch(
        { id: "s", fullName: "Imran Qureshi", username: "imran.qureshi", role: "gate", jobTitle: "Gatekeeper", status: "active" },
        { fullName: "Imran Qureshi", username: "changed", role: "provost", jobTitle: "Senior gatekeeper", status: "suspended", temporaryPassword: "" },
      ),
    ).toEqual({ job_title: "Senior gatekeeper", status: "suspended" });
    expect(passwordBody("short")).toBe("Set a temporary password");
    expect(passwordBody("Correct-Horse-1")).toEqual({ temporary_password: "Correct-Horse-1" });
  });

  it("reads blocks, texts, and the audit log, and checks the register CSV header", () => {
    expect(
      readBlocks([
        { id: "b", code: "B", name: "Block B", floors: 4, room_count: 58, beds_per_room: 2, status: "active" },
      ])?.[0],
    ).toMatchObject({ code: "B", floors: 4 });
    expect(readNotices({ late_sms_template: "late", return_sms_template: "back" })).toEqual({
      late: "late",
      back: "back",
    });
    const texts = readPage(
      {
        total: 1,
        limit: 50,
        offset: 0,
        items: [
          {
            id: "m",
            outing_id: "o",
            resident_id: "r",
            resident_name: "Amina Khan",
            notice_type: "late_notice",
            recipient_phone: "+919876543210",
            body: "Late",
            status: "sent",
            created_at: "2026-10-05T13:30:00Z",
          },
        ],
      },
      readSms,
    );
    expect(texts?.items[0]).toMatchObject({ notice: "late_notice", residentName: "Amina Khan" });
    expect(
      readAudit({
        id: "e",
        occurred_at: "2026-10-05T13:30:00Z",
        actor_name: "Provost",
        action: "resident.updated",
        entity_type: "resident",
        entity_id: "r",
        summary: "Suspended Amina Khan",
        qr_payload: "bsj:v1:secret",
      }),
    ).toBeNull();
    expect(registerCsv(`${REGISTER_CSV_HEADER}\nresident,Amina`)).toContain("Amina");
    expect(registerCsv("name\nAmina")).toBeNull();
    expect(officeMessage("That room is not in use.")).toBe("That room is not in use");
    expect(officeMessage("Check the fields", { phone: ["Enter a phone with the country code."] })).toBe(
      "Enter a phone with the country code",
    );
    expect(runsOffice("provost")).toBe(true);
    expect(runsOffice("warden")).toBe(false);
    expect(runsOffice("gate")).toBe(false);
  });
});

function snakeHours(hours: HallHours) {
  return {
    hall_name: hours.hallName,
    university_name: hours.universityName,
    timezone: hours.timezone,
    grace_minutes: hours.graceMinutes,
    summer_outing_start: hours.summerStart,
    summer_outing_end: hours.summerEnd,
    winter_outing_start: hours.winterStart,
    winter_outing_end: hours.winterEnd,
    summer_season_start: hours.summerSeason,
    winter_season_start: hours.winterSeason,
    permission_lead_minutes: hours.permissionLeadMinutes,
    guest_max_inclusive_days: hours.guestMaxDays,
    guest_min_lead_days: hours.guestMinLeadDays,
    scan_duplicate_window_seconds: hours.scanWindowSeconds,
  };
}

function accountBody() {
  return {
    id: RESIDENT.id,
    full_name: RESIDENT.fullName,
    enrolment_number: RESIDENT.enrolmentNumber,
    course: RESIDENT.course,
    room_id: RESIDENT.roomId,
    room_label: RESIDENT.roomLabel,
    phone: RESIDENT.phone,
    guardian_name: RESIDENT.guardianName,
    guardian_phone: RESIDENT.guardianPhone,
    status: "active",
    presence: "inside",
  };
}
