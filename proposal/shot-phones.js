const { chromium } = require("playwright");
const path = require("path");
const fs = require("fs");

const OUT = path.join(__dirname, "phones");
const URL = "http://127.0.0.1:8766/";

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({
    viewport: { width: 1600, height: 1100 },
    deviceScaleFactor: 2,
  });
  await page.goto(URL, { waitUntil: "networkidle" });
  await page.waitForSelector("#shot-wf1-home .device-shell");

  const ids = await page.$$eval("figure.device[id]", (els) => els.map((e) => e.id));
  console.log("ids", ids.length, ids.join(", "));

  for (const id of ids) {
    const handle = await page.$(`#${id} .device-shell`);
    if (!handle) {
      console.log("missing", id);
      continue;
    }
    await handle.scrollIntoViewIfNeeded();
    await page.waitForTimeout(80);
    const dest = path.join(OUT, `${id.replace("shot-", "")}.png`);
    await handle.screenshot({ path: dest, type: "png" });
    const box = await handle.boundingBox();
    console.log("ok", id, box && `${Math.round(box.width)}x${Math.round(box.height)}`);
  }

  await browser.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
