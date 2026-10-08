const { test, expect } = require("@playwright/test");
const { openApp } = require("./helpers");

test("GymDom.h builds elements like the old per-screen h()", async ({ browser }) => {
  const { context, page } = await openApp(browser, {});
  const r = await page.evaluate(() => {
    const h = window.GymDom.h;
    let clicked = 0;
    const el = h("button", { class: "a b", text: "label", "data-x": "1", hidden: false, title: null,
      on: { click: () => { clicked++; } } });
    el.click();
    const p = h("p", null, "a", [h("b", null, "b"), null, false], 0, 7, undefined, "c");
    return { tag: el.tagName, cls: el.className, dx: el.getAttribute("data-x"),
      hasHidden: el.hasAttribute("hidden"), hasTitle: el.hasAttribute("title"),
      text: el.textContent, clicked, ptext: p.textContent, pkids: p.childNodes.length };
  });
  expect(r).toEqual({ tag: "BUTTON", cls: "a b", dx: "1", hasHidden: false, hasTitle: false,
    text: "label", clicked: 1, ptext: "ab07c", pkids: 5 });
  await context.close();
});

test("GymDom.lang and makeT follow gym_lang and fall back to the key", async ({ browser }) => {
  const { context, page } = await openApp(browser, { lang: "ar" });
  const r = await page.evaluate(() => {
    const s = window.GymDom.makeT({ hi: ["Hello", "أهلاً"] });
    const ar = [window.GymDom.lang(), s("hi"), s("nope")];
    localStorage.setItem("gym_lang", "en");
    const en = [window.GymDom.lang(), s("hi")];
    localStorage.setItem("gym_lang", "fr");
    return { ar, en, other: window.GymDom.lang() };
  });
  expect(r).toEqual({ ar: ["ar", "أهلاً", "nope"], en: ["en", "Hello"], other: "en" });
  await context.close();
});

const fs = require("fs");
const path = require("path");

test("dom.js is shipped and precached", () => {
  const root = path.join(__dirname, "..");
  const sw = fs.readFileSync(path.join(root, "service-worker.js"), "utf8");
  const docker = fs.readFileSync(path.join(root, "Dockerfile"), "utf8");
  expect(sw).toContain('"./dom.js"');
  const copyLine = docker.split("\n").find((l) => l.startsWith("COPY") && l.includes("toast.js") && l.includes("/app/"));
  expect(copyLine).toContain(" dom.js ");
  const start = docker.indexOf("HASH=$(cat");
  const hashBlock = docker.slice(start, docker.indexOf("sha256sum", start));
  expect(hashBlock).toContain(" dom.js ");
});
