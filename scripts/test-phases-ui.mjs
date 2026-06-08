import { chromium } from "playwright";
const exe = "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
const b = await chromium.launch({ executablePath: exe, args: ["--no-sandbox", "--disable-setuid-sandbox"] });
const page = await b.newPage({ viewport: { width: 480, height: 854 } });
const errs = [];
page.on("pageerror", (e) => errs.push(`[PAGEERROR] ${e.message}`));
const press = (k) => page.keyboard.press(k);
const wait = (ms) => page.waitForTimeout(ms);
const shot = (n) => page.screenshot({ path: `/tmp/ph-${n}.png` });

await page.goto("http://localhost:5173/", { waitUntil: "load", timeout: 30000 });
await wait(3500);
await press("KeyN");
await wait(1200);
await press("Enter"); // begin (close file)
await wait(700);

// Phase 1: lie is the 2nd line ("stairs"). select it, question, pin.
await press("ArrowDown"); await press("ArrowDown"); await wait(200);
await press("Enter"); await wait(300); // question -> shift
await shot("phase1-shift");
await press("KeyX"); await wait(300); // pin -> lead
await shot("phase1-lead");
await wait(3200); // through the phase beat to phase 2

// Phase 2 + 3: lie is the 2nd line each. clear them.
for (const _ of [0, 1]) {
  await press("ArrowDown"); await press("ArrowDown"); await wait(150);
  await press("Enter"); await wait(250);
  await press("KeyX"); await wait(3400);
}

// Confrontation
await shot("confront");
await press("ArrowDown"); await wait(150); // select first claim (home)
await press("Enter"); await wait(400); // PRESENT -> picker
await shot("picker");
await press("Enter"); await wait(700); // present first lead (coat) -> partial
await shot("after-present");

console.log(errs.length ? errs.join("\n") : "(no page errors)");
await b.close();
