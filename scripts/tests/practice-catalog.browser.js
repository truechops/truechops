// Local browser fixtures only. No accounts or scores are written to a database.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const puppeteer = require("puppeteer");
const singleStroke = require("../../data/rudiments/essential/singlestrokeroll.json");
const snareDrill = require("../../data/exercises/snare/1.json");
const origin = process.argv[2] || "http://127.0.0.1:3104";
const folder = "book-output/practice-catalog-preview";
fs.mkdirSync(folder, { recursive: true });
async function clickText(page, text) {
  for (const button of await page.$$("main button, [role=dialog] button")) {
    if (await button.evaluate((el, label) => el.textContent.trim() === label, text)) { await button.click(); return; }
  }
  throw new Error(`Missing button ${text}`);
}
(async () => {
  const browser = await puppeteer.launch({ headless: "new", args: ["--no-sandbox"] });
  const errors = [], unexpected = [];
  let snapshot;
  const page = await browser.newPage();
  page.setDefaultNavigationTimeout(60000);
  try {
    page.on("pageerror", error => errors.push(error.message));
    await page.setViewport({ width: 1440, height: 1000 });
    await page.setRequestInterception(true);
    page.on("request", request => {
      const url = new URL(request.url());
      const send = body => request.respond({ status: 200, contentType: "application/json", body: JSON.stringify(body) });
      if (url.origin !== origin) return request.abort();
      if (url.pathname === "/api/auth/me") return send({ user: { id: "catalog-tester", name: "Catalog tester" } });
      if (url.pathname === "/api/social/rhythms" && request.method() === "POST") {
        snapshot = JSON.parse(request.postData()); return send({ rhythm: { id: "saved", ...snapshot } });
      }
      if (url.pathname.startsWith("/api/")) { unexpected.push(url.pathname); return send({ error: "Unexpected request" }); }
      return request.continue();
    });
    const checkFit = async () => {
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), "Page never scrolls sideways");
      const overflow = await page.$$eval("main article", cards => cards.flatMap(card => {
        const bounds = card.getBoundingClientRect();
        return [...card.querySelectorAll(".vf-stavenote,.vf-beam,.vf-tuplet")].filter(note => {
          const box = note.getBoundingClientRect(); return box.left < bounds.left - 1 || box.right > bounds.right + 1;
        }).map(() => card.querySelector("h2").textContent);
      }));
      assert.deepEqual(overflow, [], "Notation stays inside each card");
      assert(!(await page.$eval("main", el => el.textContent)).includes("Unable to display"));
    };
    const saveScore = async (dynamicDrill = false) => {
      snapshot = null;
      await page.waitForSelector("#vexflow .vf-stavenote");
      await page.waitForSelector("button[aria-label=save]");
      if (dynamicDrill) {
        await page.waitForFunction(() => document.body.textContent.includes("This is a dynamic rhythm."));
        await clickText(page, "Ok");
        await page.waitForFunction(() => !document.querySelector("[role=dialog]"));
      }
      await page.click("button[aria-label=save]");
      await page.waitForSelector("#rhythm-dialog-title");
      const dynamic = await page.$("[role=dialog] input[type=checkbox]");
      if (dynamic) await dynamic.click();
      await clickText(page, "Save privately");
      await page.waitForFunction(() => !document.querySelector("#rhythm-dialog-title"));
      assert(snapshot, "The chosen score can be saved"); return snapshot;
    };
    await page.goto(`${origin}/rudiments`, { waitUntil: "networkidle0" });
    await page.waitForSelector("main article .vf-stavenote");
    assert.equal(await page.$$eval("main article", nodes => nodes.length), 29);
    await checkFit(); await page.screenshot({ path: `${folder}/rudiments-desktop.png` });
    for (const viewport of [{ width: 820, height: 1000 }, { width: 390, height: 844 }, { width: 320, height: 740 }]) {
      await page.setViewport(viewport);
      await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
      await checkFit(); await page.screenshot({ path: `${folder}/rudiments-${viewport.width}.png` });
    }
    await page.setViewport({ width: 1440, height: 1000 });
    await page.type("input[aria-label='Search rudiments']", "Paradiddle");
    assert(await page.$$eval("main article h2", nodes => nodes.length > 0 && nodes.every(node => /paradiddle/i.test(node.textContent))));
    await page.click("button[aria-label='Clear search']");
    await page.$$eval("[aria-label='Rudiments categories'] button", buttons => buttons[1].click());
    await page.waitForSelector("section[aria-label='Hybrid rudiments'] .vf-stavenote");
    const hybridCount = await page.$$eval("main article", nodes => nodes.length);
    assert(hybridCount > 40);
    // Draw and inspect every rudiment, including dense tuplets and grace notes.
    for (const card of await page.$$("main article")) {
      await card.evaluate(el => el.scrollIntoView({ block: "center" }));
      await card.waitForSelector(".vf-stavenote");
    }
    await page.waitForFunction(() => [...document.querySelectorAll("main article")].every(card => card.querySelector(".vf-stavenote")));
    await checkFit();
    await page.evaluate(() => scrollTo(0, 0));
    await page.screenshot({ path: `${folder}/hybrid-desktop.png` });
    await page.$$eval("[aria-label='Rudiments categories'] button", buttons => buttons[0].click());
    await page.click("button[aria-label='Open Single Stroke Roll in score']");
    const rudiment = await saveScore();
    assert.equal(rudiment.name, singleStroke.name); assert.equal(rudiment.tempo, singleStroke.tempo);
    assert.deepEqual(rudiment.score, singleStroke.score);
    await page.goto(`${origin}/exercises`, { waitUntil: "networkidle0" });
    await page.waitForSelector("main article .vf-stavenote");
    assert.equal(await page.$$eval("main article", nodes => nodes.length), 10);
    await checkFit(); await page.screenshot({ path: `${folder}/drills-desktop.png` });
    const originalNotation = await page.$$eval("main article:first-child .vf-stavenote path", paths => paths.map(path => path.getAttribute("d")));
    await page.click("main article button[title='Shuffle drill']");
    assert.equal(await page.$("main [role=alert]"), null);
    await page.click("main article button[aria-label^='Open ']");
    const shuffled = await saveScore(true);
    assert.equal(shuffled.name, snareDrill.name); assert.equal(shuffled.mutations.length, 1);
    assert.equal(shuffled.score.measures.length, snareDrill.score.measures.length);
    await page.goto(`${origin}/exercises`, { waitUntil: "networkidle0" });
    await page.waitForSelector("main article .vf-stavenote");
    assert.deepEqual(await page.$$eval("main article:first-child .vf-stavenote path", paths => paths.map(path => path.getAttribute("d"))), originalNotation, "Shuffling leaves the source drill unchanged");
    await page.$$eval("[aria-label='Drills categories'] button", buttons => buttons[1].click());
    await page.waitForSelector("section[aria-label='Drum set drills'] .vf-stavenote");
    assert.equal(await page.$$eval("main article", nodes => nodes.length), 9);
    await checkFit(); await page.screenshot({ path: `${folder}/drumset-desktop.png` });
    await page.setViewport({ width: 390, height: 844 });
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    await checkFit(); await page.screenshot({ path: `${folder}/drills-mobile.png` });
    await page.click("main article button[title='Shuffle drill']");
    assert.equal(await page.$("main [role=alert]"), null);
    await page.click("main article button[aria-label^='Open ']");
    assert.equal((await saveScore(true)).score.measures[0].parts[0].instrument, "drumset");
    assert.deepEqual(errors, []); assert.deepEqual(unexpected, []);
    console.log("Passed: responsive catalog notation, category/search navigation, hybrid rendering, Score handoff, and immutable snare/drum-set drill shuffling.");
  } catch (error) {
    console.error("Runtime errors:", errors);
    await page.screenshot({ path: `${folder}/failure.png`, fullPage: true }); throw error;
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
