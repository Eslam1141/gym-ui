// The Health Connect additions to the public policy (landing/privacy.html) and Terms.
const { test, expect } = require("@playwright/test");
const fs = require("fs");
const path = require("path");

const html = fs.readFileSync(path.join(__dirname, "..", "landing", "privacy.html"), "utf8");
const terms = fs.readFileSync(path.join(__dirname, "..", "landing", "terms.html"), "utf8");

test("the policy has the §3.12 Health Connect section in EN and AR with stable anchors", () => {
  expect(html).toContain('<p id="health-connect"><strong>3.12 Connected watches and Health Connect');
  expect(html).toContain('<p id="ar-health-connect"><strong>3.12 ');
  expect(html).toContain('id="disconnect-watch"');
  expect(html).toContain('id="ar-disconnect-watch"');
  for (const six of ["steps (today's total)", "active calories burned", "heart rate (latest and average today)", "resting heart rate (latest)", "sleep (last night)", "body weight"]) {
    expect(html).toContain(six);
  }
  expect(html).toContain("Google Play User Data policy, including its Health Connect Limited Use requirements");
});

test("version is v4 in both headers and the old v2 marker is gone", () => {
  expect((html.match(/v4 \(2026-10-22\)/g) || []).length).toBe(2);
  expect(html).not.toContain("v2 (2026-10-19)");
});

test("every place the lawyer's Part A lists is updated, in both languages", () => {
  const both = [
    "optionally connect your smartwatch", "ربط ساعتك الذكية اختياريًا",                      // A1
    "So is any activity, heart-rate, sleep or weight data", "وكذلك أي بيانات نشاط أو نبض",    // A2
    "The only other data we read from your phone", "وكل ما نقرؤه من هاتفك غير ذلك",          // A3 closing
    "Showing your watch data from Health Connect in the app", "عرض بيانات ساعتك من",         // A4
    "Watch data (Android app, only if you connect Health Connect).", "بيانات الساعة (تطبيق أندرويد",  // A5
    "<strong>Connected watches.</strong>", "<strong>الساعات المتصلة.</strong>",               // A6
    "is not transferred anywhere: it stays on your phone.", "فلا تُنقل إلى أي مكان",          // A7
    "Watch data from Health Connect (Android app)</td>", "بيانات الساعة من <span dir=\"ltr\">Health Connect</span> (تطبيق أندرويد)</td>",   // A8
    "Watch data is read-only", "بيانات الساعة للقراءة فقط",                                   // A9
    "Disconnect my watch", "فصل ساعتي"                                                       // A10
  ];
  for (const t of both) expect(html, t).toContain(t);
});

test("retention row states the 30-day purge that the app implements, with no leftover bracket", () => {
  expect(html).toContain("Also removed automatically if not refreshed for 30 days.");
  expect(html).not.toContain("[Recommended: also removed automatically");
  expect(html).not.toContain("[مقترح:");
});

test("Terms carry the not-medical-advice line for watch data", () => {
  expect(terms).toContain("Watch and Health Connect data shown in Etqadem comes from third-party devices and apps, is an estimate, and isn't medical advice. Etqadem is not a medical device.");
});

test("the in-app disclosure link points at the new anchor (EN and AR)", async () => {
  const src = fs.readFileSync(path.join(__dirname, "..", "watch.js"), "utf8");
  expect(src).toContain('"ar-health-connect" : "health-connect"');
  expect(html).toContain('id="health-connect"');
});
