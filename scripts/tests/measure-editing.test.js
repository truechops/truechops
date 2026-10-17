const assert = require("node:assert/strict");
const test = require("node:test");
const fs = require("node:fs"), Module = require("node:module"), babel = require("@babel/core");
const original = Module._extensions[".js"];
Module._extensions[".js"] = (module,file) => {
  if (file.includes("node_modules")) return original(module,file);
  module._compile(babel.transformSync(fs.readFileSync(file,"utf8"),{presets:[["@babel/preset-env",{targets:{node:"current"}}]],babelrc:false,configFile:false}).code,file);
};
const { shuffleMeasure, canShuffleMeasure, insertCopiedMeasure } = require("../../src/services/measure-editing");
const { rhythmVariations, seededRandom, adjustMeasure, canAdjustMeasure, varyMeasure, getVariationOptions, getVariationInstruments } = require("../../src/services/rhythm-variations");
const copy = (value) => structuredClone(value);
const measure = () => ({timeSig:{num:2,type:4},parts:[{instrument:"snare",voices:[{
  notes:["ra","ld","rc","lf","r","l","ra",""].map((ornaments,i)=>({notes:i===7?[]:["C5"],duration:16,dots:0,ornaments,velocity:.5})),
  tuplets:[{start:0,end:3,actual:3,normal:2}]
}]}]});
const letters = {stickings:"rl",accents:"a",diddles:"d",cheese:"c",flams:"f"};

test("variation previews are unique, change one measure, and leave the original intact",()=>{
  const score={parts:{snare:{enabled:true}},measures:[measure(),measure()]}, before=copy(score);
  for(const category of Object.keys(letters)) {
    const rows=rhythmVariations(score,category,8,()=>.999);
    assert(rows.length>0 && rows.length<=8);
    assert.equal(new Set(rows.map(row=>JSON.stringify(row.score))).size,rows.length);
    for(const row of rows) {
      assert.notDeepEqual(row.score,score);
      assert.deepEqual(row.score.measures[1-row.measureIndex],score.measures[1-row.measureIndex]);
    }
  }
  assert.deepEqual(score,before);
  assert.deepEqual(rhythmVariations(score,"unknown"),[]);
});

test("missing ornaments are created, combinations stay legal, and successive variation pages keep generating",()=>{
  const bare=measure();bare.parts[0].voices[0].notes.forEach(note=>note.ornaments="");
  const source={parts:{snare:{enabled:true}},measures:[bare]}, before=copy(source);
  for(const [category,letter] of [["diddles","d"],["cheese","c"],["flams","f"]]) {
    assert(canAdjustMeasure(bare,category));
    assert(adjustMeasure(bare,category,seededRandom(5)).parts[0].voices[0].notes.some(note=>note.ornaments.includes(letter)));
    const filled=copy(bare);
    filled.parts[0].voices[0].notes.filter(note=>note.notes.length).forEach(note=>note.ornaments=letter==="f"?"c":"f");
    const replaced=adjustMeasure(filled,category,seededRandom(5)).parts[0].voices[0].notes;
    assert(replaced.some(note=>note.ornaments.includes(letter)),"Selected ornaments can be introduced when all notes have another ornament");
    assert(replaced.every(note=>[...note.ornaments].filter(mark=>"dcf".includes(mark)).length<=1));
  }
  const signatures=new Set();
  for(let page=1;page<=30;page++) {
    const variations=rhythmVariations(source,["stickings","diddles"],12,seededRandom(page*7919));
    assert.equal(variations.length,12);
    for(const row of variations) {
      const notes=row.measure.parts[0].voices[0].notes;
      assert(notes.some(note=>note.ornaments.includes("d")));
      notes.forEach((note,index)=>{
        assert.equal(note.duration,bare.parts[0].voices[0].notes[index].duration);
        assert.deepEqual(note.notes,bare.parts[0].voices[0].notes[index].notes);
        assert([...note.ornaments].filter(letter=>"dcf".includes(letter)).length<=1);
        if(!note.notes.length)assert.equal(note.ornaments,"");
      });
      signatures.add(row.key);
    }
  }
  assert(signatures.size>300); assert.deepEqual(source,before);
  assert.deepEqual(rhythmVariations(source,[]),[]);
});

test("variation generation accepts one or two types and rejects larger combinations",()=>{
  const source={parts:{snare:{enabled:true}},measures:[measure()]};
  const keys=Object.keys(letters);
  for(let i=0;i<keys.length;i++)for(let j=i+1;j<keys.length;j++) {
    assert(rhythmVariations(source,[keys[i],keys[j]],12,seededRandom(51)).length>0);
  }
  assert.deepEqual(rhythmVariations(source,["stickings","accents","cheese"]),[]);
  assert.equal(varyMeasure(measure(),["stickings","diddles","flams"]),null);
});

const drumMeasure=()=>({timeSig:{num:4,type:4},parts:[{instrument:"drumset",voices:[{notes:Array.from({length:8},(_,i)=>({
  notes:["E5",...(i%4===0?["F4"]:[]),...(i%4===2?["C5"]:[])],duration:8,dots:0,ornaments:i%4===0?"a":"",velocity:.5,
})),tuplets:[]}]}]});
const withoutPitches=(part,pitches)=>({...part,voices:part.voices.map(voice=>({...voice,notes:voice.notes.map(note=>({...note,notes:note.notes.filter(pitch=>!pitches.includes(pitch))}))}))});

test("drum-set variations move only the selected voices, preserving chords, timing, and other parts",()=>{
  const source={parts:{drumset:{enabled:true},snare:{enabled:true}},measures:[drumMeasure()]};
  source.measures[0].parts.push(measure().parts[0]);
  const before=copy(source), options=getVariationOptions("drumset").map(([key])=>key);
  assert.deepEqual(options,["kick","snare","hiHat","ride","hiHatFoot","tom1","tom2","tom3","tom4"]);
  assert.deepEqual(getVariationInstruments(source),["drumset","snare"]);
  const rows=rhythmVariations(source,["kick","snare"],12,seededRandom(17));
  assert.equal(rows.length,12);
  for(const row of rows) {
    assert.deepEqual(withoutPitches(row.measure.parts[0],["F4","C5"]),withoutPitches(before.measures[0].parts[0],["F4","C5"]));
    assert.deepEqual(row.measure.parts[1],before.measures[0].parts[1]);
    assert.deepEqual(row.measure.timeSig,before.measures[0].timeSig);
    for(const pitch of ["F4","C5"]) {
      const beforeHits=before.measures[0].parts[0].voices[0].notes.map(note=>note.notes.includes(pitch));
      const afterHits=row.measure.parts[0].voices[0].notes.map(note=>note.notes.includes(pitch));
      assert.notDeepEqual(afterHits,beforeHits);assert.equal(afterHits.filter(Boolean).length,beforeHits.filter(Boolean).length);
    }
  }
  assert.deepEqual(source,before);
  assert.deepEqual(rhythmVariations(source,["kick","snare","hiHat"]),[]);
  assert.deepEqual(rhythmVariations(source,["stickings"]),[],"Snare ornaments are unavailable for a drum-set target");
  const snare=rhythmVariations(source,["stickings","accents"],12,seededRandom(8),"snare");
  assert(snare.length);for(const row of snare)assert.deepEqual(row.measure.parts[0],source.measures[0].parts[0]);
  source.parts.drumset.enabled=false;
  assert.deepEqual(getVariationInstruments(source),["snare"]);
  assert.deepEqual(rhythmVariations(source,["kick"],12,seededRandom(8),"drumset"),[]);
});

test("kit variants can thin a steady hi-hat, introduce absent voices, and keep notation voices separate",()=>{
  const measure=drumMeasure(), source={parts:{drumset:{enabled:true}},measures:[measure]};
  for(const [key,pitch] of [["hiHat","E5"],["ride","F5"],["hiHatFoot","D4"],["tom1","D5"],["tom2","B4"],["tom3","A4"],["tom4","G4"]]) {
    const rows=rhythmVariations(source,[key],8,seededRandom(10));assert(rows.length>0);
    for(const row of rows) {
      assert(row.measure.parts[0].voices[0].notes.some(note=>note.notes.includes(pitch)));
      assert.deepEqual(withoutPitches(row.measure.parts[0],[pitch]),withoutPitches(measure.parts[0],[pitch]));
    }
    assert(canAdjustMeasure(measure,key));assert.notDeepEqual(adjustMeasure(measure,key,seededRandom(10)),measure);
  }
  const separate=drumMeasure();
  separate.parts[0].voices.push({...copy(separate.parts[0].voices[0]),notes:separate.parts[0].voices[0].notes.map((note,i)=>({...note,notes:i%2?["F5"]:[]}))});
  const changed=varyMeasure(separate,["ride"],seededRandom(7));
  assert.deepEqual(changed.parts[0].voices[0],separate.parts[0].voices[0],"A voice already written separately stays in its notation voice");
  assert.notDeepEqual(changed.parts[0].voices[1],separate.parts[0].voices[1]);
  const tuplets=drumMeasure();tuplets.parts[0].voices[0].tuplets=[{start:0,end:3,actual:3,normal:2}];
  assert.deepEqual(varyMeasure(tuplets,["kick","snare"],seededRandom(12)).parts[0].voices[0].tuplets,tuplets.parts[0].voices[0].tuplets);
  const rests=drumMeasure();rests.parts[0].voices[0].notes.forEach(note=>note.notes=[]);
  const added=varyMeasure(rests,["kick","snare"],seededRandom(11));
  for(const pitch of ["F4","C5"])assert(added.parts[0].voices[0].notes.some(note=>note.notes.includes(pitch)));
  const full=drumMeasure();full.parts[0].voices[0].notes.forEach(note=>note.notes=["D4","F4","C5","E5","F5","D5","B4","A4"]);
  assert(!canAdjustMeasure(full,"tom4"),"A missing voice cannot exceed the supported eight-pitch chord limit");
  const bounded=varyMeasure(full,["kick","tom4"],seededRandom(3));
  assert(bounded.parts[0].voices[0].notes.every(note=>note.notes.length<=8));
});

for (const [category,target] of Object.entries(letters)) test(`${category}: shuffle preserves timing, rests, other markings, and counts`,()=>{
  const before=measure(), frozen=copy(before);
  // Exercise a second voice and instrument as well as tuplets and dotted notes.
  before.parts[0].voices.push(copy(before.parts[0].voices[0]));
  before.parts.push({...copy(before.parts[0]),instrument:"tenors"});
  before.parts[1].voices[0].notes[2].dots=1;
  const after=shuffleMeasure(before,category,()=>.999);
  assert(canShuffleMeasure(before,category));
  assert.notDeepEqual(after,before,"An unchanged random permutation gets a different arrangement");
  for (let p=0;p<before.parts.length;p++) for(let v=0;v<before.parts[p].voices.length;v++) {
    const a=before.parts[p].voices[v], b=after.parts[p].voices[v];
    assert.deepEqual(b.tuplets,a.tuplets);
    const markings=(voice)=>voice.notes.map(note=>[...note.ornaments].filter(ch=>target.includes(ch)).join("")).sort();
    assert.deepEqual(markings(b),markings(a));
    a.notes.forEach((note,i)=>{
      const other=(n)=>({...n,ornaments:[...n.ornaments].filter(ch=>!target.includes(ch)).join("")});
      assert.deepEqual(other(b.notes[i]),other(note));
      assert([...b.notes[i].ornaments].filter(ch=>"fdc".includes(ch)).length<=1,"No incompatible ornaments are combined");
      if(!note.notes.length) assert.deepEqual(b.notes[i],note);
    });
  }
  assert.deepEqual(before.parts[0].voices[0],frozen.parts[0].voices[0],"Original is not modified");
});

test("uniform and empty patterns are unavailable for shuffling",()=>{
  const value=measure();
  value.parts[0].voices[0].notes.forEach(note=>note.ornaments="");
  for(const category of Object.keys(letters)) {
    assert(!canShuffleMeasure(value,category)); assert.deepEqual(shuffleMeasure(value,category),value);
  }
  assert(!canShuffleMeasure(value,"unknown"));
});

for(const side of ["left","right"]) test(`paste ${side} inserts an independent complete measure and preserves repeat endpoints`,()=>{
  const copied=measure(), existing=measure(); existing.timeSig={num:3,type:4};
  const state={score:{parts:{snare:{enabled:true},bass:{enabled:true}},measures:[existing,copy(existing)]},repeat:{start:0,end:1}};
  for(const item of state.score.measures) item.parts.push({instrument:"bass",voices:[{notes:[{duration:2,dots:1,notes:[],ornaments:""}],tuplets:[]}]});
  const old=copy(state.score.measures);
  insertCopiedMeasure(state,copied,0,side);
  const index=side==="left"?0:1;
  assert.equal(state.score.measures.length,3);
  assert.deepEqual(state.score.measures[index].parts[0],copied.parts[0]);
  assert.deepEqual(state.score.measures[index].timeSig,copied.timeSig);
  assert.deepEqual(state.score.measures.filter((_,i)=>i!==index),old);
  assert.equal(state.selectedNoteIndex.measureIndex,index);
  assert.equal(state.repeat.start,side==="left"?1:0); assert.equal(state.repeat.end,2);
  assert.equal(state.score.measures[index].parts[1].instrument,"bass","Missing parts are filled with rests in the copied meter");
  state.score.measures[index].parts[0].voices[0].notes[0].ornaments="";
  assert.equal(copied.parts[0].voices[0].notes[0].ornaments,"ra","Clipboard remains a snapshot");
});

test("invalid paste target or side leaves the score intact",()=>{
  const state={score:{parts:{snare:{enabled:true}},measures:[measure()]},repeat:{}};
  const before=copy(state);
  insertCopiedMeasure(state,measure(),9,"right"); insertCopiedMeasure(state,measure(),0,"invalid"); insertCopiedMeasure(state,null,0,"left");
  assert.deepEqual(state,before);
});
