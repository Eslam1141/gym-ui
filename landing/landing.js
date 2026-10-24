// Etqadem landing: language toggle (shares the app's gym_lang key) and the
// one-time typed coach reply. boot.js has already set <html lang dir>.
(function () {
  "use strict";

  var STR = {
    en: {
      title: "Etqadem | Free gym tracker with an AI coach in Arabic",
      desc: "Etqadem is one free app for your gym day: 3 to 6 day training splits built around your equipment, a weekly muscle map, a video for every exercise in our plans, a food calorie calculator and an AI coach that answers in Arabic or English.",
      skip: "Skip to content",
      nav_features: "Features", nav_coach: "AI coach", nav_ramadan: "Ramadan", signin: "Sign in", open_app: "Open app", cta_continue: "Continue",
      lang_btn: "العربية", lang_label: "Switch to Arabic",
      hero_h1: "Your whole gym day, one free app",
      hero_sub: "A training split built around your equipment, set logging with a rest timer, a video for every exercise in our plans, a food calorie calculator and an AI coach that answers in Arabic or English.",
      cta: "Start free", cta_how: "See how it works",
      photo_alt: "A lifter seen from behind, gripping a barbell in a squat rack",
      shot_top_alt: "Etqadem workout screen with the weekly calendar and workout timer",
      shot_list_alt: "Etqadem exercise list with sets, reps and rest buttons",
      shot_men_alt: "Etqadem men's plan in teal",
      shot_women_alt: "Etqadem women's plan in rose",
      feat_h: "Everything your gym day needs",
      f1_h: "A plan for every day", f1_p: "Day templates with warm-ups, sets and reps already filled in. Or build your own.",
      f2_h: "Log sets, rest on time", f2_p: "Save the weight and reps of each set. Tick it and the rest timer starts on its own, then counts you back in.",
      f3_h: "See the movement first", f3_p: "Every exercise in our plans has a short video demo, up to 90 seconds, one tap away.",
      f4_h: "Calorie calculator for local food", f4_p: "Search Egyptian and Gulf foods in Arabic or English, enter the grams, and get the calories, protein, carbs and fat. Your daily total sits next to your coach's target.",
      calc_label: "Example: 250 g of ful medames is about 253 kcal, with 15 g protein, 38 g carbs and 8 g fat",
      calc_food: "Ful medames", kcal: "kcal", g: "g", m_p: "Protein", m_c: "Carbs", m_f: "Fat",
      photo_new: "New", photo_h: "Snap your meal, see the calories",
      photo_p: "Send a photo of your plate to the AI coach. Get estimated calories and macros for each item, see if it fits today's plan, and add it to your food log in one tap.",
      photo_label: "Example meal estimate: koshari 420 kcal, grilled chicken 180 kcal, salad 40 kcal. Total 640 kcal, 310 kcal left today. Add to food log.",
      photo_title: "Meal estimate", photo_i1: "Koshari", photo_i2: "Grilled chicken", photo_i3: "Salad",
      photo_left: "310 kcal left", photo_add: "Add to food log",
      sp_new: "New", sp_h: "A split built around your equipment",
      sp_p: "Pick 3, 4, 5 or 6 training days, at the gym or at home, as a man or a woman. The plan uses what you have: bodyweight, dumbbells, bands, a bench or a pull-up bar. Volume starts beginner-friendly, and the sign-up questions set your split for you.",
      sp_label: "Example: a 4-day split. Upper, Lower, Upper, Lower. Equipment: bodyweight, dumbbells, bands, bench, pull-up bar.",
      sp_days: "days a week", sp_d1: "Upper", sp_d2: "Lower",
      sp_t1: "Bodyweight", sp_t2: "Dumbbells", sp_t3: "Bands", sp_t4: "Bench", sp_t5: "Pull-up bar",
      mm_new: "New", mm_h: "See which muscles you trained",
      mm_p: "The weekly muscle map lights each muscle once after your first session and fully after your second. Tap a muscle on your plan to jump to its exercise.",
      mm_label: "Example muscle map: chest trained twice, back trained once, legs not trained yet.",
      mm_a: "Chest", mm_b: "Back", mm_c: "Legs", mm_twice: "Twice", mm_once: "Once", mm_none: "Not yet",
      bb_new: "New", bb_h: "Your coach, on every screen",
      bb_p: "A floating coach bubble opens the AI coach right over whatever you are doing. Move it wherever suits your thumb. Ask about a set, then go straight back to it.",
      bb_label: "Example: a round coach button floating over the workout screen.",
      wt_new: "New", wt_h: "Your watch, in the Watch tab",
      wt_p: "Daily rings and 7-day trends for steps, active calories, sleep and heart rate from your watch, through Health Connect. Android app only, and optional. The data stays on your phone.",
      wt_label: "Example daily rings: steps 74 percent, active calories 62 percent, sleep 90 percent, heart rate.",
      wt_steps: "Steps", wt_cal: "Active calories", wt_sleep: "Sleep", wt_hr: "Heart rate",
      f5_h: "Keep your streak going", f5_p: "Train, log your weight and check in each week. Rest days keep your streak alive.",
      f5_soon: "Coming soon: every 4-week streak earns you a free week of Premium.", wk_gift: "+1 week",
      coach_h: "A coach that answers in Arabic",
      coach_p: "Ask about training or food in your own words. The AI coach builds a diet and training plan from your numbers and goal, and can add your meals to the Food section from the chat or from a photo.",
      coach_note: "Free with a Google account.",
      chat_name: "AI coach", chat_cap: "Example conversation",
      chat_label: "Example conversation with the AI coach",
      chat_q_en: "You train legs today? What should I eat before training?",
      chat_a_en: "About an hour and a half before, eat a meal with carbs and some protein, like a banana with yogurt or a cheese sandwich. After training, focus on protein: eggs, chicken or fava beans.",
      ram_h: "Ramadan mode", ram_p: "Plan meals around suhoor and iftar, and train around your fast.",
      plans_h: "Plans for men and women", plans_p: "Choose the men's or women's day templates. Switch any time, in Arabic or English.",
      plan_m: "Men's plan", plan_f: "Women's plan",
      final_h: "Ready for today's session?", final_p: "It's free. Sign in with Google, or look around without an account.",
      foot_privacy: "Privacy Policy", foot_terms: "Terms of Use", foot_delete: "Delete account",
    },
    ar: {
      title: "اتقدم | تطبيق جيم مجاني مع مدرب ذكي بالعربي",
      desc: "اتقدم تطبيق واحد مجاني ليوم الجيم: تقسيمات تمرين من 3 إلى 6 أيام على قد معداتك، خريطة عضلات أسبوعية، فيديو لكل تمرين في خططنا، حاسبة سعرات للأكل ومدرب ذكي يرد بالعربي أو الإنجليزي.",
      skip: "انتقل إلى المحتوى",
      nav_features: "المميزات", nav_coach: "المدرب الذكي", nav_ramadan: "رمضان", signin: "تسجيل الدخول", open_app: "افتح التطبيق", cta_continue: "تابع",
      lang_btn: "English", lang_label: "التبديل إلى الإنجليزية",
      hero_h1: "تطبيق واحد مجاني لكل يوم جيم",
      hero_sub: "تقسيمة تمرين على قد معداتك، تسجيل المجموعات مع مؤقت راحة، فيديو لكل تمرين في خططنا، حاسبة سعرات للأكل ومدرب ذكي يرد بالعربي أو الإنجليزي.",
      cta: "ابدأ مجاناً", cta_how: "شاهد كيف يعمل",
      photo_alt: "لاعب من الخلف يمسك البار في قفص السكوات",
      shot_top_alt: "شاشة التمرين في اتقدم مع تقويم الأسبوع ومؤقت التمرين",
      shot_list_alt: "قائمة تمارين اتقدم مع المجموعات والتكرارات وأزرار الراحة",
      shot_men_alt: "خطة الرجال في اتقدم باللون الأخضر المزرق",
      shot_women_alt: "خطة النساء في اتقدم باللون الوردي",
      feat_h: "كل ما يحتاجه يومك في الجيم",
      f1_h: "خطة لكل يوم", f1_p: "قوالب أيام جاهزة بالإحماء والمجموعات والتكرارات. أو ابنِ خطتك بنفسك.",
      f2_h: "سجّل مجموعاتك وارتح في وقتك", f2_p: "احفظ وزن وتكرارات كل مجموعة. وأول ما تعلّم المجموعة يبدأ مؤقت الراحة لوحده ويعدّ لك الوقت.",
      f3_h: "شاهد الحركة قبل أن تبدأ", f3_p: "لكل تمرين في خططنا فيديو توضيحي قصير، لحد 90 ثانية، بضغطة واحدة.",
      f4_h: "حاسبة سعرات لأكلك", f4_p: "ابحث عن الأكلات المصرية والخليجية بالعربية أو الإنجليزية، اكتب الجرامات، واعرف السعرات والبروتين والكارب والدهون. وإجمالي يومك يظهر جنب هدف مدربك.",
      calc_label: "مثال: 250 جرام فول مدمس فيها حوالي 253 سعرة، و15 جرام بروتين و38 جرام كارب و8 جرام دهون",
      calc_food: "فول مدمس", kcal: "سعرة", g: "جم", m_p: "بروتين", m_c: "كارب", m_f: "دهون",
      photo_new: "جديد", photo_h: "صوّر أكلك واعرف سعراته",
      photo_p: "أرسل صورة طبقك للمدرب الذكي، ويعطيك تقدير السعرات والماكروز لكل صنف، ويوضح لك هل يناسب خطة يومك. وتضيفه لسجل أكلك بضغطة واحدة.",
      photo_label: "مثال على تقدير وجبة: كشري 420 سعرة، دجاج مشوي 180 سعرة، سلطة 40 سعرة. الإجمالي 640 سعرة، وباقي 310 سعرة لليوم. أضف لسجل الأكل.",
      photo_title: "تقدير الوجبة", photo_i1: "كشري", photo_i2: "دجاج مشوي", photo_i3: "سلطة",
      photo_left: "باقي 310 سعرة", photo_add: "أضف لسجل الأكل",
      sp_new: "جديد", sp_h: "تقسيمة تتبنى على معداتك",
      sp_p: "اختر 3 أو 4 أو 5 أو 6 أيام تمرين، في الجيم أو في البيت، للرجال أو للنساء. الخطة تستخدم اللي معك: وزن الجسم أو الدمبل أو الأربطة أو البنش أو عقلة الشدّ. الحجم يبدأ مناسباً للمبتدئين، وأسئلة التسجيل تضبط لك التقسيمة تلقائياً.",
      sp_label: "مثال: تقسيمة 4 أيام. علوي، سفلي، علوي، سفلي. المعدات: وزن الجسم، دمبل، أربطة، بنش، عقلة.",
      sp_days: "أيام في الأسبوع", sp_d1: "علوي", sp_d2: "سفلي",
      sp_t1: "وزن الجسم", sp_t2: "دمبل", sp_t3: "أربطة", sp_t4: "بنش", sp_t5: "عقلة",
      mm_new: "جديد", mm_h: "شوف أي عضلات تمرّنت",
      mm_p: "خريطة العضلات الأسبوعية تُضيء كل عضلة نصفها بعد أول جلسة وكاملة بعد الثانية. وبلمسة على أي عضلة في خطتك تنتقل إلى تمرينها.",
      mm_label: "مثال على خريطة العضلات: الصدر تم تدريبه مرتين، الظهر مرة واحدة، والأرجل لم تُدرَّب بعد.",
      mm_a: "الصدر", mm_b: "الظهر", mm_c: "الأرجل", mm_twice: "مرتين", mm_once: "مرة", mm_none: "لسه",
      bb_new: "جديد", bb_h: "مدربك في كل شاشة",
      bb_p: "فقاعة المدرب العائمة تفتح لك المدرب الذكي فوق أي شاشة أنت فيها. حرّكها للمكان اللي يناسب إبهامك. اسأل عن مجموعة، ثم ارجع لتمرينك مباشرة.",
      bb_label: "مثال: زر المدرب الدائري عائم فوق شاشة التمرين.",
      wt_new: "جديد", wt_h: "ساعتك في تبويب ساعتي",
      wt_p: "حلقات يومية واتجاهات 7 أيام للخطوات والسعرات النشطة والنوم ونبض القلب من ساعتك، عبر Health Connect. في تطبيق أندرويد فقط، واختياري. وبياناتك تبقى على هاتفك.",
      wt_label: "مثال على الحلقات اليومية: الخطوات 74 بالمئة، السعرات النشطة 62 بالمئة، النوم 90 بالمئة، ونبض القلب.",
      wt_steps: "الخطوات", wt_cal: "السعرات النشطة", wt_sleep: "النوم", wt_hr: "النبض",
      f5_h: "حافظ على استمرارك", f5_p: "تمرّن وسجّل وزنك وتابع كل أسبوع. أيام الراحة تحافظ على سلسلتك.",
      f5_soon: "قريباً: كل 4 أسابيع متواصلة تكسبك أسبوع بريميوم مجاناً.", wk_gift: "+أسبوع",
      coach_h: "مدرب يرد عليك بالعربي",
      coach_p: "اسأل عن التمرين أو الأكل بكلامك أنت. المدرب الذكي يبني لك خطة أكل وتمرين من أرقامك وهدفك، ويقدر يضيف وجباتك لقسم الأكل من المحادثة أو من صورة.",
      coach_note: "مجاني بحساب Google.",
      chat_name: "المدرب الذكي", chat_cap: "محادثة توضيحية",
      chat_label: "محادثة توضيحية مع المدرب الذكي",
      chat_q_en: "", chat_a_en: "",
      ram_h: "وضع رمضان", ram_p: "نظّم وجباتك حول السحور والإفطار، وتمرّن حول صيامك.",
      plans_h: "خطط للرجال والنساء", plans_p: "اختر قوالب الرجال أو النساء. بدّل متى شئت، بالعربية أو الإنجليزية.",
      plan_m: "خطة الرجال", plan_f: "خطة النساء",
      final_h: "جاهز لتمرين اليوم؟", final_p: "التطبيق مجاني. سجّل بحساب Google، أو تجوّل بدون حساب.",
      foot_privacy: "سياسة الخصوصية", foot_terms: "شروط الاستخدام", foot_delete: "حذف الحساب",
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
