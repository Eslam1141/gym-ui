const { test, expect } = require("@playwright/test");
const { openApp } = require("./helpers");

test.setTimeout(45000);
const T = { timeout: 8000 };
const USER_PREFIXES = ["gymrest_", "gymday_", "gymchat_", "gymcoach_", "gym_checks"];
const XSS = "<img src=x onerror=\"window.__xss=1\">";

const userKeys = (page) => page.evaluate((prefixes) =>
  Object.keys(localStorage).filter((k) => prefixes.some((p) => k.indexOf(p) === 0)), USER_PREFIXES);

test.describe("sign-out wipes device-local user data (audit M4)", () => {
  test("explicit sign-out clears rest, day, chat and coach keys incl. the pending queue", async ({ browser }) => {
    const { context, page } = await openApp(browser, {
      signedIn: true,
      ls: {
        gym_user_sub: "sub-1",
        gymrest_days: ["2026-10-01"],
        gymrest_pending: [{ date: "2026-10-01", dayId: "m_upperA" }],
        gymrest_syd_dismissed: ["2026-10-01"],
        gymday_last_completed: { date: "2026-10-01", dayId: "m_upperA" },
        gymchat_history: [{ role: "user", content: "old key" }],
        gymcoach_chat_history: [{ role: "user", content: "my weight is 80kg" }],
        gymcoach_form: { goal: "cut" }
      }
    });
    await page.waitForFunction(() => window.GymSync && GymSync.isSignedIn(), null, T);
    expect(await userKeys(page)).toContain("gymrest_pending");

    await page.evaluate(() => GymSync.signOut());
    await expect.poll(() => userKeys(page), T).toEqual([]);
    expect(await page.evaluate(() => localStorage.getItem("gym_user_sub"))).toBeNull();
    await context.close();
  });

  test("anonymous visitor keeps local rest days across load (no authchange wipe)", async ({ browser }) => {
    const { context, page } = await openApp(browser, { ls: { gymrest_days: ["2026-10-01"] } });
    await page.waitForTimeout(800);
    expect(await page.evaluate(() => localStorage.getItem("gymrest_days"))).not.toBeNull();
    await context.close();
  });

  test("sign-out clears the in-memory chat transcript", async ({ browser }) => {
    const { context, page } = await openApp(browser, {
      signedIn: true,
      ls: { gym_user_sub: "sub-1", gymcoach_chat_history: [{ role: "user", content: "secret health note" }] }
    });
    await page.waitForFunction(() => window.GymSync && GymSync.isSignedIn(), null, T);
    await page.evaluate(() => GymSync.signOut());
    await expect.poll(() => page.evaluate(() => document.getElementById("coachChatMsgs").textContent), T)
      .not.toContain("secret health note");
    await context.close();
  });

  test("legacy gymchat_history is migrated when a session exists, dropped otherwise", async ({ browser }) => {
    const a = await openApp(browser, { signedIn: true, ls: { gymchat_history: [{ role: "user", content: "mine" }] } });
    expect(await a.page.evaluate(() => localStorage.getItem("gymchat_history"))).toBeNull();
    expect(await a.page.evaluate(() => localStorage.getItem("gymcoach_chat_history"))).toContain("mine");
    await a.context.close();
    const b = await openApp(browser, { ls: { gymchat_history: [{ role: "user", content: "someone else" }] } });
    expect(await b.page.evaluate(() => localStorage.getItem("gymchat_history"))).toBeNull();
    expect(await b.page.evaluate(() => localStorage.getItem("gymcoach_chat_history"))).toBeNull();
    await b.context.close();
  });
});

test.describe("untrusted text never becomes markup (audit L1)", () => {
  test("AI plan and chat history containing <img onerror> create no element", async ({ browser }) => {
    const { context, page, consoleErrors } = await openApp(browser, {
      signedIn: true,
      ls: { gymcoach_chat_history: [{ role: "assistant", content: XSS }] }
    });
    await page.evaluate((x) => {
      GymApplyCoachPlan([{
        id: "coach_0", label: x, muscles: x,
        exercises: [{ id: "coach_0_0\"><img src=x onerror=window.__xss=1>", en: x, sets: x, reps: x, rest: x }]
      }]);
    }, XSS);
    await page.locator("#exList .ex-card").first().waitFor(T);
    await page.evaluate(() => GymChat.open());
    await page.locator("#coachChatMsgs .coach-chat-bubble, #coachChatMsgs > *").first().waitFor(T);
    // Month overlay day detail also lists plan names.
    expect(await page.locator('img[src="x"]').count()).toBe(0);
    expect(await page.evaluate(() => window.__xss)).toBeUndefined();
    expect(await page.locator("#exList").textContent()).toContain("<img src=x");
    expect(consoleErrors.filter((e) => /onerror|xss/i.test(e))).toEqual([]);
    await context.close();
  });
});
