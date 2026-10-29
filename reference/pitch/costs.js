/**
 * Running-cost estimate PDF for the hall app pitch.
 * Business language only. Figures are estimates.
 */
const PDFDocument = require("pdfkit");
const fs = require("fs");
const path = require("path");

const OUT = path.join(__dirname, "BSJ-Hall-App-Costs.pdf");

const ink = "#14261F";
const soft = "#44554C";
const forest = "#1F4D3A";
const line = "#D4DBD4";
const paper = "#F2F4F0";

const doc = new PDFDocument({
  size: "A4",
  margins: { top: 56, bottom: 56, left: 56, right: 56 },
  info: {
    Title: "Begum Sultan Jahan Hall — App running costs (estimate)",
    Author: "Begum Sultan Jahan Hall",
  },
});

const stream = fs.createWriteStream(OUT);
doc.pipe(stream);

function heading(text) {
  doc.fillColor(ink).font("Times-Bold").fontSize(22).text(text, { align: "left" });
  doc.moveDown(0.4);
}

function body(text) {
  doc.fillColor(soft).font("Helvetica").fontSize(11).text(text, { align: "left", lineGap: 3 });
  doc.moveDown(0.6);
}

function label(text) {
  doc.fillColor(forest).font("Helvetica-Bold").fontSize(10).text(text.toUpperCase(), { characterSpacing: 0.6 });
  doc.moveDown(0.35);
}

heading("Begum Sultan Jahan Hall");
doc.fillColor(forest).font("Helvetica").fontSize(12).text("Aligarh Muslim University");
doc.moveDown(0.3);
doc.fillColor(ink).font("Times-Bold").fontSize(16).text("App costs — estimate");
doc.moveDown(0.8);

body(
  "Figures below are estimates for about 400 students. They are not a fixed quote. " +
    "Hosting is an India VPS so the app and its data stay in India and stay fast for campus use.",
);

label("One-time");
const oneTime = [
  ["App build", "₹75,000", "Can be paid in installments."],
  ["Google Play account", "₹2,100", "Once, for the hall’s Play Store listing."],
];

drawTable(oneTime, ["Item", "Amount", "Notes"]);

doc.moveDown(0.9);
label("Each year");
const yearly = [
  ["India VPS (app + database)", "₹15,000", "About ₹1,200 a month."],
  ["Apple App Store account", "₹8,500", "Yearly membership for iPhone listing."],
  ["Parent texts (optional)", "₹500", "Only when a student is late. Can be tuned."],
];
drawTable(yearly, ["Item", "Amount", "Notes"]);

doc.moveDown(1.0);
label("Running totals");

const totalsY = doc.y;
const boxW = (doc.page.width - 112 - 16) / 2;
drawTotalBox(56, totalsY, boxW, "Year 1", "₹26,100", "About ₹2,175 a month");
drawTotalBox(56 + boxW + 16, totalsY, boxW, "Each year after", "₹24,000", "About ₹2,000 a month");

doc.y = totalsY + 118;
doc.moveDown(0.4);

body(
  "Year 1 includes the Play Store fee. Later years do not. " +
    "The ₹75,000 build fee is separate from these running totals.",
);

body(
  "Parent texts: the hall can turn this on and set how it is used. " +
    "It is not required for the app to run day to day.",
);

doc.moveDown(0.5);
doc.fillColor(soft).font("Helvetica").fontSize(9)
  .text("Estimate only. Actual hosting and store fees can change with the provider and the exchange rate.", {
    align: "left",
  });

doc.end();

function drawTable(rows, headers) {
  const x = 56;
  const widths = [220, 90, 185];
  const rowH = 28;
  let y = doc.y;

  doc.save();
  doc.rect(x, y, widths.reduce((a, b) => a + b, 0), rowH).fill(forest);
  doc.fillColor("#F7F4EA").font("Helvetica-Bold").fontSize(10);
  let cx = x;
  headers.forEach((h, i) => {
    doc.text(h, cx + 8, y + 9, { width: widths[i] - 16, align: i === 1 ? "right" : "left" });
    cx += widths[i];
  });
  y += rowH;

  rows.forEach((row, idx) => {
    doc.rect(x, y, widths.reduce((a, b) => a + b, 0), rowH).fill(idx % 2 === 0 ? "#FFFFFF" : paper);
    doc.strokeColor(line).lineWidth(0.5)
      .moveTo(x, y + rowH).lineTo(x + widths.reduce((a, b) => a + b, 0), y + rowH).stroke();
    cx = x;
    row.forEach((cell, i) => {
      doc.fillColor(ink).font(i === 0 ? "Helvetica-Bold" : "Helvetica").fontSize(10);
      doc.text(cell, cx + 8, y + 9, { width: widths[i] - 16, align: i === 1 ? "right" : "left" });
      cx += widths[i];
    });
    y += rowH;
  });
  doc.restore();
  doc.y = y + 4;
}

function drawTotalBox(x, y, w, title, amount, month) {
  doc.save();
  doc.roundedRect(x, y, w, 100, 6).fill("#FFFFFF");
  doc.roundedRect(x, y, w, 100, 6).strokeColor(line).lineWidth(1).stroke();
  doc.fillColor(forest).font("Helvetica-Bold").fontSize(10).text(title.toUpperCase(), x + 16, y + 16);
  doc.fillColor(ink).font("Times-Bold").fontSize(26).text(amount, x + 16, y + 38);
  doc.fillColor(soft).font("Helvetica").fontSize(11).text(month, x + 16, y + 72);
  doc.restore();
}

stream.on("finish", () => {
  console.log("Wrote", OUT);
});
