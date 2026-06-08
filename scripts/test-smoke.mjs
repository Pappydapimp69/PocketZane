// Headless smoke: every mode and every scene must boot without a page error.
// Catches integration regressions the engine unit tests can't. Needs a dev
// server on :5173 (npx vite) and the system chromium. Run: node scripts/test-smoke.mjs
import { chromium } from "playwright";
const exe = "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
const b = await chromium.launch({ executablePath: exe, args: ["--no-sandbox", "--disable-setuid-sandbox"] });
const page = await b.newPage({ viewport: { width: 480, height: 854 } });
const errs = [];
page.on("pageerror", (e) => errs.push("[PAGEERR] " + e.message));
const w = (ms) => page.waitForTimeout(ms);

await page.goto("http://localhost:5173/", { waitUntil: "load", timeout: 30000 });
await w(3000);

const modes = [
  ["daily", { mode: "daily" }],
  ["sit-down", { generate: true }],
  ["endless", { mode: "endless", night: 3 }],
  ["versus", { vsMode: "versus" }],
  ["co-op", { vsMode: "coop" }],
];
let ok = true;
for (const [name, data] of modes) {
  await page.evaluate((d) => window.__game.scene.getScene("TitleScene").scene.start("CaseRun", d), data);
  await w(900);
  const good = await page.evaluate(() => {
    const s = window.__game.scene.getScene("CaseRun");
    return !!(s && s.inq && s.theCase);
  });
  if (!good) ok = false;
  console.log(`${good ? "✓" : "✗"} ${name}`);
  await page.evaluate(() => window.__game.scene.getScene("CaseRun").scene.start("TitleScene"));
  await w(400);
}
for (const sc of ["Stats", "CaseSelect"]) {
  await page.evaluate((s) => window.__game.scene.getScene("TitleScene").scene.start(s), sc);
  await w(800);
  console.log(`✓ ${sc} scene`);
  await page.evaluate((s) => window.__game.scene.getScene(s).scene.start("TitleScene"), sc);
  await w(400);
}

if (errs.length) {
  ok = false;
  console.log("\n" + errs.join("\n"));
}
console.log(ok ? "\nSmoke OK — every mode and scene boots clean." : "\nSMOKE BROKEN.");
await b.close();
process.exit(ok ? 0 : 1);
