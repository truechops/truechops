// Browser fixtures keep all account mutations and media playback local.
const assert = require("node:assert/strict"), fs = require("node:fs"), puppeteer = require("puppeteer");
const origin = process.argv[2] || "http://127.0.0.1:3104", folder = "book-output/immersive-preview";
fs.mkdirSync(folder, { recursive:true });
const score = { parts:{snare:{enabled:true}}, measures:[{timeSig:{num:2,type:4},parts:[{instrument:"snare",voices:[{notes:["ra","l","rd","lc","rf","l","ra","l"].map(ornaments=>({notes:["C5"],duration:16,dots:0,ornaments,velocity:.5})),tuplets:[]}]}]}] };
const creator = {id:"creator",displayName:"Jared Simon",handle:"boomcat",instruments:["snare"]};
const make = (id,name) => ({id,name,score,creator,tempo:90,tags:["coordination"],instruments:["snare"],visibility:"public",saved:false,isOwner:false,media:[{id:`video-${id}`,kind:"video",status:"ready",name:"Demonstration",thumbnailUrl:`${origin}/fixture.svg`}]});
const rhythms = [make("first","Eight-note flow"), make("second","A little more bounce"), make("third","Keep it moving")];
let signedIn=true, likes=12, saved=false, posted=[], creations=[];
const comments = Array.from({length:16},(_,i)=>({id:`comment-${i}`,text:"A great rhythm to practice. The accents really bring this to life.",author:{...creator,handle:`drummer_${i+1}`},createdAt:"2026-10-12T12:00:00.000Z",canDelete:false}));
const errors=[];
const active="[data-slide-index][data-active=true]";
async function fits(page) {
  assert(await page.evaluate((selector)=>{
    const root=document.querySelector(selector), notation=root.querySelector('[aria-label="Exercise notation"]'), video=root.querySelector('iframe');
    const n=notation.getBoundingClientRect(), v=video?.getBoundingClientRect();
    return n.bottom<=innerHeight && n.left>=0 && n.right<=innerWidth && (!v || n.top>=v.bottom) && notation.scrollWidth<=notation.clientWidth+1 && document.documentElement.scrollWidth<=innerWidth;
  },active),"Notation stays under the video, inside the viewport and without horizontal overflow");
}
(async()=>{
  const browser=await puppeteer.launch({headless:"new",args:["--no-sandbox"],timeout:20000});
  const page=await browser.newPage();
  page.on("pageerror",e=>errors.push(e.message));
  try {
    await page.setViewport({width:1440,height:900});
    await page.setRequestInterception(true);
    page.on("request",req=>{
      const url=new URL(req.url()),method=req.method();
      const send=(body,status=200)=>req.respond({status,contentType:"application/json",body:JSON.stringify(body)});
      if(url.hostname==="player.mediadelivery.net") return req.respond({status:200,contentType:"text/html; charset=utf-8",body:'<html><body style="margin:0;background:radial-gradient(ellipse at 40% 20%,#957f65,#383c47 45%,#151820);color:white;height:100vh;display:grid;place-items:center;font:14px system-ui"><div style="text-align:center"><div style="border:1px solid #ffffff70;border-radius:50%;padding:20px;font-size:32px">▶</div><p>Video demonstration</p></div></body></html>'});
      if(url.origin!==origin) return req.abort();
      if(url.pathname==="/fixture.svg") return req.respond({status:200,contentType:"image/svg+xml",body:'<svg xmlns="http://www.w3.org/2000/svg" width="600" height="600"><rect width="600" height="600" fill="#70685c"/></svg>'});
      if(url.pathname==="/api/auth/me") return send({user:signedIn?{id:"visitor",name:"Practice Tester"}:null});
      if(!url.pathname.startsWith("/api/social/"))return req.continue();
      const route=url.pathname.slice(12),body=req.postData()?JSON.parse(req.postData()):{},[,id,action]=route.split("/");
      if(route==="search")return send({items:url.searchParams.get("type")==="users"?[creator]:rhythms,hasMore:false,page:1});
      if(route==="rhythms"&&method==="POST") {creations.push(body);return send({rhythm:{...body,id:`saved-${creations.length}`}},201);}
      if(action==="similar")return send({items:rhythms.filter(r=>r.id!==id),hasMore:false,page:1});
      if(action==="engagement")return send({likeCount:likes,commentCount:comments.length+posted.length,liked:likes>12});
      if(action==="like") {likes=method==="PUT"?13:12;return send({likeCount:likes,commentCount:comments.length+posted.length,liked:likes>12});}
      if(action==="save") {saved=method==="PUT";return send({saved});}
      if(action==="comments") {
        if(method==="POST") {posted.unshift({id:"my-comment",text:body.text,author:creator,createdAt:new Date().toISOString(),canDelete:true});return send({likeCount:likes,commentCount:comments.length+posted.length,liked:likes>12});}
        if(method==="DELETE") {posted=[];return send({likeCount:likes,commentCount:comments.length,liked:likes>12});}
        return send({items:[...posted,...comments],hasMore:false,page:1});
      }
      if(action==="media")return send({embedUrl:`https://player.mediadelivery.net/embed/1/${id}`,expiresAt:new Date(Date.now()+3600000)});
      if(route===`rhythms/${id}`)return send({rhythm:{...rhythms.find(r=>r.id===id),saved}});
      return send({error:"Unexpected fixture request"},404);
    });
    await page.goto(`${origin}/discover`,{waitUntil:"networkidle0",timeout:60000});
    await page.click("main a[href='/rhythms/first']");
    await page.waitForSelector(`${active} iframe`);
    await page.waitForSelector(`${active} .vf-stavenote`);
    await page.waitForFunction(()=>getComputedStyle(document.querySelector(".MuiDialog-container")).opacity==="1");
    await fits(page);
    assert.equal(await page.$("aside[aria-label$='panel']"),null,"Panels start closed");
    assert(await page.$eval(`${active} header`,el=>{const b=el.getBoundingClientRect();return b.top<100&&b.left<70;}),"Metadata sits at top left");
    await page.screenshot({path:`${folder}/viewer-desktop.png`});
    await page.click(`${active} button[aria-label='Save rhythm']`);
    await page.waitForSelector(`${active} button[aria-label='Unsave rhythm']`);assert(saved);
    await page.click(`${active} button[aria-label='Like rhythm']`);
    await page.waitForSelector(`${active} button[aria-label='Unlike rhythm']`);
    await page.click(`${active} button[aria-label='Comments']`);
    await page.waitForSelector("aside[aria-label='Comments panel'] article");
    await fits(page);
    await page.type("textarea[placeholder='Add a comment...']","Working on these accents!");
    await page.click("aside form button");
    await page.waitForFunction(()=>document.querySelector("aside")?.innerText.includes("Working on these accents!"));
    assert.equal(posted.length,1);
    const list=await page.$("aside article");
    await list.evaluate(el=>el.parentElement.scrollTop=200);
    assert.equal(await page.$eval("[aria-label='Rhythms and similar rhythms']",el=>el.scrollTop),0,"Comments scroll independently");
    await page.screenshot({path:`${folder}/comments-desktop.png`});
    await page.click(`${active} button[aria-label='Variations']`);
    await page.waitForSelector("button[aria-label='Preview stickings variation 1'] .vf-stavenote");
    const firstNotation=await page.$("button[aria-label='Preview stickings variation 1'] svg");
    await page.$eval('[data-variation-list]',el=>el.scrollTop=30);
    await page.waitForFunction(()=>document.querySelector('[data-variation-list]').scrollTop===30);
    await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
    assert(await firstNotation.evaluate(el=>el.isConnected),"Scrolling reuses existing notation instead of redrawing it");
    const initialCount=await page.$eval("[data-variation-list]",el=>Number(el.dataset.generatedCount));
    for(let i=0;i<5;i++) {
      const before=await page.$eval("[data-variation-list]",el=>Number(el.dataset.generatedCount));
      await page.$eval("[data-variation-list]",el=>el.scrollTop=el.scrollHeight);
      await page.waitForFunction(count=>Number(document.querySelector('[data-variation-list]').dataset.generatedCount)>count,{},before);
    }
    assert(await page.$eval("[data-variation-list]",(el,count)=>Number(el.dataset.generatedCount)>=count+60,initialCount),"Scrolling keeps creating variations");
    assert((await page.$$('[data-variation-number]')).length<20,"Long browsing sessions keep the rendered notation bounded");
    await page.$eval("[data-variation-list]",el=>el.scrollTop=0);
    await page.waitForSelector("button[aria-label='Preview stickings variation 1']");
    await page.click("button[aria-label='Preview stickings variation 1']");
    await page.waitForFunction(()=>document.querySelector('[aria-label="Exercise content"]').innerText.includes("Variation preview"));
    await page.click("button[aria-label='Play variation 1']");
    await page.waitForSelector("button[aria-label='Stop variation 1']");
    await page.click("button[aria-label='Stop variation 1']");
    await page.click("button[aria-label='Save variation 1']");
    await page.waitForSelector("button[aria-label='Variation 1 saved']");
    assert.equal(creations.length,1);assert.equal(creations[0].visibility,"private");assert.notDeepEqual(creations[0].score,score);
    await page.$eval("[aria-label='stickings variations']",el=>el.scrollTop=400);
    assert.equal(await page.$eval("[aria-label='Rhythms and similar rhythms']",el=>el.scrollTop),0,"Variations scroll independently");
    await page.screenshot({path:`${folder}/variations-desktop.png`});
    await page.click("button[aria-label='Maximize variations']");
    await page.waitForFunction(()=>{const b=document.querySelector("aside[aria-label='Variations panel']").getBoundingClientRect();return b.width>=innerWidth-1&&b.height>=innerHeight-1;});
    await page.$eval("[data-variation-list]",el=>el.scrollTop=0);
    await page.waitForFunction(()=>{const cards=[...document.querySelectorAll('[data-variation-number]')];return cards.length>1&&Math.abs(cards[0].getBoundingClientRect().top-cards[1].getBoundingClientRect().top)<2&&cards[1].getBoundingClientRect().left>cards[0].getBoundingClientRect().left;});
    await page.screenshot({path:`${folder}/variations-fullscreen-grid.png`});
    for(const name of ["Diddles","Cheese","Flams"]) await page.$$eval('[aria-label="Variation types"] button',(buttons,label)=>buttons.find(button=>button.textContent===label).click(),name);
    assert.equal(await page.$$eval('[aria-label="Variation types"] [aria-pressed=true]',els=>els.length),4);
    await page.waitForSelector("button[aria-label='Save variation 1']");
    await page.click("button[aria-label='Save variation 1']");
    await page.waitForFunction(()=>document.querySelector("button[aria-label='Variation 1 saved']"));
    const mixed=creations.at(-1).score.measures[0].parts[0].voices[0].notes;
    for(const letter of "dcf") assert(mixed.some(note=>note.ornaments.includes(letter)),"Each selected ornament is present");
    await page.keyboard.press("Escape");
    await page.waitForSelector("button[aria-label='Maximize variations']");
    await page.keyboard.press("Escape");
    await page.waitForFunction(()=>!document.querySelector("aside[aria-label$='panel']"));
    assert.equal(await page.evaluate(()=>document.activeElement?.getAttribute("aria-label")),"Variations");
    for(const viewport of [{width:1280,height:600},{width:900,height:720},{width:390,height:844},{width:320,height:740}]) {
      await page.setViewport(viewport);
      await page.waitForFunction(()=>document.querySelector('[data-active="true"] [aria-label="Exercise notation"]').getBoundingClientRect().bottom<=innerHeight);
      await fits(page);
      await page.focus(`${active} button[aria-label='Variations']`);
      await page.keyboard.press("Enter");
      await page.waitForSelector("aside[aria-label='Variations panel']");
      assert(await page.$eval("aside",el=>{const b=el.getBoundingClientRect();return b.right<=innerWidth&&b.left>=0&&b.bottom<=innerHeight&&b.width>=Math.min(290,innerWidth-24);}),"Side panel stays readable and fits viewport");
      await page.screenshot({path:`${folder}/variations-${viewport.width}.png`});
      if([900,390].includes(viewport.width)) {
        await page.click("button[aria-label='Maximize variations']");
        await page.waitForFunction(()=>{const b=document.querySelector("aside[aria-label='Variations panel']").getBoundingClientRect();return b.width>=innerWidth-1&&b.height>=innerHeight-1;});
        await page.waitForFunction(columns=>{const cards=[...document.querySelectorAll('[data-variation-number]')],top=cards[0]?.getBoundingClientRect().top;return cards.filter(card=>Math.abs(card.getBoundingClientRect().top-top)<2).length===columns;},{},viewport.width===900?2:1);
        assert(await page.$eval('[data-variation-browser]',el=>el.scrollWidth<=el.clientWidth+1),"Full-screen variation controls fit smaller screens");
        const before=await page.$eval('[data-variation-list]',el=>Number(el.dataset.generatedCount));
        await page.$eval('[data-variation-list]',el=>el.scrollTop=el.scrollHeight);
        await page.waitForFunction(count=>Number(document.querySelector('[data-variation-list]').dataset.generatedCount)>count,{},before);
        await page.screenshot({path:`${folder}/variations-fullscreen-${viewport.width}.png`});
      }
      await page.click("button[aria-label='Close side panel']");
      await page.waitForFunction(()=>!document.querySelector("aside[aria-label$='panel']"));
    }
    await page.setViewport({width:1440,height:900});
    await page.$eval("[aria-label='Rhythms and similar rhythms']",el=>el.scrollBy({top:el.clientHeight,behavior:"instant"}));
    await page.waitForFunction(()=>document.querySelector("#rhythm-post-title")?.textContent==="A little more bounce");
    await page.waitForSelector(`${active} iframe`);
    assert.equal(await page.$$eval("[data-slide-index] iframe",els=>els.length),1,"Offscreen videos are unmounted");
    await page.screenshot({path:`${folder}/similar-rhythm.png`});
    await page.click("button[aria-label='Close rhythm']");
    await page.waitForFunction(()=>!document.querySelector("[role=dialog]"));
    assert.equal(await page.evaluate(()=>document.activeElement?.getAttribute("href")),"/rhythms/first","Close returns focus to original search card");
    await page.goto(`${origin}/rhythms/first`,{waitUntil:"networkidle0"});
    await page.waitForSelector(`${active} iframe`); await fits(page);
    signedIn=false;
    await page.reload({waitUntil:"networkidle0"});
    await page.waitForSelector("a[aria-label='Sign in to save']");
    await page.click(`${active} button[aria-label='Comments']`);
    await page.waitForSelector("aside article");assert.equal(await page.$("aside textarea"),null);
    assert.deepEqual(errors,[]);
    console.log("Passed: immersive search/deep links, viewport notation, comments, likes, save, real variations/playback/private saving, independent panels, similar feed, focus, signed-out state, and responsive layouts.");
  } catch(error) {console.error(errors);await page.screenshot({path:`${folder}/failure.png`});throw error;}
  finally {await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
