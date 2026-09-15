const sharp = require("sharp");
const fs = require("fs");
const path = require("path");

const SRC = "/Users/abu/Desktop/Coding/bsj-hostel-management/prototype/shots";
const OUT = "/Users/abu/Desktop/Coding/bsj-hostel-management/proposal/phones";

const jobs = [
  { file: "phone-home-2026-09-14T18-50-26-802Z.png", names: ["wf1-home", "wf1-plan", "wf1-ready", "wf1-qr"] },
  { file: "wf1-v3-2026-09-14T18-53-28-245Z.png", names: ["wf1-home-b", "wf1-plan-b", "wf1-ready-b", "wf1-qr-b", "wf1-exit"] },
  { file: "wf2-v3-2026-09-14T18-53-54-943Z.png", names: ["wf2-outside", "wf2-return", "wf2-late", "wf2-details", "wf2-sms"] },
  { file: "wf3-v3-2026-09-14T18-54-24-170Z.png", names: ["wf3-home", "wf3-type", "wf3-latenight", "wf3-homegoing", "wf3-pending"] },
  { file: "scanner-v6-2026-09-14T18-58-42-942Z.png", names: ["wf4-home", "wf4-scanner", "wf4-exit", "wf4-return"] },
  { file: "gate-error-2026-09-14T18-59-01-313Z.png", names: ["wf4-exit-b", "wf4-return-b", "wf4-error"] },
  { file: "wf5-v3-2026-09-14T18-55-08-086Z.png", names: ["wf5-dash", "wf5-late", "wf5-resident", "wf5-pending"] },
  { file: "wf6-v3-2026-09-14T18-55-31-019Z.png", names: ["wf6-home", "wf6-screen", "wf6-confirm"] },
  { file: "sms-v6-2026-09-14T18-59-17-320Z.png", names: ["wf2-late-b", "wf2-details-b", "wf2-sms-b"] },
];

function isBezel(r, g, b) {
  return r < 42 && g < 48 && b < 46;
}

function px(data, width, channels, x, y) {
  const i = (y * width + x) * channels;
  return [data[i], data[i + 1], data[i + 2]];
}

async function findPhones(file) {
  const { data, info } = await sharp(file).raw().toBuffer({ resolveWithObject: true });
  const { width, height, channels } = info;

  const colDark = new Array(width).fill(0);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * channels;
      if (isBezel(data[i], data[i + 1], data[i + 2])) colDark[x]++;
    }
  }

  // Thin vertical chrome (phone bezels), not the dark board rail.
  const edges = [];
  let x = 0;
  while (x < width) {
    if (colDark[x] > height * 0.45) {
      const x0 = x;
      while (x < width && colDark[x] > height * 0.35) x++;
      const w = x - x0;
      if (w >= 3 && w <= 36) edges.push({ x: x0, w, mid: x0 + w / 2, dark: colDark[x0] });
    } else {
      x++;
    }
  }

  const phones = [];
  const used = new Set();
  for (let i = 0; i < edges.length; i++) {
    if (used.has(i)) continue;
    for (let j = i + 1; j < edges.length; j++) {
      const span = edges[j].mid - edges[i].mid;
      if (span < 360 || span > 480) continue;
      const left = Math.round(edges[i].x);
      const right = Math.round(edges[j].x + edges[j].w);
      const phoneW = right - left;
      const lx = Math.min(width - 1, left + 8);

      let top = 0;
      for (let y = 0; y < height; y++) {
        const p = px(data, width, channels, lx, y);
        if (isBezel(p[0], p[1], p[2])) {
          top = y;
          break;
        }
      }
      let bottom = height - 1;
      for (let y = height - 1; y > top; y--) {
        const p = px(data, width, channels, lx, y);
        if (isBezel(p[0], p[1], p[2])) {
          bottom = y;
          break;
        }
      }
      const h = bottom - top + 1;
      const aspect = h / phoneW;
      if (phoneW > 280 && h > 560 && aspect > 1.75 && aspect < 2.35) {
        phones.push({ x: left, y: top, w: phoneW, h, aspect });
        used.add(i);
        used.add(j);
        break;
      }
    }
  }

  phones.sort((a, b) => a.x - b.x);
  const unique = [];
  for (const p of phones) {
    const prev = unique[unique.length - 1];
    if (prev && Math.abs(p.x - prev.x) < 40) continue;
    unique.push(p);
  }
  return { width, height, phones: unique };
}

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  for (const job of jobs) {
    const src = path.join(SRC, job.file);
    const { phones, width, height } = await findPhones(src);
    console.log(job.file, `${width}x${height}`, "phones", phones.length, phones.map((p) => `${p.w}x${p.h}@${p.x},${p.y}`).join(" | "));
    const n = Math.min(phones.length, job.names.length);
    for (let i = 0; i < n; i++) {
      const p = phones[i];
      const dest = path.join(OUT, job.names[i] + ".png");
      await sharp(src).extract({ left: p.x, top: p.y, width: p.w, height: p.h }).png().toFile(dest);
    }
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
