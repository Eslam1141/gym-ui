// Shared setup for the rest-days specs: own context per test, Cairo timezone,
// fake clock, and an in-memory stand-in for the gym-be endpoints.
const NOW = "2026-10-02T07:00:00Z"; // Friday 10:00 in Cairo; yesterday = 2026-10-01
const TODAY = "2026-10-02";
const YESTERDAY = "2026-10-01";
const DAY_ID = "m_upperA";
const EX_IDS = ["mua_bench", "mua_pulldown", "mua_ohp", "mua_row", "mua_lateral", "mua_facepull", "mua_curl", "mua_pushdown"];

function makeServer(over) {
  return Object.assign({
    records: [], restDays: [], left: 2, streak: 3, todayDone: false,
    completeStatus: 200, completeError: "", log: []
  }, over || {});
}

async function mockApi(context, s) {
  await context.route("**/api/v1/**", async (route) => {
    const req = route.request();
    const url = new URL(req.url());
    const path = url.pathname.replace(/^.*\/api\/v1/, "");
    const json = (status, body) => route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });
    const body = () => { try { return JSON.parse(req.postData() || "{}"); } catch (e) { return {}; } };
    s.log.push({ method: req.method(), path, query: url.search, body: req.method() === "POST" ? body() : null });

    if (path === "/me") {
      return json(200, {
        id: "u1", email: "t@example.com", displayName: "Tester", currentStreak: s.streak, totalDaysTrained: 5,
        todayDone: s.todayDone, todayRested: s.restDays.includes(TODAY), trainingDays: []
      });
    }
    if (path === "/workouts/complete" && req.method() === "GET") {
      return json(200, { records: s.records, restDays: s.restDays, restDaysLeftThisWeek: s.left });
    }
    if (path === "/workouts/complete" && req.method() === "POST") {
      if (s.completeStatus !== 200) return json(s.completeStatus, { error: { code: s.completeError, message: "x" } });
      const b = body();
      s.records.push({ date: b.date, dayId: b.dayId });
      if (b.date === TODAY) s.todayDone = true;
      return json(200, { ok: true });
    }
    if (path === "/workouts/rest" && req.method() === "POST") {
      if (s.left <= 0 || s.forceLimit) return json(409, { error: { code: "rest_day_limit", message: "limit" } });
      const b = body();
      s.restDays.push(b.date);
      s.left--;
      return json(200, { date: b.date, restDaysLeftThisWeek: s.left });
    }
    if (path.startsWith("/workouts/rest/") && req.method() === "DELETE") {
      const d = path.split("/").pop();
      s.restDays = s.restDays.filter((x) => x !== d);
      s.left = Math.min(2, s.left + 1);
      return json(200, { restDaysLeftThisWeek: s.left });
    }
    return json(404, { error: { code: "not_found", message: "mock" } });
  });
}

// opts: { signedIn, lang, theme, plan, checks, ls: {key: value}, server, viewport }
async function openApp(browser, opts) {
  opts = opts || {};
  const context = await browser.newContext({
    timezoneId: "Africa/Cairo", locale: opts.lang === "ar" ? "ar-EG" : "en-US", serviceWorkers: "block",
    viewport: opts.viewport || { width: 390, height: 844 }
  });
  const server = makeServer(opts.server);
  await mockApi(context, server);
  const consoleErrors = [];
  await context.addInitScript((o) => {
    try {
      if (sessionStorage.getItem("__seeded")) return;
      sessionStorage.setItem("__seeded", "1");
      const ls = localStorage;
      ls.setItem("gym_lang", o.lang || "en");
      ls.setItem("gym_onboarded", "1");
      ls.setItem("gym_plan", o.plan || "male");
      ls.setItem("gym_style", "gym");
      ls.setItem("gym_theme", o.theme || "dark");
      if (!o.signedIn) ls.setItem("gym_anon", "1");
      if (o.checks) ls.setItem("gym_checks", JSON.stringify(o.checks));
      Object.keys(o.ls || {}).forEach((k) => ls.setItem(k, JSON.stringify(o.ls[k])));
      if (o.signedIn) {
        sessionStorage.setItem("gymauth_session", JSON.stringify({
          token: "tok", exp: o.exp, source: "local", profile: { name: "Tester", email: "t@example.com" }
        }));
      }
    } catch (e) {}
  }, Object.assign({ exp: Math.floor(Date.parse(NOW) / 1000) + 20 * 3600 }, opts));
  const page = await context.newPage();
  page.on("console", (m) => { if (m.type() === "error") consoleErrors.push(m.text()); });
  page.on("pageerror", (e) => consoleErrors.push(String(e)));
  await page.clock.install({ time: new Date(NOW) });
  await page.goto("/index.html");
  await page.waitForFunction(() => window.GymRest && window.GymDate, null, { timeout: 15000 });
  return { context, page, server, consoleErrors };
}

module.exports = { openApp, NOW, TODAY, YESTERDAY, DAY_ID, EX_IDS };
