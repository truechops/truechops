// Run against a local Next server. Authentication and saves use browser fixtures.
const assert = require("node:assert/strict"), fs = require("node:fs"), puppeteer = require("puppeteer");
const origin = process.argv[2] || "http://127.0.0.1:3104", folder = "book-output/byos-preview";
fs.mkdirSync(folder, { recursive: true });
async function clickText(page, text) {
  for (const button of await page.$$("main button, [role=dialog] button")) {
    if (await button.evaluate((el, label) => el.textContent.trim() === label, text)) { await button.click(); return; }
  }
  throw new Error(`Missing button ${text}`);
}
(async () => {
  const browser = await puppeteer.launch({ headless: "new", args: ["--no-sandbox"] });
  const page = await browser.newPage(), errors = [], unexpected = [];
  let saved;
  page.setDefaultNavigationTimeout(60000);
  try {
    page.on("pageerror", error => errors.push(error.message));
    await page.setViewport({ width: 1440, height: 1000 });
    await page.setRequestInterception(true);
    page.on("request", request => {
      const url = new URL(request.url());
      const send = body => request.respond({ status: 200, contentType: "application/json", body: JSON.stringify(body) });
      if (url.origin !== origin) return request.abort();
      if (url.pathname === "/api/auth/me") return send({ user: { id: "byos-tester", name: "BYOS tester" } });
      if (url.pathname === "/api/social/rhythms" && request.method() === "POST") { saved = JSON.parse(request.postData()); return send({ rhythm: { id: "saved", ...saved } }); }
      if (url.pathname.startsWith("/api/")) { unexpected.push(url.pathname); return send({ error: "Unexpected request" }); }
      return request.continue();
    });
    const frame = () => page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    const fill = async value => { await page.focus("#byosWord"); await page.keyboard.down("Control"); await page.keyboard.press("A"); await page.keyboard.up("Control"); await page.keyboard.press("Backspace"); if (value) await page.type("#byosWord", value); await frame(); };
    const checkFit = async () => {
      await frame();
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), "Page fits without horizontal scrolling");
      const overflow = await page.$$eval("main [role=img]", containers => containers.flatMap(container => {
        const box = container.getBoundingClientRect();
        return [...container.querySelectorAll(".vf-stavenote,.vf-beam,.vf-tuplet")].filter(note => {
          const bounds = note.getBoundingClientRect(); return bounds.left < box.left - 1 || bounds.right > box.right + 1;
        }).map(() => container.getAttribute("aria-label"));
      }));
      assert.deepEqual(overflow, [], "Notation stays inside the preview and letter cards");
      assert(!(await page.$eval("main", el => el.textContent)).includes("Unable to display"));
    };
    await page.goto(`${origin}/byos`, { waitUntil: "networkidle0" });
    await page.waitForSelector("#byos-alphabet .vf-stavenote");
    assert.equal(await page.$$eval("#byos-alphabet button", buttons => buttons.length), 26);
    assert(await page.$eval("form button[type=submit]", button => button.disabled));
    await checkFit(); await page.screenshot({ path: `${folder}/desktop-empty.png` });
    await fill("  !HoWdy, 123");
    await page.waitForSelector("[aria-label='Your BYOS rhythm'] .vf-stavenote");
    await checkFit(); await page.screenshot({ path: `${folder}/desktop-phrase.png` });
    await page.click("button[aria-label='Add A to phrase']");
    assert.equal(await page.$eval("#byosWord", input => input.value), "  !HoWdy, 123A");
    await clickText(page, "Hide alphabet");
    assert.equal(await page.$("#byos-alphabet"), null);
    await clickText(page, "Show alphabet");
    await page.waitForSelector("#byos-alphabet .vf-stavenote");
    assert.equal(await page.$eval("#byosWord", input => input.value), "  !HoWdy, 123A");
    await clickText(page, "Notation guide");
    await page.waitForSelector("#byos-guide-title");
    await page.waitForFunction(() => getComputedStyle(document.querySelector(".MuiDialog-container")).opacity === "1");
    assert.equal(await page.$$eval("[role=dialog] li", items => items.length), 5);
    await page.screenshot({ path: `${folder}/guide-desktop.png` });
    await page.keyboard.press("Escape");
    await page.waitForFunction(() => !document.querySelector("[role=dialog]"));
    assert.equal(await page.evaluate(() => document.activeElement.textContent.trim()), "Notation guide");
    // Inspect every letter, including the special noteheads, without eager rendering.
    for (const card of await page.$$("#byos-alphabet button")) {
      await card.evaluate(el => el.scrollIntoView({ block: "center" })); await card.waitForSelector(".vf-stavenote");
    }
    await checkFit();
    await page.waitForSelector("[aria-label='Phrase quick actions']");
    await page.screenshot({ path: `${folder}/alphabet-desktop.png` });
    await page.click("button[aria-label='Back to phrase']");
    await page.waitForFunction(() => !document.querySelector("[aria-label='Phrase quick actions']"));
    await page.click("button[aria-label='Clear phrase']");
    await clickText(page, "HOWDY");
    assert.equal(await page.$eval("#byosWord", input => input.value), "HOWDY");
    for (const viewport of [{ width: 820, height: 1000 }, { width: 390, height: 844 }, { width: 320, height: 740 }]) {
      await page.setViewport(viewport); await checkFit();
      await page.screenshot({ path: `${folder}/phrase-${viewport.width}.png` });
    }
    await clickText(page, "Notation guide"); await page.waitForSelector("#byos-guide-title");
    await page.waitForFunction(() => getComputedStyle(document.querySelector(".MuiDialog-container")).opacity === "1");
    assert(await page.$eval("[role=dialog]", el => el.scrollWidth <= el.clientWidth + 1));
    await page.screenshot({ path: `${folder}/guide-mobile.png` });
    await page.click("button[aria-label='Close notation guide']");
    await page.waitForFunction(() => !document.querySelector("[role=dialog]"));
    await fill("123 !");
    assert.equal(await page.$("[aria-label='Your BYOS rhythm']"), null);
    assert(await page.$eval("form button[type=submit]", button => button.disabled));
    await fill("A".repeat(65));
    assert.equal(await page.$eval("#byosWord", input => input.value.length), 64);
    assert(await page.$$eval("#byos-alphabet button", buttons => buttons.every(button => button.disabled)));
    await checkFit();
    await page.click("button[aria-label='Clear phrase']");
    for (const letter of ["H", "O", "H"]) await page.click(`button[aria-label='Add ${letter} to phrase']`);
    assert.equal(await page.$eval("#byosWord", input => input.value), "HOH");
    await clickText(page, "Open in score");
    await page.waitForSelector("#vexflow .vf-stavenote");
    await page.waitForSelector("button[aria-label=save]"); await page.click("button[aria-label=save]");
    await page.waitForSelector("#rhythm-dialog-title"); await clickText(page, "Save privately");
    await page.waitForFunction(() => !document.querySelector("#rhythm-dialog-title"));
    assert.equal(saved.name, "HOH"); assert.equal(saved.tempo, 120); assert.deepEqual(saved.mutations, []);
    const expected = ["h", "o", "h"].flatMap(letter => require(`../../data/byos/alphabet/${letter}.json`).score.measures);
    assert.deepEqual(saved.score.measures, expected, "Score receives the exact phrase, including repeated letters and special notation");
    assert.deepEqual(errors, []); assert.deepEqual(unexpected, []);
    console.log("Passed: BYOS typing, ignored punctuation, alphabet composition, clear/examples, hide/show, accessible guide, 64-character limit, responsive notation and Score handoff.");
  } catch (error) {
    console.error("Runtime errors:", errors);
    await page.screenshot({ path: `${folder}/failure.png`, fullPage: true }); throw error;
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
