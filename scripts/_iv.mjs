import { chromium } from "playwright";
const exe="/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
const b=await chromium.launch({executablePath:exe,args:["--no-sandbox","--disable-setuid-sandbox"]});
const page=await b.newPage({viewport:{width:480,height:854}});
const errs=[]; page.on("pageerror",e=>errs.push(e.message));
const w=ms=>page.waitForTimeout(ms), k=x=>page.keyboard.press(x);
await page.goto("http://localhost:5173/",{waitUntil:"load"}); await w(3000);
await page.evaluate(()=>{ localStorage.setItem("again:textSize","1"); window.__game.scene.getScene("TitleScene").scene.start("CaseRun",{generate:true,seed:11,fixed:true}); });
await w(1100); await k("Enter"); await w(600); // close file
await page.screenshot({ path:"/tmp/iv-start.png" });
// programmatically: ask a lever, then its lie, then press
const info = await page.evaluate(()=>{
  const s=window.__game.scene.getScene("CaseRun"); const iv=s.interview;
  const lever=iv.questions.find(q=>q.kind==='lever');
  const lie=iv.questions.find(q=>q.kind==='lie' && q.leverId===lever?.evId);
  return { lever:lever?.id, lie:lie?.id, leverEv:lever?.evId, lieLever:lie?.leverId };
});
