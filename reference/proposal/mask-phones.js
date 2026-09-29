const sharp = require("sharp");
const fs = require("fs");
const path = require("path");

const DIR = path.join(__dirname, "phones");
const keep = new Set([
  "wf1-home.png","wf1-plan.png","wf1-ready.png","wf1-qr.png","wf1-exit.png",
  "wf2-outside.png","wf2-return.png","wf2-late.png","wf2-details.png","wf2-sms.png",
  "wf3-home.png","wf3-type.png","wf3-latenight.png","wf3-homegoing.png","wf3-pending.png","wf3-review.png","wf3-approved.png",
  "wf4-home.png","wf4-scanner.png","wf4-exit.png","wf4-return.png","wf4-error.png",
  "wf5-dash.png","wf5-late.png","wf5-resident.png","wf5-pending.png",
  "wf6-home.png","wf6-screen.png","wf6-confirm.png",
]);
const files = fs.readdirSync(DIR).filter((f) => keep.has(f));

(async () => {
  for (const f of files) {
    const src = path.join(DIR, f);
    const img = sharp(src);
    const { width, height } = await img.metadata();
    const r = Math.round(width * (56 / 412));
    const svg = Buffer.from(
      `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
        <rect x="0" y="0" width="${width}" height="${height}" rx="${r}" ry="${r}" fill="#fff"/>
      </svg>`
    );
    await img
      .ensureAlpha()
      .composite([{ input: svg, blend: "dest-in" }])
      .png()
      .toFile(src + ".tmp.png");
    fs.renameSync(src + ".tmp.png", src);
    console.log("masked", f, width, height, "r", r);
  }
})();
