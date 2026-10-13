// UI checks against a running Next server. API fixtures are intercepted in
// the browser; this script never writes accounts or rhythms to a real DB.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const puppeteer = require("puppeteer");
const origin = process.argv[2] || "http://127.0.0.1:3104";
const folder = "book-output/community-practice-preview";
fs.mkdirSync(folder,{recursive:true});
const note=(duration,hit=true)=>({duration,notes:hit?["C5"]:[],dots:0,ornaments:"",velocity:.5});
const score={parts:{snare:{enabled:true}},measures:[
  {timeSig:{num:4,type:4},parts:[{instrument:"snare",voices:[{notes:[note(8),note(8),note(4),note(8,false),note(8),note(8),note(8)],tuplets:[]}]}]},
  {timeSig:{num:4,type:4},parts:[{instrument:"snare",voices:[{notes:[note(4),note(8),note(8),note(4),note(4)],tuplets:[]}]}]},
]};
const creator={id:"profile-one",handle:"maya_pulse",displayName:"Maya Rivers",bio:"Finding the groove between the notes. Snare studies, odd meters, and a little space to breathe.",instruments:["snare","drumset"],joinedAt:"2026-10-01"};
const people=[creator,...[["Theo Park","theo_park"],["Jules Moreno","jules_plays"],["Sam Brooks","sam_brooks"]].map(([displayName,handle],i)=>({...creator,id:`person-${i}`,displayName,handle}))];
let myProfile=null, signedIn=false, saved=new Set(), requests=[], likes=new Set(), comments=[];
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
      const body=req.postData()?JSON.parse(req.postData()):{};
      requests.push({path,method,query:url.search,body});
      if(typeof body.tags==="string") body.tags=body.tags.split(",").map((tag)=>tag.trim()).filter(Boolean);
      if(path==="search") {
        const query=url.searchParams.get("q"), users=url.searchParams.get("type")==="users";
        if(query==="slow") {
          await new Promise((resolve)=>setTimeout(resolve,1000));
          return send({items:users?[{...creator,displayName:"Outdated drummer"}]:[{...rhythms[0],name:"Outdated rhythm"}],hasMore:false,page:1}).catch(()=>{});
        }
        if(query==="unavailable" && !users) return send({error:"Search is temporarily unavailable."},503);
        if(query==="paged") {
          const pageNumber=Number(url.searchParams.get("page")||1);
          return send({items:users?people.map((person)=>({...person,displayName:`Page ${pageNumber} drummer ${person.displayName}`})):rhythms.map((rhythm)=>({...decorate(rhythm),name:`Page ${pageNumber} pattern ${rhythm.name}`})),hasMore:pageNumber<2,page:pageNumber});
        }
        return send({items:query==="no-results"?[]:users?people:rhythms.map(decorate),hasMore:false,page:1});
      }
      if(path===`profiles/${creator.handle}`) return send({profile:creator,isOwner:false,items:rhythms.map(decorate),hasMore:false,page:1});
      if(path==="profile") {if(method==="PUT")myProfile={...body,id:"me",joinedAt:"2026-10-12"};return send({profile:myProfile});}
      if(path==="library")return send({items:url.searchParams.get("tab")==="saved"?rhythms.filter((r)=>saved.has(r.id)).map(decorate):[mine],page:1,hasMore:false});
      if(path.endsWith("/save")) {const id=path.split("/")[1];if(method==="PUT")saved.add(id);else saved.delete(id);return send({saved:saved.has(id)});}
      if(path==="rhythms"&&method==="POST")return send({rhythm:{...body,id:"created",isOwner:true}},201);
      if(path==="rhythms/mine"&&method==="PATCH") {Object.assign(mine,body);return send({rhythm:mine});}
      if(path.startsWith("rhythms/")) {
        const [,id,action,commentId]=path.split("/");
        const summary=()=>({likeCount:likes.has(id)?1:0,liked:likes.has(id),commentCount:comments.filter((c)=>c.rhythmId===id).length});
        if(action==="engagement")return send(summary());
        if(action==="like") { if(method==="PUT")likes.add(id);else likes.delete(id);return send(summary()); }
        if(action==="comments") {
          if(method==="POST") {const comment={id:`comment-${Date.now()}`,rhythmId:id,text:body.text.trim(),author:myProfile||{...creator,displayName:"Alex Carter"},canDelete:true,createdAt:new Date().toISOString()};comments.unshift(comment);return send({comment,...summary()},201);}
          if(method==="DELETE") {comments=comments.filter((c)=>c.id!==commentId);return send({removed:true,...summary()});}
          return send({items:comments.filter((c)=>c.rhythmId===id),page:1,hasMore:false});
        }
      }
      if(path.startsWith("rhythms/"))return send({rhythm:decorate(rhythms.find((r)=>r.id===path.split("/")[1])||mine)});
      return send({error:"Unexpected fixture route"},404);
    });
    await page.goto(`${origin}/discover`,{waitUntil:"networkidle0"});
    await page.waitForSelector("main .vf-stavenote");
    assert(!(await page.$eval("main article",el=>el.innerText)).includes("Maya Rivers"),"Feed cards contain only the exercise");
    assert.equal(await page.$("main article button"),null,"Card social actions appear only after opening");
    assert.equal(await page.$("#community-search"),null,"Discover shows a feed, not an active search form");
    assert(!(await page.$eval("main",el=>el.innerText)).includes("Good rhythms"));
    assert(await page.$$eval("main article svg",nodes=>nodes.every(el=>el.getBoundingClientRect().width<=el.closest("article").getBoundingClientRect().width)),"Card notation fits its preview");
    await page.screenshot({path:`${folder}/discover-desktop.png`,fullPage:true});
    await page.click("main a[href='/rhythms/rhythm-0']");
    await page.waitForSelector("[role=dialog] #rhythm-post-title");
    assert((await page.$eval("[role=dialog]",el=>el.innerText)).includes("Sign in to save"));
    assert((await page.$eval("[role=dialog]",el=>el.innerText)).includes("Maya Rivers"));
    await page.waitForFunction(()=>getComputedStyle(document.querySelector(".MuiDialog-container")).opacity==="1");
    await page.screenshot({path:`${folder}/exercise-desktop.png`,fullPage:true});
    await page.keyboard.press("Escape");
    await page.waitForFunction(()=>!document.querySelector("[role=dialog]"));
    assert(!new URL(page.url()).searchParams.has("rhythm"));
    assert.equal(await page.evaluate(()=>document.activeElement?.getAttribute("href")),"/rhythms/rhythm-0","Closing returns keyboard focus to the card");
    await page.click("main a[href='/search']");
    await page.waitForFunction(()=>location.pathname==="/search" && document.activeElement?.id==="community-search");
    await page.type("#community-search","triplets");
    await page.waitForFunction(()=>location.search.includes("q=triplets"));
    await page.waitForSelector("section[aria-label='People'] article");
    await page.waitForSelector("section[aria-label='Rhythms'] .vf-stavenote");
    await page.screenshot({path:`${folder}/search-desktop.png`,fullPage:true});
    await page.click("#community-search",{clickCount:3});await page.type("#community-search","slow");
    await page.waitForFunction(()=>location.search.includes("q=slow"));
    assert(await page.$("section[aria-label='Rhythms'] .vf-stavenote"),"Keep results in place while a search is pending");
    await page.click("#community-search",{clickCount:3});await page.type("#community-search","triplets");
    await page.waitForFunction(()=>location.search.includes("q=triplets") && document.getElementById("search-results")?.getAttribute("aria-busy")==="false");
    await new Promise((resolve)=>setTimeout(resolve,1100));
    assert(!(await page.$eval("main",el=>el.innerText)).includes("Outdated"),"A late response must not replace the current results");
    await clickText(page,"People");await page.waitForSelector(`main a[href='/u/${creator.handle}']`);
    assert.equal(await page.$("section[aria-label='Rhythms']"),null);
    assert.equal(await page.$eval("#community-search",el=>el.value),"triplets");
    assert(requests.some((r)=>r.path==="search"&&r.query.includes("type=users")&&r.query.includes("q=triplets")));
    await page.screenshot({path:`${folder}/search-people.png`,fullPage:true});
    await page.goBack();
    await page.waitForSelector("section[aria-label='Rhythms'] .vf-stavenote");
    assert.equal(await page.$eval("#tab-all",el=>el.getAttribute("aria-selected")),"true");
    await page.focus("#tab-all");await page.keyboard.press("ArrowRight");
    await page.waitForFunction(()=>document.getElementById("tab-rhythms")?.getAttribute("aria-selected")==="true");
    assert.equal(await page.$eval("#community-search",el=>el.value),"triplets");
    await page.select("select[aria-label='Difficulty']","advanced");
    await page.waitForFunction(()=>location.search.includes("difficulty=advanced"));
    await clickText(page,"People");
    await page.waitForFunction(()=>document.getElementById("tab-users")?.getAttribute("aria-selected")==="true");
    assert.equal(await page.$("select[aria-label='Difficulty']"),null);
    await clickText(page,"Rhythms");
    await page.waitForSelector("select[aria-label='Difficulty']");
    assert.equal(await page.$eval("select[aria-label='Difficulty']",el=>el.value),"advanced");
    await clickText(page,"Reset");
    await page.waitForFunction(()=>!location.search.includes("difficulty="));
    await page.click("button[aria-label='Clear search']");
    await page.waitForFunction(()=>!location.search.includes("q="));
    assert.equal(await page.$eval("#community-search",el=>el.value),"");
    await page.keyboard.press("Escape");
    await page.waitForFunction(()=>location.pathname==="/discover");
    await page.goto(`${origin}/search?q=triplets&type=users`,{waitUntil:"networkidle0"});
    assert.equal(await page.$eval("#community-search",el=>el.value),"triplets");
    await page.reload({waitUntil:"networkidle0"});
    assert.equal(await page.$eval("#tab-users",el=>el.getAttribute("aria-selected")),"true");
    await page.click(`main a[href='/u/${creator.handle}']`);
    await page.waitForFunction(()=>document.querySelector("main h1")?.textContent==="Maya Rivers");
    await page.screenshot({path:`${folder}/public-profile.png`,fullPage:true});
    signedIn=true;
    await page.goto(`${origin}/search`,{waitUntil:"networkidle0"});
    await page.click("main a[href='/rhythms/rhythm-0']");
    await page.waitForSelector("[role=dialog] #rhythm-post-title");
    await clickText(page,"Save rhythm");await page.waitForFunction(()=>Array.from(document.querySelectorAll("[role=dialog] button")).some((el)=>el.textContent==="Saved"));
    assert(saved.has("rhythm-0"));
    await page.waitForSelector("button[aria-label='Like rhythm']:not([disabled])");
    await page.click("button[aria-label='Like rhythm']");
    await page.waitForSelector("button[aria-label='Unlike rhythm']");
    await page.type("#new-comment","Working on this at 60 BPM. <script>safe text</script>");
    await clickText(page,"Post");
    await page.waitForSelector("button[aria-label='Delete comment']");
    assert.equal(comments.length,1);
    assert((await page.$eval("[role=dialog]",el=>el.innerText)).includes("<script>safe text</script>"));
    await page.waitForFunction(()=>getComputedStyle(document.querySelector(".MuiDialog-container")).opacity==="1");
    await page.screenshot({path:`${folder}/exercise-conversation.png`,fullPage:true});
    await page.click("button[aria-label='Delete comment']");
    await page.waitForFunction(()=>!document.querySelector("button[aria-label='Delete comment']"));
    assert.equal(comments.length,0);
    await page.click("button[aria-label='Close rhythm']");
    await page.waitForFunction(()=>!document.querySelector("[role=dialog]"));
    await clickText(page,"People");
    await page.waitForFunction(()=>document.getElementById("tab-users")?.getAttribute("aria-selected")==="true");
    await clickText(page,"Rhythms");
    await page.waitForSelector("section[aria-label='Rhythms'] .vf-stavenote");
    await page.click("main a[href='/rhythms/rhythm-0']");
    await page.waitForSelector("button[aria-label='Unlike rhythm']");
    assert((await page.$eval("[role=dialog]",el=>el.innerText)).includes("Saved"),"Saved state must survive category switches");
    await page.reload({waitUntil:"networkidle0"});
    await page.waitForSelector("[role=dialog] #rhythm-post-title");
    await page.click("button[aria-label='Close rhythm']");
    await page.waitForFunction(()=>!document.querySelector("[role=dialog]"));
    assert.equal(new URL(page.url()).searchParams.get("type"),"rhythms","Closing a reloaded modal preserves search context");
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
    await page.click("main a[href='/rhythms/mine']");
    await page.waitForSelector("[role=dialog] #rhythm-post-title");
    assert.equal(await page.$("#new-comment"),null,"Private rhythms have no public conversation");
    await clickText(page,"Edit details");await page.waitForSelector("#rhythm-dialog-title");
    await field(page,"Title","My updated practice");await field(page,"Visibility","public");await clickText(page,"Save & publish");
    await page.waitForFunction(()=>!document.querySelector("#rhythm-dialog-title"));assert.equal(mine.visibility,"public");
    await page.waitForFunction(()=>document.querySelector("#rhythm-post-title")?.textContent==="My updated practice");
    await page.goto(`${origin}/rhythms/rhythm-0`,{waitUntil:"networkidle0"});
    await clickText(page,"Open in score");await page.waitForFunction(()=>location.pathname==="/");
    await page.waitForSelector("button[aria-label='save']");await page.click("button[aria-label='save']");
    await page.waitForSelector("[role=dialog]");await field(page,"Title","Saved from the composer");await clickText(page,"Save privately");
    await page.waitForFunction(()=>document.body.innerText.includes("Saved to your profile."));
    assert(requests.some((r)=>r.path==="rhythms"&&r.method==="POST"&&r.body.visibility==="private"),"Composer saves are private by default");
    await page.setViewport({width:390,height:844});
    await page.goto(`${origin}/discover`,{waitUntil:"networkidle0"});await page.waitForSelector("main .vf-stavenote");
    assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),"Mobile page must not overflow horizontally");
    await page.screenshot({path:`${folder}/discover-mobile.png`,fullPage:true});
    await page.click("main a[href='/rhythms/rhythm-0']");
    await page.waitForSelector("[role=dialog] #new-comment");
    assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),"Mobile dialog must fit the screen");
    await page.waitForFunction(()=>getComputedStyle(document.querySelector(".MuiDialog-container")).opacity==="1");
    await page.screenshot({path:`${folder}/exercise-mobile.png`,fullPage:true});
    await page.click("button[aria-label='Close rhythm']");
    await page.waitForFunction(()=>!document.querySelector("[role=dialog]"));
    await page.click("button[aria-label='open drawer']");
    await page.waitForSelector("[aria-label='Practice tools']");
    assert((await page.$eval("[aria-label='Practice tools']",el=>el.innerText)).includes("Score"),"Practice navigation remains available on phones");
    await page.keyboard.press("Escape");
    await page.waitForFunction(()=>!document.querySelector("[aria-label='Practice tools']"));
    await page.click("main a[href='/search']");
    await page.waitForSelector("#community-search");
    await page.type("#community-search","groove");
    await page.waitForFunction(()=>location.search.includes("q=groove"));
    await page.waitForSelector("section[aria-label='Rhythms'] .vf-stavenote");
    assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),"Mobile search must not overflow horizontally");
    await page.screenshot({path:`${folder}/search-mobile.png`,fullPage:true});
    await page.setViewport({width:320,height:740});
    assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),"Search must fit a narrow phone");
    await page.click("main a[aria-label='Back to community']");
    await page.waitForFunction(()=>location.pathname==="/discover");
    await page.goto(`${origin}/search?q=no-results`,{waitUntil:"networkidle0"});
    assert((await page.$eval("main",el=>el.innerText)).includes("No rhythms found"));
    assert((await page.$eval("main",el=>el.innerText)).includes("No people found"));
    await page.goto(`${origin}/search?q=unavailable`,{waitUntil:"networkidle0"});
    await page.waitForSelector("[role=alert]");
    assert((await page.$eval("section[aria-label='People']",el=>el.innerText)).includes("Maya Rivers"),"One failed category must not hide the other");
    await page.goto(`${origin}/search?q=paged`,{waitUntil:"networkidle0"});
    await page.click("section[aria-label='Rhythms'] button");
    await page.waitForFunction(()=>document.getElementById("tab-rhythms")?.getAttribute("aria-selected")==="true");
    await clickText(page,"Next");
    await page.waitForFunction(()=>document.querySelector("section[aria-label='Rhythms'] article")?.textContent.includes("Page 2 pattern"));
    await clickText(page,"People");
    await page.waitForFunction(()=>document.querySelector("section[aria-label='People'] article")?.textContent.includes("Page 1 drummer"));
    assert(!new URL(page.url()).searchParams.has("page"),"Switching categories resets pagination");
    await clickText(page,"Next");
    await page.waitForFunction(()=>document.querySelector("section[aria-label='People'] article")?.textContent.includes("Page 2 drummer"));
    await page.goto(`${origin}/discover?q=triplets`,{waitUntil:"networkidle0"});
    await page.waitForFunction(()=>location.pathname==="/search" && location.search.includes("q=triplets"));
    assert.deepEqual(errors,[]);
    console.log("Passed: feed, live combined search, tabs, keyboard/back navigation, filters, deep links, empty/error states, account saves, comments, likes, modal deep links and focus, profiles, publishing, private composer saves, and mobile layouts.");
    console.log(`Screenshots: ${folder}`);
  } catch(error) {
    console.error("Runtime errors:",errors);
    for(const tab of await browser.pages()) {
      console.error("Page:",tab.url(),await tab.$eval("body",el=>el.innerText.slice(-3500)).catch(()=>"No body"));
      if(tab.url().startsWith(origin))await tab.screenshot({path:`${folder}/failure.png`,fullPage:true});
    }
    throw error;
  } finally {await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
