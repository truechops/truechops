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
const { createBookChallenge, challengeMatches, generateBookPractice } = require("../../src/lib/book-practice-server");
const { validatePracticeLines } = require("../../src/lib/book-practice-score");
const { getBookPageQrToken, getBookPageIdentity } = require("../../src/lib/book-qr");
const origin = process.argv[2] || "http://127.0.0.1:3102";
const rawBook = JSON.parse(fs.readFileSync("data/book-builder/snare-drum-book-2-tuplets/book.json"));
const book = { ...rawBook, pages: rawBook.sections.flatMap((section) => section.pages) };
const token = getBookPageQrToken(getBookPageIdentity(5, book));
const challenge = createBookChallenge(book);
const fresh = generateBookPractice(book, 5, 4);

async function clickText(page, text) {
  const buttons = await page.$$("main button");
  for (const button of buttons) if (await button.evaluate((element, label) => element.textContent === label, text)) { await button.click(); return; }
  throw new Error(`Button not found: ${text}`);
}

(async () => {
  const browser = await puppeteer.launch({ headless: "new", args: ["--no-sandbox", "--disable-setuid-sandbox"], timeout: 20000 });
  try {
    const page = await browser.newPage();
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.setViewport({ width: 1280, height: 900 });
    await page.goto(`${origin}/q/${token}`, { waitUntil: "domcontentloaded", timeout: 60000 });
    await page.waitForSelector("#tab-rhythms", { timeout: 30000 });
    assert(page.url().includes(`/book?token=${token}`));
    assert((await page.cookies()).some((cookie) => cookie.name === "tc_book_scan" && cookie.httpOnly));
    await page.waitForSelector("main .vf-stavenote");
    await page.screenshot({ path: "book-output/book-practice-desktop.png" });
    await clickText(page, "Clear selection");
    await page.click('button[aria-label="Rhythm 1"]');
    assert((await page.$eval("main", (element) => element.innerText)).includes("1 of 22 rhythms selected"));
    await clickText(page, "Alternate R/L");
    await clickText(page, "Play selected");
    await page.waitForFunction(() => [...document.querySelectorAll("main button")].some((button) => button.textContent === "Stop"));
    await clickText(page, "Stop");
    await clickText(page, "Restore");
    await page.click("#tab-generate");
    assert((await page.$eval("#panel-generate", (element) => element.innerText)).includes("Sign in"));
    await page.setViewport({ width: 390, height: 844 });
    await page.click("#tab-rhythms");
    await page.screenshot({ path: "book-output/book-practice-mobile.png" });
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), "no horizontal page overflow");

    let verified = false;
    let saved = null;
    let generationCalls = 0;
    const bookIdentity = { book: book.book, edition: book.edition, title: book.title };
    await page.setRequestInterception(true);
    page.on("request", async (request) => {
      const url = new URL(request.url());
      const respond = (payload, status = 200) => request.respond({ status, contentType: "application/json", body: JSON.stringify(payload) });
      const body = request.postData() ? JSON.parse(request.postData()) : {};
      if (url.pathname === "/api/auth/me") return respond({ user: { id: "browser-test", name: "Practice tester" } });
      if (url.pathname === "/api/book-practice/access") {
        if (request.method() === "GET") return respond({ books: [bookIdentity], verifiedBooks: verified ? [bookIdentity] : [], verified, scanActive: true });
        if (request.method() === "POST") { const publicChallenge = { ...challenge }; delete publicChallenge.answers; return respond({ challenge: publicChallenge }); }
        verified = challengeMatches(challenge, body.answers);
        return respond(verified ? { verified: true } : { error: "Incorrect answers" }, verified ? 200 : 400);
      }
      if (url.pathname === "/api/book-practice/generate") {
        assert.equal(body.token, token); assert.equal(body.count, 4); assert(verified);
        generationCalls++; return respond(fresh);
      }
      if (url.pathname === "/api/book-practice/sets") {
        if (request.method() === "POST") {
          saved = { _id: "browser-saved", name: body.name, tempo: body.tempo, lines: validatePracticeLines(body.lines), createdAt: new Date().toISOString() };
          return respond({ id: saved._id, name: saved.name });
        }
        return respond(url.searchParams.has("id") ? { set: saved } : { sets: saved ? [saved] : [] });
      }
      return request.continue();
    });
    await page.setViewport({ width: 1280, height: 900 });
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.waitForSelector("#tab-generate"); await page.click("#tab-generate");
    await page.waitForSelector('a[href^="/account/books?book="]');
    await page.click('a[href^="/account/books?book="]');
    await page.waitForSelector("main select");
    await clickText(page, "Start three rhythm matches");
    await page.waitForSelector('input[type="radio"]');
    assert.equal((await page.$$('input[type="radio"]')).length, 12);
    await page.screenshot({ path: "book-output/book-practice-verification.png", fullPage: true });
    for (const answer of challenge.answers) await page.click(`input[value="${answer.optionId}"]`);
    await clickText(page, "Verify my book");
    await page.waitForFunction(() => document.querySelector("main")?.innerText.includes("Your book is verified"));
    assert(verified);
    await page.click(`a[href="/book?token=${token}"]`);
    await page.waitForSelector("#tab-generate"); await page.click("#tab-generate");
    await page.waitForSelector('input[aria-label="Number of rhythms"]');
    await page.$eval('input[aria-label="Number of rhythms"]', (input) => { input.value = ""; });
    await page.type('input[aria-label="Number of rhythms"]', "4");
    await clickText(page, "Generate rhythms");
    await page.waitForFunction(() => document.querySelector("main")?.innerText.includes("Add all 4 rhythms"));
    await clickText(page, "Add all 4 rhythms to practice");
    await page.waitForSelector("#panel-rhythms");
    assert((await page.$eval("main", (element) => element.innerText)).includes("26 of 26 rhythms selected"));
    await clickText(page, "Save selected rhythms");
    await page.waitForSelector('a[href="/book?set=browser-saved"]');
    assert.equal(saved.lines.length, 26);
    await page.click('a[href="/book?set=browser-saved"]');
    await page.waitForFunction(() => document.querySelector("main")?.innerText.includes("These are your saved rhythms"));
    assert.equal(await page.$("#tab-generate"), null);
    assert.equal(generationCalls, 1);
    assert(!JSON.stringify(saved).includes(token));
    assert(!errors.length, errors.join("\n"));
    console.log("Browser checks passed: QR redirect, mobile layout, notation, modification, playback, sign-in gate, three account matches, generation, add all, save, and practice-only reopening.");
  } finally { await browser.close(); }
})().catch((error) => { console.error(error); process.exitCode = 1; });
