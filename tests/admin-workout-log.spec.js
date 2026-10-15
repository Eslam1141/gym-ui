const { test, expect } = require("@playwright/test");
const fs = require("fs");
const path = require("path");

test.setTimeout(45000);

// "Today" is fixed so the month grid is stable: Thu 15 Oct 2026.
const TODAY = new Date(2026, 9, 15, 12, 0, 0);
const USER = { id: "u1", email: "lifter@example.com", displayName: "Lifter One", provider: "google", createdAt: "2026-01-01T00:00:00Z", currentStreak: 2, totalDaysTrained: 9 };

function seed() {
  return {
    records: [
      { date: "2026-10-13", dayId: "m_upper", completedAt: "2026-10-13T18:00:00Z", confirmedLate: false, source: "app" },
      { date: "2026-10-14", dayId: "m_lower", completedAt: "2026-10-14T18:00:00Z", confirmedLate: true, source: "admin", addedBy: "boss@example.com" }
    ],
    restDays: [{ date: "2026-10-12", createdAt: "2026-10-12T08:00:00Z", source: "app" }],
    streak: { currentStreak: 2, totalDaysTrained: 9, todayDone: false, todayRested: false, restDaysLeftThisWeek: 1 }
  };
}

// opts.state: mutable GET payload; opts.on: {"METHOD /path": (state, body, json) => response | undefined}
async function openLog(browser, opts = {}) {
  const context = await browser.newContext({
    ...(process.env.PW_BASE ? { baseURL: process.env.PW_BASE } : {}),
    reducedMotion: "reduce", locale: "en-US", viewport: opts.viewport || { width: 1280, height: 900 }, serviceWorkers: "block",
    colorScheme: opts.colorScheme || "light"
  });
  await context.addInitScript((lang) => {
    localStorage.setItem("gym_lang", lang);
    sessionStorage.setItem("gymauth_session", JSON.stringify({
      token: "tok", exp: Math.floor(Date.now() / 1000) + 3600, source: "local", profile: { name: "Admin", email: "a@example.com" }
    }));
  }, opts.lang || "en");
  const state = opts.state || seed();
  const log = { gets: [], writes: [] };
  await context.route("**/api/v1/**", async (route) => {
    const req = route.request();
    const url = new URL(req.url());
    const p = url.pathname.replace(/^.*\/api\/v1/, "");
    const method = req.method();
    const json = (status, b) => route.fulfill({ status, contentType: "application/json", body: JSON.stringify(b) });
    if (p === "/admin/stats") return json(200, { totalUsers: 1, newUsers: { today: 0, d7: 0, d30: 0 }, activeUsers: { d7: 0, d30: 0 }, blockedUsers: 0, providers: { google: 1, password: 0, both: 0 }, signupsPerDay: [] });
    if (p === "/admin/users" && method === "GET") return json(200, { total: 1, page: 1, pageSize: 25, users: [USER] });
    if (p === "/admin/users/u1" && method === "GET") return json(200, USER);
    if (p === "/admin/users/u1/workouts" && method === "GET") {
      log.gets.push(Object.fromEntries(url.searchParams));
      if (opts.getStatus) return json(opts.getStatus, { error: { code: "not_found", message: "user not found" } });
      return json(200, state);
    }
    const body = req.postData() ? JSON.parse(req.postData()) : undefined;
    if (p.startsWith("/admin/users/u1/") && method !== "GET") {
      log.writes.push({ method, path: p, body, auth: req.headers().authorization });
      const h = (opts.on || {})[method + " " + p.replace("/admin/users/u1", "")];
      if (h) { const handled = h(state, body, json); if (handled) return handled; }
      return route.fulfill({ status: method === "DELETE" ? 204 : 201, contentType: "application/json", body: method === "DELETE" ? "" : "{}" });
    }
    return json(404, {});
  });
  const page = await context.newPage();
  await page.clock.setFixedTime(TODAY);
  await page.goto("/admin.html#users");
  await page.locator(".adm-row").first().click();
  await page.locator('[data-act="workout-log"]').click();
  if (!opts.getStatus) await expect(page.locator(".adm-cal")).toBeVisible();
  return { context, page, state, log };
}
const cell = (page, d) => page.locator(`[data-date="${d}"]`);
const reason = (page, text) => page.locator("#admLogReason").fill(text);
const streakNum = (page, i) => page.locator(".adm-log-sum div").nth(i).locator("dd");

test("renders trained, rest and admin-marked days with the streak summary", async ({ browser }) => {
  const { context, page, log } = await openLog(browser);
  await expect(page.getByRole("dialog", { name: "Workout log" })).toBeVisible();
  expect(log.gets[0]).toEqual({ from: "2026-10-01", to: "2026-10-31", today: "2026-10-15" });
  await expect(cell(page, "2026-10-13")).toHaveClass(/is-done/);
  await expect(cell(page, "2026-10-14")).toHaveClass(/is-done/);
  await expect(cell(page, "2026-10-14").locator(".adm-cal-mark")).toHaveText("admin");
  await expect(cell(page, "2026-10-13").locator(".adm-cal-mark")).toHaveCount(0);
  await expect(cell(page, "2026-10-12")).toHaveClass(/is-rest/);
  await expect(cell(page, "2026-10-15")).toHaveClass(/is-today/);
  await expect(page.locator(".adm-log-sum")).toContainText("Current streak");
  await expect(streakNum(page, 0)).toHaveText("2");
  await expect(streakNum(page, 1)).toHaveText("9");
  await expect(streakNum(page, 2)).toHaveText("1");
  await expect(page.locator(".adm-log-list li")).toHaveCount(3);
  await expect(page.locator(".adm-log-list")).toContainText("m_lower");
  await expect(page.locator(".adm-log-list")).toContainText("added by boss@example.com");
  expect(await cell(page, "2026-10-14").getAttribute("aria-label")).toContain("trained");
  // month navigation re-fetches that month
  await page.locator('[data-nav="prev"]').click();
  await expect(page.locator("#admLogMonth")).toContainText("September 2026");
  expect(log.gets[1]).toMatchObject({ from: "2026-09-01", to: "2026-09-30" });
  await expect(cell(page, "2026-09-30")).toBeVisible();
  await expect(cell(page, "2026-10-13")).toHaveCount(0);
  await context.close();
});

test("marks a day complete with a reason, then re-fetches and updates the streak", async ({ browser }) => {
  const on = {
    "POST /workouts": (st, body, json) => {
      st.records.push({ date: body.date, dayId: body.dayId, completedAt: "2026-10-10T10:00:00Z", confirmedLate: true, source: "admin", addedBy: "a@example.com" });
      st.streak = { ...st.streak, totalDaysTrained: 10, currentStreak: 3 };
      return json(201, {});
    }
  };
  const { context, page, log } = await openLog(browser, { on });
  await cell(page, "2026-10-10").click();
  await page.locator("#admLogDay").selectOption("m_backbi");
  await page.locator('[data-act="mark"]').click();
  await expect(page.locator("#admLogErr")).toHaveText("Write a reason of 3 to 300 characters.");
  expect(log.writes).toHaveLength(0);
  await reason(page, "  Phone died mid-workout  ");
  await page.locator('[data-act="mark"]').click();
  await expect(cell(page, "2026-10-10")).toHaveClass(/is-done/);
  expect(log.writes).toEqual([{ method: "POST", path: "/admin/users/u1/workouts", auth: "Bearer tok", body: { date: "2026-10-10", dayId: "m_backbi", reason: "Phone died mid-workout" } }]);
  expect(log.gets).toHaveLength(2);
  await expect(streakNum(page, 0)).toHaveText("3");
  await expect(page.locator(".adm-log-pane .adm-ok")).toHaveText("Marked complete.");
  await expect(cell(page, "2026-10-10")).toBeFocused();
  await context.close();
});

test("free-text day id is validated against the server pattern", async ({ browser }) => {
  const { context, page, log } = await openLog(browser);
  await cell(page, "2026-10-09").click();
  await page.locator("#admLogDay").selectOption({ label: "Other (type an id)…" });
  await reason(page, "custom plan day");
  await page.locator("#admLogOther").fill("bad id!");
  await page.locator('[data-act="mark"]').click();
  await expect(page.locator("#admLogErr")).toContainText("1 to 64 letters");
  expect(log.writes).toHaveLength(0);
  await page.locator("#admLogOther").fill("x".repeat(70));
  await expect(page.locator("#admLogOther")).toHaveValue("x".repeat(64));
  await page.locator("#admLogOther").fill("coach_plan-7");
  await page.locator('[data-act="mark"]').click();
  await expect.poll(() => log.writes.length).toBe(1);
  expect(log.writes[0].body).toEqual({ date: "2026-10-09", dayId: "coach_plan-7", reason: "custom plan day" });
  await context.close();
});

test("removing a completion asks for confirmation first", async ({ browser }) => {
  const on = {
    "DELETE /workouts/2026-10-13/m_upper": (st) => {
      st.records = st.records.filter((r) => r.date !== "2026-10-13");
      st.streak = { ...st.streak, currentStreak: 0 };
    }
  };
  const { context, page, log } = await openLog(browser, { on });
  await cell(page, "2026-10-13").click();
  await page.locator('[data-act="remove"]').click();
  await expect(page.locator("#admLogErr")).toContainText("3 to 300"); // reason first
  await reason(page, "Logged by mistake");
  await page.locator('[data-act="remove"]').click();
  await expect(page.getByRole("alertdialog")).toContainText("Remove m_upper on");
  expect(log.writes).toHaveLength(0);
  await page.getByRole("alertdialog").getByRole("button", { name: "Cancel" }).click();
  await expect(page.getByRole("alertdialog")).toHaveCount(0);
  expect(log.writes).toHaveLength(0);
  await page.locator('[data-act="remove"]').click();
  await page.locator('[data-act="confirm"]').click();
  await expect(cell(page, "2026-10-13")).not.toHaveClass(/is-done/);
  expect(log.writes).toEqual([{ method: "DELETE", path: "/admin/users/u1/workouts/2026-10-13/m_upper", auth: "Bearer tok", body: { reason: "Logged by mistake" } }]);
  await expect(streakNum(page, 0)).toHaveText("0");
  await expect(page.locator(".adm-log-pane .adm-ok")).toHaveText("Completion removed.");
  await context.close();
});

test("adds and removes a rest day; shows the 409 inline", async ({ browser }) => {
  const on = {
    "POST /rest-days": (st, body, json) => {
      if (body.date === "2026-10-14") return json(409, { error: { code: "already_trained", message: "trained that day" } });
      st.restDays.push({ date: body.date, createdAt: "2026-10-11T00:00:00Z", source: "admin", addedBy: "a@example.com" });
      return json(201, {});
    },
    "DELETE /rest-days/2026-10-11": (st) => { st.restDays = st.restDays.filter((r) => r.date !== "2026-10-11"); }
  };
  const { context, page, log } = await openLog(browser, { on });
  await cell(page, "2026-10-14").click();
  await reason(page, "Doctor said rest");
  await page.locator('[data-act="rest-add"]').click();
  await expect(page.locator("#admLogErr")).toContainText("can't be a rest day");
  await expect(page.locator('[data-act="rest-add"]')).toBeEnabled();
  expect(log.gets).toHaveLength(1);

  await cell(page, "2026-10-11").click();
  await reason(page, "Doctor said rest");
  await page.locator('[data-act="rest-add"]').click();
  await expect(cell(page, "2026-10-11")).toHaveClass(/is-rest/);
  await expect(cell(page, "2026-10-11").locator(".adm-cal-mark")).toHaveText("admin");
  expect(log.writes.at(-1)).toMatchObject({ method: "POST", path: "/admin/users/u1/rest-days", body: { date: "2026-10-11", reason: "Doctor said rest" } });

  await cell(page, "2026-10-11").click();
  await reason(page, "Added twice");
  await page.locator('[data-act="rest-remove"]').click();
  await page.locator('[data-act="confirm"]').click();
  await expect(cell(page, "2026-10-11")).not.toHaveClass(/is-rest/);
  expect(log.writes.at(-1)).toMatchObject({ method: "DELETE", path: "/admin/users/u1/rest-days/2026-10-11", body: { reason: "Added twice" } });
  await context.close();
});

test("reason needs 3 to 300 characters, with a live counter", async ({ browser }) => {
  const { context, page, log } = await openLog(browser);
  await cell(page, "2026-10-09").click();
  await expect(page.locator("#admLogCount")).toHaveText("0 / 300");
  await reason(page, "ab");
  await expect(page.locator("#admLogCount")).toHaveText("2 / 300");
  await page.locator('[data-act="rest-add"]').click();
  await expect(page.locator("#admLogErr")).toContainText("3 to 300");
  await reason(page, "x".repeat(301));
  await expect(page.locator("#admLogCount")).toHaveText("301 / 300");
  await expect(page.locator("#admLogCount")).toHaveClass(/adm-over/);
  await expect(page.locator("#admLogErr")).toHaveText(""); // typing clears the stale error
  await page.locator('[data-act="rest-add"]').click();
  await expect(page.locator("#admLogErr")).toContainText("3 to 300");
  await reason(page, "   ab   "); // trimmed length 2
  await page.locator('[data-act="rest-add"]').click();
  await expect(page.locator("#admLogErr")).toContainText("3 to 300");
  expect(log.writes).toHaveLength(0);
  await context.close();
});

test("future days can't be changed", async ({ browser }) => {
  const { context, page, log } = await openLog(browser);
  await expect(cell(page, "2026-10-20")).toHaveClass(/is-future/);
  await cell(page, "2026-10-20").click();
  await expect(page.locator(".adm-log-pane")).toContainText("hasn't happened yet");
  await expect(page.locator(".adm-log-pane button")).toHaveCount(0);
  await expect(page.locator("#admLogReason")).toHaveCount(0);
  expect(log.writes).toHaveLength(0);
  await context.close();
});

test("server errors on writes show inline: future date, bad request, gone entry", async ({ browser }) => {
  const on = {
    "POST /workouts": (st, body, json) => json(400, { error: { code: "date_in_future", message: "future" } }),
    "POST /rest-days": (st, body, json) => json(400, { error: { code: "invalid_request", message: "reason is too vague" } }),
    "DELETE /workouts/2026-10-13/m_upper": (st, body, json) => json(404, { error: { code: "not_found", message: "no such record" } })
  };
  const { context, page } = await openLog(browser, { on });
  await cell(page, "2026-10-08").click();
  await reason(page, "valid reason");
  await page.locator('[data-act="mark"]').click();
  await expect(page.locator("#admLogErr")).toHaveText("That date is in the future.");
  await page.locator('[data-act="rest-add"]').click();
  await expect(page.locator("#admLogErr")).toHaveText("reason is too vague");
  await cell(page, "2026-10-13").click();
  await reason(page, "valid reason");
  await page.locator('[data-act="remove"]').click();
  await page.locator('[data-act="confirm"]').click();
  await expect(page.getByText("That entry no longer exists.")).toBeVisible();
  await context.close();
});

test("unknown user (404) shows an inline message instead of a grid", async ({ browser }) => {
  const { context, page } = await openLog(browser, { getStatus: 404 });
  await expect(page.locator(".adm-log .adm-err")).toHaveText("User not found.");
  await expect(page.locator(".adm-cal")).toHaveCount(0);
  await context.close();
});

test("XSS: hostile dayId, addedBy and user fields render as inert text", async ({ browser }) => {
  const evil = '<img src=x onerror="window.__xss=1">';
  const evil2 = "<script>window.__xss=2</script>";
  const state = seed();
  state.records.push({ date: "2026-10-11", dayId: evil, completedAt: "2026-10-11T10:00:00Z", confirmedLate: false, source: "admin", addedBy: evil2 });
  state.restDays.push({ date: "2026-10-10", createdAt: "2026-10-10T08:00:00Z", source: "admin", addedBy: evil });
  const { context, page } = await openLog(browser, { state });
  await expect(page.locator(".adm-log-list")).toContainText(evil);
  await expect(page.locator(".adm-log-list")).toContainText(evil2);
  await cell(page, "2026-10-11").click();
  await expect(page.locator(".adm-log-entries")).toContainText(evil);
  await expect(page.locator(".adm-log-entries b")).toHaveAttribute("dir", "auto");
  await cell(page, "2026-10-10").click();
  await expect(page.locator(".adm-log-entries")).toContainText(evil);
  expect(await page.evaluate(() => window.__xss)).toBeUndefined();
  expect(await page.locator(".adm-log img, .adm-log script, .adm-log a").count()).toBe(0);
  await cell(page, "2026-10-11").click();
  await reason(page, "cleanup");
  await page.locator('[data-act="remove"]').click();
  await expect(page.getByRole("alertdialog")).toContainText("Remove " + evil + " on");
  expect(await page.evaluate(() => window.__xss)).toBeUndefined();
  await context.close();
});

test("keyboard: arrows move through the grid, Esc closes and returns focus, Tab stays inside", async ({ browser }) => {
  const { context, page } = await openLog(browser);
  const opener = page.locator('[data-act="workout-log"]');
  await cell(page, "2026-10-15").focus();
  await page.keyboard.press("ArrowLeft");
  await expect(cell(page, "2026-10-14")).toBeFocused();
  await page.keyboard.press("ArrowUp");
  await expect(cell(page, "2026-10-07")).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.locator(".adm-log-pane h3").first()).toContainText("Oct 7, 2026");
  await expect(cell(page, "2026-10-07")).toHaveAttribute("aria-selected", "true");
  for (let i = 0; i < 40; i++) {
    await page.keyboard.press("Tab");
    expect(await page.evaluate(() => !!document.activeElement.closest(".adm-log"))).toBe(true);
  }
  for (let i = 0; i < 40; i++) {
    await page.keyboard.press("Shift+Tab");
    expect(await page.evaluate(() => !!document.activeElement.closest(".adm-log"))).toBe(true);
  }
  await page.keyboard.press("Escape");
  await expect(page.locator(".adm-log")).toHaveCount(0);
  await expect(page.locator("#admPanel")).toBeVisible(); // Esc only closed the log, not the user panel
  await expect(opener).toBeFocused();
  await context.close();
});

test("the plan day ids offered still exist in app.js", async ({ browser }) => {
  const { context, page } = await openLog(browser);
  await cell(page, "2026-10-09").click();
  const ids = await page.evaluate(() => window.__admin.wlDayIds.flatMap((g) => g[1]));
  const app = fs.readFileSync(path.join(__dirname, "..", "app.js"), "utf8");
  for (const id of ids) expect(app, id).toContain(`id:"${id}"`);
  await expect(page.locator("#admLogDay option")).toHaveCount(ids.length + 1);
  await context.close();
});

test("Arabic renders RTL with translated labels", async ({ browser }) => {
  const { context, page } = await openLog(browser, { lang: "ar" });
  expect(await page.evaluate(() => document.documentElement.dir)).toBe("rtl");
  await expect(page.getByRole("dialog", { name: "سجل التمارين" })).toBeVisible();
  await expect(cell(page, "2026-10-14").locator(".adm-cal-mark")).toHaveText("مسؤول");
  await context.close();
});

test("works at phone width without horizontal scroll", async ({ browser }) => {
  const { context, page } = await openLog(browser, { viewport: { width: 360, height: 740 } });
  await cell(page, "2026-10-09").click();
  const over = await page.evaluate(() => { const d = document.querySelector(".adm-log"); return d.scrollWidth - d.clientWidth; });
  expect(over).toBeLessThanOrEqual(0);
  await context.close();
});
