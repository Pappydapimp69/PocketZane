import { chromium } from "playwright";
const exe = "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
const b = await chromium.launch({ executablePath: exe, args: ["--no-sandbox", "--disable-setuid-sandbox"] });
const page = await b.newPage({ viewport: { width: 480, height: 854 } });
const errs = []; page.on("pageerror", (e) => errs.push(e.message));
const k = (x) => page.keyboard.press(x), w = (ms) => page.waitForTimeout(ms), shot = (n) => page.screenshot({ path: `/tmp/key-${n}.png` });
await page.goto("http://localhost:5173/?web=keystone&seed=11", { waitUntil: "load", timeout: 30000 });
await w(3800);
await k("Enter"); await w(700);   // begin (close file)
await shot("start");
await k("Enter"); await w(350); await k("Enter"); await w(600);                          // present #1 -> deflect via keystone
await k("Enter"); await w(350); await k("ArrowDown"); await k("Enter"); await w(600);     // present #2 -> deflect via keystone
await shot("leaning");
await k("Enter"); await w(350); await k("ArrowDown"); await k("ArrowDown"); await k("Enter"); await w(700); // present the tell -> keystone -> cascade
await shot("cascade");
console.log(errs.length ? errs.join("\n") : "(no errors)");
await b.close();
