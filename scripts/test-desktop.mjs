import { chromium } from "playwright";

const exe = "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
const browser = await chromium.launch({ executablePath: exe, args: ["--no-sandbox", "--disable-setuid-sandbox"] });
// Desktop-ish window to reproduce centering/scaling.
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
await page.goto("http://localhost:5173/", { waitUntil: "load", timeout: 30000 });
await page.waitForTimeout(3500);

const info = await page.evaluate(() => {
  const c = document.querySelector("canvas");
  const r = c?.getBoundingClientRect();
  return {
    win: { w: window.innerWidth, h: window.innerHeight },
    canvasCss: c ? { w: Math.round(c.clientWidth), h: Math.round(c.clientHeight) } : null,
    rect: r ? { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) } : null,
    style: c ? c.getAttribute("style") : null,
  };
});
console.log(JSON.stringify(info, null, 2));
await page.screenshot({ path: "/tmp/again-desktop.png" });
await browser.close();
