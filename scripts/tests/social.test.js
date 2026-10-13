const assert = require("node:assert/strict");
const test = require("node:test");
const fs = require("node:fs");
const http = require("node:http");
const crypto = require("node:crypto");
const Module = require("node:module");
const { apiResolver } = require("next/dist/server/api-utils/node/api-resolver");
const babel = require("@babel/core");
const originalLoader = Module._extensions[".js"];
Module._extensions[".js"] = (module,file) => {
  if (file.includes("node_modules")) return originalLoader(module,file);
  module._compile(babel.transformSync(fs.readFileSync(file,"utf8"), { presets: [["@babel/preset-env",{ targets: { node: "current" } }]], babelrc:false, configFile:false }).code,file);
};
const { createSocialService, socialHandler, canRead } = require("../../src/lib/social/server");
const { normalizeProfile, normalizeMetadata, normalizeMutations, validateScore, searchOptions } = require("../../src/lib/social/validation");
const { searchPipeline } = require("../../src/lib/social/search");
const { legacyQueries, legacyMutations } = require("../../src/lib/social/legacy");
const { bunnyConfig, createBunnyClient, uploadCredentials, embedUrl, thumbnailUrl, verifyBunnyWebhook } = require("../../src/lib/social/bunny");
const { webhookHandler, config:webhookConfig } = require("../../pages/api/media/bunny-webhook");
const { createSessionCookie } = require("../../src/lib/auth/session");
const { config: socialApiConfig } = require("../../pages/api/social/[...route]");
const defaultScore = require("../../src/consts/default-score").default;
const clone = (v) => JSON.parse(JSON.stringify(v));
const at = (row,key) => key.split(".").reduce((value,part)=>value?.[part],row);
function assign(row,key,value) { const parts=key.split(".");const last=parts.pop();let parent=row;for(const part of parts)parent=parent[part]||(parent[part]={});parent[last]=value; }
function unset(row,key) { const parts=key.split(".");const last=parts.pop();const parent=parts.reduce((value,part)=>value?.[part],row);if(parent)delete parent[last]; }
function equal(a,b) { return String(a) === String(b); }
function matches(row,query) {
  return Object.entries(query).every(([key,value]) => {
    if (key === "$or") return value.some((q) => matches(row,q));
    if (key === "$and") return value.every((q) => matches(row,q));
    if (value && typeof value === "object" && "$in" in value) return value.$in.some((v) => equal(at(row,key),v));
    if (value && typeof value === "object" && "$gte" in value) return new Date(at(row,key)) >= new Date(value.$gte);
    if (value && typeof value === "object" && "$lt" in value) return at(row,key) < value.$lt;
    return Array.isArray(row[key]) ? row[key].includes(value) : equal(at(row,key),value);
  });
}
function cursor(rows) {
  let result = rows;
  const api = { sort(spec) { result.sort((a,b) => { for (const [key,direction] of Object.entries(spec)) { if (typeof direction !== "number") continue; if (a[key] < b[key]) return -direction; if (a[key] > b[key]) return direction; } return 0; }); return api; },
    skip(n) { result=result.slice(n);return api; }, limit(n) { result=result.slice(0,n);return api; }, async toArray() { return clone(result); } };
  return api;
}
function database() {
  const collections = new Map();
  const db = { collection(name) {
    if (!collections.has(name)) {
      const rows = [], traces = [];
      const collection = {
        rows,traces,
        async findOne(q) { const row=rows.find((r)=>matches(r,q));return row ? clone(row) : null; },
        find(q={}) { return cursor(rows.filter((r)=>matches(r,q))); },
        async countDocuments(q={}) { return rows.filter((r)=>matches(r,q)).length; },
        async insertOne(row) { rows.push(clone(row));return { insertedId: row._id }; },
        async updateOne(q,update,{upsert}={}) {
          let index=rows.findIndex((r)=>matches(r,q));
          const next=clone(index<0 ? { ...Object.fromEntries(Object.entries(q).filter(([,v])=>typeof v!=="object")),...update.$setOnInsert } : rows[index]);
          for(const [key,value] of Object.entries(update.$set||{}))assign(next,key,value);
          for(const [key,value] of Object.entries(update.$inc||{}))assign(next,key,(at(next,key)||0)+value);
          for(const key of Object.keys(update.$unset||{}))unset(next,key);
          if(index<0&&upsert&&rows.some((row)=>row._id===next._id)){const error=new Error("duplicate");error.code=11000;throw error;}
          if (name === "profiles" && rows.some((row,i)=>i!==index && (row.handle===next.handle || row.userId===next.userId))) { const error=new Error("duplicate");error.code=11000;throw error; }
          if(index<0) { if(upsert) rows.push(clone(next));return { matchedCount:0 }; }
          rows[index]=clone(next);return { matchedCount:1 };
        },
        async deleteOne(q) { const index=rows.findIndex((r)=>matches(r,q));if(index<0)return {deletedCount:0};rows.splice(index,1);return {deletedCount:1}; },
        async deleteMany(q) { for(let i=rows.length-1;i>=0;i--) if(matches(rows[i],q)) rows.splice(i,1); },
        aggregate(pipeline) {
          traces.push(pipeline);
          let result=clone(rows);
          for(const stage of pipeline) {
            // Simulate a stale search index that still returns all documents.
            if(stage.$match) result=result.filter((r)=>matches(r,stage.$match));
            if(stage.$sort) { const spec=stage.$sort;result.sort((a,b)=>{for(const [k,d] of Object.entries(spec)) if(typeof d==='number' && a[k]!==b[k])return (a[k]<b[k]?-1:1)*d;return 0;}); }
            if(stage.$skip) result=result.slice(stage.$skip);
            if(stage.$limit) result=result.slice(0,stage.$limit);
            if(stage.$lookup) result=result.map((r)=>({ ...r,rhythm: db.collection("rhythms").rows.filter((rhythm)=>equal(rhythm._id,r.rhythmId) && matches(rhythm,stage.$lookup.pipeline[1].$match)) }));
            if(stage.$unwind) result=result.flatMap((r)=>r.rhythm.map((rhythm)=>({...r,rhythm})));
            if(stage.$replaceRoot) result=result.map((r)=>r.rhythm);
          }
          return cursor(result);
        },
      };
      collections.set(name,collection);
    }
    return collections.get(name);
  } };
  return db;
}
const owner={ id:"google:owner",name:"A drummer",email:"private@example.com" }, visitor={id:"google:visitor"};
const profile={handle:"pulse_maker",displayName:"Pulse Maker",bio:"Triplets and space",instruments:["snare"]};
const composition={name:"Triplet conversation",score:defaultScore.score,tempo:90};
async function fixture(options) {
  const db=database(), api=createSocialService(db,options);
  await api.saveProfile(owner,profile);
  const privateRhythm=(await api.createRhythm(owner,composition)).rhythm;
  const publicRhythm=(await api.createRhythm(owner,{...composition,name:"Public rhythm",visibility:"public",tags:["triplets"]})).rhythm;
  return {db,api,privateRhythm,publicRhythm};
}
const rejects=(promise,status)=>assert.rejects(promise,(error)=>error.status===status);
const response=()=>({ statusCode:200, headers:{}, setHeader(k,v){this.headers[k]=v;},status(n){this.statusCode=n;return this;},json(value){this.body=value;return this;} });

function mediaProvider() {
  const config={libraryId:"123",apiKey:"test-library-secret",tokenKey:"test-token-secret",hostname:"test.b-cdn.net"};
  const videos=new Map(), deleted=[];
  const bunny={config:()=>config, async create() {const guid=crypto.randomUUID();const row={guid,videoLibraryId:123,status:0,storageSize:0,length:30};videos.set(guid,row);return row;},
    async get(id){return videos.get(id);}, async remove(id){deleted.push(id);videos.delete(id);},
    credentials:(id,now)=>uploadCredentials(config,id,now),embed:(id,now)=>embedUrl(config,id,now),thumbnail:(id,file,now)=>thumbnailUrl(config,id,file,now)};
  return {bunny,videos,deleted,config};
}

async function httpApi(t, service) {
  const handler = socialHandler({ service });
  // Exercise Next's body/cookie parsing over HTTP, not hand-built request objects.
  const server = http.createServer((req,res) => {
    const url = new URL(req.url,"http://localhost");
    const query = { ...Object.fromEntries(url.searchParams), route: url.pathname.split("/").slice(3) };
    void apiResolver(req,res,query,{ default: handler, config: socialApiConfig },{},false,false,"/api/social/[...route]");
  });
  t.after(() => new Promise((resolve,reject) => {
    server.close((error) => error ? reject(error) : resolve());
    server.closeAllConnections();
  }));
  await new Promise((resolve,reject) => {
    server.once("error",reject);
    server.listen(0,"127.0.0.1",resolve);
  });
  return async (path,{ user = owner, headers = {}, ...options } = {}) => {
    const res = await fetch(`http://127.0.0.1:${server.address().port}/api/social/${path}`, {
      ...options, signal: AbortSignal.timeout(5000),
      headers: { ...(user ? { cookie: createSessionCookie(user).split(";")[0] } : {}), ...headers },
    });
    const text = await res.text();
    return { status: res.status, headers: res.headers,
      body: res.headers.get("content-type")?.includes("application/json") ? JSON.parse(text) : text };
  };
}

test("profiles are explicit, unique, account-bound and never expose auth fields",async()=>{
  const {db,api}=await fixture();
  await rejects(api.saveProfile(visitor,{...profile,handle:"PULSE_MAKER"}),409);
  const saved=await api.saveProfile(owner,{...profile,userId:visitor.id,email:"oops@example.com"});
  assert.equal(db.collection("profiles").rows[0].userId,owner.id);
  assert.deepEqual(Object.keys(saved.profile).sort(),["id","handle","displayName","bio","instruments","joinedAt"].sort());
  assert.equal((await api.myProfile(visitor)).profile,null);
  await rejects(api.createRhythm(visitor,{...composition,visibility:"public"}),409);
  assert.throws(()=>normalizeProfile({...profile,handle:"$where"}),/handle/);
});
test("private scores stay private across detail, profile, search and another account",async()=>{
  assert.equal(canRead({type:"saved"},undefined),false,"a missing owner is never an anonymous access grant");
  const {db,api,privateRhythm,publicRhythm}=await fixture();
  await rejects(api.getRhythm(visitor,privateRhythm.id),404);
  await rejects(api.getRhythm(null,privateRhythm.id),404);
  assert.equal((await api.library(visitor,{})).items.length,0);
  assert.deepEqual((await api.profile(visitor,profile.handle,{})).items.map((r)=>r.id),[publicRhythm.id]);
  assert.deepEqual((await api.search(visitor,{q:"rhythm"})).items.map((r)=>r.id),[publicRhythm.id]);
  const search=db.collection("rhythms").traces.at(-1);
  assert(search[0].$search);
  assert.equal(search[1].$match.visibility,"public");
  assert(!JSON.stringify(await api.search(visitor,{q:"rhythm"})).includes(owner.id));
  assert.equal((await api.getRhythm(owner,privateRhythm.id)).rhythm.score.measures.length,composition.score.measures.length);
});
test("saves are idempotent, scoped to the account, and disappear when a rhythm becomes private",async()=>{
  const {db,api,publicRhythm}=await fixture();
  await Promise.all(Array.from({length:4},()=>api.bookmark(visitor,publicRhythm.id,true)));
  assert.equal(db.collection("rhythmSaves").rows.length,1);
  assert.equal((await api.library(visitor,{tab:"saved"})).items[0].id,publicRhythm.id);
  assert.equal((await api.library(owner,{tab:"saved"})).items.length,0);
  await api.updateRhythm(owner,publicRhythm.id,{visibility:"private"});
  assert.equal((await api.library(visitor,{tab:"saved"})).items.length,0);
  assert.equal((await api.search(visitor,{q:"rhythm"})).items.length,0);
  await rejects(api.bookmark(visitor,publicRhythm.id,true),404);
  await api.bookmark(visitor,publicRhythm.id,false);
  assert.equal(db.collection("rhythmSaves").rows.length,0);
});
test("only owners can edit or delete; incoming IDs and ownership cannot be assigned",async()=>{
  const {db,api,publicRhythm}=await fixture();
  await rejects(api.updateRhythm(visitor,publicRhythm.id,{name:"stolen"}),404);
  await rejects(api.removeRhythm(visitor,publicRhythm.id),404);
  const saved=(await api.createRhythm(owner,{...composition,_userId:visitor.id,_id:"injected"})).rhythm;
  assert.notEqual(saved.id,"injected");
  assert.equal(db.collection("rhythms").rows.at(-1)._userId,owner.id);
  await api.updateRhythm(owner,saved.id,{_userId:visitor.id,score:{bad:true}});
  assert.equal(db.collection("rhythms").rows.at(-1)._userId,owner.id);
  await api.bookmark(visitor,publicRhythm.id,true);
  await api.removeRhythm(owner,publicRhythm.id);
  assert.equal(db.collection("rhythmSaves").rows.length,0);
});
test("MongoDB Search uses autocomplete and text with indexed filters; pagination is bounded",()=>{
  const pipeline=searchPipeline(searchOptions({q:"quintuplet",instrument:"snare",difficulty:"advanced",page:"2"}));
  const search=pipeline[0].$search;
  assert.equal(search.index,"community_rhythms_v1");
  assert(search.compound.should.some((clause)=>clause.autocomplete));
  assert(search.compound.should.some((clause)=>clause.text?.path.includes("tags")));
  assert(search.compound.filter.some((clause)=>clause.equals.path==="visibility" && clause.equals.value==="public"));
  assert.deepEqual(pipeline.at(-2),{$skip:12});
  assert.deepEqual(pipeline.at(-1),{$limit:13});
  const people=searchPipeline(searchOptions({q:"@pulse",type:"users"}));
  assert.equal(people[0].$search.index,"community_profiles_v1");
  assert(!JSON.stringify(people).includes("email"));
  assert.throws(()=>searchOptions({q:{$ne:null}}),/search/);
  assert.throws(()=>searchOptions({page:101}),/page/);
});
test("invalid rhythms and query payloads cannot reach storage",()=>{
  assert.deepEqual(validateScore(defaultScore.score).instruments,["snare"]);
  assert.throws(()=>validateScore({measures:[]}),/measures/);
  const bad=clone(defaultScore.score);bad.measures[0].parts[0].voices[0].notes[0].duration=0;
  assert.throws(()=>validateScore(bad),/note/);
  assert.throws(()=>normalizeMetadata({...composition,visibility:"unlisted"}),/visibility/);
  assert.throws(()=>normalizeMetadata({...composition,tags:{$where:"anything"}}),/tags/);
  assert.equal(normalizeMutations([{type:"swap",context:"All",grid:16,config:{probability:.25}}])[0].type,"swap");
  assert.throws(()=>normalizeMutations([{type:"anything",context:"All",grid:16,config:{}}]),/mutation type/);
  assert.throws(()=>normalizeMutations([{type:"swap",context:"All",grid:16,config:"null"}]),/settings/);
});
test("HTTP API verifies signed sessions and rejects CSRF and unsupported methods before connecting",async()=>{
  let connects=0;
  const handler=socialHandler({service:async()=>{connects++;return {myProfile:async(user)=>({id:user.id})};}});
  let res=response();await handler({method:"PUT",query:{route:["profile"]},headers:{host:"localhost"},body:{}},res);
  assert.equal(res.statusCode,401);assert.equal(connects,0);
  const cookie=createSessionCookie(owner).split(";")[0];
  res=response();await handler({method:"PUT",query:{route:["profile"]},headers:{host:"localhost",origin:"https://elsewhere.test",cookie},body:{}},res);
  assert.equal(res.statusCode,403);assert.equal(connects,0);
  res=response();await handler({method:"GET",query:{route:["profile"]},headers:{host:"localhost",cookie}},res);
  assert.equal(res.statusCode,200);assert.equal(res.body.id,owner.id);
  assert.equal(res.headers["Cache-Control"],"private, no-store");
  res=response();await handler({method:"POST",query:{route:["search"]},headers:{}},res);
  assert.equal(res.statusCode,405);assert.equal(res.headers.Allow,"GET");
});
test("Next HTTP requests without bodies can load profiles, libraries, searches and rhythms",async(t)=>{
  const {api,publicRhythm}=await fixture();
  const request=await httpApi(t,async()=>api);
  const reads=[
    ["profile",owner,(body)=>assert.equal(body.profile.handle,profile.handle)],
    ["library?tab=created&page=1",owner,(body)=>assert.equal(body.items.length,2)],
    ["library?tab=saved&page=1",owner,(body)=>assert.deepEqual(body.items,[])],
    ["search?q=&type=rhythms&instrument=&difficulty=&page=1",null,(body)=>assert.equal(body.items[0].id,publicRhythm.id)],
    ["search?q=triplet&type=rhythms",null,(body)=>assert.equal(body.items[0].id,publicRhythm.id)],
    ["search?q=pulse&type=users",null,(body)=>assert.equal(body.items[0].handle,profile.handle)],
    [`profiles/${profile.handle}`,null,(body)=>assert.equal(body.profile.handle,profile.handle)],
    [`rhythms/${publicRhythm.id}`,null,(body)=>assert.equal(body.rhythm.id,publicRhythm.id)],
  ];
  for (const [path,user,check] of reads) await t.test(path,async()=>{
    const res=await request(path,{user});
    assert.equal(res.status,200,JSON.stringify(res.body));
    assert.equal(res.headers.get("cache-control"),"private, no-store");
    check(res.body);
  });
});

test("Next HTTP requests can save, unsave and delete rhythms without sending a body",async(t)=>{
  const {api,db,privateRhythm,publicRhythm}=await fixture();
  const request=await httpApi(t,async()=>api);
  await t.test("save",async()=>{
    const res=await request(`rhythms/${publicRhythm.id}/save`,{method:"PUT",user:visitor});
    assert.equal(res.status,200,JSON.stringify(res.body));
    assert.equal(res.body.saved,true);
    assert.equal(db.collection("rhythmSaves").rows.length,1);
  });
  // Seed independently so unsaving is tested even when the save request fails.
  await api.bookmark(visitor,publicRhythm.id,true);
  await t.test("unsave",async()=>{
    const res=await request(`rhythms/${publicRhythm.id}/save`,{method:"DELETE",user:visitor});
    assert.equal(res.status,200,JSON.stringify(res.body));
    assert.equal(res.body.saved,false);
    assert.equal(db.collection("rhythmSaves").rows.length,0);
  });
  await t.test("delete",async()=>{
    const res=await request(`rhythms/${privateRhythm.id}`,{method:"DELETE"});
    assert.equal(res.status,200,JSON.stringify(res.body));
    assert.equal(res.body.removed,true);
    await rejects(api.getRhythm(owner,privateRhythm.id),404);
  });
});

test("Next HTTP parsing still enforces authentication, origin and JSON payload validation",async(t)=>{
  const {api,privateRhythm}=await fixture();
  let connects=0;
  const request=await httpApi(t,async()=>{connects++;return api;});
  assert.equal((await request("profile",{user:null})).status,401);
  assert.equal((await request("library",{user:null})).status,401);
  assert.equal((await request(`rhythms/${privateRhythm.id}`,{method:"DELETE",user:null})).status,401);
  assert.equal((await request(`rhythms/${privateRhythm.id}`,{method:"DELETE",headers:{origin:"https://elsewhere.test"}})).status,403);
  for (const [path,method] of [["profile","PUT"],["rhythms","POST"],[`rhythms/${privateRhythm.id}`,"PATCH"]]) {
    for (const body of ["[]",'"not an object"',"42","false","{"]) {
      const res=await request(path,{method,headers:{"Content-Type":"application/json"},body});
      assert.equal(res.status,400,`${method} ${path}: ${body}`);
    }
  }
  assert.equal((await request("profile",{method:"PUT",body:"not JSON"})).status,400);
  assert.equal(connects,0,"invalid requests must be rejected before connecting to storage");
  const saved=await request("profile",{method:"PUT",headers:{"Content-Type":"application/json"},body:JSON.stringify({...profile,bio:"Updated over HTTP"})});
  assert.equal(saved.status,200);
  assert.equal(saved.body.profile.bio,"Updated over HTTP");
  const created=await request("rhythms",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(composition)});
  assert.equal(created.status,201);
  assert.equal(created.body.rhythm.name,composition.name);
  const updated=await request(`rhythms/${created.body.rhythm.id}`,{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({name:"Renamed over HTTP"})});
  assert.equal(updated.status,200);
  assert.equal(updated.body.rhythm.name,"Renamed over HTTP");
});

test("likes persist per account, are idempotent, and require a published rhythm",async()=>{
  const {api,db,privateRhythm,publicRhythm}=await fixture();
  assert.equal(privateRhythm.visibility,"private");
  await rejects(api.like(null,publicRhythm.id,true),401);
  await rejects(api.like(visitor,privateRhythm.id,true),404);
  await Promise.all(Array.from({length:4},()=>api.like(visitor,publicRhythm.id,true)));
  assert.equal(db.collection("rhythmLikes").rows.length,1);
  assert.deepEqual(await api.engagement(visitor,publicRhythm.id),{liked:true,likeCount:1,commentCount:0});
  assert.equal((await api.engagement(owner,publicRhythm.id)).liked,false);
  await api.like(owner,publicRhythm.id,true);
  await api.like(visitor,publicRhythm.id,false);
  assert.equal((await api.engagement(null,publicRhythm.id)).likeCount,1);
  await api.updateRhythm(owner,publicRhythm.id,{visibility:"private"});
  await rejects(api.engagement(visitor,publicRhythm.id),404);
  await rejects(api.comments(visitor,publicRhythm.id),404);
  await rejects(api.like(visitor,publicRhythm.id,false),404);
});

test("comments use public identities, validate text, and enforce authorship and rhythm-owner moderation",async()=>{
  const {api,publicRhythm,privateRhythm}=await fixture();
  await rejects(api.addComment(null,publicRhythm.id,{text:"Hello"}),401);
  await rejects(api.addComment(visitor,publicRhythm.id,{text:"Hello"}),409);
  await api.saveProfile(visitor,{...profile,handle:"another_drummer",displayName:"Another drummer"});
  const saved=await api.addComment(visitor,publicRhythm.id,{text:"  Start slowly, then add accents.  ",userId:owner.id});
  assert.equal(saved.comment.text,"Start slowly, then add accents.");
  const visible=await api.comments(null,publicRhythm.id);
  assert.equal(visible.items[0].author.handle,"another_drummer");
  assert.equal(visible.items[0].canDelete,false);
  assert(!JSON.stringify(visible).includes(visitor.id));
  assert(!JSON.stringify(visible).includes("email"));
  assert.equal((await api.comments(owner,publicRhythm.id)).items[0].canDelete,true);
  for (const text of [" ","x".repeat(1001),{$ne:null}]) await rejects(api.addComment(visitor,publicRhythm.id,{text}),400);
  await rejects(api.comments(visitor,publicRhythm.id,{page:{$ne:0}}),400);
  await rejects(api.removeComment({id:"other"},publicRhythm.id,saved.comment.id),404);
  await rejects(api.removeComment(owner,privateRhythm.id,saved.comment.id),404);
  await api.removeComment(owner,publicRhythm.id,saved.comment.id);
  assert.equal((await api.engagement(null,publicRhythm.id)).commentCount,0);
  const own=await api.addComment(visitor,publicRhythm.id,{text:"My comment"});
  await api.removeComment(visitor,publicRhythm.id,own.comment.id);
  assert.equal((await api.comments(null,publicRhythm.id)).items.length,0);
});

test("comment pagination, posting limits and rhythm deletion clean up engagement",async()=>{
  const {api,db,publicRhythm}=await fixture();
  for(let i=0;i<10;i++) await api.addComment(owner,publicRhythm.id,{text:`Practice note ${i}`});
  await rejects(api.addComment(owner,publicRhythm.id,{text:"Too many"}),429);
  db.collection("rhythmComments").rows.forEach((row)=>{row.createdAt="2020-01-01";});
  await api.addComment(owner,publicRhythm.id,{text:"A new day"});
  for(let i=0;i<15;i++) db.collection("rhythmComments").rows.push({_id:`older-${i}`,rhythmId:publicRhythm.id,userId:owner.id,text:`Older ${i}`,createdAt:"2019-01-01"});
  const first=await api.comments(null,publicRhythm.id),second=await api.comments(null,publicRhythm.id,{page:2});
  assert.equal(first.items.length,20);assert.equal(first.hasMore,true);
  assert.equal(second.items.length,6);assert.equal(second.hasMore,false);
  assert(!second.items.some((row)=>first.items.some((other)=>row.id===other.id)));
  await api.like(visitor,publicRhythm.id,true);
  await api.removeRhythm(owner,publicRhythm.id);
  assert.equal(db.collection("rhythmComments").rows.length,0);
  assert.equal(db.collection("rhythmLikes").rows.length,0);
});

test("engagement routes work through Next HTTP parsing and enforce signed sessions and origin",async(t)=>{
  const {api,publicRhythm}=await fixture();
  const request=await httpApi(t,async()=>api),path=`rhythms/${publicRhythm.id}`;
  assert.equal((await request(`${path}/like`,{method:"PUT",user:null})).status,401);
  assert.equal((await request(`${path}/like`,{method:"PUT",headers:{origin:"https://elsewhere.test"}})).status,403);
  assert.equal((await request(`${path}/like`,{method:"PUT"})).body.liked,true);
  assert.equal((await request(`${path}/engagement`,{user:null})).body.likeCount,1);
  const added=await request(`${path}/comments`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({text:"Keep the pulse steady."})});
  assert.equal(added.status,201);
  assert.equal((await request(`${path}/comments`,{user:null})).body.items.length,1);
  assert.equal((await request(`${path}/comments/${added.body.comment.id}`,{method:"DELETE",user:visitor})).status,404);
  assert.equal((await request(`${path}/comments/${added.body.comment.id}`,{method:"DELETE"})).status,200);
  assert.equal((await request(`${path}/like`,{method:"DELETE"})).body.liked,false);
});

test("legacy GraphQL cannot read or mutate private rhythms belonging to another user",async()=>{
  const {db,privateRhythm,publicRhythm}=await fixture();
  const context={db,currentUser:visitor,req:{headers:{host:"localhost"}}};
  assert.equal(await legacyQueries.getRhythmById(null,{input:privateRhythm.id},context),null);
  assert.equal((await legacyQueries.rhythms(null,{query:{_userId:owner.id}},context)).length,0);
  assert.equal(await legacyMutations.deleteOneRhythm(null,{query:{_id:privateRhythm.id}},context),null);
  assert.throws(()=>legacyMutations.updateManyRhythms(),/profile/);
  assert.equal((await legacyQueries.getRhythmById(null,{input:publicRhythm.id},context))._id,publicRhythm.id);
});

const videoFile={kind:"video",name:"practice.mp4",size:1024};
const audioFile={kind:"audio",name:"practice.mp3",size:512};

test("media uploads require ownership, validate files and never accept another account's media IDs",async()=>{
  const provider=mediaProvider(),{api,db,privateRhythm,publicRhythm}=await fixture({bunny:provider.bunny});
  await rejects(api.startMedia(null,publicRhythm.id,videoFile),401);
  await rejects(api.startMedia(visitor,publicRhythm.id,videoFile),404);
  await rejects(api.startMedia(owner,privateRhythm.id,{...videoFile,name:"bad.html"}),400);
  await rejects(api.startMedia(owner,privateRhythm.id,{...videoFile,size:501*1024*1024}),400);
  const started=await api.startMedia(owner,privateRhythm.id,videoFile);
  assert(!JSON.stringify(started).includes(provider.config.apiKey));
  assert.equal(started.upload.headers.LibraryId,"123");
  await rejects(api.completeMedia(visitor,privateRhythm.id,started.media.id),404);
  await rejects(api.completeMedia(owner,publicRhythm.id,started.media.id),404);
  await rejects(api.mediaPlayback(null,privateRhythm.id,started.media.id),404);
  await api.updateRhythm(owner,publicRhythm.id,{mediaIds:{video:started.media.id},media:[started.media]});
  assert.deepEqual((await api.getRhythm(null,publicRhythm.id)).rhythm.media,[]);
  assert.equal(db.collection("rhythmMedia").rows[0].userId,owner.id);
});

test("verified completion attaches audio and video; playback and thumbnails follow rhythm privacy",async()=>{
  const provider=mediaProvider(),{api,privateRhythm}=await fixture({bunny:provider.bunny});
  for(const file of [videoFile,audioFile]) {
    const start=await api.startMedia(owner,privateRhythm.id,file);
    await rejects(api.completeMedia(owner,privateRhythm.id,start.media.id),409);
    provider.videos.get(start.upload.headers.VideoId).status=2;
    assert.equal((await api.completeMedia(owner,privateRhythm.id,start.media.id)).media.status,"processing");
    provider.videos.get(start.upload.headers.VideoId).status=3;
    await api.syncMediaWebhook(123,start.upload.headers.VideoId);
  }
  const own=(await api.getRhythm(owner,privateRhythm.id)).rhythm;
  assert.equal(own.media.length,2);
  assert(own.media.every((m)=>m.status==="ready"));
  assert(own.media.find((m)=>m.kind==="video").thumbnailUrl.includes("token=HS256-"));
  assert(!JSON.stringify(own.media).includes("test-token-secret"));
  assert(!JSON.stringify(own.media).includes(owner.id));
  await rejects(api.mediaPlayback(visitor,privateRhythm.id,own.media[0].id),404);
  await api.updateRhythm(owner,privateRhythm.id,{visibility:"public"});
  assert((await api.mediaPlayback(null,privateRhythm.id,own.media[0].id)).embedUrl.includes("autoplay=false"));
  await api.updateRhythm(owner,privateRhythm.id,{visibility:"private"});
  await rejects(api.mediaPlayback(null,privateRhythm.id,own.media[0].id),404);
});

test("replacing and deleting recordings removes Bunny assets; failed deletions remain queued for cleanup",async()=>{
  const provider=mediaProvider(),{api,db,privateRhythm}=await fixture({bunny:provider.bunny});
  const first=await api.startMedia(owner,privateRhythm.id,videoFile);
  provider.videos.get(first.upload.headers.VideoId).status=3;
  await api.completeMedia(owner,privateRhythm.id,first.media.id);
  const second=await api.startMedia(owner,privateRhythm.id,videoFile);
  // Creating another upload doesn't remove the current video.
  assert.equal((await api.getRhythm(owner,privateRhythm.id)).rhythm.media[0].id,first.media.id);
  provider.videos.get(second.upload.headers.VideoId).status=3;
  await api.completeMedia(owner,privateRhythm.id,second.media.id);
  assert(provider.deleted.includes(first.upload.headers.VideoId));
  const remove=provider.bunny.remove;provider.bunny.remove=async()=>{throw new Error("offline");};
  await api.removeMedia(owner,privateRhythm.id,second.media.id);
  assert.deepEqual((await api.getRhythm(owner,privateRhythm.id)).rhythm.media,[]);
  assert.equal(db.collection("rhythmMedia").rows[0].status,"deleting");
  await rejects(api.completeMedia(owner,privateRhythm.id,second.media.id),404);
  provider.bunny.remove=remove;
  await api.cleanupMedia();
  assert.equal(db.collection("rhythmMedia").rows.length,0);
  const audio=await api.startMedia(owner,privateRhythm.id,audioFile);
  await api.removeRhythm(owner,privateRhythm.id);
  assert(provider.deleted.includes(audio.upload.headers.VideoId));
});

test("media cleanup preserves attached and recent uploads, and dry runs never delete assets",async()=>{
  let time=new Date("2026-10-12T00:00:00Z");
  const provider=mediaProvider(),{api,db,privateRhythm}=await fixture({bunny:provider.bunny,now:()=>time});
  const attached=await api.startMedia(owner,privateRhythm.id,videoFile);
  provider.videos.get(attached.upload.headers.VideoId).status=3;
  await api.completeMedia(owner,privateRhythm.id,attached.media.id);
  const abandoned=await api.startMedia(owner,privateRhythm.id,audioFile);
  time=new Date("2026-10-14T00:00:00Z");
  const recent=await api.startMedia(owner,privateRhythm.id,audioFile);
  assert.deepEqual(await api.cleanupMedia({dryRun:true}),{processed:1});
  assert.equal(provider.deleted.length,0);
  assert.equal(db.collection("rhythmMedia").rows.length,3);
  assert.deepEqual(await api.cleanupMedia(),{processed:1});
  assert.deepEqual(provider.deleted,[abandoned.upload.headers.VideoId]);
  assert.deepEqual(db.collection("rhythmMedia").rows.map((row)=>row._id).sort(),[attached.media.id,recent.media.id].sort());
  assert.equal((await api.getRhythm(owner,privateRhythm.id)).rhythm.media[0].id,attached.media.id);
});

test("media rate limits survive removal and concurrent calls; unsupported encodings stay unavailable",async()=>{
  const provider=mediaProvider(),{api,privateRhythm}=await fixture({bunny:provider.bunny});
  const started=await api.startMedia(owner,privateRhythm.id,videoFile);
  provider.videos.get(started.upload.headers.VideoId).status=5;
  await rejects(api.completeMedia(owner,privateRhythm.id,started.media.id),422);
  await api.removeMedia(owner,privateRhythm.id,started.media.id);
  const results=await Promise.allSettled(Array.from({length:12},()=>api.startMedia(owner,privateRhythm.id,audioFile)));
  assert.equal(results.filter((result)=>result.status==="fulfilled").length,9);
  assert(results.filter((result)=>result.status==="rejected").every((result)=>result.reason.status===429));
});

test("Bunny signatures match the upload, embed and CDN contracts, without exposing signing keys",async()=>{
  const {config}=mediaProvider(),id="11111111-2222-3333-4444-555555555555",now=new Date("2026-10-12T00:00:00Z");
  const credentials=uploadCredentials(config,id,now),expiration=String(now.getTime()/1000+3600);
  assert.equal(credentials.headers.AuthorizationSignature,crypto.createHash("sha256").update(`123test-library-secret${expiration}${id}`).digest("hex"));
  const url=new URL(embedUrl(config,id,now));
  assert.equal(url.searchParams.get("token"),crypto.createHash("sha256").update(`test-token-secret${id}${expiration}`).digest("hex"));
  const thumb=new URL(thumbnailUrl(config,id,"../../bad.png",now));
  assert.equal(thumb.pathname,`/${id}/thumbnail.jpg`);
  assert.equal(thumb.searchParams.get("token"),"HS256-"+crypto.createHmac("sha256",config.tokenKey).update(`${thumb.pathname}${thumb.searchParams.get("expires")}`).digest("base64url"));
  assert.throws(()=>bunnyConfig({}),(error)=>error.status===503);
  const calls=[];
  const client=createBunnyClient({config:()=>config,request:async(url,options)=>{calls.push({url,options});return {ok:true,status:200,json:async()=>({guid:id})};}});
  await client.create("Practice");await client.get(id);await client.remove(id);
  assert.equal(calls[0].url,"https://video.bunnycdn.com/library/123/videos");
  assert.equal(calls[0].options.headers.AccessKey,config.apiKey);
  assert.equal(calls[2].options.method,"DELETE");
});

test("media HTTP routes enforce session/origin and return processing then authorized playback",async(t)=>{
  const provider=mediaProvider(),{api,privateRhythm}=await fixture({bunny:provider.bunny});
  const request=await httpApi(t,async()=>api),base=`rhythms/${privateRhythm.id}/media`;
  assert.equal((await request(base,{method:"POST",user:null,headers:{"Content-Type":"application/json"},body:JSON.stringify(videoFile)})).status,401);
  assert.equal((await request(base,{method:"POST",headers:{origin:"https://evil.test","Content-Type":"application/json"},body:JSON.stringify(videoFile)})).status,403);
  const start=await request(base,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(videoFile)});
  assert.equal(start.status,201);
  provider.videos.get(start.body.upload.headers.VideoId).status=3;
  const path=`${base}/${start.body.media.id}`;
  assert.equal((await request(`${path}/complete`,{method:"POST"})).status,201);
  assert.equal((await request(`${path}/playback`,{user:null})).status,404);
  assert.equal((await request(`${path}/playback`)).status,200);
  assert.equal((await request(path,{method:"DELETE"})).status,200);
});

test("webhook raw-body signatures reject tampering before opening the database",async(t)=>{
  const secret="read-only-test-key",raw=JSON.stringify({VideoLibraryId:123,VideoGuid:"11111111-2222-3333-4444-555555555555",Status:3});
  const headers={"x-bunnystream-signature-version":"v1","x-bunnystream-signature-algorithm":"hmac-sha256","x-bunnystream-signature":crypto.createHmac("sha256",secret).update(raw).digest("hex")};
  assert(verifyBunnyWebhook(Buffer.from(raw),headers,secret));
  assert(!verifyBunnyWebhook(Buffer.from(raw+" "),headers,secret));
  assert(!verifyBunnyWebhook(Buffer.from(raw),{...headers,"x-bunnystream-signature-version":"v2"},secret));
  let calls=0;
  const handler=webhookHandler({secret:()=>secret,service:async()=>{calls++;return {syncMediaWebhook:async(library,id)=>{assert.equal(library,123);assert.equal(id,"11111111-2222-3333-4444-555555555555");}};}});
  const server=http.createServer((req,res)=>void apiResolver(req,res,{}, {default:handler,config:webhookConfig},{},false,false,"/api/media/bunny-webhook"));
  await new Promise((resolve)=>server.listen(0,"127.0.0.1",resolve));
  t.after(()=>new Promise((resolve)=>{server.close(resolve);server.closeAllConnections();}));
  const url=`http://127.0.0.1:${server.address().port}`;
  assert.equal((await fetch(url,{method:"POST",headers,body:raw+" "})).status,401);
  assert.equal(calls,0);
  assert.equal((await fetch(url,{method:"POST",headers,body:raw})).status,200);
  assert.equal(calls,1);
});
