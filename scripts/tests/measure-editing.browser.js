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
    assert.equal(await page.$("[data-measure-trigger]"),null,"Measures have no hover trigger; the score toolbar holds the tools");
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
      await page.click(`[data-measure-index='${index}'] [data-measure-background]`);
      await page.waitForFunction((i)=>document.querySelector(`[data-measure-index='${i}']`)?.dataset.selected==="true",{},index);
    };
    const mode=async(name)=>{ await clickText(page,name); await page.waitForFunction((label)=>[...document.querySelectorAll("[aria-label=Mode] button")].some(el=>el.textContent===label&&el.getAttribute("aria-pressed")==="true"),{},name); };
    const menuOpen=async()=>{ await page.waitForSelector("[role=menu]"); await page.waitForFunction(()=>getComputedStyle(document.querySelector("[role=menu]").parentElement).opacity==="1"); };
    const save=async()=>{
      await page.waitForFunction(()=>!document.querySelector("[role=menu]"));
      snapshot=null; await page.click("button[aria-label=save]"); await page.waitForSelector("#rhythm-dialog-title");
      await clickText(page,"Save privately"); await page.waitForFunction(()=>!document.querySelector("[role=dialog]"));
      assert(snapshot);
      const selected=await page.$("[data-measure-index][data-selected=true]");
      if(selected) await select(await selected.evaluate(el=>Number(el.dataset.measureIndex)));
      return structuredClone(snapshot);
    };
    // Clicking a measure selects it in place; its tools live in the score toolbar.
    await select(1);
    assert.equal(await page.$eval("[data-measure-index='1']",el=>el.getAttribute("aria-pressed")),"true");
    await page.screenshot({path:`${folder}/measure-selected.png`});
    // Every tab and mode keeps its tools on one row, so the toolbar never changes
    // height and the score actions never move.
    const toolbarLayout=()=>page.evaluate(()=>{
      const toolbar=document.querySelector("section[aria-label='Score tools']").getBoundingClientRect(), save=document.querySelector("button[aria-label=save]").getBoundingClientRect();
      const tools=[...document.querySelectorAll("section[aria-label='Score tools'] [class*=tools]")];
      return {height:Math.round(toolbar.height),save:[Math.round(save.left),Math.round(save.top),Math.round(save.width)],overflow:tools.some(row=>row.scrollWidth>row.clientWidth)};
    });
    const layouts={};
    for(const tab of ["Measure","Notes","Ornaments"]){ await clickText(page,tab); layouts[tab]=await toolbarLayout(); }
    await mode("Mutate"); layouts.Mutate=await toolbarLayout();
    assert.deepEqual(Object.values(layouts),Object.values(layouts).map(()=>({...layouts.Measure,overflow:false})),"Toolbar height and actions are identical in every tab and mode");
    assert.deepEqual(await page.$$eval("[aria-label='Vary the measure'] button",els=>els.map(el=>el.getAttribute("aria-label")||el.textContent.trim())),["Stickings","Accents","Diddles","Cheese","Flams","More"]);
    await clickText(page,"More"); await menuOpen();
    assert.deepEqual(await page.$$eval("[role=menuitem]",els=>els.map(el=>el.textContent.trim())),["Browse variations","Find matching rhythms"]);
    await page.screenshot({path:`${folder}/mutate-desktop.png`});
    await page.keyboard.press("Escape");
    await page.waitForFunction(()=>!document.querySelector("[role=menu]"));
    await clickText(page,"Accents");
    const shuffled=await save();
    assert.notDeepEqual(shuffled.measures[1],score.measures[1]);
    assert.deepEqual(shuffled.measures.filter((_,i)=>i!==1),score.measures.filter((_,i)=>i!==1),"Only the selected measure changes");
    await checkBounds();
    await page.click("button[aria-label=undo]"); assert.deepEqual(await save(),score,"Variation undo restores all notation");
    await page.click("button[aria-label=redo]"); assert.deepEqual(await save(),shuffled,"Redo restores the same variation");
    await mode("Edit"); await clickText(page,"Measure");
    await select(0); await clickText(page,"Copy");
    await select(2); await clickText(page,"Paste"); await clickText(page,"Paste before");
    await page.waitForFunction(()=>document.querySelectorAll("[data-measure-index]").length===5);
    const left=await save(); assert.deepEqual(left.measures[2],score.measures[0]); assert.deepEqual(left.measures[3],score.measures[2]);
    await clickText(page,"Paste"); await clickText(page,"Paste after");
    await page.waitForFunction(()=>document.querySelectorAll("[data-measure-index]").length===6);
    const right=await save(); assert.deepEqual(right.measures[3],score.measures[0]);
    await clickText(page,"More"); await clickText(page,"Duplicate measure"); await page.waitForFunction(()=>document.querySelectorAll("[data-measure-index]").length===7);
    const duplicate=await save(); assert.deepEqual(duplicate.measures[4],score.measures[0]);
    await page.focus("button[aria-label=redo]");
    await page.keyboard.down("Control"); await page.keyboard.press("z"); await page.keyboard.up("Control");
    assert.deepEqual(await save(),right,"Inserted measures support keyboard undo while a button has focus");
    await page.click("button[aria-label=redo]"); assert.deepEqual(await save(),duplicate);
    await checkBounds();
    await mode("Mutate");
    await select(6);
    assert.equal(await page.$eval("button[aria-label=Accents]",el=>el.disabled),true,"Absent markings cannot be shuffled");
    await clickText(page,"Diddles");
    const introduced=await save();
    assert(introduced.measures[6].parts[0].voices[0].notes.some(note=>note.ornaments.includes("d")),"Varying introduces missing diddles");
    await clickText(page,"More"); await clickText(page,"Browse variations");
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
    await page.select("select:has(option[value=all])","all"); await clickText(page,"Stickings");
    const everywhere=await save();
    assert.equal(everywhere.measures.filter((measure,i)=>JSON.stringify(measure)!==JSON.stringify(applied.measures[i])).length,applied.measures.filter(measure=>measure.parts[0].voices[0].notes.some(note=>note.notes.length)).length,"All measures varies every measure with notes");
    await page.click("button[aria-label=undo]"); assert.deepEqual(await save(),applied,"Varying all measures is one undoable edit");
    await page.select("select:has(option[value=all])","selected");
    await page.setViewport({width:390,height:844});
    await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
    await checkBounds();
    await select(0); await clickText(page,"More"); await menuOpen();
    assert(await page.$eval("section[aria-label='Score tools']",el=>{const b=el.getBoundingClientRect();return b.left>=0&&b.right<=innerWidth;}),"Toolbar fits a phone");
    assert(await page.$eval("[role=menu]",el=>{const b=el.getBoundingClientRect();return b.left>=0&&b.right<=innerWidth&&b.bottom<=innerHeight;}),"Menu fits a phone");
    assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),"No sideways page scroll on a phone");
    await page.screenshot({path:`${folder}/mutate-mobile.png`});
    await page.keyboard.press("Escape");
    await page.waitForFunction(()=>!document.querySelector("[role=menu]"));
    await page.$eval("[data-measure-index='1']",el=>el.focus()); await page.keyboard.press("Enter");
    await page.waitForFunction(()=>document.querySelector("[data-measure-index='1']")?.dataset.selected==="true");
    await page.waitForFunction(()=>document.activeElement?.getAttribute("aria-label")==="Measure 2");
    const touch=await browser.newPage();
    touch.on("pageerror",e=>errors.push(e.message));
    await touch.setViewport({width:390,height:844,isMobile:true,hasTouch:true});
    await touch.setRequestInterception(true); touch.on("request",intercept);
    await touch.goto(`${origin}/rhythms/editor`,{waitUntil:"networkidle0"});
    await clickText(touch,"Open in score"); await touch.waitForSelector("#vexflow [data-measure-index='0']");
    await touch.tap("[data-measure-index='0'] [data-measure-background]");
    await touch.waitForFunction(()=>document.querySelector("[data-measure-index='0']")?.dataset.selected==="true");
    assert.deepEqual(errors,[]);
    console.log("Passed: in-place selection, notation containment, scoped and all-measure variations, clipboard insertion on both sides, duplication, undo/redo, saving, keyboard selection, and phone layout.");
  }catch(error){console.error(errors);await page.screenshot({path:`${folder}/failure.png`,fullPage:true});throw error;}
  finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
