// All API reads/writes use local fixtures; no database or external media is accessed.
const assert = require("node:assert/strict"), fs = require("node:fs"), puppeteer = require("puppeteer");
const origin = process.argv[2] || "http://127.0.0.1:3104", folder = "book-output/notation-search-preview";
fs.mkdirSync(folder, { recursive: true });
const score = { parts: { snare: { enabled: true } }, measures: ["ralr", "rlrlrlrl"].map((pattern, index) => ({
  timeSig: { num: 2, type: 4 }, parts: [{ instrument: "snare", voices: [{
    notes: [...pattern].map((marking) => ({ notes: ["C5"], duration: index ? 16 : 8, dots: 0, ornaments: marking, velocity: .5 })), tuplets: [],
  }] }],
})) };
const creator = { id: "creator", displayName: "Rhythm creator", handle: "rhythms", instruments: ["snare"] };
const rhythm = { id: "match", name: "A matching rhythm", score, creator, tempo: 90, instruments: ["snare"], visibility: "public", media: [], tags: [] };
const requests = [], errors = [], unexpected = [];
async function clickText(page, text, selector = "button,a,[role=menuitem]") {
  for (const element of await page.$$(selector)) if (await element.evaluate((el, label) => el.textContent.trim() === label || el.getAttribute("aria-label") === label, text)) { await element.click(); return; }
  throw new Error(`Missing control: ${text}`);
}
(async () => {
  const browser = await puppeteer.launch({ headless: "new", args: ["--no-sandbox"] });
  const page = await browser.newPage(); page.setDefaultTimeout(30000); page.setDefaultNavigationTimeout(60000);
  try {
    page.on("pageerror", error => errors.push(error.message));
    await page.setViewport({ width: 1440, height: 900 });
    await page.setRequestInterception(true);
    page.on("request", request => {
      const url = new URL(request.url()), method = request.method();
      const send = (body, status = 200) => request.respond({ status, contentType: "application/json", body: JSON.stringify(body) });
      if (url.origin !== origin) return request.abort();
      if (url.pathname === "/api/auth/me") return send({ user: { id: "tester", name: "Notation tester" } });
      if (url.pathname === "/api/social/rhythms/editor") return send({ rhythm: { ...rhythm, id: "editor", name: "Source study", visibility: "private", isOwner: true } });
      if (url.pathname === "/api/social/search/notation" && method === "POST") {
        const body = JSON.parse(request.postData()); requests.push(body);
        return send({ items: body.instrument === "bass" ? [] : [{ ...rhythm, matchMeasureIndex: 1, score: { ...score, measures: [score.measures[1]] } }], page: body.page, hasMore: false });
      }
      if (url.pathname === "/api/social/rhythms/match") return send({ rhythm });
      if (url.pathname.endsWith("/engagement")) return send({ likeCount: 0, commentCount: 0, liked: false });
      if (url.pathname.endsWith("/similar")) return send({ items: [], page: 1, hasMore: false });
      if (url.pathname === "/api/social/search") return send({ items: url.searchParams.get("type") === "users" ? [creator] : [rhythm], page: 1, hasMore: false });
      if (url.pathname.startsWith("/api/")) { unexpected.push(url.pathname); return send({ error: "Unexpected fixture request" }, 404); }
      return request.continue();
    });
    await page.goto(`${origin}/rhythms/editor`, { waitUntil: "networkidle0" });
    await clickText(page, "Open in score");
    await page.waitForSelector("#vexflow [data-measure-index='1']");
    await page.click("[data-measure-index='1'] [data-measure-background]");
    await clickText(page, "Measure"); await clickText(page, "Find similar");
    await page.waitForSelector("a[aria-label='Open A matching rhythm']");
    await page.waitForSelector("[aria-label='Search notation'] .vf-stavenote");
    await page.waitForSelector("[aria-label='Matching notation from A matching rhythm'] .vf-stavenote");
    assert.equal(new URL(page.url()).searchParams.get("notation"), "1");
    assert.deepEqual(requests.at(-1).score, { ...score, measures: [score.measures[1]] }, "Measure search sends actual selected notation");
    assert.equal(requests.at(-1).includeMarkings, false);
    assert(await page.$eval("[aria-label='Notation to match']", el => el.innerText.includes("Measure 2")));
    await page.click("input[type=checkbox]");
    await page.waitForSelector("a[aria-label='Open A matching rhythm']");
    assert.equal(requests.at(-1).includeMarkings, true);
    await clickText(page, "Bass");
    await page.waitForFunction(() => document.querySelector("main").innerText.includes("No matching notation yet"));
    assert.equal(requests.at(-1).instrument, "bass");
    await clickText(page, "All instruments");
    await page.waitForSelector("a[aria-label='Open A matching rhythm']");
    await page.screenshot({ path: `${folder}/measure-search-desktop.png` });
    await page.click("a[aria-label='Open A matching rhythm']");
    await page.waitForSelector("[aria-label='Rhythm viewer']");
    await page.keyboard.press("Escape");
    await page.waitForFunction(() => !document.querySelector("[aria-label='Rhythm viewer']"));
    assert.equal(new URL(page.url()).searchParams.get("notation"), "1", "Closing a matching rhythm restores the notation search");
    assert.equal(new URL(page.url()).searchParams.get("markings"), "1");
    await clickText(page, "Back to Score");
    await page.waitForSelector("#vexflow [data-measure-index='1']");
    await page.click("button[aria-label='Find rhythms matching this score']");
    await page.waitForSelector("a[aria-label='Open A matching rhythm']");
    assert.deepEqual(requests.at(-1).score, score, "Whole-score search preserves the complete source composition");
    assert(await page.$eval("[aria-label='Notation to match']", el => el.innerText.includes("Source study")));
    await page.setViewport({ width: 390, height: 844 });
    await page.waitForFunction(() => document.documentElement.scrollWidth <= innerWidth);
    await page.screenshot({ path: `${folder}/score-search-mobile.png`, fullPage: true });
    await page.evaluate(() => sessionStorage.removeItem("truechops:notation-search"));
    await page.reload({ waitUntil: "networkidle0" });
    await page.waitForFunction(() => document.querySelector("main").innerText.includes("Select a measure in Score"));
    await clickText(page, "Use current score");
    await page.waitForSelector("a[aria-label='Open A matching rhythm']");
    assert(requests.at(-1).score.measures.length > 0);
    await clickText(page, "All search");
    await page.waitForSelector("input[placeholder='Search rhythms, creators, or tags...']");
    await clickText(page, "Search by notation");
    await page.waitForSelector("a[aria-label='Open A matching rhythm']");
    assert.deepEqual(unexpected, []); assert.deepEqual(errors, []);
    console.log("Passed: selected-measure and whole-score notation search, notation preview, marking/instrument filters, viewer return, mobile layout, and fresh-tab fallback.");
  } catch (error) { console.error(errors, unexpected); await page.screenshot({ path: `${folder}/failure.png`, fullPage: true }); throw error; }
  finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
