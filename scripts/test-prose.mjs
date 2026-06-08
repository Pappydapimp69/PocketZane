import { chromium } from "playwright";

const exe = "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
const browser = await chromium.launch({ executablePath: exe, args: ["--no-sandbox", "--disable-setuid-sandbox"] });
const page = await browser.newPage({ viewport: { width: 480, height: 854 } });
const errs = [];
page.on("pageerror", (e) => errs.push(`[PAGEERROR] ${e.message}`));

await page.goto("http://localhost:5173/", { waitUntil: "load", timeout: 30000 });
await page.waitForTimeout(3500);
await page.keyboard.press("Enter"); // dismiss help
await page.waitForTimeout(400);
await page.keyboard.press("Enter"); // begin story
await page.waitForTimeout(2200); // intro card fades
await page.keyboard.press("ArrowDown"); // select first clause
await page.waitForTimeout(400);
await page.screenshot({ path: "/tmp/prose-1.png" });

for (let i = 0; i < 4; i++) {
  await page.keyboard.press("Enter"); // AGAIN
  await page.waitForTimeout(700);
}
await page.keyboard.press("ArrowDown");
await page.keyboard.press("ArrowDown");
await page.waitForTimeout(400);
await page.screenshot({ path: "/tmp/prose-2.png" });

console.log(errs.length ? errs.join("\n") : "(no page errors)");
await browser.close();
