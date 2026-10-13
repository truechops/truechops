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
const { createBookChallenge, challengeMatches } = require("../../src/lib/book-practice-server");
const { validatePracticeLines } = require("../../src/lib/book-practice-score");
const { getBookPageQrToken, getBookPageIdentity } = require("../../src/lib/book-qr");
const origin = process.argv[2] || "http://127.0.0.1:3102";
const artifactRoot = `book-output/practice-check-${Date.now()}`;
fs.mkdirSync(artifactRoot, { recursive: true });
const rawBook = JSON.parse(fs.readFileSync("data/book-builder/snare-drum-book-2-tuplets/book.json"));
const book = { ...rawBook, pages: rawBook.sections.flatMap((section) => section.pages) };
const token = getBookPageQrToken(getBookPageIdentity(5, book));
const challenge = createBookChallenge(book);


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

    let verified = false;
    let saved = null;
    let generationCalls = 0;
    const bookIdentity = { book: book.book, edition: book.edition, title: book.title };
    await page.setRequestInterception(true);
    const mockAccount = (scanActive) => async (request) => {
      const url = new URL(request.url());
      const respond = (payload, status = 200) => request.respond({ status, contentType: "application/json", body: JSON.stringify(payload) });
      const body = request.postData() ? JSON.parse(request.postData()) : {};
      if (url.pathname === "/api/auth/me") return respond({ user: { id: "browser-test", name: "Practice tester", email: "practice@example.com" } });
      if (url.pathname === "/api/book-practice/access") {
        if (request.method() === "GET") return respond({ books: [{ book: "true-chops-volume-1", edition: 1, title: "Book 1 - Rhythms" }, bookIdentity], verifiedBooks: verified ? [bookIdentity] : [], verified, scanActive });
        if (request.method() === "POST") { const publicChallenge = { ...challenge }; delete publicChallenge.answers; return respond({ challenge: publicChallenge }); }
        verified = challengeMatches(challenge, body.answers);
        return respond(verified ? { verified: true } : { error: "Incorrect answers" }, verified ? 200 : 400);
      }
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
    // A second device has the same account, but no QR cookie. Leave its pages
    // open before verification, then return to them after the phone verifies.
    const laptopContext = await browser.createIncognitoBrowserContext();
    const laptop = await laptopContext.newPage();
    const library = await laptopContext.newPage();
    for (const tab of [laptop, library]) {
      tab.on("pageerror", (error) => errors.push(error.message));
      await tab.setRequestInterception(true);
      tab.on("request", mockAccount(false));
    }
    await laptop.bringToFront();
    await laptop.goto(`${origin}/account/books?book=${book.book}`, { waitUntil: "domcontentloaded" });
    await laptop.waitForSelector("main select");
    assert(!(await laptop.cookies()).some((cookie) => cookie.name === "tc_book_scan"));
    await library.bringToFront();
    await library.goto(`${origin}/account/books`, { waitUntil: "domcontentloaded" });
    await library.waitForSelector("main select");
    assert.equal(await library.$('section[aria-label="Verified books"]'), null);
    await page.bringToFront();
    await page.setViewport({ width: 1280, height: 900 });
    await page.goto(`${origin}/account/books?book=${book.book}&returnTo=${encodeURIComponent(`/book?token=${token}`)}`, { waitUntil: "domcontentloaded" });
    await page.waitForSelector("main select");
    await clickText(page, "Start three rhythm matches");
    await page.waitForSelector('input[type="radio"]');
    assert.equal((await page.$$('input[type="radio"]')).length, 12);
    await page.screenshot({ path: `${artifactRoot}/book-practice-verification.png`, fullPage: true });
    for (const answer of challenge.answers) await page.click(`input[value="${answer.optionId}"]`);
    await clickText(page, "Verify my book");
    await page.waitForFunction(() => document.querySelector("main")?.innerText.includes("Your book is verified"));
    assert(verified);
    await laptop.bringToFront();
    await laptop.evaluate(() => window.dispatchEvent(new Event("focus")));
    await laptop.waitForSelector('section[aria-label="Verified books"]');
    assert((await laptop.$eval('section[aria-label="Verified books"]',el=>el.innerText)).includes(book.title));
    await clickText(laptop, "Refresh book verification");
    await library.bringToFront();
    await library.evaluate(() => document.dispatchEvent(new Event("visibilitychange")));
    await library.waitForSelector('section[aria-label="Verified books"]');
    assert((await library.$eval('section[aria-label="Verified books"]', (element) => element.innerText)).includes(book.title));
    await library.reload({ waitUntil: "domcontentloaded" });
    await library.waitForFunction((bookKey) => document.querySelector("main select")?.value === bookKey, {}, book.book);
    await page.bringToFront();
    await page.waitForFunction(() => [...document.querySelectorAll("main button")].some((button) => button.textContent === "Refresh book verification" && !button.disabled));
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
    await page.waitForFunction(() => window.scrollY === 0);
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
    assert.equal(generationCalls, 0,"Book pages must never request generated exercises");
    await clickText(page,"Open in score");
    await page.waitForFunction(()=>location.pathname==="/");
    await page.waitForSelector("button[aria-label='save']");
    await page.click("button[aria-label='save']");
    await page.waitForSelector("#rhythm-dialog-title");
    assert.equal(await page.$eval("[role=dialog] select",el=>el.parentElement.parentElement.querySelectorAll("select")[1].value),"private");
    assert.equal(await page.$eval("[role=dialog] input",el=>el.value),saved.name,"The saved book practice name is carried to Score");
    assert.equal(await page.evaluate(async()=> (await fetch('/api/book-practice/generate',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'})).status),410);
    assert(!JSON.stringify(saved).includes(token));
    assert(!errors.length, errors.join("\n"));
    console.log("Browser checks passed: QR redirect, mobile layout, notation, modification, playback, three account matches, cross-device verification refresh, saved practice, score transfer, private defaults, and retired generation endpoint.");
  } catch (error) {
    console.error("Browser errors:", errors);
    for (const tab of await browser.pages()) {
      console.error("Page:", tab.url(), await tab.$eval("main", (element) => element.innerText.slice(0, 1500)).catch(() => "No main content"));
    }
    throw error;
  } finally { await browser.close(); }
})().catch((error) => { console.error(error); process.exitCode = 1; });
