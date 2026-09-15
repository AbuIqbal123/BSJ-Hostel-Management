/**
 * Begum Sultan Jahan Hall — hostel management app proposal
 * Plain walkthrough for hall staff. Workflows, screens, price.
 */

const pptxgen = require("pptxgenjs");
const path = require("path");

const PHONES = path.join(__dirname, "phones");
const OUT = path.join(__dirname, "BSJ-Hall-Movement-Proposal.pptx");

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
  forestDeep: "16382B",
  gold: "A68438",
  goldSoft: "D7C48A",
  mutedDark: "9AA89E",
  card: "13201A",
  line: "D4DBD4",
  white: "FFFFFF",
  late: "8C4A24",
  emergency: "6E2430",
};

const TITLE = "Georgia";
const BODY = "Calibri";

const PHONE_RATIO = 824 / 1734;

const pres = new pptxgen();
pres.title = "Begum Sultan Jahan Hall — Hostel Management App Proposal";
pres.author = "Begum Sultan Jahan Hall";
pres.subject = "Hostel management app proposal for Aligarh Muslim University";
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

const DEMO = "https://bsj-hostel-demo.vercel.app";

function footer(slide, n, dark, extra) {
  const muted = dark ? C.mutedDark : C.inkFaint;
  slide.addText("Begum Sultan Jahan Hall", {
    x: M,
    y: H - 0.38,
    w: extra ? 4.4 : 8,
    h: 0.22,
    fontFace: BODY,
    fontSize: 12,
    color: muted,
    margin: 0,
  });
  if (extra) {
    slide.addText(extra.label, {
      x: 5.1,
      y: H - 0.38,
      w: 6.8,
      h: 0.22,
      fontFace: BODY,
      fontSize: 12,
      color: dark ? C.goldSoft : C.forest,
      margin: 0,
      hyperlink: { url: extra.url },
    });
  }
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

function scenarioSlide({ n, title, steps, files, who, dark, demoPath }) {
  const s = pres.addSlide();
  s.background = { color: dark ? C.dark : C.paper };
  const ink = dark ? C.cream : C.ink;
  const soft = dark ? "C5CEC6" : C.inkSoft;
  const roleColor = dark ? C.goldSoft : C.forest;

  s.addText(title, {
    x: M,
    y: 0.16,
    w: 7.2,
    h: 0.36,
    fontFace: TITLE,
    fontSize: 22,
    color: ink,
    margin: 0,
  });

  const ph = 4.28;
  const pw = phoneSize(ph).w;
  const gap = 0.26;
  const rowW = 4 * pw + 3 * gap;
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
      x: x,
      y: 0.78,
      w: 0.24,
      h: 0.24,
      fill: { color: C.forest },
    });
    s.addText(String(i + 1), {
      x: x,
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

  footer(s, n, dark, demoPath ? { label: DEMO + "/" + demoPath, url: DEMO + "/" + demoPath } : null);
}

// ─────────────────────────────────────────────────────────────────────────────
// 01 Title
// ─────────────────────────────────────────────────────────────────────────────
{
  const s = pres.addSlide();
  s.background = { color: C.dark };

  s.addText("Begum Sultan Jahan Hall", {
    x: M, y: 1.15, w: 7.4, h: 0.7,
    fontFace: TITLE, fontSize: 32, color: C.cream, margin: 0,
  });
  s.addText("Aligarh Muslim University", {
    x: M, y: 1.88, w: 7.4, h: 0.36,
    fontFace: BODY, fontSize: 18, color: C.goldSoft, margin: 0,
  });
  s.addText("Hostel Management App Proposal", {
    x: M, y: 2.5, w: 7.4, h: 0.5,
    fontFace: BODY, fontSize: 22, color: C.cream, margin: 0,
  });

  s.addText("Built for", {
    x: M, y: 3.35, w: 7.4, h: 0.28,
    fontFace: BODY, fontSize: 14, color: C.mutedDark, margin: 0,
  });

  const roles = ["Resident", "Warden", "Gate staff", "Provost"];
  roles.forEach((r, i) => {
    const x = M + i * 1.72;
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, {
      x, y: 3.72, w: 1.58, h: 0.4,
      fill: { color: "1A2C24" },
      line: { color: C.gold, width: 1.1 },
      rectRadius: 0.18,
    });
    s.addText(r, {
      x, y: 3.72, w: 1.58, h: 0.4,
      fontFace: BODY, fontSize: 14, color: C.cream, align: "center", valign: "middle", margin: 0,
    });
  });

  s.addText("Try a demo", {
    x: M, y: 4.28, w: 7.4, h: 0.24,
    fontFace: BODY, fontSize: 13, color: C.mutedDark, margin: 0,
  });
  s.addText(DEMO.replace("https://", ""), {
    x: M, y: 4.52, w: 7.4, h: 0.32,
    fontFace: BODY, fontSize: 16, color: C.goldSoft, margin: 0,
    hyperlink: { url: DEMO },
  });

  addPhone(s, "wf1-home.png", 8.55, 0.55, 6.35);
  footer(s, 1, true, { label: DEMO.replace("https://", ""), url: DEMO });
}

// ─────────────────────────────────────────────────────────────────────────────
// 02 The case
// ─────────────────────────────────────────────────────────────────────────────
{
  const s = pres.addSlide();
  s.background = { color: C.paper };

  s.addText("The case", {
    x: M, y: 0.45, w: 12.2, h: 0.5,
    fontFace: TITLE, fontSize: 28, color: C.ink, margin: 0,
  });

  // Today
  s.addShape(pres.shapes.RECTANGLE, {
    x: M, y: 1.25, w: 5.9, h: 5.0,
    fill: { color: C.white },
    shadow: shadowCard(),
  });
  s.addShape(pres.shapes.RECTANGLE, {
    x: M, y: 1.25, w: 0.1, h: 5.0,
    fill: { color: C.forest },
  });
  s.addText("Today", {
    x: M + 0.45, y: 1.55, w: 5.1, h: 0.36,
    fontFace: BODY, fontSize: 16, color: C.forest, margin: 0,
  });
  s.addText("Movement is a paper register at the gate.", {
    x: M + 0.45, y: 2.15, w: 5.1, h: 2.2,
    fontFace: TITLE, fontSize: 24, color: C.ink, margin: 0,
  });

  // With the app
  s.addShape(pres.shapes.RECTANGLE, {
    x: M + 6.15, y: 1.25, w: 5.9, h: 5.0,
    fill: { color: C.white },
    shadow: shadowCard(),
  });
  s.addShape(pres.shapes.RECTANGLE, {
    x: M + 6.15, y: 1.25, w: 0.1, h: 5.0,
    fill: { color: C.forest },
  });
  s.addText("With the app", {
    x: M + 6.6, y: 1.55, w: 5.1, h: 0.36,
    fontFace: BODY, fontSize: 16, color: C.forest, margin: 0,
  });
  const appDoes = [
    "Students and admins check in and check out from one app.",
    "Residents request special permission.",
    "Wardens approve special permission.",
    "Parents are notified if a resident is late.",
  ];
  appDoes.forEach((t, i) => {
    const y = 2.1 + i * 0.9;
    s.addShape(pres.shapes.OVAL, {
      x: M + 6.6, y: y + 0.08, w: 0.16, h: 0.16,
      fill: { color: C.forest },
    });
    s.addText(t, {
      x: M + 6.92, y, w: 4.7, h: 0.8,
      fontFace: BODY, fontSize: 16, color: C.ink, margin: 0,
    });
  });
  footer(s, 2, false);
}

// ─────────────────────────────────────────────────────────────────────────────
// 03 How the hall pass works
// ─────────────────────────────────────────────────────────────────────────────
{
  const s = pres.addSlide();
  s.background = { color: C.dark };

  s.addText("How the hall pass works", {
    x: M, y: 0.32, w: 8.3, h: 0.46,
    fontFace: TITLE, fontSize: 26, color: C.cream, margin: 0,
  });
  s.addText("Every resident has a hall pass on the phone: a QR code. At the gate, staff scan this hall pass. The app already knows whether that resident is inside the hall or outside.", {
    x: M, y: 0.84, w: 8.3, h: 0.95,
    fontFace: BODY, fontSize: 15, color: "C5CEC6", margin: 0,
  });

  const loops = [
    {
      when: "If the resident is inside the hall",
      body: "The resident shows the hall pass. Gate staff scan it. The app records that the resident has gone out. Destination and return time were already set in the app.",
    },
    {
      when: "If the resident is outside",
      body: "The resident shows the same hall pass. Gate staff scan it. The app records that the resident has come back. Nothing extra to fill in.",
    },
  ];
  loops.forEach((row, i) => {
    const y = 1.95 + i * 2.2;
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, {
      x: M, y, w: 8.3, h: 2.05,
      fill: { color: C.card },
      rectRadius: 0.12,
    });
    s.addText(row.when, {
      x: M + 0.32, y: y + 0.22, w: 7.65, h: 0.4,
      fontFace: TITLE, fontSize: 18, color: C.goldSoft, margin: 0,
    });
    s.addText(row.body, {
      x: M + 0.32, y: y + 0.68, w: 7.65, h: 1.15,
      fontFace: BODY, fontSize: 15, color: "C5CEC6", margin: 0,
    });
  });

  addPhone(s, "wf1-qr.png", 9.95, 0.55, 6.35);
  footer(s, 3, true);
}

// ─────────────────────────────────────────────────────────────────────────────
// 04 Built for everyone
// ─────────────────────────────────────────────────────────────────────────────
{
  const s = pres.addSlide();
  s.background = { color: C.paper };

  s.addText("Built for everyone", {
    x: M, y: 0.38, w: 12.2, h: 0.5,
    fontFace: TITLE, fontSize: 28, color: C.ink, margin: 0,
  });

  const roles = [
    { name: "Resident", job: "Plans an outing, requests special permission, and shows the hall pass at the gate." },
    { name: "Warden", job: "Sees who is inside, outside, or late. Approves or rejects special permission." },
    { name: "Gate staff", job: "Scans the resident hall pass. The app records exit or return." },
    { name: "Provost", job: "Sees the whole hall. Can export the register." },
  ];
  roles.forEach((r, i) => {
    const x = M + (i % 2) * 6.15;
    const y = 1.15 + Math.floor(i / 2) * 2.7;
    s.addShape(pres.shapes.RECTANGLE, {
      x, y, w: 5.95, h: 2.5,
      fill: { color: C.white },
      shadow: shadowCard(),
    });
    s.addShape(pres.shapes.RECTANGLE, {
      x, y, w: 0.1, h: 2.5,
      fill: { color: C.forest },
    });
    s.addText(r.name, {
      x: x + 0.4, y: y + 0.35, w: 5.2, h: 0.45,
      fontFace: TITLE, fontSize: 22, color: C.ink, margin: 0,
    });
    s.addText(r.job, {
      x: x + 0.4, y: y + 1.0, w: 5.2, h: 1.05,
      fontFace: BODY, fontSize: 16, color: C.inkSoft, margin: 0,
    });
  });
  footer(s, 4, false);
}

// ─────────────────────────────────────────────────────────────────────────────
// 05 Scenario 1 — outing
// ─────────────────────────────────────────────────────────────────────────────
scenarioSlide({
  n: 5,
  title: "Scenario 1. Normal outing",
  who: ["Resident", "Resident", "Gate staff", "Resident"],
  steps: [
    "Sets destination and return time.",
    "Opens the hall pass at the gate.",
    "Scans the hall pass.",
    "Exit is recorded.",
  ],
  files: ["wf1-plan.png", "wf1-qr.png", "wf4-scanner.png", "wf1-exit.png"],
  dark: false,
  demoPath: "outing",
});

// ─────────────────────────────────────────────────────────────────────────────
// 06 Scenario 2 — return
// ─────────────────────────────────────────────────────────────────────────────
scenarioSlide({
  n: 6,
  title: "Scenario 2. A resident comes back",
  who: ["Resident", "Gate staff", "Warden", "Parent phone"],
  steps: [
    "Opens the same hall pass.",
    "Scans it. Return is recorded.",
    "If late, the warden sees the late list.",
    "A parent SMS is sent, then another on return.",
  ],
  files: ["wf2-outside.png", "wf2-return.png", "wf2-late.png", "wf2-sms.png"],
  dark: false,
  demoPath: "return",
});

// ─────────────────────────────────────────────────────────────────────────────
// 07 Scenario 3 — special permission
// ─────────────────────────────────────────────────────────────────────────────
scenarioSlide({
  n: 7,
  title: "Scenario 3. Special permission",
  who: ["Resident", "Resident", "Warden", "Resident"],
  steps: [
    "Chooses late-night or home going.",
    "Fills the form and sends it to the warden.",
    "Approves or rejects.",
    "If approved, the same hall pass is used at the gate.",
  ],
  files: ["wf3-type.png", "wf3-latenight.png", "wf3-review.png", "wf3-approved.png"],
  dark: false,
  demoPath: "permission",
});

// ─────────────────────────────────────────────────────────────────────────────
// 08 Scenario 4 — gate
// ─────────────────────────────────────────────────────────────────────────────
scenarioSlide({
  n: 8,
  title: "Scenario 4. Gate staff",
  who: ["Gate staff", "Gate staff", "Gate staff", "Gate staff"],
  steps: [
    "Opens Scan QR.",
    "Scans the resident hall pass.",
    "Shows Exit recorded or Return recorded.",
    "If the scan cannot be used, the screen says what to do.",
  ],
  files: ["wf4-home.png", "wf4-scanner.png", "wf4-exit.png", "wf4-error.png"],
  dark: true,
  demoPath: "gate",
});

// ─────────────────────────────────────────────────────────────────────────────
// 09 Scenario 5 — warden
// ─────────────────────────────────────────────────────────────────────────────
scenarioSlide({
  n: 9,
  title: "Scenario 5. Warden",
  who: ["Warden", "Warden", "Warden", "Warden"],
  steps: [
    "Opens the hall register.",
    "Opens the late list.",
    "Opens a resident record.",
    "Approves or rejects special permission.",
  ],
  files: ["wf5-dash.png", "wf5-late.png", "wf5-resident.png", "wf5-pending.png"],
  dark: false,
  demoPath: "warden",
});

// ─────────────────────────────────────────────────────────────────────────────
// 10 Optional — emergency
// ─────────────────────────────────────────────────────────────────────────────
{
  const s = pres.addSlide();
  s.background = { color: C.paper };

  s.addText("Optional", {
    x: M, y: 0.38, w: 6.8, h: 0.32,
    fontFace: BODY, fontSize: 14, color: C.late, margin: 0,
  });
  s.addText("Emergency", {
    x: M, y: 0.7, w: 6.8, h: 0.5,
    fontFace: TITLE, fontSize: 28, color: C.ink, margin: 0,
  });
  s.addText("A resident can alert the duty warden and the gate, and call from the phone. This is not a leave form.", {
    x: M, y: 1.35, w: 6.6, h: 1.15,
    fontFace: BODY, fontSize: 18, color: C.inkSoft, margin: 0,
  });
  s.addText("Skip this if the hall does not want it in the first version.", {
    x: M, y: 2.6, w: 6.6, h: 0.7,
    fontFace: BODY, fontSize: 16, italic: true, color: C.inkFaint, margin: 0,
  });

  addPhone(s, "wf6-screen.png", 8.2, 0.5, 6.4);
  footer(s, 10, false);
}

// ─────────────────────────────────────────────────────────────────────────────
// 11 What we will build
// ─────────────────────────────────────────────────────────────────────────────
{
  const s = pres.addSlide();
  s.background = { color: C.paper };

  s.addText("What we will build", {
    x: M, y: 0.38, w: 12.2, h: 0.5,
    fontFace: TITLE, fontSize: 28, color: C.ink, margin: 0,
  });

  const reqs = [
    "Normal outing: destination, return time, scan at the gate. No special permission.",
    "Return, including late return and parent SMS",
    "Special permission: late-night and home going",
    "Gate scanning",
    "Warden register: inside, outside, late, pending",
  ];
  reqs.forEach((t, i) => {
    const y = 1.1 + i * 0.78;
    s.addShape(pres.shapes.OVAL, {
      x: M, y: y + 0.08, w: 0.38, h: 0.38,
      fill: { color: C.forest },
    });
    s.addText(String(i + 1), {
      x: M, y: y + 0.08, w: 0.38, h: 0.38,
      fontFace: BODY, fontSize: 14, bold: true, color: C.cream, align: "center", valign: "middle", margin: 0,
    });
    s.addText(t, {
      x: M + 0.58, y, w: 12.0, h: 0.55,
      fontFace: BODY, fontSize: 20, color: C.ink, margin: 0, valign: "middle",
    });
  });

  s.addText("Optional: emergency contacts on the resident phone.", {
    x: M, y: 5.15, w: 12.2, h: 0.4,
    fontFace: BODY, fontSize: 15, color: C.inkSoft, margin: 0,
  });
  footer(s, 11, false);
}

// ─────────────────────────────────────────────────────────────────────────────
// 12 Price
// ─────────────────────────────────────────────────────────────────────────────
{
  const s = pres.addSlide();
  s.background = { color: C.paper };

  s.addText("Running cost (estimate)", {
    x: M, y: 0.22, w: 12.2, h: 0.38,
    fontFace: TITLE, fontSize: 26, color: C.ink, margin: 0,
  });
  s.addText("Estimate for 400 residents and 10 admins. iPhone and Android app. Developer cost to be confirmed.", {
    x: M, y: 0.6, w: 12.2, h: 0.32,
    fontFace: BODY, fontSize: 14, color: C.inkSoft, margin: 0,
  });

  const header = {
    fill: { color: C.forest },
    color: C.cream,
    bold: true,
    align: "left",
    valign: "middle",
    fontFace: BODY,
    fontSize: 12,
  };
  const headerR = { ...header, align: "right" };
  const cell = {
    fill: { color: C.white },
    color: C.ink,
    align: "left",
    valign: "middle",
    fontFace: BODY,
    fontSize: 13,
  };
  const cellR = { ...cell, align: "right" };
  const sum = {
    fill: { color: "E5EDE8" },
    color: C.ink,
    bold: true,
    align: "left",
    valign: "middle",
    fontFace: BODY,
    fontSize: 14,
  };
  const sumR = { ...sum, align: "right" };

  const rows = [
    [
      { text: "Item", options: header },
      { text: "Amount", options: headerR },
    ],
    [
      { text: "Developer cost, one-time", options: cell },
      { text: "To be confirmed", options: cellR },
    ],
    [
      { text: "India VPS, 2 GB, about ₹500 a month", options: cell },
      { text: "₹6,000 each year", options: cellR },
    ],
    [
      { text: "Parent SMS, late returns only", options: cell },
      { text: "₹2,000 each year", options: cellR },
    ],
    [
      { text: "App Store, Apple Developer $99 a year", options: cell },
      { text: "₹8,500 each year", options: cellR },
    ],
    [
      { text: "Play Store, Google $25 once", options: cell },
      { text: "₹2,100 in year 1", options: cellR },
    ],
    [
      { text: "Estimated total with Apple and Google accounts, year 1", options: sum },
      { text: "₹18,600", options: sumR },
    ],
    [
      { text: "Estimated total with Apple and Google accounts, each year after", options: sum },
      { text: "₹16,500", options: sumR },
    ],
  ];

  s.addTable(rows, {
    x: M,
    y: 0.96,
    w: 12.2,
    colW: [8.6, 3.6],
    border: [
      { pt: 0.5, color: C.line },
      { pt: 0.5, color: C.line },
      { pt: 0.5, color: C.line },
      { pt: 0.5, color: C.line },
    ],
    fontFace: BODY,
    valign: "middle",
    rowH: 0.38,
  });

  s.addText("With personal Apple and Google accounts, same as the ICACON Companion app, App Store and Play Store are ₹0. Running cost is then ₹8,000 a year.", {
    x: M, y: 4.12, w: 12.2, h: 0.42,
    fontFace: BODY, fontSize: 14, color: C.ink, margin: 0,
  });
  s.addText("India VPS: one 2 GB server in an Indian data centre (Mumbai or Bangalore) is about ₹500 a month, so ₹6,000 a year. It runs the app backend, the database, and a nightly backup. 400 residents and 10 admins fit on this size.", {
    x: M, y: 4.58, w: 12.2, h: 0.55,
    fontFace: BODY, fontSize: 13, color: C.inkSoft, margin: 0,
  });
  s.addText("Parent SMS: only if a resident is late. Two texts: one when grace ends, one when they return. About 8 late returns a night × 250 term days × 2 texts ≈ 4,000 SMS a year. Indian transactional SMS is about ₹0.20 each, about ₹800. We estimate ₹2,000 so a busier year still fits.", {
    x: M, y: 5.16, w: 12.2, h: 0.7,
    fontFace: BODY, fontSize: 13, color: C.inkSoft, margin: 0,
  });
  footer(s, 12, false);
}

pres.writeFile({ fileName: OUT }).then(() => {
  console.log("Wrote", OUT);
});
