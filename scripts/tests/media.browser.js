// Real browser/TUS client; intercepted Bunny and account fixtures, no live uploads.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const puppeteer = require("puppeteer");
const origin = process.argv[2] || "http://127.0.0.1:3104";
const folder = "book-output/community-media-preview";
fs.mkdirSync(folder,{recursive:true});
for (const name of ["practice.mp4","practice.mp3","invalid.html"]) fs.writeFileSync(`${folder}/${name}`,"Bunny protocol test fixture");
const profile={id:"profile",displayName:"Practice Tester",handle:"practice_tester",instruments:["snare"]};
let rhythm=null,creates=0,uploadStarts=0,patches=0,failComplete=true;
const media=new Map(),requests=[],errors=[];
const decorate=()=>({...rhythm,creator:profile,instruments:["snare"],measureCount:rhythm.score.measures.length,isOwner:true,saved:false,media:[...media.values()].filter((m)=>m.attached)});
async function button(page,label) {
  for (const element of await page.$$("main button, [role=dialog] button")) if(await element.evaluate((el,text)=>el.textContent.trim()===text,label)) {
    await element.evaluate((el)=>el.scrollIntoView({block:"center"})); await element.click();return;
  }
  throw new Error(`Missing button ${label}`);
}
async function field(page,label,value) {
  for (const item of await page.$$("[role=dialog] label")) if(await item.evaluate((el,text)=>el.textContent.trim().startsWith(text),label)) {
    const input=await item.$("input,textarea,select");
    if(await input.evaluate((el)=>el.tagName==="SELECT"))await input.select(value);
    else {await input.click({clickCount:3});await input.type(value);}
    return;
  }
  throw new Error(`Missing field ${label}`);
}
(async()=>{
  const browser=await puppeteer.launch({headless:"new",args:["--no-sandbox"],timeout:20000});
  try {
    const page=await browser.newPage();page.on("pageerror",(error)=>errors.push(error.message));
    await page.setViewport({width:1440,height:1000});
    await page.setRequestInterception(true);
    page.on("request",async(req)=>{
      const url=new URL(req.url()),method=req.method();
      const send=(body,status=200)=>req.respond({status,contentType:"application/json",body:JSON.stringify(body)});
      if(url.hostname==="video.bunnycdn.com") {
        const headers={"Access-Control-Allow-Origin":origin,"Access-Control-Allow-Methods":"POST,PATCH,HEAD,OPTIONS","Access-Control-Allow-Headers":"*","Access-Control-Expose-Headers":"Location,Upload-Offset,Upload-Length,Tus-Resumable","Tus-Resumable":"1.0.0"};
        if(method==="OPTIONS")return req.respond({status:204,headers});
        if(method==="POST")return req.respond({status:201,headers:{...headers,Location:`https://video.bunnycdn.com/tusupload/${req.headers().videoid}`}});
        if(method==="HEAD")return req.respond({status:200,headers:{...headers,"Upload-Offset":"0","Upload-Length":"27"}});
        if(method==="PATCH") {patches++;return req.respond({status:204,headers:{...headers,"Upload-Offset":"27"}});}
        return req.abort();
      }
      if(url.hostname==="player.mediadelivery.net")return req.respond({status:200,contentType:"text/html",body:'<html><body style="background:#211c24;color:white;font:18px sans-serif;display:grid;place-items:center;height:90vh">Bunny player fixture</body></html>'});
      if(url.origin!==origin)return req.abort();
      if(url.pathname==="/fixture-thumbnail.svg")return req.respond({status:200,contentType:"image/svg+xml",body:'<svg xmlns="http://www.w3.org/2000/svg" width="800" height="450"><rect width="800" height="450" fill="#342332"/><circle cx="400" cy="200" r="100" fill="#b71836"/><text x="400" y="360" fill="white" text-anchor="middle" font-size="30">Video demonstration fixture</text></svg>'});
      if(url.pathname==="/api/auth/me")return send({user:{id:"owner",name:"Practice Tester",email:"test@example.test"}});
      if(!url.pathname.startsWith("/api/social/"))return req.continue();
      const route=url.pathname.slice(12),body=req.postData()?JSON.parse(req.postData()):{};
      requests.push({route,method,body});
      if(route==="rhythms"&&method==="POST") {creates++;rhythm={...body,id:"with-media",media:[]};return send({rhythm:decorate()},201);}
      if(route==="search")return send({items:rhythm?.visibility==="public"?[url.searchParams.get("type")==="users"?profile:decorate()]:[],hasMore:false,page:1});
      if(route==="profile")return send({profile});
      if(route==="library")return send({items:rhythm?[decorate()]:[],hasMore:false,page:1});
      if(route.endsWith("/engagement"))return send({likeCount:0,commentCount:0,liked:false});
      if(route.endsWith("/similar"))return send({items:[],hasMore:false,page:1});
      if(route.endsWith("/comments"))return send({items:[],hasMore:false,page:1});
      const [,id,action,mediaId,mediaAction]=route.split("/");
      if(action==="media") {
        if(mediaAction==="playback")return send({embedUrl:`https://player.mediadelivery.net/embed/123/${mediaId}?autoplay=false`,expiresAt:new Date(Date.now()+3600000)});
        if(mediaAction==="complete") {
          if(failComplete) {failComplete=false;return send({error:"Recording is still arriving. Save again to finish."},409);}
          const recording=media.get(mediaId);recording.status="ready";recording.attached=true;return send({media:recording});
        }
        if(method==="DELETE") {media.delete(mediaId);return send({removed:true});}
        if(method==="GET")return send({media:media.get(mediaId)});
        if(method==="POST") {
          uploadStarts++;
          const recording={id:`media-${uploadStarts}`,name:body.name,kind:body.kind,status:"uploading",duration:30,...(body.kind==="video"?{thumbnailUrl:`${origin}/fixture-thumbnail.svg`}:{})};
          media.set(recording.id,recording);
          return send({media:recording,upload:{endpoint:"https://video.bunnycdn.com/tusupload",headers:{AuthorizationSignature:"test-signature",AuthorizationExpire:String(Math.floor(Date.now()/1000)+3600),LibraryId:"123",VideoId:recording.id}}},201);
        }
      }
      if(route===`rhythms/${id}`) {
        if(method==="PATCH")Object.assign(rhythm,body);
        return send({rhythm:decorate()});
      }
      return send({error:"Unexpected fixture request"},404);
    });
    await page.goto(origin,{waitUntil:"networkidle0",timeout:60000});
    await page.waitForSelector("button[aria-label='save']");await page.click("button[aria-label='save']");
    await page.waitForSelector("input[aria-label='Upload video']");
    await field(page,"Title","My demonstration");
    assert.equal(await page.$("[role=dialog] textarea"),null,"Practice notes are no longer part of saving a rhythm");
    await field(page,"Visibility","public");
    await (await page.$("input[aria-label='Upload video']")).uploadFile(path.resolve(`${folder}/invalid.html`));
    await page.waitForSelector("[role=dialog] [role=alert]");assert.equal(creates,0);
    await (await page.$("input[aria-label='Upload video']")).uploadFile(path.resolve(`${folder}/practice.mp4`));
    await (await page.$("input[aria-label='Upload audio']")).uploadFile(path.resolve(`${folder}/practice.mp3`));
    await page.screenshot({path:`${folder}/upload-form.png`,fullPage:true});
    await button(page,"Save & publish");
    await page.waitForFunction(()=>document.querySelector("[role=dialog] [role=alert]")?.textContent.includes("still arriving"));
    assert.equal(creates,1);assert.equal(rhythm.visibility,"private","A failed upload cannot publish the draft");
    assert.equal(patches,1);
    await button(page,"Save & publish");
    await page.waitForFunction(()=>document.body.innerText.includes("Saved to your profile."));
    assert.equal(creates,1,"Retries reuse the private draft");
    assert.equal(uploadStarts,2,"One Bunny asset per selected file, including after retry");
    assert.equal(patches,2,"Completed transfers are not sent again");
    assert.equal(rhythm.visibility,"public");
    assert.equal(decorate().media.length,2);
    rhythm.description="Legacy practice notes should stay hidden.";
    await page.setViewport({width:1280,height:720});
    await page.goto(`${origin}/discover`,{waitUntil:"networkidle0"});
    await page.waitForSelector("main article img[alt='Video demonstration of My demonstration']");
    await page.waitForSelector("section[aria-label='Rhythms'] article .vf-stavenote");
    assert(await page.$eval("section[aria-label='Rhythms'] article",el=>{const video=el.querySelector('img').getBoundingClientRect(),notation=el.querySelector('[role=img]').getBoundingClientRect();return notation.top>=video.bottom && notation.bottom<=innerHeight && el.querySelector('[role=img]').scrollWidth<=el.querySelector('[role=img]').clientWidth+1;}),"Landing-page notation sits below the video and is visible without scrolling");
    assert.equal(await page.$("main article iframe"),null,"Feed loads thumbnails; playback starts in the opened card");
    await page.screenshot({path:`${folder}/video-feed.png`,fullPage:true});
    for (const viewport of [{width:390,height:844},{width:320,height:740}]) {
      await page.setViewport(viewport);
      await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
      assert(await page.$eval("section[aria-label='Rhythms'] article [role=img]",el=>el.getBoundingClientRect().bottom<=innerHeight),`Landing-page notation is visible without scrolling at ${viewport.width}px`);
      await page.screenshot({path:`${folder}/video-feed-${viewport.width}.png`,fullPage:true});
    }
    await page.setViewport({width:1280,height:720});
    await page.click("main a[href='/rhythms/with-media']");
    await page.waitForSelector("iframe[title^='Video demonstration:']");
    await page.waitForFunction(()=>getComputedStyle(document.querySelector(".MuiDialog-container")).opacity==="1");
    await page.waitForSelector("[role=dialog] .vf-stavenote");
    const notationFits=()=>{const score=document.querySelector('[aria-label="Exercise notation"]'),box=score.getBoundingClientRect(),video=document.querySelector('iframe[title^="Video demonstration:"]').getBoundingClientRect();return box.top>=video.bottom && box.bottom<=innerHeight && score.scrollWidth<=score.clientWidth+1 && document.querySelector('[role=dialog]').scrollTop===0;};
    assert(await page.evaluate(notationFits),"Full notation is visible below the player on a laptop without scrolling");
    assert(!(await page.$eval("[role=dialog]",el=>el.innerText)).includes("Legacy practice notes"),"Existing practice notes are not shown");
    await page.click("button[aria-label='Comments']");
    await page.waitForSelector("textarea[placeholder='Add a comment...']");
    await page.click("button[aria-label='Close side panel']");
    await page.screenshot({path:`${folder}/video-modal.png`});
    await page.setViewport({width:1280,height:600});
    await page.waitForFunction(notationFits);
    await page.screenshot({path:`${folder}/video-short-screen.png`});
    await page.setViewport({width:390,height:844});
    await page.waitForFunction(notationFits);
    await page.screenshot({path:`${folder}/video-mobile.png`});
    await page.setViewport({width:1280,height:720});
    await page.click("[role=dialog] details summary");
    await page.waitForSelector("iframe[title^='Audio recording:']",{visible:true});
    assert.equal(await page.$("[role=dialog] [role=group][aria-label='Exercise content']"),null,"Recordings and notation share a single view");
    assert(await page.evaluate(()=>document.querySelector("[aria-label='Exercise notation']").getBoundingClientRect().top>=document.querySelector("iframe[title^='Video demonstration:']").getBoundingClientRect().bottom),"Notation appears below the video");
    assert(!(await page.$eval("[aria-label='Exercise content']",el=>el.innerText)).match(/\b\d+ bars?\b/i),"Bar counts are hidden");
    await page.goto(`${origin}/rhythms/with-media`,{waitUntil:"networkidle0"});
    await page.waitForSelector("main [aria-label='Exercise notation'] .vf-stavenote");
    assert(await page.evaluate(()=>{const notation=document.querySelector('[aria-label="Exercise notation"]').getBoundingClientRect();return notation.bottom<=innerHeight && scrollY===0;}),"The standalone details page also shows notation without scrolling");
    await page.screenshot({path:`${folder}/rhythm-details.png`,fullPage:true});
    await page.goto(`${origin}/discover`,{waitUntil:"networkidle0"});
    await page.click("main a[href='/rhythms/with-media']");
    await page.waitForSelector("[role=dialog] #rhythm-post-title");
    await button(page,"Edit details");await page.waitForSelector("#rhythm-dialog-title");
    await button(page,"Remove video");await button(page,"Save & publish");
    await page.waitForFunction(()=>!document.querySelector("#rhythm-dialog-title"));
    assert.equal(decorate().media.length,1);
    await page.click("button[aria-label='Close rhythm']");
    await page.waitForFunction(()=>!document.querySelector("[role=dialog]"));
    assert.equal(await page.$("main article img"),null);
    await page.setViewport({width:390,height:844});
    await page.click("main a[href='/rhythms/with-media']");
    await page.waitForSelector("iframe[title^='Audio recording:']");
    assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
    await page.waitForFunction(()=>getComputedStyle(document.querySelector(".MuiDialog-container")).opacity==="1");
    await page.screenshot({path:`${folder}/audio-mobile.png`});
    assert.deepEqual(errors,[]);
    console.log("Passed: file validation, direct TUS uploads, private draft on failure, retry without duplicate uploads, video feed, video/audio playback with notation, removal, and mobile layout.");
  } catch(error) {
    console.error("Runtime errors:",errors);
    for(const page of await browser.pages())if(page.url().startsWith(origin)) {
      console.error(await page.$eval("body",el=>el.innerText.slice(-2500)));
      await page.screenshot({path:`${folder}/failure.png`,fullPage:true});
    }
    throw error;
  } finally {await browser.close();}
})().catch((error)=>{console.error(error);process.exitCode=1;});
