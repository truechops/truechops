// Browser fixtures only: no real accounts, database writes, or media services.
const assert = require("node:assert/strict"), fs = require("node:fs"), puppeteer = require("puppeteer");
const origin = process.argv[2] || "http://127.0.0.1:3104", folder = "book-output/instrument-variations-preview";
fs.mkdirSync(folder, { recursive: true });
const kit = { parts: { drumset: { enabled: true } }, measures: [{ timeSig: { num: 4, type: 4 }, parts: [{ instrument: "drumset", voices: [{
  notes: Array.from({ length: 8 }, (_, i) => ({ notes: ["E5", ...(i % 4 === 0 ? ["F4"] : []), ...(i % 4 === 2 ? ["C5"] : [])], duration: 8, dots: 0, ornaments: "", velocity: .5 })), tuplets: [],
}] }] }] };
const mixed = structuredClone(kit);
mixed.parts.snare = { enabled: true };
mixed.measures[0].parts.unshift({ instrument: "snare", voices: [{ notes: Array.from({ length: 8 }, (_, i) => ({ notes: ["C5"], duration: 8, dots: 0, ornaments: i % 2 ? "l" : "ra", velocity: .5 })), tuplets: [] }] });
const options = ["Kick", "Snare", "Hi-hat", "Ride", "Hi-hat Foot", "Tom 1", "Tom 2", "Tom 3", "Tom 4"];
const errors = [], unexpected = [], creations = [];
let snapshot;
const without = (part, pitches) => ({ ...part, voices: part.voices.map(voice => ({ ...voice, notes: voice.notes.map(note => ({ ...note, notes: note.notes.filter(pitch => !pitches.includes(pitch)) })) })) });
async function clickText(page, text, selector = "button,[role=menuitem]") {
  for (const element of await page.$$(selector)) if (await element.evaluate((el, label) => el.textContent.trim() === label || el.getAttribute("aria-label") === label, text)) { await element.click(); return; }
  throw new Error(`Missing control: ${text}`);
}
const types = '[aria-label="Variation types"]';
const pressed = page => page.$$eval(`${types} [aria-pressed=true]`, buttons => buttons.map(button => button.textContent));
const choose = (page, name) => page.$$eval(`${types} button`, (buttons, label) => buttons.find(button => button.textContent === label).click(), name);
(async () => {
  const browser = await puppeteer.launch({ headless: "new", args: ["--no-sandbox"] });
  const page = await browser.newPage(); page.setDefaultTimeout(30000); page.setDefaultNavigationTimeout(60000);
  try {
    page.on("pageerror", error => errors.push(error.message));
    await page.setViewport({ width: 1440, height: 900 });
    await page.setRequestInterception(true);
    page.on("request", request => {
      const url = new URL(request.url());
      const send = (body, status = 200) => request.respond({ status, contentType: "application/json", body: JSON.stringify(body) });
      if (url.origin !== origin) return request.abort();
      if (url.pathname === "/api/auth/me") return send({ user: { id: "tester", name: "Kit tester" } });
      if (["/api/social/rhythms/kit", "/api/social/rhythms/mixed"].includes(url.pathname)) {
        const id = url.pathname.split("/").at(-1), score = id === "kit" ? kit : mixed;
        return send({ rhythm: { id, name: "Drum-set study", score, tempo: 90, mutations: [], visibility: "private", instruments: Object.keys(score.parts), media: [], isOwner: true } });
      }
      if (url.pathname === "/api/social/rhythms" && request.method() === "POST") {
        const body = JSON.parse(request.postData()); creations.push(body); snapshot = body.score;
        return send({ rhythm: { ...body, id: `saved-${creations.length}` } }, 201);
      }
      if (url.pathname.startsWith("/api/")) { unexpected.push(url.pathname); return send({ error: "Unexpected fixture request" }, 404); }
      return request.continue();
    });
    await page.goto(`${origin}/rhythms/kit`, { waitUntil: "networkidle0" });
    await clickText(page, "Variations");
    await page.waitForSelector("button[aria-label='Preview kick variation 1'] .vf-stavenote");
    assert.deepEqual(await page.$$eval(`${types} button`, buttons => buttons.map(button => button.textContent)), options);
    await choose(page, "Snare"); assert.deepEqual(await pressed(page), ["Kick", "Snare"]);
    await choose(page, "Hi-hat"); assert.deepEqual(await pressed(page), ["Kick", "Snare"], "A third voice cannot be selected");
    assert(await page.$$eval(`${types} button`, buttons => buttons.find(button => button.textContent === "Hi-hat").disabled));
    await choose(page, "Kick"); await choose(page, "Hi-hat");
    assert.deepEqual(await pressed(page), ["Snare", "Hi-hat"]);
    await page.click("button[aria-label='Save variation 1']"); await page.waitForSelector("button[aria-label='Variation 1 saved']");
    assert.deepEqual(without(snapshot.measures[0].parts[0], ["C5", "E5"]), without(kit.measures[0].parts[0], ["C5", "E5"]), "Unselected kick and note timing remain intact");
    await choose(page, "Hi-hat"); await choose(page, "Ride");
    await page.click("button[aria-label='Save variation 1']"); await page.waitForSelector("button[aria-label='Variation 1 saved']");
    assert(snapshot.measures[0].parts[0].voices[0].notes.some(note => note.notes.includes("F5")), "Absent ride is introduced");
    assert.deepEqual(without(snapshot.measures[0].parts[0], ["C5", "F5"]), without(kit.measures[0].parts[0], ["C5", "F5"]));
    await page.click("button[aria-label='Play variation 1']"); await page.waitForSelector("button[aria-label='Stop variation 1']"); await page.click("button[aria-label='Stop variation 1']");
    await page.click("button[aria-label='Maximize variations']");
    await page.waitForFunction(() => document.querySelector("aside").getBoundingClientRect().width >= innerWidth - 1);
    await page.screenshot({ path: `${folder}/kit-fullscreen.png` });
    const count = await page.$eval('[data-variation-list]', el => Number(el.dataset.generatedCount));
    await page.$eval('[data-variation-list]', el => el.scrollTop = el.scrollHeight);
    await page.waitForFunction(before => Number(document.querySelector('[data-variation-list]').dataset.generatedCount) > before, {}, count);
    await page.keyboard.press("Escape"); await page.keyboard.press("Escape");
    await page.waitForFunction(() => !document.querySelector("aside[aria-label='Variations panel']"));
    await clickText(page, "Original rhythm");
    await clickText(page, "Open in score");
    await page.waitForSelector("#vexflow [data-measure-index='0']");
    assert.deepEqual(await page.$$eval('[role=tab]', tabs => tabs.map(tab => tab.textContent)), ["Measure", "Notes", "Ornaments"], "Edit tabs; Mutate is its own mode");
    const vary = "[aria-label='Vary the measure'] button";
    const openTools = async () => {
      await page.click("#vexflow [data-measure-index='0'] [data-measure-background]");
      await page.waitForFunction(() => document.querySelector("#vexflow [data-measure-index='0']")?.dataset.selected === "true");
      if (!await page.$(vary)) await clickText(page, "Mutate");
      await page.waitForSelector(vary);
    };
    const browse = async () => {
      await clickText(page, "More"); await page.waitForSelector("[role=menu][aria-label='More variations']");
      await clickText(page, "Browse variations");
    };
    const save = async () => {
      await page.waitForSelector("button[aria-label=save]");
      snapshot = null; await page.click("button[aria-label=save]"); await page.waitForSelector("#rhythm-dialog-title");
      await clickText(page, "Save privately"); await page.waitForFunction(() => !document.querySelector("#rhythm-dialog-title"));
      assert(snapshot); return structuredClone(snapshot);
    };
    await openTools();
    assert.deepEqual(await page.$$eval(vary, buttons => buttons.map(button => button.getAttribute("aria-label") || button.textContent.trim())), [...options.slice(0, 5), "More"]);
    await clickText(page, "More"); await page.waitForSelector("[role=menu][aria-label='More variations']");
    assert.deepEqual(await page.$$eval("[role=menuitem]", items => items.map(item => item.textContent.trim().replace(/^T\d/, ""))), [...options.slice(5), "Browse variations", "Find matching rhythms"], "Toms are under More");
    await page.keyboard.press("Escape"); await page.waitForFunction(() => !document.querySelector("[role=menu]"));
    await clickText(page, "Kick");
    const shuffled = await save(); assert.notDeepEqual(shuffled, kit);
    assert.deepEqual(without(shuffled.measures[0].parts[0], ["F4"]), without(kit.measures[0].parts[0], ["F4"]));
    await page.click("button[aria-label=undo]"); assert.deepEqual(await save(), kit);
    await openTools(); await browse();
    await page.waitForSelector("#measure-variations-title"); await choose(page, "Snare");
    assert.deepEqual(await pressed(page), ["Kick", "Snare"]);
    await page.click("button[aria-label='Preview kick + snare variation 1']"); await clickText(page, "Use variation");
    await page.waitForFunction(() => !document.querySelector("#measure-variations-title"));
    const applied = await save(); assert.notDeepEqual(applied, kit);
    assert.deepEqual(without(applied.measures[0].parts[0], ["F4", "C5"]), without(kit.measures[0].parts[0], ["F4", "C5"]));
    await page.goto(`${origin}/rhythms/mixed`, { waitUntil: "networkidle0" });
    await clickText(page, "Variations"); await page.waitForSelector('[aria-label="Variation instrument"]');
    assert.deepEqual(await pressed(page), ["Stickings"]);
    await choose(page, "Cheese"); await page.click("button[aria-label='Preview stickings + cheese variation 1']");
    await page.select('[aria-label="Variation instrument"]', "drumset");
    assert.deepEqual(await pressed(page), ["Kick"], "Changing instruments clears incompatible selections");
    assert.equal(await page.$('[data-variation-number][data-selected=true]'), null);
    await page.click("button[aria-label='Close side panel']"); await clickText(page, "Open in score");
    await page.waitForSelector("#vexflow [data-measure-index='0']"); await openTools();
    await page.select('[aria-label="Variation part"]', "drumset");
    await clickText(page, "Kick");
    const mixedShuffled = await save();
    assert.deepEqual(mixedShuffled.measures[0].parts[0], mixed.measures[0].parts[0]);
    assert.deepEqual(without(mixedShuffled.measures[0].parts[1], ["F4"]), without(mixed.measures[0].parts[1], ["F4"]));
    await openTools(); await page.select('[aria-label="Variation part"]', "drumset"); await browse();
    await page.waitForSelector("#measure-variations-title"); assert.deepEqual(await pressed(page), ["Kick"]);
    await page.setViewport({ width: 390, height: 844 });
    await page.click("button[aria-label='Maximize variations']");
    await page.waitForFunction(() => document.querySelector('[role=dialog]').getBoundingClientRect().width >= innerWidth - 1);
    await choose(page, "Hi-hat"); assert.deepEqual(await pressed(page), ["Kick", "Hi-hat"]);
    assert(await page.$eval('[data-variation-browser]', el => el.scrollWidth <= el.clientWidth + 1));
    await page.screenshot({ path: `${folder}/kit-score-mobile.png` });
    assert.deepEqual(errors, []); assert.deepEqual(unexpected, []);
    console.log("Passed: two-selection limits, instrument detection, drum voice preservation/playback/save, kit measure shuffles and undo, applying variants, mixed-part targeting, and full-screen/mobile layouts.");
  } catch (error) { console.error(errors, unexpected); await page.screenshot({ path: `${folder}/failure.png`, fullPage: true }); throw error; }
  finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
