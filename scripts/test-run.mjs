import { chromium } from "playwright";

const exe = "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
const browser = await chromium.launch({ executablePath: exe, args: ["--no-sandbox", "--disable-setuid-sandbox"] });
const page = await browser.newPage({ viewport: { width: 480, height: 854 } });

const log = [];
page.on("console", (m) => log.push(`[${m.type()}] ${m.text()}`));
page.on("pageerror", (e) => log.push(`[PAGEERROR] ${e.message}\n${e.stack ?? ""}`));

await page.goto("http://localhost:5173/", { waitUntil: "load", timeout: 30000 });
await page.waitForTimeout(4000);
await page.screenshot({ path: "/tmp/again-title.png" });

// Try to start: dismiss any help overlay, then begin via keyboard.
await page.keyboard.press("Enter");
await page.waitForTimeout(800);
await page.keyboard.press("Enter");
await page.waitForTimeout(2500);
await page.screenshot({ path: "/tmp/again-case.png" });

console.log("=== CONSOLE / ERRORS ===");
console.log(log.length ? log.join("\n") : "(no console output or errors)");
await browser.close();
