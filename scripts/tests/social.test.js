const assert = require("node:assert/strict");
const test = require("node:test");
const fs = require("node:fs");
const Module = require("node:module");
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
const { createSessionCookie } = require("../../src/lib/auth/session");
const defaultScore = require("../../src/consts/default-score").default;
const clone = (v) => JSON.parse(JSON.stringify(v));
function equal(a,b) { return String(a) === String(b); }
function matches(row,query) {
  return Object.entries(query).every(([key,value]) => {
    if (key === "$or") return value.some((q) => matches(row,q));
    if (key === "$and") return value.every((q) => matches(row,q));
    if (value && typeof value === "object" && "$in" in value) return value.$in.some((v) => equal(row[key],v));
    return Array.isArray(row[key]) ? row[key].includes(value) : equal(row[key],value);
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
        async insertOne(row) { rows.push(clone(row));return { insertedId: row._id }; },
        async updateOne(q,update,{upsert}={}) {
          let index=rows.findIndex((r)=>matches(r,q));
          const next={ ...(index<0 ? { ...q,...update.$setOnInsert } : rows[index]),...update.$set };
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
async function fixture() {
  const db=database(), api=createSocialService(db);
  await api.saveProfile(owner,profile);
  const privateRhythm=(await api.createRhythm(owner,composition)).rhythm;
  const publicRhythm=(await api.createRhythm(owner,{...composition,name:"Public rhythm",visibility:"public",tags:["triplets"]})).rhythm;
  return {db,api,privateRhythm,publicRhythm};
}
const rejects=(promise,status)=>assert.rejects(promise,(error)=>error.status===status);
const response=()=>({ statusCode:200, headers:{}, setHeader(k,v){this.headers[k]=v;},status(n){this.statusCode=n;return this;},json(value){this.body=value;return this;} });

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
test("legacy GraphQL cannot read or mutate private rhythms belonging to another user",async()=>{
  const {db,privateRhythm,publicRhythm}=await fixture();
  const context={db,currentUser:visitor,req:{headers:{host:"localhost"}}};
  assert.equal(await legacyQueries.getRhythmById(null,{input:privateRhythm.id},context),null);
  assert.equal((await legacyQueries.rhythms(null,{query:{_userId:owner.id}},context)).length,0);
  assert.equal(await legacyMutations.deleteOneRhythm(null,{query:{_id:privateRhythm.id}},context),null);
  assert.throws(()=>legacyMutations.updateManyRhythms(),/profile/);
  assert.equal((await legacyQueries.getRhythmById(null,{input:publicRhythm.id},context))._id,publicRhythm.id);
});
