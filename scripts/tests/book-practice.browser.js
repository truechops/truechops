// Run against a local Next server: node scripts/tests/book-practice.browser.js http://127.0.0.1:3102
// Account responses are intercepted fixtures; signed-out QR delivery is real.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const Module = require("node:module");
const babel = require("@babel/core");
const puppeteer = require("puppeteer");
const originalLoader = Module._extensions[".js"];
Module._extensions[".js"] = (module, file) => {
  if (file.includes("node_modules")) return originalLoader(module, file);
  module._compile(babel.transformSync(fs.readFileSync(file, "utf8"), {
    presets: [["@babel/preset-env", { targets: { node: "current" } }]], babelrc: false, configFile: false,
  }).code, file);
};
const { validatePracticeLines } = require("../../src/lib/book-practice-score");
const { getBookPageQrToken, getBookPageIdentity } = require("../../src/lib/book-qr");
const origin = process.argv[2] || "http://127.0.0.1:3102";
const artifactRoot = `book-output/practice-check-${Date.now()}`;
fs.mkdirSync(artifactRoot, { recursive: true });
const rawBook = JSON.parse(fs.readFileSync("data/book-builder/snare-drum-book-2-tuplets/book.json"));
const book = { ...rawBook, pages: rawBook.sections.flatMap((section) => section.pages) };
const token = getBookPageQrToken(getBookPageIdentity(5, book));


async function clickText(page, text) {
  const buttons = await page.$$("main button");
  for (const button of buttons) if (await button.evaluate((element, label) => element.textContent === label, text)) { await button.evaluate(el=>el.scrollIntoView({block:"center"})); await button.click(); return; }
  throw new Error(`Button not found: ${text}`);
}

(async () => {
  const browser = await puppeteer.launch({ headless: "new", args: ["--no-sandbox", "--disable-setuid-sandbox"], timeout: 20000, protocolTimeout: 30000 });
  const errors = [];
  try {
    const page = await browser.newPage();
    page.on("pageerror", (error) => errors.push(error.message));
    await page.setViewport({ width: 1280, height: 900 });
    await page.goto(`${origin}/q/${token}`, { waitUntil: "domcontentloaded", timeout: 60000 });
    await page.waitForSelector("#panel-rhythms", { timeout: 30000 });
    assert(page.url().includes(`/book?token=${token}`));
    assert((await page.cookies()).some((cookie) => cookie.name === "tc_book_scan" && cookie.httpOnly));
    await page.waitForSelector("main .vf-stavenote");
    await page.screenshot({ path: `${artifactRoot}/book-practice-desktop.png` });
    await clickText(page, "Clear selection");
    await page.click('button[aria-label="Rhythm 1"]');
    assert((await page.$eval("main", (element) => element.innerText)).includes("1 of 22 rhythms selected"));
    await clickText(page, "Alternate R/L");
    await clickText(page, "Play selected");
    await page.waitForFunction(() => [...document.querySelectorAll("main button")].some((button) => button.textContent === "Stop"));
    await clickText(page, "Stop");
    await clickText(page, "Restore");
    assert.equal(await page.$("#tab-generate"),null);
    assert.equal(await page.$('input[aria-label="Number of rhythms"]'),null);
    await clickText(page,"Open in score");
    await page.waitForFunction(()=>location.pathname==="/");
    await page.waitForSelector(".vf-stavenote");
    await page.goBack({waitUntil:"domcontentloaded"});
    await page.waitForSelector("#panel-rhythms");
    await page.setViewport({ width: 390, height: 844 });

    await page.screenshot({ path: `${artifactRoot}/book-practice-mobile.png` });
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), "no horizontal page overflow");

    let verificationCalls = 0;
    let saved = null;
    let generationCalls = 0;
    await page.setRequestInterception(true);
    const mockAccount = (scanActive) => async (request) => {
      const url = new URL(request.url());
      const respond = (payload, status = 200) => request.respond({ status, contentType: "application/json", body: JSON.stringify(payload) });
      const body = request.postData() ? JSON.parse(request.postData()) : {};
      if (url.pathname === "/api/auth/me") return respond({ user: { id: "browser-test", name: "Practice tester", email: "practice@example.com" } });
      if (url.pathname === "/api/book-practice/access") { verificationCalls++; return respond({ error:"Verification removed" },410); }
      if (url.pathname === "/api/book-practice/generate") generationCalls++;
      if (url.pathname === "/api/book-practice/sets") {
        if (request.method() === "POST") {
          saved = { _id: "browser-saved", name: body.name, tempo: body.tempo, lines: validatePracticeLines(body.lines), createdAt: new Date().toISOString() };
          return respond({ id: saved._id, name: saved.name });
        }
        return respond(url.searchParams.has("id") ? { set: saved } : { sets: saved ? [saved] : [] });
      }
      return request.continue();
    };
    page.on("request", mockAccount(true));
    await page.setViewport({ width: 1280, height: 900 });
    await page.goto(`${origin}/account/books?returnTo=${encodeURIComponent(`/book?token=${token}`)}`, { waitUntil:"domcontentloaded" });
    await page.waitForSelector('section[aria-label="Saved practice"]');
    assert(!/verify|verification|rhythm matches/i.test(await page.$eval("main", el=>el.innerText)));
    assert.equal(await page.$('input[type="radio"]'),null);
    await page.screenshot({path:`${artifactRoot}/saved-practice.png`,fullPage:true});
    await page.click(`a[href="/book?token=${token}"]`);
    await page.waitForSelector("#panel-rhythms");
    await clickText(page,"Clear selection");
    await page.click('button[aria-label="Rhythm 1"]');
    await clickText(page, "Save selected rhythms");
    await page.waitForSelector('a[href="/book?set=browser-saved"]');
    assert.equal(saved.lines.length, 1);
    await page.click('a[href="/book?set=browser-saved"]');
    await page.waitForFunction(() => document.querySelector("main")?.innerText.includes("1 of 1 rhythms selected"));
    assert.equal(await page.$("#tab-generate"), null);
    assert.equal(verificationCalls, 0,"Book practice never requests verification");
    assert.equal(generationCalls, 0,"Book pages must never request generated exercises");
    await clickText(page,"Open in score");
    await page.waitForFunction(()=>location.pathname==="/");
    await page.waitForSelector("button[aria-label='save']");
    await page.click("button[aria-label='save']");
    await page.waitForSelector("#rhythm-dialog-title");
    assert.equal(await page.$eval("[role=dialog] select",el=>el.value),"private");
    assert.equal(await page.$eval("[role=dialog] input",el=>el.value),saved.name,"The saved book practice name is carried to Score");
    assert.equal(await page.evaluate(async()=> (await fetch('/api/book-practice/generate',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'})).status),410);
    assert(!JSON.stringify(saved).includes(token));
    assert(!errors.length, errors.join("\n"));
    console.log("Browser checks passed: QR redirect, mobile layout, notation, modification, playback, verification-free book account, saved practice, score transfer, private defaults, and retired generation endpoint.");
  } catch (error) {
    console.error("Browser errors:", errors);
    for (const tab of await browser.pages()) {
      console.error("Page:", tab.url(), await tab.$eval("main", (element) => element.innerText.slice(0, 1500)).catch(() => "No main content"));
    }
    throw error;
  } finally { await browser.close(); }
})().catch((error) => { console.error(error); process.exitCode = 1; });
