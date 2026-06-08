import { chromium } from "playwright";
const exe = "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
const b = await chromium.launch({ executablePath: exe, args: ["--no-sandbox", "--disable-setuid-sandbox"] });
const p = await b.newPage({ viewport: { width: 900, height: 720 }, deviceScaleFactor: 2 });
await p.goto("file:///tmp/hard-web.html", { waitUntil: "networkidle" });
await p.waitForTimeout(1500);
await p.screenshot({ path: "/tmp/hard-web.png" });
await b.close();
console.log("rendered");
