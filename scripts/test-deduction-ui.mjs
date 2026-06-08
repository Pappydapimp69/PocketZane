import { chromium } from "playwright";
const exe = "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
const b = await chromium.launch({ executablePath: exe, args: ["--no-sandbox", "--disable-setuid-sandbox"] });
const page = await b.newPage({ viewport: { width: 480, height: 854 } });
const errs = [];
page.on("pageerror", (e) => errs.push(`[PAGEERROR] ${e.message}`));
const shot = (n) => page.screenshot({ path: `/tmp/ded-${n}.png` });

await page.goto("http://localhost:5173/", { waitUntil: "load", timeout: 30000 });
await page.waitForTimeout(3500);
await page.keyboard.press("KeyN"); // start the new case
await page.waitForTimeout(1200);
await shot("file"); // the case file
await page.keyboard.press("Enter"); // begin
await page.waitForTimeout(700);
await page.keyboard.press("ArrowDown"); // select first thread (alibi)
await page.waitForTimeout(300);
await shot("testimony");
await page.keyboard.press("KeyX"); // present
await page.waitForTimeout(400);
await shot("picker");
await page.keyboard.press("ArrowDown"); // focus -> coat
await page.keyboard.press("Enter"); // present coat
await page.waitForTimeout(800);
await shot("after-coat");
// question the alibi to gain the neighbor
await page.keyboard.press("Enter"); // A = question (alibi still selected)
await page.waitForTimeout(1400);
await shot("after-question");
console.log(errs.length ? errs.join("\n") : "(no page errors)");
await b.close();
