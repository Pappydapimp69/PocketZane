import { chromium } from "playwright";
const exe = "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
const b = await chromium.launch({ executablePath: exe, args: ["--no-sandbox", "--disable-setuid-sandbox"] });
const page = await b.newPage({ viewport: { width: 480, height: 854 } });
const errs = [];
page.on("pageerror", (e) => errs.push(`[PAGEERROR] ${e.message}`));
const k = (x) => page.keyboard.press(x), w = (ms) => page.waitForTimeout(ms), shot = (n) => page.screenshot({ path: `/tmp/gen-${n}.png` });
await page.goto("http://localhost:5173/", { waitUntil: "load", timeout: 30000 });
await w(3500);
await k("KeyW"); await w(900);  // GENERATED
await k("Enter"); await w(700); // begin
await shot("start");
await k("Enter"); await w(400); // picker
await k("Enter"); await w(800); // present the one held lead -> deflect + reveal
await shot("deflect");
console.log(errs.length ? errs.join("\n") : "(no page errors)");
await b.close();
