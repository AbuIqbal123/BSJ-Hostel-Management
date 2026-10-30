/**
 * Capture real Expo web screens into phone-framed PNGs for the pitch deck.
 * Needs API :8000, Expo :8081, same-origin proxy :9090, SecureStore web stub,
 * and /tmp/bsj-seed-passwords.json.
 */
const { chromium, devices } = require("playwright");
const fs = require("fs");
const path = require("path");

const OUT = path.join(__dirname, "phones");
const APP = "http://127.0.0.1:9090";
const PASS = JSON.parse(fs.readFileSync("/tmp/bsj-seed-passwords.json", "utf8"));

fs.mkdirSync(OUT, { recursive: true });

async function dismissOverlay(page) {
  await page.evaluate(() => {
    const el = document.getElementById("error-overlay");
    if (el) el.remove();
  }).catch(() => {});
}

async function clearSession(page) {
  await page.goto(APP, { waitUntil: "domcontentloaded", timeout: 120000 });
  await page.evaluate(() => {
    try {
      localStorage.clear();
      sessionStorage.clear();
    } catch (_) {}
  });
  await page.reload({ waitUntil: "networkidle" }).catch(() => {});
  await page.waitForTimeout(1200);
  await dismissOverlay(page);
}

async function signIn(page, username, password) {
  await clearSession(page);
  await page.waitForSelector("text=Sign in", { timeout: 60000 });
  await dismissOverlay(page);
  const inputs = page.locator("input");
  await inputs.nth(0).fill(username);
  await inputs.nth(1).fill(password);
  await page.getByText("Sign in", { exact: true }).click({ force: true });
  await page.waitForTimeout(2800);
  await dismissOverlay(page);
}

async function framePhone(browser, rawBuf, outName) {
  const page = await browser.newPage({
    viewport: { width: 460, height: 960 },
    deviceScaleFactor: 2,
  });
  const b64 = rawBuf.toString("base64");
  await page.setContent(`<!doctype html><html><head><style>
    html,body{margin:0;background:#dfe4dc;display:flex;align-items:center;justify-content:center;height:100%;}
    .shell{width:390px;height:844px;border-radius:44px;background:#0c1612;padding:12px;box-shadow:0 18px 40px rgba(0,0,0,.28);}
    .screen{width:100%;height:100%;border-radius:34px;overflow:hidden;background:#f7f4ea;}
    img{width:100%;height:100%;object-fit:cover;object-position:top;display:block;}
  </style></head><body>
    <div class="shell"><div class="screen"><img src="data:image/png;base64,${b64}"/></div></div>
  </body></html>`);
  await page.waitForTimeout(80);
  const dest = path.join(OUT, `${outName}.png`);
  await page.locator(".shell").screenshot({ path: dest, type: "png" });
  await page.close();
  console.log("ok", outName);
}

async function capture(page, browser, name) {
  await dismissOverlay(page);
  await page.waitForTimeout(400);
  const raw = await page.screenshot({ type: "png" });
  await framePhone(browser, raw, name);
}

async function tapTab(page, label) {
  await page.getByText(label, { exact: true }).last().click({ force: true });
  await page.waitForTimeout(1400);
  await dismissOverlay(page);
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  const phone = { ...devices["iPhone 14"], deviceScaleFactor: 2 };

  async function withPhone(fn) {
    const context = await browser.newContext(phone);
    const page = await context.newPage();
    try {
      await fn(page);
    } finally {
      await context.close();
    }
  }

  await withPhone(async (page) => {
    await clearSession(page);
    await page.waitForSelector("text=Sign in", { timeout: 60000 });
    await capture(page, browser, "sign-in");
  });

  await withPhone(async (page) => {
    await clearSession(page);
    await page.waitForSelector("text=Sign up", { timeout: 60000 });
    await page.getByText("Sign up", { exact: true }).click({ force: true });
    await page.waitForTimeout(1600);
    await capture(page, browser, "onboard");
  });

  await withPhone(async (page) => {
    await signIn(page, PASS.RESIDENT_USER, PASS.RESIDENT_PASS);
    await page.waitForSelector("text=Aisha", { timeout: 30000 });
    await capture(page, browser, "resident-home");
  });

  await withPhone(async (page) => {
    await signIn(page, PASS.RESIDENT_USER, PASS.RESIDENT_PASS);
    await page.waitForSelector("text=Aisha", { timeout: 30000 });
    await tapTab(page, "Pass");
    await page.waitForTimeout(800);
    await capture(page, browser, "hall-pass");
  });

  await withPhone(async (page) => {
    await signIn(page, PASS.RESIDENT_USER, PASS.RESIDENT_PASS);
    await page.waitForSelector("text=Aisha", { timeout: 30000 });
    await tapTab(page, "Permissions");
    await capture(page, browser, "permissions");
    const guest = page.getByText(/Guest stays|Guest/i).first();
    if (await guest.count()) {
      await guest.click({ force: true });
      await page.waitForTimeout(1000);
      await capture(page, browser, "guest-list");
    }
  });

  await withPhone(async (page) => {
    await signIn(page, PASS.RESIDENT_USER, PASS.RESIDENT_PASS);
    await page.waitForSelector("text=Aisha", { timeout: 30000 });
    // open notices via bell count / route
    await page.goto(APP + "/notifications", { waitUntil: "networkidle" }).catch(() => {});
    await page.waitForTimeout(1500);
    await dismissOverlay(page);
    if (!(await page.getByText(/approved|rejected|guest|Late|Notice/i).count())) {
      await page.mouse.click(350, 64);
      await page.waitForTimeout(1200);
    }
    await capture(page, browser, "notices");
  });

  await withPhone(async (page) => {
    await signIn(page, PASS.GATE_USER, PASS.GATE_PASS);
    await page.waitForTimeout(2000);
    await capture(page, browser, "gate-home");
    await tapTab(page, "Scan");
    await capture(page, browser, "gate-scan");
  });

  await withPhone(async (page) => {
    await signIn(page, PASS.PROVOST_USER, PASS.PROVOST_PASS);
    await page.waitForTimeout(2200);
    await capture(page, browser, "provost-home");
  });

  await withPhone(async (page) => {
    await signIn(page, PASS.PROVOST_USER, PASS.PROVOST_PASS);
    await page.waitForTimeout(1500);
    await tapTab(page, "Requests");
    await capture(page, browser, "provost-requests");
    const row = page.getByText(/Lucknow|Home going|Aisha|Zara|Guest/i).first();
    if (await row.count()) {
      await row.click({ force: true });
      await page.waitForTimeout(1400);
      await capture(page, browser, "provost-decide");
    }
  });

  await withPhone(async (page) => {
    await signIn(page, PASS.PROVOST_USER, PASS.PROVOST_PASS);
    await page.waitForTimeout(1200);
    await page.goto(APP + "/staff/office", { waitUntil: "networkidle" }).catch(() => {});
    await page.waitForTimeout(1600);
    await dismissOverlay(page);
    if (!(await page.getByText(/Residents|Blocks|Settings|Office/i).count())) {
      await page.getByText(/Hall office|Office/i).first().click({ force: true }).catch(() => {});
      await page.waitForTimeout(1200);
    }
    await capture(page, browser, "provost-office");
  });

  await withPhone(async (page) => {
    await signIn(page, PASS.PROVOST_USER, PASS.PROVOST_PASS);
    await page.waitForTimeout(1200);
    await page.goto(APP + "/staff/out", { waitUntil: "networkidle" }).catch(() => {});
    await page.waitForTimeout(1600);
    await dismissOverlay(page);
    await capture(page, browser, "provost-register");
  });

  // Gate exit result: scan via API then reload gate activity / home after scan UI hard;
  // drive gate scan result by posting scan then showing activity on gate home.
  const token = await (async () => {
    const res = await fetch("http://127.0.0.1:8000/api/v1/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: PASS.GATE_USER, password: PASS.GATE_PASS }),
    });
    return (await res.json()).access_token;
  })();
  const scan = await fetch("http://127.0.0.1:8000/api/v1/gate/scans", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ qr_payload: "bsj:v1:test-resident-hall-pass" }),
  });
  console.log("scan", scan.status, await scan.text());

  await withPhone(async (page) => {
    await signIn(page, PASS.GATE_USER, PASS.GATE_PASS);
    await page.waitForTimeout(2000);
    await capture(page, browser, "gate-after-exit");
  });

  await withPhone(async (page) => {
    await signIn(page, PASS.RESIDENT_USER, PASS.RESIDENT_PASS);
    await page.waitForTimeout(2000);
    await capture(page, browser, "resident-outside");
    await tapTab(page, "Pass");
    await capture(page, browser, "hall-pass-outside");
  });

  await browser.close();
  console.log("files", fs.readdirSync(OUT).join(", "));
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
