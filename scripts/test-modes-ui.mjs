// Smoke the step-10 wiring: daily (top link) and endless (menu) both boot the
// new engine, render, and run a phase without page errors.
import { chromium } from "playwright";
const exe = "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
const b = await chromium.launch({ executablePath: exe, args: ["--no-sandbox", "--disable-setuid-sandbox"] });
const page = await b.newPage({ viewport: { width: 480, height: 854 } });
const errs = [];
page.on("pageerror", (e) => errs.push(`[PAGEERROR] ${e.message}`));
const k = (x) => page.keyboard.press(x);
const w = (ms) => page.waitForTimeout(ms);

await page.goto("http://localhost:5173/", { waitUntil: "load", timeout: 30000 });
await w(3500);

// Daily: click the "» today's subject «" link near y=360.
await page.mouse.click(240, 360);
await w(1200);
await k("Enter"); await w(600); // close the file
await page.screenshot({ path: "/tmp/mode-daily.png" });
const dailyTag = await page.evaluate(() => document.title || "ok");

// back to title, then endless: menu focus starts on SIT DOWN; down once = ENDLESS NIGHT.
await page.mouse.click(35, 22); // "← leave" — CaseRun back link
await w(900);
await k("ArrowDown"); await w(150);
await k("Enter"); await w(1200); // endless night 1
await k("Enter"); await w(600); // close file
await page.screenshot({ path: "/tmp/mode-endless.png" });

console.log(errs.length ? errs.join("\n") : "(no page errors)");
await b.close();
