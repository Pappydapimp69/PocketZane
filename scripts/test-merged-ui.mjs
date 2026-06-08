import { chromium } from "playwright";
const exe = "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
const b = await chromium.launch({ executablePath: exe, args: ["--no-sandbox", "--disable-setuid-sandbox"] });
const page = await b.newPage({ viewport: { width: 480, height: 854 } });
const errs = [];
page.on("pageerror", (e) => errs.push(`[PAGEERROR] ${e.message}`));
const k = (x) => page.keyboard.press(x);
const w = (ms) => page.waitForTimeout(ms);
const shot = (n) => page.screenshot({ path: `/tmp/m-${n}.png` });

await page.goto("http://localhost:5173/", { waitUntil: "load", timeout: 30000 });
await w(3500);
await k("KeyN"); await w(1100);
await k("Enter"); await w(700); // begin

// three phases: lie is the 2nd line; question it then pin.
for (let p = 0; p < 3; p++) {
  await k("ArrowDown"); await k("ArrowDown"); await w(150);
  await k("Enter"); await w(250); // question -> shift
  await k("KeyX"); await w(p < 2 ? 3400 : 3400); // pin -> lead -> phase beat
}
await shot("confront");

// present coat -> deflect through sleep
await k("Enter"); await w(400); // picker
await k("Enter"); await w(700); // coat (index 0)
await shot("deflect");

// present call -> break sleep
await k("Enter"); await w(400);
await k("ArrowDown"); await k("ArrowDown"); await w(150); // call index 2
await k("Enter"); await w(700);
await shot("support-broken");

// present coat -> break alibi -> solve
await k("Enter"); await w(400);
await k("Enter"); await w(1100); // coat index 0 -> solve
await shot("solved");

// open the win diagram (click the "THE WEB" button at ~132, 786)
await page.mouse.click(132, 786);
await w(700);
await shot("diagram");

console.log(errs.length ? errs.join("\n") : "(no page errors)");
await b.close();
