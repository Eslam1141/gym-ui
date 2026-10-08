// Etqadem landing: language toggle (shares the app's gym_lang key) and the
// one-time typed coach reply. boot.js has already set <html lang dir>.
(function () {
  "use strict";

  var STR = {
    en: {
      title: "Etqadem | Free gym tracker with an AI coach in Arabic",
      desc: "Etqadem is one free app for your gym day: workout plan, set logging, rest timer, form videos, a food calorie calculator and an AI coach that answers in Arabic or English.",
      skip: "Skip to content",
      nav_features: "Features", nav_coach: "AI coach", nav_ramadan: "Ramadan", signin: "Sign in",
      lang_btn: "العربية", lang_label: "Switch to Arabic",
      hero_h1: "Your whole gym day, one free app",
      hero_sub: "Workout plan, set logging, rest timer, form videos, a food calorie calculator and an AI coach that answers in Arabic or English.",
      cta: "Start free", cta_how: "See how it works",
      photo_alt: "A lifter under a barbell in a squat rack",
      shot_top_alt: "Etqadem workout screen with the weekly calendar and workout timer",
      shot_list_alt: "Etqadem exercise list with sets, reps and rest buttons",
      shot_men_alt: "Etqadem men's plan in teal",
      shot_women_alt: "Etqadem women's plan in rose",
      feat_h: "Everything your gym day needs",
      f1_h: "A plan for every day", f1_p: "Day templates with warm-ups, sets and reps already filled in. Or build your own.",
      f2_h: "Log sets, rest on time", f2_p: "Save the weight and reps of each set, and let the rest timer count you back in.",
      f3_h: "See the movement first", f3_p: "Exercises come with form videos, one tap away.",
      f4_h: "Calorie calculator for local food", f4_p: "Search Egyptian and Gulf foods in Arabic or English, enter the grams, and get the calories, protein, carbs and fat. Your daily total sits next to your coach's target.",
      calc_label: "Example: 250 g of ful medames is 275 kcal, with 19 g protein, 37 g carbs and 8 g fat",
      calc_food: "Ful medames", kcal: "kcal", g: "g", m_p: "Protein", m_c: "Carbs", m_f: "Fat",
      f5_h: "Keep the streak, earn Premium", f5_p: "Train, log your weight and check in each week. Rest days keep your streak alive.",
      f5_soon: "Coming soon: every 4-week streak earns you a free week of Premium.", wk_gift: "+1 week",
      coach_h: "A coach that answers in Arabic",
      coach_p: "Ask about training or food in your own words. The AI coach builds a diet and training plan from your numbers and goal.",
      coach_note: "Free with a Google account.",
      chat_name: "AI coach", chat_cap: "Example conversation",
      chat_label: "Example conversation with the AI coach",
      chat_q_en: "You train legs today? What should I eat before training?",
      chat_a_en: "About an hour and a half before, eat a meal with carbs and some protein, like a banana with yogurt or a cheese sandwich. After training, focus on protein: eggs, chicken or fava beans.",
      ram_h: "Ramadan mode", ram_p: "Plan meals around suhoor and iftar, and train around your fast.",
      plans_h: "Plans for men and women", plans_p: "Choose the men's or women's day templates. Switch any time, in Arabic or English.",
      plan_m: "Men's plan", plan_f: "Women's plan",
      final_h: "Ready for today's session?", final_p: "It's free. Sign in with Google or email, or look around without an account.",
      credit_pre: "Photo:", credit_post: ". Cropped and recolored."
    },
    ar: {
      title: "اتقدم | تطبيق جيم مجاني مع مدرب ذكي بالعربي",
      desc: "اتقدم تطبيق واحد مجاني ليوم الجيم: خطة تمرين، تسجيل المجموعات، مؤقت راحة، فيديوهات أداء، حاسبة سعرات للأكل ومدرب ذكي يرد بالعربي أو الإنجليزي.",
      skip: "انتقل إلى المحتوى",
      nav_features: "المميزات", nav_coach: "المدرب الذكي", nav_ramadan: "رمضان", signin: "تسجيل الدخول",
      lang_btn: "English", lang_label: "التبديل إلى الإنجليزية",
      hero_h1: "تطبيق واحد مجاني لكل يوم جيم",
      hero_sub: "خطة تمرين، تسجيل المجموعات، مؤقت راحة، فيديوهات أداء، حاسبة سعرات للأكل ومدرب ذكي يرد بالعربي أو الإنجليزي.",
      cta: "ابدأ مجاناً", cta_how: "شاهد كيف يعمل",
      photo_alt: "لاعب تحت البار في قفص السكوات",
      shot_top_alt: "شاشة التمرين في اتقدم مع تقويم الأسبوع ومؤقت التمرين",
      shot_list_alt: "قائمة تمارين اتقدم مع المجموعات والتكرارات وأزرار الراحة",
      shot_men_alt: "خطة الرجال في اتقدم باللون الأخضر المزرق",
      shot_women_alt: "خطة النساء في اتقدم باللون الوردي",
      feat_h: "كل ما يحتاجه يومك في الجيم",
      f1_h: "خطة لكل يوم", f1_p: "قوالب أيام جاهزة بالإحماء والمجموعات والتكرارات. أو ابنِ خطتك بنفسك.",
      f2_h: "سجّل مجموعاتك وارتح في وقتك", f2_p: "احفظ وزن وتكرارات كل مجموعة، ودع مؤقت الراحة يعدّ لك الوقت.",
      f3_h: "شاهد الحركة قبل أن تبدأ", f3_p: "التمارين معها فيديوهات أداء بضغطة واحدة.",
      f4_h: "حاسبة سعرات لأكلك", f4_p: "ابحث عن الأكلات المصرية والخليجية بالعربية أو الإنجليزية، اكتب الجرامات، واعرف السعرات والبروتين والكارب والدهون. وإجمالي يومك يظهر جنب هدف مدربك.",
      calc_label: "مثال: 250 جرام فول مدمس فيها 275 سعرة، و19 جرام بروتين و37 جرام كارب و8 جرام دهون",
      calc_food: "فول مدمس", kcal: "سعرة", g: "جم", m_p: "بروتين", m_c: "كارب", m_f: "دهون",
      f5_h: "حافظ على استمرارك واكسب بريميوم", f5_p: "تمرّن وسجّل وزنك وتابع كل أسبوع. أيام الراحة تحافظ على سلسلتك.",
      f5_soon: "قريباً: كل 4 أسابيع متواصلة تكسبك أسبوع بريميوم مجاناً.", wk_gift: "+أسبوع",
      coach_h: "مدرب يرد عليك بالعربي",
      coach_p: "اسأل عن التمرين أو الأكل بكلامك أنت. المدرب الذكي يبني لك خطة أكل وتمرين من أرقامك وهدفك.",
      coach_note: "مجاني بحساب Google.",
      chat_name: "المدرب الذكي", chat_cap: "محادثة توضيحية",
      chat_label: "محادثة توضيحية مع المدرب الذكي",
      chat_q_en: "", chat_a_en: "",
      ram_h: "وضع رمضان", ram_p: "نظّم وجباتك حول السحور والإفطار، وتمرّن حول صيامك.",
      plans_h: "خطط للرجال والنساء", plans_p: "اختر قوالب الرجال أو النساء. بدّل متى شئت، بالعربية أو الإنجليزية.",
      plan_m: "خطة الرجال", plan_f: "خطة النساء",
      final_h: "جاهز لتمرين اليوم؟", final_p: "التطبيق مجاني. سجّل بحساب Google أو بالبريد، أو تجوّل بدون حساب.",
      credit_pre: "الصورة:", credit_post: ". تم القص وتغيير الألوان."
    }
  };

  var root = document.documentElement;
  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var lang = root.lang === "ar" ? "ar" : "en";

  function $all(sel) { return Array.prototype.slice.call(document.querySelectorAll(sel)); }

  function apply(next) {
    lang = next;
    var s = STR[lang];
    root.lang = lang;
    root.dir = lang === "ar" ? "rtl" : "ltr";
    document.title = s.title;
    var meta = document.querySelector('meta[name="description"]');
    if (meta) meta.setAttribute("content", s.desc);

    $all("[data-i18n]").forEach(function (el) { el.textContent = s[el.getAttribute("data-i18n")]; });
    $all("[data-i18n-alt]").forEach(function (el) { el.alt = s[el.getAttribute("data-i18n-alt")]; });
    $all("[data-i18n-label]").forEach(function (el) { el.setAttribute("aria-label", s[el.getAttribute("data-i18n-label")]); });

    // The other-language echo under the headline.
    var other = lang === "ar" ? "en" : "ar";
    $all("[data-echo]").forEach(function (el) {
      el.textContent = STR[other][el.getAttribute("data-echo")];
      el.lang = other;
    });

    // English glosses under the Arabic chat, only on the English page.
    $all("[data-gloss]").forEach(function (el) {
      var t = s[el.getAttribute("data-gloss")];
      el.textContent = t;
      el.hidden = !t;
    });

    // Screenshots follow the language: the app itself flips to RTL.
    $all("img[data-shot]").forEach(function (img) {
      var k = img.getAttribute("data-shot").split("-");
      img.src = "assets/app-" + k[0] + "-" + lang + "-" + k[1] + ".webp";
    });

    var btn = document.getElementById("langBtn");
    btn.textContent = s.lang_btn;
    btn.setAttribute("aria-label", s.lang_label);
    var chat = document.querySelector(".chat");
    if (chat) chat.setAttribute("aria-label", s.chat_label);
  }

  document.getElementById("langBtn").addEventListener("click", function () {
    var next = lang === "ar" ? "en" : "ar";
    try { localStorage.setItem("gym_lang", next); } catch (e) {}
    apply(next);
    finishTyping();
  });

  // Typed coach reply: plays once when the chat scrolls into view.
  var answer = document.getElementById("chatA");
  var full = answer ? answer.getAttribute("data-full") : "";
  var timer = 0;
  var io = null;

  function finishTyping() {
    if (io) { io.disconnect(); io = null; }
    if (timer) { clearTimeout(timer); timer = 0; }
    if (answer) { answer.textContent = full; answer.classList.remove("typing"); }
  }

  function typeReply() {
    var i = 0;
    answer.textContent = "";
    answer.classList.add("typing");
    (function step() {
      i += 1;
      answer.textContent = full.slice(0, i);
      if (i < full.length) timer = setTimeout(step, 28);
      else finishTyping();
    })();
  }

  apply(lang);
  root.classList.remove("pending");

  if (answer && !reduce && "IntersectionObserver" in window) {
    answer.textContent = "";
    answer.classList.add("typing");
    io = new IntersectionObserver(function (entries) {
      if (entries[0].isIntersecting) { io.disconnect(); io = null; timer = setTimeout(typeReply, 600); }
    }, { threshold: 0.6 });
    io.observe(document.querySelector(".chat"));
  }

  // Scroll motion: sections rise in, the calorie example counts up, and the
  // hero phones drift at different speeds. Off for reduced motion.
  if (!reduce && "IntersectionObserver" in window) {
    root.classList.add("motion");

    var revealed = [];
    [".features h2", ".bento .cell", ".coach-copy", ".chat", ".ramadan-in",
      ".plans h2", ".plans-sub", ".plan", ".final"].forEach(function (sel) {
      $all(sel).forEach(function (el, i) {
        el.classList.add("reveal");
        el.style.setProperty("--d", (i % 3) * 0.09 + "s");
        revealed.push(el);
      });
    });
    var rio = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) { e.target.classList.add("in"); rio.unobserve(e.target); }
      });
    }, { threshold: 0.15, rootMargin: "0px 0px -8% 0px" });
    revealed.forEach(function (el) { rio.observe(el); });

    var calc = document.querySelector(".calc");
    var kcal = calc && calc.querySelector(".calc-kcal strong");
    if (kcal) {
      var total = parseInt(kcal.textContent, 10);
      kcal.textContent = "0";
      var cio = new IntersectionObserver(function (entries) {
        if (!entries[0].isIntersecting) return;
        cio.disconnect();
        calc.classList.add("in");
        setTimeout(function () {
          var t0 = 0;
          requestAnimationFrame(function tick(t) {
            if (!t0) t0 = t;
            var p = Math.min(1, (t - t0) / 1100);
            kcal.textContent = Math.round(total * (1 - Math.pow(1 - p, 3)));
            if (p < 1) requestAnimationFrame(tick);
          });
        }, 250);
      }, { threshold: 0.6 });
      cio.observe(calc);
    }

    var phones = $all(".stage .phone");
    var ticking = false;
    function drift() {
      ticking = false;
      var y = Math.min(window.scrollY, 700);
      phones.forEach(function (p, i) {
        p.style.setProperty("--py", (-y * (i === 0 ? 0.04 : 0.08)).toFixed(1) + "px");
      });
    }
    window.addEventListener("scroll", function () {
      if (!ticking) { ticking = true; requestAnimationFrame(drift); }
    }, { passive: true });
  }
})();
