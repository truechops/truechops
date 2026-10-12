// UI checks against a running Next server. API fixtures are intercepted in
// the browser; this script never writes accounts or rhythms to a real DB.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const puppeteer = require("puppeteer");
const origin = process.argv[2] || "http://127.0.0.1:3104";
const folder = "book-output/social-preview";
fs.mkdirSync(folder,{recursive:true});
const note=(duration,hit=true)=>({duration,notes:hit?["C5"]:[],dots:0,ornaments:"",velocity:.5});
const score={parts:{snare:{enabled:true}},measures:[
  {timeSig:{num:4,type:4},parts:[{instrument:"snare",voices:[{notes:[note(8),note(8),note(4),note(8,false),note(8),note(8),note(8)],tuplets:[]}]}]},
  {timeSig:{num:4,type:4},parts:[{instrument:"snare",voices:[{notes:[note(4),note(8),note(8),note(4),note(4)],tuplets:[]}]}]},
]};
const creator={id:"profile-one",handle:"maya_pulse",displayName:"Maya Rivers",bio:"Finding the groove between the notes. Snare studies, odd meters, and a little space to breathe.",instruments:["snare","drumset"],joinedAt:"2026-10-01"};
let myProfile=null, signedIn=false, saved=new Set(), requests=[];
const rhythms=["The space between","Five against the pulse","An eighth-note conversation","Make room for the backbeat"].map((name,i)=>({id:`rhythm-${i}`,name,description:["Keep the pulse steady. Let the spaces speak.","A shifting pattern that keeps coming home.","Start slowly, then make the two bars feel like one phrase.","Listen to the distance between each entrance."][i],tags:[["syncopation","space"],["coordination","quintuplets"],["eighths","groove"],["backbeat","independence"]][i],instruments:["snare"],difficulty:["intermediate","advanced","beginner","intermediate"][i],visibility:"public",tempo:[90,70,80,100][i],measureCount:2,score,mutations:[],creator,isOwner:false,saved:false}));
const mine={...rhythms[0],id:"mine",name:"My private practice",visibility:"private",isOwner:true,creator:null};
const decorate=(r)=>({...r,saved:saved.has(r.id)});
async function clickText(page,label) {
  const buttons=await page.$$("main button, [role=dialog] button");
  for(const button of buttons) if(await button.evaluate((el,text)=>el.textContent.trim()===text,label)) {await button.click();return;}
  throw new Error(`No button: ${label}`);
}
async function field(page,label,value) {
  const labels=await page.$$("main label, [role=dialog] label");
  for(const entry of labels) if(await entry.evaluate((el,text)=>el.textContent.trim().startsWith(text),label)) {
    const input=await entry.$("input, textarea, select");
    const tag=await input.evaluate((el)=>el.tagName);
    if(tag==='SELECT') await input.select(value); else {await input.click({clickCount:3});await input.type(value);}
    return;
  }
  throw new Error(`No field: ${label}`);
}
(async()=>{
  const browser=await puppeteer.launch({headless:"new",args:["--no-sandbox"],timeout:20000});
  const errors=[];
  try {
    const page=await browser.newPage();
    page.on("pageerror",error=>errors.push(error.message));
    await page.setViewport({width:1440,height:1080});
    await page.setRequestInterception(true);
    page.on("request",async(req)=>{
      const url=new URL(req.url());
      const send=(body,status=200)=>req.respond({status,contentType:"application/json",body:JSON.stringify(body)});
      if(url.origin!==origin) {
        if(url.hostname.includes("google-analytics") || url.hostname.includes("googleapis") || url.hostname.includes("doubleclick")) return req.abort();
        return req.continue();
      }
      if(url.pathname==="/api/auth/me") return send({user:signedIn?{id:"reader",name:"Alex Carter",email:"alex@example.test"}:null});
      if(!url.pathname.startsWith("/api/social/")) return req.continue();
      const path=url.pathname.slice("/api/social/".length), method=req.method();
      requests.push({path,method,query:url.search});
      const body=req.postData()?JSON.parse(req.postData()):{};
      if(path==="search") return send({items:url.searchParams.get("type")==="users"?[creator]:rhythms.map(decorate),hasMore:false,page:1});
      if(path===`profiles/${creator.handle}`) return send({profile:creator,isOwner:false,items:rhythms.map(decorate),hasMore:false,page:1});
      if(path==="profile") {if(method==="PUT")myProfile={...body,id:"me",joinedAt:"2026-10-12"};return send({profile:myProfile});}
      if(path==="library")return send({items:url.searchParams.get("tab")==="saved"?rhythms.filter((r)=>saved.has(r.id)).map(decorate):[mine],page:1,hasMore:false});
      if(path.endsWith("/save")) {const id=path.split("/")[1];if(method==="PUT")saved.add(id);else saved.delete(id);return send({saved:saved.has(id)});}
      if(path==="rhythms"&&method==="POST")return send({rhythm:{...body,id:"created",isOwner:true}},201);
      if(path==="rhythms/mine"&&method==="PATCH") {Object.assign(mine,body);return send({rhythm:mine});}
      if(path.startsWith("rhythms/"))return send({rhythm:decorate(rhythms.find((r)=>r.id===path.split("/")[1])||mine)});
      return send({error:"Unexpected fixture route"},404);
    });
    await page.goto(`${origin}/discover`,{waitUntil:"networkidle0"});
    await page.waitForSelector("main .vf-stavenote");
    assert((await page.$eval("main",el=>el.innerText)).includes("Sign in to save"));
    await page.screenshot({path:`${folder}/discover-desktop.png`,fullPage:true});
    await page.type("#community-search","triplets");await clickText(page,"Search");
    await page.waitForFunction(()=>location.search.includes("q=triplets"));
    await clickText(page,"People");await page.waitForSelector(`main a[href='/u/${creator.handle}']`);
    assert(requests.some((r)=>r.path==="search"&&r.query.includes("type=users")&&r.query.includes("q=triplets")));
    await page.click(`main a[href='/u/${creator.handle}']`);
    await page.waitForFunction(()=>document.querySelector("main h1")?.textContent==="Maya Rivers");
    await page.screenshot({path:`${folder}/public-profile.png`,fullPage:true});
    signedIn=true;
    await page.goto(`${origin}/discover`,{waitUntil:"networkidle0"});
    await clickText(page,"Save rhythm");await page.waitForFunction(()=>Array.from(document.querySelectorAll("main button")).some((el)=>el.textContent==="Saved"));
    assert(saved.has("rhythm-0"));
    await page.goto(`${origin}/profile`,{waitUntil:"networkidle0"});
    await clickText(page,"Create public profile");
    await field(page,"Handle","alex_beats");await field(page,"Bio","Working on the quiet notes.");
    await page.$eval("form",form=>form.requestSubmit());
    await page.waitForFunction(()=>document.querySelector("main")?.innerText.includes("Your public profile is saved."));
    assert.equal(myProfile.handle,"alex_beats");
    await clickText(page,"Saved from the community");await page.waitForSelector("main article");
    assert((await page.$eval("main",el=>el.innerText)).includes("The space between"));
    await page.screenshot({path:`${folder}/my-profile.png`,fullPage:true});
    await clickText(page,"My creations");await page.waitForFunction(()=>document.querySelector("main")?.innerText.includes("My private practice"));
    await clickText(page,"Edit details");await page.waitForSelector("[role=dialog]");
    await field(page,"Title","My updated practice");await field(page,"Visibility","public");await clickText(page,"Save & publish");
    await page.waitForFunction(()=>!document.querySelector("[role=dialog]"));assert.equal(mine.visibility,"public");
    await page.goto(`${origin}/rhythms/rhythm-0`,{waitUntil:"networkidle0"});
    await clickText(page,"Practice");await page.waitForFunction(()=>location.pathname==="/");
    await page.waitForSelector("button[aria-label='save']");await page.click("button[aria-label='save']");
    await page.waitForSelector("[role=dialog]");await field(page,"Title","Saved from the composer");await clickText(page,"Save privately");
    await page.waitForFunction(()=>document.body.innerText.includes("Saved to your profile."));
    assert(requests.some((r)=>r.path==="rhythms"&&r.method==="POST"));
    await page.setViewport({width:390,height:844});
    await page.goto(`${origin}/discover`,{waitUntil:"networkidle0"});await page.waitForSelector("main .vf-stavenote");
    assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),"Mobile page must not overflow horizontally");
    await page.screenshot({path:`${folder}/discover-mobile.png`,fullPage:true});
    assert.deepEqual(errors,[]);
    console.log("Passed: signed-out browse, query search, people/profile links, account saves, profile creation, publishing, composer save, practice, and mobile layout.");
    console.log(`Screenshots: ${folder}`);
  } finally {await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
