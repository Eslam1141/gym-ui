/* offline.js — the page offline.html runs: picks the language, retries on the
 * 'online' event, on a slow probe, and on the button. A reload goes through the
 * service worker, which serves the real app as soon as the network answers. */
(function () {
  "use strict";
  var COPY = {
    en: {
      title: "You're offline",
      body: "Etqadem couldn't load. Check your Wi-Fi or mobile data, then try again. We'll reconnect on our own when you're back online.",
      btn: "Try again", busy: "Checking…", still: "Still offline. Check your Wi-Fi or mobile data."
    },
    ar: {
      title: "أنت غير متصل بالإنترنت",
      body: "تعذّر تحميل اتقدم. تحقق من الواي فاي أو بيانات الهاتف ثم حاول مرة أخرى. سنعيد الاتصال تلقائيًا عند عودة الإنترنت.",
      btn: "حاول مرة أخرى", busy: "جارٍ التحقق…", still: "ما زلت غير متصل. تحقق من الواي فاي أو بيانات الهاتف."
    }
  };
  var stored = null;
  try { stored = localStorage.getItem("gym_lang"); } catch (e) {}
  var lang = stored === "ar" || stored === "en" ? stored : (/^ar/i.test(navigator.language || "") ? "ar" : "en");
  var t = COPY[lang];
  document.documentElement.lang = lang;
  document.documentElement.dir = lang === "ar" ? "rtl" : "ltr";
  document.getElementById("netScreenTitle").textContent = t.title;
  document.getElementById("netBody").textContent = t.body;
  var btn = document.getElementById("netRetry");
  var msg = document.getElementById("netMsg");
  btn.textContent = t.btn;

  var leaving = false;
  function probe() {
    var ctl = typeof AbortController === "function" ? new AbortController() : null;
    var timer = setTimeout(function () { if (ctl) ctl.abort(); }, 4000);
    return fetch("manifest.json?_=" + Date.now(), { cache: "no-store", signal: ctl ? ctl.signal : undefined })
      .then(function (r) { clearTimeout(timer); return r.ok; }, function () { clearTimeout(timer); return false; });
  }
  function retry(manual) {
    if (leaving) return;
    var started = Date.now();
    if (manual) { btn.disabled = true; btn.textContent = t.busy; msg.textContent = ""; }
    probe().then(function (ok) {
      if (ok) { leaving = true; location.reload(); return; }
      setTimeout(function () {
        btn.disabled = false; btn.textContent = t.btn;
        if (manual) msg.textContent = t.still;
      }, manual ? Math.max(0, 600 - (Date.now() - started)) : 0);
    });
  }
  btn.addEventListener("click", function () { retry(true); });
  window.addEventListener("online", function () { retry(false); });
  setInterval(function () { if (!document.hidden) retry(false); }, 8000);
})();
