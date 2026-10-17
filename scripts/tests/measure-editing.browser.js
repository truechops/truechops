// Run against a local Next server. All account and score writes are fixtures.
const assert=require("node:assert/strict"), fs=require("node:fs"), puppeteer=require("puppeteer");
const origin=process.argv[2]||"http://127.0.0.1:3104", folder="book-output/measure-editing-preview";
fs.mkdirSync(folder,{recursive:true});
const score={parts:{snare:{enabled:true}},measures:Array.from({length:4},(_,i)=>({timeSig:{num:2,type:4},parts:[{instrument:"snare",voices:[{
  notes:["ra","ld","r","lc","rf","l","ra","l"].map((ornaments,j)=>({duration:16,dots:0,notes:["C5"],ornaments:i===3?"":ornaments,velocity:.5})),tuplets:[]
}]}]}))};
// Stress both grace-note spacing and changed meters in the editor's normal layout.
score.measures[2] = {timeSig:{num:4,type:4},parts:[{instrument:"snare",voices:[{
  notes:Array.from({length:32},(_,i)=>({duration:32,dots:0,notes:["C5"],ornaments:(i%2?"lf":"rc")+(i%4===0?"a":""),velocity:.5})),tuplets:[]
}]}]};
score.measures[1].parts[0].voices[0]={
  notes:Array.from({length:12},(_,i)=>({duration:16,dots:0,notes:["C5"],ornaments:(i%2?"l":"r")+(i%3===0?"af":""),velocity:.5})),
  tuplets:Array.from({length:4},(_,i)=>({start:i*3,end:i*3+3,actual:3,normal:2}))
};
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
    const intercept=req=>{
      const url=new URL(req.url());
      const send=(body)=>req.respond({status:200,contentType:"application/json",body:JSON.stringify(body)});
      if(url.origin!==origin && /google|doubleclick/.test(url.hostname))return req.abort();
      if(url.pathname==="/api/auth/me")return send({user:{id:"measure-tester",name:"Measure tester"}});
      if(url.pathname==="/api/social/rhythms/editor")return send({rhythm:{id:"editor",name:"Measure study",score,tempo:90,mutations:[],visibility:"private",instruments:["snare"],isOwner:true}});
      if(url.pathname==="/api/social/rhythms" && req.method()==="POST") {snapshot=JSON.parse(req.postData()).score;return send({rhythm:{id:"saved",score:snapshot}});}
      return req.continue();
    };
    page.on("request",intercept);
    await page.goto(`${origin}/rhythms/editor`,{waitUntil:"networkidle0"});
    await clickText(page,"Open in score");
    await page.waitForSelector("#vexflow [data-measure-index='3']");
    await page.waitForSelector("button[aria-label=save]");
    assert.equal(await page.$("[data-measure-toolbar]"),null,"Toolbar starts hidden");
    const checkBounds=async()=>{
      const overflow=await page.$$eval("#vexflow [data-measure-index]",groups=>groups.flatMap(group=>{
        const bar=group.querySelector("[data-measure-background]").getBoundingClientRect();
        return [...group.querySelectorAll(".vf-stavenote,.vf-beam,.vf-tuplet")].filter(el=>{
          const b=el.getBoundingClientRect(); return b.left<bar.left-2 || b.right>bar.right+2;
        }).map(el=>({measure:group.dataset.measureIndex,bar:{left:bar.left,right:bar.right},notation:{left:el.getBoundingClientRect().left,right:el.getBoundingClientRect().right}}));
      }));
      assert.deepEqual(overflow,[],"Notes, grace notes, beams and tuplets stay within their measures");
    };
    await checkBounds();
    const select=async(index)=>{
      const group=`[data-measure-index='${index}']`;
      await page.hover(`${group} [data-measure-background]`);
      await page.waitForFunction((selector)=>getComputedStyle(document.querySelector(selector)).opacity==="1",{},`${group} [data-measure-trigger]`);
      await page.click(`${group} [data-measure-trigger]`);
      await page.waitForSelector(`[role=toolbar][aria-label='Measure ${index+1} tools']`);
      await page.waitForFunction((i)=>document.querySelector(`[data-measure-index='${i}']`)?.dataset.selected==="true",{},index);
    };
    // Hover reveals only the small trigger; selecting a measure does not open tools.
    await page.hover("[data-measure-index='1'] [data-measure-background]");
    assert.equal(await page.$("[data-measure-toolbar]"),null);
    await page.waitForFunction(()=>getComputedStyle(document.querySelector("[data-measure-index='1'] [data-measure-trigger]")).opacity==="1");
    await page.screenshot({path:`${folder}/measure-hover.png`});
    await page.click("[data-measure-index='1'] [data-measure-background]");
    assert.equal(await page.$("[data-measure-toolbar]"),null);
    await page.mouse.move(1100,500);
    await page.waitForFunction(()=>getComputedStyle(document.querySelector("[data-measure-index='1'] [data-measure-trigger]")).opacity==="0");
    const save=async()=>{
      await page.waitForFunction(()=>!document.querySelector("[role=menu]"));
      snapshot=null; await page.click("button[aria-label=save]"); await page.waitForSelector("#rhythm-dialog-title");
      await clickText(page,"Save privately"); await page.waitForFunction(()=>!document.querySelector("[role=dialog]"));
      assert(snapshot);
      const selected=await page.$("[data-measure-index][data-selected=true]");
      if(selected) await select(await selected.evaluate(el=>Number(el.dataset.measureIndex)));
      return structuredClone(snapshot);
    };
    await select(1);
    await clickText(page,"Adjust");
    await page.waitForSelector("[role=menu][aria-label='Adjust measure']");
    await page.waitForFunction(()=>getComputedStyle(document.querySelector("[role=menu]").parentElement).opacity==="1");
    assert.deepEqual(await page.$$eval("[role=menuitem]",els=>els.map(el=>el.getAttribute("aria-label"))),["Stickings","Accents","Diddles","Cheese","Flams","Browse variations","Find matching rhythms"]);
    await page.screenshot({path:`${folder}/adjust-desktop.png`});
    await clickText(page,"Accents"); await clickText(page,"Shuffle");
    const shuffled=await save();
    assert.notDeepEqual(shuffled.measures[1],score.measures[1]);
    assert.deepEqual(shuffled.measures.filter((_,i)=>i!==1),score.measures.filter((_,i)=>i!==1),"Only the selected measure changes");
    await checkBounds();
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
    await checkBounds();
    await select(6); await clickText(page,"Adjust"); await clickText(page,"Accents");
    assert.equal(await page.$eval("[role=menuitem][aria-disabled=true]",el=>el.innerText),"Shuffle","Absent markings cannot be shuffled");
    await page.keyboard.press("Escape");
    await page.waitForFunction(()=>!document.querySelector("[role=menu]"));
    await select(6); await clickText(page,"Adjust"); await clickText(page,"Diddles"); await clickText(page,"Shuffle");
    const introduced=await save();
    assert(introduced.measures[6].parts[0].voices[0].notes.some(note=>note.ornaments.includes("d")),"Shuffle introduces missing diddles");
    await select(6); await clickText(page,"Adjust"); await clickText(page,"Browse variations");
    await page.waitForSelector("#measure-variations-title");
    await page.waitForSelector("button[aria-label='Preview stickings variation 1']");
    await page.click("button[aria-label='Preview stickings variation 1']");
    await page.click("button[aria-label='Maximize variations']");
    await page.waitForFunction(()=>document.querySelector('[role=dialog]').getBoundingClientRect().width===innerWidth);
    await page.waitForFunction(()=>{const cards=[...document.querySelectorAll('[data-variation-number]')];return cards.length>1&&Math.abs(cards[0].getBoundingClientRect().top-cards[1].getBoundingClientRect().top)<2;});
    await page.screenshot({path:`${folder}/measure-variations-fullscreen.png`});
    await clickText(page,"Use variation");
    await page.waitForFunction(()=>!document.querySelector("#measure-variations-title"));
    const applied=await save();
    assert.notDeepEqual(applied.measures[6],introduced.measures[6]);
    assert.deepEqual(applied.measures.slice(0,6),introduced.measures.slice(0,6),"Browsing changes only the selected measure");
    await page.click("button[aria-label=undo]");assert.deepEqual(await save(),introduced,"Applying a variation is one undoable edit");
    await page.click("button[aria-label=redo]");assert.deepEqual(await save(),applied);
    await page.setViewport({width:390,height:844});
    await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
    await checkBounds();
    await select(0); await clickText(page,"Adjust"); await page.waitForSelector("[role=menu]");
    await page.waitForFunction(()=>getComputedStyle(document.querySelector("[role=menu]").parentElement).opacity==="1");
    assert(await page.$eval("[data-measure-toolbar]",el=>{const b=el.getBoundingClientRect();return b.left>=0&&b.right<=innerWidth;}),"Toolbar fits a phone");
    assert(await page.$eval("[role=menu]",el=>{const b=el.getBoundingClientRect();return b.left>=0&&b.right<=innerWidth&&b.bottom<=innerHeight;}),"Adjustment menu fits a phone");
    await page.screenshot({path:`${folder}/adjust-mobile.png`});
    await page.keyboard.press("Escape");
    await page.waitForFunction(()=>!document.querySelector("[role=menu]"));
    await page.click("button[aria-label='Close measure tools']");
    await page.$eval("[data-measure-index='1'] [data-measure-trigger]",el=>el.focus()); await page.keyboard.press("Enter");
    await page.waitForSelector("[role=toolbar][aria-label='Measure 2 tools']");
    await page.waitForFunction(()=>document.activeElement?.textContent==="Copy");
    await page.keyboard.press("Escape");
    assert.equal(await page.$("[data-measure-toolbar]"),null);
    assert.equal(await page.evaluate(()=>document.activeElement?.getAttribute("aria-label")),"Modify measure 2");
    const touch=await browser.newPage();
    touch.on("pageerror",e=>errors.push(e.message));
    await touch.setViewport({width:390,height:844,isMobile:true,hasTouch:true});
    await touch.setRequestInterception(true); touch.on("request",intercept);
    await touch.goto(`${origin}/rhythms/editor`,{waitUntil:"networkidle0"});
    await clickText(touch,"Open in score"); await touch.waitForSelector("#vexflow [data-measure-trigger]");
    assert.equal(await touch.$("[data-measure-toolbar]"),null);
    await touch.waitForFunction(()=>getComputedStyle(document.querySelector("[data-measure-trigger]")).opacity==="1");
    await touch.tap("[data-measure-index='0'] [data-measure-trigger]");
    await touch.waitForSelector("[role=toolbar][aria-label='Measure 1 tools']");
    assert.deepEqual(errors,[]);
    console.log("Passed: hover trigger, explicit tool opening, notation containment, scoped shuffle, clipboard insertion on both sides, duplication, undo/redo, saving, keyboard selection, and mobile toolbar.");
  }catch(error){console.error(errors);await page.screenshot({path:`${folder}/failure.png`,fullPage:true});throw error;}
  finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
