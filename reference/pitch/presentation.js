/**
 * Begum Sultan Jahan Hall — hostel management app pitch
 * Real phone screenshots. Workflows for hall staff.
 */
const pptxgen = require("pptxgenjs");
const path = require("path");

const PHONES = path.join(__dirname, "phones");
const OUT = path.join(__dirname, "BSJ-Hall-App-Pitch.pptx");

const W = 13.3;
const H = 7.5;
const M = 0.55;

const C = {
  dark: "0C1612",
  paper: "F2F4F0",
  cream: "F7F4EA",
  ink: "14261F",
  inkSoft: "44554C",
  inkFaint: "6B7A72",
  forest: "1F4D3A",
  gold: "A68438",
  goldSoft: "D7C48A",
  mutedDark: "9AA89E",
  card: "13201A",
  line: "D4DBD4",
  white: "FFFFFF",
};

const TITLE = "Georgia";
const BODY = "Calibri";
const PHONE_RATIO = 824 / 1734;

const pres = new pptxgen();
pres.title = "Begum Sultan Jahan Hall — Hostel Management App";
pres.author = "Begum Sultan Jahan Hall";
pres.subject = "Pitch for the hall management app";
pres.defineLayout({ name: "BSJ_WIDE", width: W, height: H });
pres.layout = "BSJ_WIDE";

function shadowPhone() {
  return { type: "outer", color: "000000", blur: 16, offset: 6, angle: 135, opacity: 0.22 };
}
function shadowCard() {
  return { type: "outer", color: "14261F", blur: 12, offset: 3, angle: 135, opacity: 0.08 };
}
function phoneSize(h) {
  return { w: h * PHONE_RATIO, h };
}
function addPhone(slide, file, x, y, h) {
  const { w } = phoneSize(h);
  slide.addImage({
    path: path.join(PHONES, file),
    x,
    y,
    w,
    h,
    shadow: shadowPhone(),
  });
  return w;
}

function footer(slide, n, dark) {
  const muted = dark ? C.mutedDark : C.inkFaint;
  slide.addText("Begum Sultan Jahan Hall", {
    x: M,
    y: H - 0.38,
    w: 10,
    h: 0.22,
    fontFace: BODY,
    fontSize: 12,
    color: muted,
    margin: 0,
  });
  slide.addText(String(n), {
    x: W - M - 0.7,
    y: H - 0.38,
    w: 0.7,
    h: 0.22,
    fontFace: BODY,
    fontSize: 12,
    color: muted,
    align: "right",
    margin: 0,
  });
}

function scenarioSlide({ n, title, steps, files, who, dark }) {
  const s = pres.addSlide();
  s.background = { color: dark ? C.dark : C.paper };
  const ink = dark ? C.cream : C.ink;
  const soft = dark ? "C5CEC6" : C.inkSoft;
  const roleColor = dark ? C.goldSoft : C.forest;

  s.addText(title, {
    x: M,
    y: 0.16,
    w: 12.2,
    h: 0.36,
    fontFace: TITLE,
    fontSize: 22,
    color: ink,
    margin: 0,
  });

  const count = files.length;
  const ph = count >= 4 ? 4.28 : 4.6;
  const pw = phoneSize(ph).w;
  const gap = 0.26;
  const rowW = count * pw + (count - 1) * gap;
  let x = (W - rowW) / 2;

  files.forEach((f, i) => {
    s.addText(who[i], {
      x,
      y: 0.54,
      w: pw,
      h: 0.2,
      fontFace: BODY,
      fontSize: 12,
      bold: true,
      color: roleColor,
      margin: 0,
    });
    s.addShape(pres.shapes.OVAL, {
      x,
      y: 0.78,
      w: 0.24,
      h: 0.24,
      fill: { color: C.forest },
    });
    s.addText(String(i + 1), {
      x,
      y: 0.78,
      w: 0.24,
      h: 0.24,
      fontFace: BODY,
      fontSize: 11,
      bold: true,
      color: C.cream,
      align: "center",
      valign: "middle",
      margin: 0,
    });
    s.addText(steps[i], {
      x: x + 0.32,
      y: 0.76,
      w: pw - 0.32,
      h: 0.82,
      fontFace: BODY,
      fontSize: 12,
      color: soft,
      margin: 0,
      valign: "top",
    });
    addPhone(s, f, x, 1.68, ph);
    x += pw + gap;
  });

  footer(s, n, dark);
}

// 01 Title
{
  const s = pres.addSlide();
  s.background = { color: C.dark };
  s.addText("Begum Sultan Jahan Hall", {
    x: M, y: 1.35, w: 7.4, h: 0.7,
    fontFace: TITLE, fontSize: 32, color: C.cream, margin: 0,
  });
  s.addText("Aligarh Muslim University", {
    x: M, y: 2.1, w: 7.4, h: 0.36,
    fontFace: BODY, fontSize: 18, color: C.goldSoft, margin: 0,
  });
  s.addText("Hostel Management App", {
    x: M, y: 2.75, w: 7.4, h: 0.5,
    fontFace: BODY, fontSize: 22, color: C.cream, margin: 0,
  });
  s.addText("One app for students, the gate, and the provost.", {
    x: M, y: 3.45, w: 7.4, h: 0.4,
    fontFace: BODY, fontSize: 16, color: "C5CEC6", margin: 0,
  });
  addPhone(s, "resident-home.png", 8.55, 0.55, 6.35);
  footer(s, 1, true);
}

// 02 Who uses it
{
  const s = pres.addSlide();
  s.background = { color: C.paper };
  s.addText("Who uses it", {
    x: M, y: 0.4, w: 12.2, h: 0.5,
    fontFace: TITLE, fontSize: 28, color: C.ink, margin: 0,
  });

  const header = {
    fill: { color: C.forest },
    color: C.cream,
    bold: true,
    align: "left",
    valign: "middle",
    fontFace: BODY,
    fontSize: 15,
  };
  const cell = {
    fill: { color: C.white },
    color: C.ink,
    align: "left",
    valign: "middle",
    fontFace: BODY,
    fontSize: 16,
  };
  const cellSoft = { ...cell, color: C.inkSoft, fontSize: 15 };

  s.addTable(
    [
      [
        { text: "Role", options: header },
        { text: "Job", options: header },
      ],
      [
        { text: "Student", options: cell },
        {
          text: "Creates her account, plans ordinary outings, asks for special permission, and shows her hall pass at the gate.",
          options: cellSoft,
        },
      ],
      [
        { text: "Gate staff", options: cell },
        {
          text: "Scans the hall pass. The app records exit or return. Records guest arrival and departure.",
          options: cellSoft,
        },
      ],
      [
        { text: "Provost", options: cell },
        {
          text: "Sees who is inside, outside, or late. Approves special permission and guest stays. Runs the hall office.",
          options: cellSoft,
        },
      ],
    ],
    {
      x: M,
      y: 1.2,
      w: 12.2,
      colW: [2.4, 9.8],
      border: [
        { pt: 0.5, color: C.line },
        { pt: 0.5, color: C.line },
        { pt: 0.5, color: C.line },
        { pt: 0.5, color: C.line },
      ],
      fontFace: BODY,
      valign: "middle",
      rowH: [0.55, 1.35, 1.35, 1.35],
    },
  );
  footer(s, 2, false);
}

// 03 Student joins
scenarioSlide({
  n: 3,
  title: "Student joins",
  who: ["Student", "Student", "Student"],
  steps: [
    "Opens the app and signs in with her enrolment number.",
    "Or signs up: name, enrolment, phone, password, guardian, and room.",
    "Home shows her name, room, and any planned outing.",
  ],
  files: ["sign-in.png", "onboard.png", "resident-home.png"],
  dark: false,
});

// 04 Outing
scenarioSlide({
  n: 4,
  title: "Ordinary outing",
  who: ["Student", "Student", "Gate staff", "Student"],
  steps: [
    "Plans where she is going and when she will be back.",
    "Opens her hall pass. The same QR is used both ways.",
    "Scans the pass. Exit is recorded.",
    "Home shows she is outside until she returns.",
  ],
  files: ["resident-home.png", "hall-pass.png", "gate-home.png", "resident-outside.png"],
  dark: false,
});

// 05 Return
scenarioSlide({
  n: 5,
  title: "Return",
  who: ["Student", "Gate staff", "Student"],
  steps: [
    "Shows the same hall pass at the gate.",
    "Scan records the return. Presence is inside again.",
    "Home is clear for the next plan.",
  ],
  files: ["hall-pass-outside.png", "gate-after-return.png", "resident-returned.png"],
  dark: false,
});

// 06 Special permissions (incl guest + notice)
scenarioSlide({
  n: 6,
  title: "Special permission",
  who: ["Student", "Student", "Provost", "Student"],
  steps: [
    "Asks for late-night or home going, or a guest stay.",
    "Guest stays sit with special permission. Payment is at the office, outside the app.",
    "Approves or rejects the request.",
    "She is told on her phone when it is decided.",
  ],
  files: ["permissions.png", "guest-list.png", "provost-decide.png", "notices.png"],
  dark: false,
});

// 07 Gate
scenarioSlide({
  n: 7,
  title: "Gate staff",
  who: ["Gate staff", "Gate staff", "Gate staff"],
  steps: [
    "Home is ready to scan.",
    "Opens Scan and reads the hall pass.",
    "Exit or return is written into the register.",
  ],
  files: ["gate-home.png", "gate-scan.png", "gate-after-exit.png"],
  dark: true,
});

// 08 Provost
scenarioSlide({
  n: 8,
  title: "Provost",
  who: ["Provost", "Provost", "Provost", "Provost"],
  steps: [
    "Dashboard: who is out, what is waiting.",
    "Requests queue for permission and guests.",
    "Register: inside, outside, late.",
    "Hall office: people, rooms, and settings.",
  ],
  files: ["provost-home.png", "provost-requests.png", "provost-register.png", "provost-office.png"],
  dark: false,
});

pres.writeFile({ fileName: OUT }).then(() => {
  console.log("Wrote", OUT);
});
