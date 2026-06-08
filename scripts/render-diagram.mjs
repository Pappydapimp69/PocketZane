import { chromium } from "playwright";
const exe = "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
const b = await chromium.launch({ executablePath: exe, args: ["--no-sandbox", "--disable-setuid-sandbox"] });
const p = await b.newPage({ viewport: { width: 760, height: 600 }, deviceScaleFactor: 2 });
await p.goto("file:///tmp/web-diagram.html", { waitUntil: "networkidle" });
await p.waitForTimeout(1500);
await p.screenshot({ path: "/tmp/web-diagram.png" });
await b.close();
console.log("rendered");
