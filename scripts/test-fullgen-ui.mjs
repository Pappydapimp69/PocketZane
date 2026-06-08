import { chromium } from "playwright";
const exe = "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
const b = await chromium.launch({ executablePath: exe, args: ["--no-sandbox", "--disable-setuid-sandbox"] });
const page = await b.newPage({ viewport: { width: 480, height: 854 } });
const errs = []; page.on("pageerror", (e) => errs.push(e.message));
const k = (x) => page.keyboard.press(x), w = (ms) => page.waitForTimeout(ms), shot = (n) => page.screenshot({ path: `/tmp/fg-${n}.png` });
await page.goto("http://localhost:5173/", { waitUntil: "load", timeout: 30000 });
await w(3500);
await k("KeyW"); await w(1000);   // GENERATED -> full case (CaseRun)
await k("Enter"); await w(700);   // begin
await shot("phase1");             // a generated phase
// clear 3 phases: lie position varies, so question+pin each line until a lead lands
for (let p = 0; p < 3; p++) {
  for (let i = 0; i < 3; i++) { await k("ArrowDown"); await k("Enter"); await k("KeyX"); await w(250); }
  await w(3200);
}
await shot("confront");           // generated web confrontation
console.log(errs.length ? errs.join("\n") : "(no errors)");
await b.close();
