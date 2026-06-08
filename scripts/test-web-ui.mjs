import { chromium } from "playwright";
const exe = "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
const b = await chromium.launch({ executablePath: exe, args: ["--no-sandbox", "--disable-setuid-sandbox"] });
const page = await b.newPage({ viewport: { width: 480, height: 854 } });
const errs = [];
page.on("pageerror", (e) => errs.push(`[PAGEERROR] ${e.message}`));
const k = (x) => page.keyboard.press(x);
const w = (ms) => page.waitForTimeout(ms);
const shot = (n) => page.screenshot({ path: `/tmp/web-${n}.png` });

await page.goto("http://localhost:5173/", { waitUntil: "load", timeout: 30000 });
await w(3500);
await k("KeyW"); // open THE WEB
await w(1100);
await k("Enter"); // begin (close file)
await w(600);
await shot("start");

// present the coat (picker order: coat, neighbor, call) -> deflect via sleep
await k("Enter"); await w(400); // open picker
await k("Enter"); await w(700); // choose first (coat)
await shot("deflect");

// present the call -> breaks the sleep story
await k("Enter"); await w(400); // picker
await k("ArrowDown"); await k("ArrowDown"); await w(150); // focus -> call (index 2)
await k("Enter"); await w(700);
await shot("support-broken");

// present the coat again -> now breaks the alibi
await k("Enter"); await w(400);
await k("Enter"); await w(800); // coat (index 0)
await shot("solved");

console.log(errs.length ? errs.join("\n") : "(no page errors)");
await b.close();
