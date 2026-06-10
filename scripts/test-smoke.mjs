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
    return !!(s && s.interview && s.theCase);
  });
  if (!good) ok = false;
  console.log(`${good ? "✓" : "✗"} ${name}`);
  await page.evaluate(() => window.__game.scene.getScene("CaseRun").scene.start("TitleScene"));
  await w(400);
}
// the earned-seam patch flow must reach a win through the LIVE confrontation web,
// not just the engine unit test — guards against a dead-end where his invented lie
// can't be cracked. Drive the real scene's WebInquiry (patch live) to solved.
{
  const r = await page.evaluate(async () => {
    const G = window.__game; const sleep = (ms) => new Promise((res) => setTimeout(res, ms));
    for (let seed = 1; seed <= 30; seed++) {
      G.scene.getScene("TitleScene").scene.start("CaseRun", { generate: true, seed, supports: 3, depth: 2, weirdness: 0.8, herring: true });
      await sleep(180);
      const s = G.scene.getScene("CaseRun");
      if (!s || !s.interview) continue;
      const web = s.interview.toWeb(s.theCase.web, seed, true); // exactly as startConfront ships it
      let patched = false, guard = 0;
      while (!web.solved && guard++ < 150) {
        let acted = false;
        for (const e of web.heldEvidence()) {
          const res = web.present(e.id);
          if (res.kind === "break" && res.patched) patched = true;
          if (res.kind !== "nomatch" && res.kind !== "already") acted = true;
          if (web.solved) break;
        }
        if (!acted) break;
      }
      if (patched) return { seed, solved: web.solved };
    }
    return { seed: -1, solved: false };
  });
  if (!r.solved) { ok = false; console.log(`✗ patched confrontation did not solve through the live web (seed ${r.seed})`); }
  else console.log(`✓ earned-seam patch solves through the live web (seed ${r.seed})`);
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
