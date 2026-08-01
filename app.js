/* =====================================================================
   Я МОГУ ВСЁ — логика сайта
   - тема (светлая/тёмная)
   - аффирмации + прогресс
   - гость: прогресс в localStorage
   - зарегистрированный: прогресс в облаке (Supabase), синхронно между устройствами
   ===================================================================== */
(function () {
  "use strict";

  var CFG = window.APP_CONFIG || {};
  var LS_PROGRESS = "yamoguvse_progress_v1";
  var root = document.documentElement;

  /* ---------------- ТЕМА ---------------- */
  var tgl = document.getElementById("tgl"),
      tglIco = document.getElementById("tglIco");
  function isDark() {
    var a = root.getAttribute("data-theme");
    if (a) return a === "dark";
    return window.matchMedia && window.matchMedia("(prefers-color-scheme:dark)").matches;
  }
  function paintTheme() { tglIco.textContent = isDark() ? "☀" : "☾"; }
  tgl.addEventListener("click", function () {
    root.setAttribute("data-theme", isDark() ? "light" : "dark");
    paintTheme();
  });
  paintTheme();

  document.getElementById("year").textContent = "2026";

  /* ---------------- ДАННЫЕ АФФИРМАЦИЙ ---------------- */
  var THEMES = [
    { id: "power", label: "Сила и возможности", items: [
      "Я могу всё. В моём подсознании — безграничная сила.",
      "Каждый день я становлюсь сильнее, увереннее и свободнее.",
      "Всё, что я задумываю, я осуществляю.",
      "Моё подсознание работает на меня 24 часа в сутки.",
      "Я хозяин своих мыслей, а значит — хозяин своей жизни."
    ]},
    { id: "money", label: "Деньги и изобилие", items: [
      "Деньги приходят ко мне легко, часто и из разных источников.",
      "Я достоин изобилия, и оно свободно течёт в мою жизнь.",
      "Я притягиваю новые возможности зарабатывать больше.",
      "У меня всегда больше, чем достаточно — и я делюсь этим спокойно.",
      "Мой доход растёт, потому что растёт моё мышление."
    ]},
    { id: "health", label: "Здоровье и энергия", items: [
      "Моё тело здорово, сильно и полно энергии.",
      "С каждым вдохом я наполняюсь здоровьем и спокойствием.",
      "Я просыпаюсь бодрым, отдохнувшим и полным сил.",
      "Каждая клетка моего тела обновляется и служит мне."
    ]},
    { id: "confidence", label: "Уверенность и спокойствие", items: [
      "Я спокоен, собран и уверен в себе.",
      "Люди тянутся ко мне — я располагаю к себе легко.",
      "Я справляюсь с любой задачей и любым разговором.",
      "Страх уходит — остаётся ясность и сила.",
      "Я доверяю себе и своим решениям."
    ]},
    { id: "goals", label: "Цели и успех", items: [
      "Я двигаюсь к своей цели каждый день, шаг за шагом.",
      "Успех — моё естественное состояние.",
      "Удача сопутствует мне во всём, что я делаю.",
      "Я ясно вижу свою цель, и мир помогает мне её достичь.",
      "Всё складывается наилучшим для меня образом."
    ]}
  ];

  /* ---------------- СОСТОЯНИЕ ---------------- */
  var state = {};      // { "power:0": true, ... }
  var active = THEMES[0].id;
  var user = null;     // объект пользователя Supabase, если вошёл
  var supabase = null; // клиент Supabase
  var saveTimer = null;

  function keyOf(t, i) { return t + ":" + i; }

  function loadLocal() {
    try { var r = localStorage.getItem(LS_PROGRESS); return r ? JSON.parse(r) : {}; }
    catch (e) { return {}; }
  }
  function saveLocal() {
    try { localStorage.setItem(LS_PROGRESS, JSON.stringify(state)); } catch (e) {}
  }

  /* ---------------- ОБЛАКО (Supabase) ---------------- */
  function initSupabase() {
    if (!CFG.SUPABASE_URL || !CFG.SUPABASE_ANON_KEY || !window.supabase) return;
    supabase = window.supabase.createClient(CFG.SUPABASE_URL, CFG.SUPABASE_ANON_KEY);
    // восстановить сессию, если пользователь уже входил
    supabase.auth.getSession().then(function (res) {
      if (res.data && res.data.session) onSignedIn(res.data.session.user);
    });
    supabase.auth.onAuthStateChange(function (_evt, session) {
      if (session && session.user) onSignedIn(session.user);
      else onSignedOut();
    });
  }

  function cloudLoad() {
    if (!supabase || !user) return Promise.resolve(null);
    return supabase.from("progress").select("data").eq("user_id", user.id).maybeSingle()
      .then(function (r) { return (r.data && r.data.data) ? r.data.data : {}; })
      .catch(function () { return null; });
  }
  function cloudSave() {
    if (!supabase || !user) return;
    supabase.from("progress")
      .upsert({ user_id: user.id, data: state, updated_at: new Date().toISOString() })
      .then(function(){}, function(){});
  }

  function persist() {
    saveLocal();
    if (user) {
      clearTimeout(saveTimer);
      saveTimer = setTimeout(cloudSave, 600); // не дёргаем сеть на каждый клик
    }
  }

  /* ---------------- РЕНДЕР ---------------- */
  var tabsEl = document.getElementById("tabs"),
      listEl = document.getElementById("affList"),
      barFill = document.getElementById("barFill"),
      progTxt = document.getElementById("progTxt"),
      cloudTag = document.getElementById("cloudTag"),
      resetBtn = document.getElementById("resetBtn"),
      saveBanner = document.getElementById("saveBanner");

  var CHECK = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>';

  function buildTabs() {
    tabsEl.innerHTML = "";
    THEMES.forEach(function (t) {
      var b = document.createElement("button");
      b.className = "tab"; b.type = "button"; b.textContent = t.label;
      b.setAttribute("role", "tab");
      b.setAttribute("aria-selected", t.id === active ? "true" : "false");
      b.addEventListener("click", function () { active = t.id; syncTabs(); renderList(); });
      tabsEl.appendChild(b);
    });
  }
  function syncTabs() {
    Array.prototype.forEach.call(tabsEl.children, function (b, i) {
      b.setAttribute("aria-selected", THEMES[i].id === active ? "true" : "false");
    });
  }
  function renderList() {
    var theme = THEMES.filter(function (t) { return t.id === active; })[0];
    listEl.innerHTML = "";
    theme.items.forEach(function (text, i) {
      var k = keyOf(theme.id, i);
      var btn = document.createElement("button");
      btn.className = "aff"; btn.type = "button";
      btn.setAttribute("data-done", state[k] ? "1" : "0");
      btn.innerHTML = '<span class="mark">' + CHECK + '</span><span class="txt"></span>';
      btn.querySelector(".txt").textContent = text;
      btn.addEventListener("click", function () {
        state[k] = !state[k];
        btn.setAttribute("data-done", state[k] ? "1" : "0");
        persist(); updateProgress();
      });
      listEl.appendChild(btn);
    });
    updateProgress();
  }
  function updateProgress() {
    var total = 0, done = 0;
    THEMES.forEach(function (t) {
      t.items.forEach(function (_, i) { total++; if (state[keyOf(t.id, i)]) done++; });
    });
    var pct = total ? Math.round(done / total * 100) : 0;
    barFill.style.width = pct + "%";
    progTxt.textContent = done + " из " + total + " прочитано";
  }
  resetBtn.addEventListener("click", function () { state = {}; persist(); renderList(); });

  /* ---------------- UI аккаунта ---------------- */
  var loginBtn = document.getElementById("loginBtn"),
      registerBtn = document.getElementById("registerBtn"),
      accountChip = document.getElementById("accountChip"),
      whoTxt = document.getElementById("whoTxt"),
      logoutBtn = document.getElementById("logoutBtn"),
      bannerRegister = document.getElementById("bannerRegister");

  function showLoggedIn(email) {
    loginBtn.style.display = "none";
    registerBtn.style.display = "none";
    accountChip.style.display = "flex";
    whoTxt.textContent = email;
    cloudTag.style.display = "inline-flex";
    saveBanner.classList.add("hidden");
  }
  function showLoggedOut() {
    loginBtn.style.display = "";
    registerBtn.style.display = "";
    accountChip.style.display = "none";
    cloudTag.style.display = "none";
    // баннер показываем только если облако вообще настроено
    if (CFG.SUPABASE_URL) saveBanner.classList.remove("hidden");
    else saveBanner.classList.add("hidden");
  }

  function onSignedIn(u) {
    user = u;
    showLoggedIn(u.email || "аккаунт");
    // слить облачный прогресс с локальным (объединяем отметки)
    cloudLoad().then(function (cloud) {
      if (cloud) {
        Object.keys(cloud).forEach(function (k) { if (cloud[k]) state[k] = true; });
      }
      saveLocal();
      cloudSave(); // записать объединённый результат обратно
      renderList();
    });
  }
  function onSignedOut() {
    user = null;
    showLoggedOut();
  }

  /* ---------------- Модалка входа/регистрации ---------------- */
  var modal = document.getElementById("authModal"),
      authClose = document.getElementById("authClose"),
      authTitle = document.getElementById("authTitle"),
      authSub = document.getElementById("authSub"),
      authForm = document.getElementById("authForm"),
      authSubmit = document.getElementById("authSubmit"),
      authSwitch = document.getElementById("authSwitch"),
      switchLink = document.getElementById("switchLink"),
      authMsg = document.getElementById("authMsg"),
      emailInp = document.getElementById("email"),
      passInp = document.getElementById("password");

  var mode = "register"; // или "login"

  function setMode(m) {
    mode = m;
    if (m === "register") {
      authTitle.textContent = "Регистрация";
      authSub.textContent = "Создайте аккаунт, чтобы прогресс сохранялся на всех устройствах.";
      authSubmit.textContent = "Зарегистрироваться";
      authSwitch.innerHTML = 'Уже есть аккаунт? <a id="switchLink">Войти</a>';
      passInp.setAttribute("autocomplete", "new-password");
    } else {
      authTitle.textContent = "Вход";
      authSub.textContent = "С возвращением! Войдите, чтобы продолжить.";
      authSubmit.textContent = "Войти";
      authSwitch.innerHTML = 'Нет аккаунта? <a id="switchLink">Зарегистрироваться</a>';
      passInp.setAttribute("autocomplete", "current-password");
    }
    document.getElementById("switchLink").addEventListener("click", function () {
      setMode(mode === "register" ? "login" : "register");
    });
    clearMsg();
  }
  function openModal(m) {
    if (!CFG.SUPABASE_URL) {
      alert("Регистрация пока не подключена. Добавьте ключи Supabase в файл config.js (см. README).");
      return;
    }
    setMode(m);
    modal.classList.add("open");
    setTimeout(function(){ emailInp.focus(); }, 50);
  }
  function closeModal() { modal.classList.remove("open"); }
  function clearMsg() { authMsg.className = "msg"; authMsg.textContent = ""; }
  function showMsg(text, kind) { authMsg.className = "msg " + kind; authMsg.textContent = text; }

  loginBtn.addEventListener("click", function () { openModal("login"); });
  registerBtn.addEventListener("click", function () { openModal("register"); });
  bannerRegister.addEventListener("click", function () { openModal("register"); });
  authClose.addEventListener("click", closeModal);
  modal.addEventListener("click", function (e) { if (e.target === modal) closeModal(); });
  document.addEventListener("keydown", function (e) { if (e.key === "Escape") closeModal(); });

  authForm.addEventListener("submit", function (e) {
    e.preventDefault();
    if (!supabase) { showMsg("Облако не подключено. Проверьте config.js.", "err"); return; }
    var email = emailInp.value.trim(), pass = passInp.value;
    authSubmit.disabled = true; clearMsg();
    var op = mode === "register"
      ? supabase.auth.signUp({ email: email, password: pass })
      : supabase.auth.signInWithPassword({ email: email, password: pass });
    op.then(function (res) {
      authSubmit.disabled = false;
      if (res.error) { showMsg(translateErr(res.error.message), "err"); return; }
      if (mode === "register" && res.data && res.data.user && !res.data.session) {
        showMsg("Готово! Проверьте почту и подтвердите адрес, чтобы войти.", "ok");
        return;
      }
      showMsg("Успешно! Загружаем ваш прогресс…", "ok");
      setTimeout(closeModal, 900);
    }, function () {
      authSubmit.disabled = false;
      showMsg("Не удалось связаться с сервером. Попробуйте ещё раз.", "err");
    });
  });

  logoutBtn.addEventListener("click", function () {
    if (supabase) supabase.auth.signOut();
  });

  function translateErr(m) {
    m = (m || "").toLowerCase();
    if (m.indexOf("invalid login") >= 0) return "Неверная почта или пароль.";
    if (m.indexOf("already registered") >= 0) return "Эта почта уже зарегистрирована. Войдите.";
    if (m.indexOf("password") >= 0 && m.indexOf("6") >= 0) return "Пароль должен быть не короче 6 символов.";
    if (m.indexOf("email not confirmed") >= 0) return "Сначала подтвердите почту — письмо уже отправлено.";
    if (m.indexOf("rate limit") >= 0) return "Слишком много попыток. Подождите минуту.";
    return "Ошибка: " + m;
  }

  /* ---------------- Кнопка поддержки ---------------- */
  var supportBtn = document.getElementById("supportBtn");
  supportBtn.addEventListener("click", function () {
    if (CFG.STRIPE_PAYMENT_LINK) {
      window.open(CFG.STRIPE_PAYMENT_LINK, "_blank", "noopener");
    } else {
      alert("Спасибо за желание поддержать проект! 🙏 Приём взносов скоро откроется.");
    }
  });

  /* ---------------- СТАРТ ---------------- */
  state = loadLocal();
  buildTabs();
  renderList();
  showLoggedOut();

  if (window.__supabaseReady) initSupabase();
  else document.addEventListener("supabase-ready", initSupabase);
})();
