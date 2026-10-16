// Run against a local Next server. All account and score writes are fixtures.
const assert=require("node:assert/strict"), fs=require("node:fs"), puppeteer=require("puppeteer");
const origin=process.argv[2]||"http://127.0.0.1:3104", folder="book-output/measure-editing-preview";
fs.mkdirSync(folder,{recursive:true});
const score={parts:{snare:{enabled:true}},measures:Array.from({length:4},(_,i)=>({timeSig:{num:2,type:4},parts:[{instrument:"snare",voices:[{
  notes:["ra","ld","r","lc","rf","l","ra","l"].map((ornaments,j)=>({duration:16,dots:0,notes:["C5"],ornaments:i===3?"":ornaments,velocity:.5})),tuplets:[]
}]}]}))};
async function clickText(page,text,selector="button,[role=menuitem]") {
  for(const element of await page.$$(selector)) if(await element.evaluate((el,label)=>el.textContent.trim()===label || el.getAttribute("aria-label")===label,text)){await element.click();return;}
  throw new Error(`Missing control: ${text}`);
}
(async()=>{
  const browser=await puppeteer.launch({headless:"new",args:["--no-sandbox"]});
  const errors=[]; let snapshot;
  const page=await browser.newPage(); page.setDefaultTimeout(30000); page.setDefaultNavigationTimeout(60000);
  try {
    page.on("pageerror",e=>errors.push(e.message));
    await page.setViewport({width:1440,height:900});
    await page.setRequestInterception(true);
    page.on("request",req=>{
      const url=new URL(req.url());
      const send=(body)=>req.respond({status:200,contentType:"application/json",body:JSON.stringify(body)});
      if(url.origin!==origin && /google|doubleclick/.test(url.hostname))return req.abort();
      if(url.pathname==="/api/auth/me")return send({user:{id:"measure-tester",name:"Measure tester"}});
      if(url.pathname==="/api/social/rhythms/editor")return send({rhythm:{id:"editor",name:"Measure study",score,tempo:90,mutations:[],visibility:"private",instruments:["snare"],isOwner:true}});
      if(url.pathname==="/api/social/rhythms" && req.method()==="POST") {snapshot=JSON.parse(req.postData()).score;return send({rhythm:{id:"saved",score:snapshot}});}
      return req.continue();
    });
    await page.goto(`${origin}/rhythms/editor`,{waitUntil:"networkidle0"});
    await clickText(page,"Open in score");
    await page.waitForSelector("#vexflow [data-measure-index='3']");
    await page.waitForSelector("button[aria-label=save]");
    assert.equal(await page.$("[data-measure-toolbar]"),null,"Toolbar starts hidden");
    const select=async(index)=>{
      const el=await page.$(`[data-measure-index='${index}'] [data-measure-background]`);
      const rect=await el.boundingBox(); await page.mouse.click(rect.x+12,rect.y+12);
      await page.waitForSelector(`[role=toolbar][aria-label='Measure ${index+1} tools']`);
      await page.waitForFunction((i)=>document.querySelector(`[data-measure-index='${i}']`)?.getAttribute("aria-pressed")==="true",{},index);
    };
    const save=async()=>{
      await page.waitForFunction(()=>!document.querySelector("[role=menu]"));
      snapshot=null; await page.click("button[aria-label=save]"); await page.waitForSelector("#rhythm-dialog-title");
      await clickText(page,"Save privately"); await page.waitForFunction(()=>!document.querySelector("[role=dialog]"));
      assert(snapshot); return structuredClone(snapshot);
    };
    await select(1);
    await clickText(page,"Adjust");
    await page.waitForSelector("[role=menu][aria-label='Adjust measure']");
    assert.deepEqual(await page.$$eval("[role=menuitem]",els=>els.map(el=>el.getAttribute("aria-label"))),["Stickings","Accents","Diddles","Cheese","Flams"]);
    await page.screenshot({path:`${folder}/adjust-desktop.png`});
    await clickText(page,"Accents"); await clickText(page,"Shuffle");
    const shuffled=await save();
    assert.notDeepEqual(shuffled.measures[1],score.measures[1]);
    assert.deepEqual(shuffled.measures.filter((_,i)=>i!==1),score.measures.filter((_,i)=>i!==1),"Only the selected measure changes");
    await page.click("button[aria-label=undo]"); assert.deepEqual(await save(),score,"Shuffle undo restores all notation");
    await page.click("button[aria-label=redo]"); assert.deepEqual(await save(),shuffled,"Redo restores the same shuffle");
    await select(0); await clickText(page,"Copy");
    await select(2); await clickText(page,"Paste"); await clickText(page,"Paste to the left");
    await page.waitForFunction(()=>document.querySelectorAll("[data-measure-index]").length===5);
    const left=await save(); assert.deepEqual(left.measures[2],score.measures[0]); assert.deepEqual(left.measures[3],score.measures[2]);
    await clickText(page,"Paste"); await clickText(page,"Paste to the right");
    await page.waitForFunction(()=>document.querySelectorAll("[data-measure-index]").length===6);
    const right=await save(); assert.deepEqual(right.measures[3],score.measures[0]);
    await clickText(page,"Duplicate"); await page.waitForFunction(()=>document.querySelectorAll("[data-measure-index]").length===7);
    const duplicate=await save(); assert.deepEqual(duplicate.measures[4],score.measures[0]);
    await page.keyboard.down("Control"); await page.keyboard.press("z"); await page.keyboard.up("Control");
    assert.deepEqual(await save(),right,"Inserted measures support keyboard undo while a button has focus");
    await page.click("button[aria-label=redo]"); assert.deepEqual(await save(),duplicate);
    await select(6); await clickText(page,"Adjust"); await clickText(page,"Accents");
    assert.equal(await page.$eval("[role=menuitem][aria-disabled=true]",el=>el.innerText),"Shuffle","Absent markings cannot be shuffled");
    await page.keyboard.press("Escape");
    await page.waitForFunction(()=>!document.querySelector("[role=menu]"));
    await page.setViewport({width:390,height:844});
    await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
    await select(0); await clickText(page,"Adjust"); await page.waitForSelector("[role=menu]");
    await page.waitForFunction(()=>getComputedStyle(document.querySelector("[role=menu]").parentElement).opacity==="1");
    assert(await page.$eval("[data-measure-toolbar]",el=>{const b=el.getBoundingClientRect();return b.left>=0&&b.right<=innerWidth;}),"Toolbar fits a phone");
    assert(await page.$eval("[role=menu]",el=>{const b=el.getBoundingClientRect();return b.left>=0&&b.right<=innerWidth&&b.bottom<=innerHeight;}),"Adjustment menu fits a phone");
    await page.screenshot({path:`${folder}/adjust-mobile.png`});
    await page.keyboard.press("Escape");
    await page.waitForFunction(()=>!document.querySelector("[role=menu]"));
    await page.click("button[aria-label='Deselect measure']");
    await page.$eval("[data-measure-index='1']",el=>el.focus()); await page.keyboard.press("Enter");
    await page.waitForSelector("[role=toolbar][aria-label='Measure 2 tools']");
    assert.deepEqual(errors,[]);
    console.log("Passed: measure selection, scoped shuffle, clipboard insertion on both sides, duplication, undo/redo, saving, keyboard selection, and mobile toolbar.");
  }catch(error){console.error(errors);await page.screenshot({path:`${folder}/failure.png`,fullPage:true});throw error;}
  finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
