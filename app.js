/* =====================================================================
   Я МОГУ ВСЁ — логика сайта
   языки · тема · аффирмации · уровни и серии (сброс каждый день) ·
   окно повышения уровня · профиль · личный кабинет · облако (Supabase)
   ===================================================================== */
(function () {
  "use strict";

  var CFG = window.APP_CONFIG || {};
  var I18N = window.I18N, LANGS = window.I18N_LANGS;
  var CONTACT_EMAIL = "hello@doxoxo.com";
  var LS_STATE = "yamoguvse_state_v2";
  var LS_LANG  = "yamoguvse_lang";
  var LS_BOT   = "yamoguvse_bot_dismissed";
  var root = document.documentElement;
  var $ = function (id) { return document.getElementById(id); };

  /* ---------------- ЯЗЫК ---------------- */
  var lang = (window.detectLang && window.detectLang()) || "ru";

  function t(key, vars) {
    var d = I18N[lang] || I18N.en;
    var s = (d[key] != null) ? d[key] : (I18N.en[key] != null ? I18N.en[key] : key);
    if (vars) for (var k in vars) s = s.split("{" + k + "}").join(vars[k]);
    return s;
  }
  function getThemes() { return (I18N[lang] || I18N.en).themes; }

  function applyLang(newLang) {
    if (newLang) lang = newLang;
    try { localStorage.setItem(LS_LANG, lang); } catch (e) {}
    root.setAttribute("lang", lang);
    document.title = t("meta.title");
    $("langCode").textContent = lang.toUpperCase();

    document.querySelectorAll("[data-i18n]").forEach(function (el) {
      var val = t(el.getAttribute("data-i18n"));
      if (val.indexOf("<") >= 0) el.innerHTML = val; else el.textContent = val;
    });
    document.querySelectorAll("[data-i18n-ph]").forEach(function (el) {
      el.setAttribute("placeholder", t(el.getAttribute("data-i18n-ph")));
    });
    $("footerCopy").textContent = t("footer.copy", { year: new Date().getFullYear() });

    buildLangMenu();
    buildTabs();
    renderList();
    refreshAuthTexts();
    updateLevelBadge(false);
    refreshQuotes();
    updateAutoUI();
  }

  function buildLangMenu() {
    var m = $("langMenu"); m.innerHTML = "";
    LANGS.forEach(function (code) {
      var b = document.createElement("button");
      b.className = "dd-item"; b.type = "button"; b.setAttribute("role", "menuitem");
      b.setAttribute("aria-selected", code === lang ? "true" : "false");
      b.textContent = I18N[code]["lang.name"];
      b.addEventListener("click", function () { applyLang(code); closeMenus(); });
      m.appendChild(b);
    });
  }

  /* ---------------- ТЕМА ---------------- */
  function isDark() {
    var a = root.getAttribute("data-theme");
    if (a) return a === "dark";
    return window.matchMedia && window.matchMedia("(prefers-color-scheme:dark)").matches;
  }
  function paintTheme() { $("tglIco").textContent = isDark() ? "☀" : "☾"; }
  $("tgl").addEventListener("click", function () {
    root.setAttribute("data-theme", isDark() ? "light" : "dark"); paintTheme();
  });
  paintTheme();

  /* ---------------- ДАТЫ ---------------- */
  function pad(n) { return (n < 10 ? "0" : "") + n; }
  function dateToStr(d) { return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()); }
  function parseDate(s) { var p = s.split("-"); return new Date(+p[0], +p[1] - 1, +p[2]); }
  function todayStr() { return dateToStr(new Date()); }
  function addDays(s, n) { var d = parseDate(s); d.setDate(d.getDate() + n); return dateToStr(d); }
  function dowMon(s) { return (parseDate(s).getDay() + 6) % 7; } // 0=Пн .. 6=Вс
  function computeStreak(history, today) {
    var cur = today;
    if (!history[cur]) cur = addDays(cur, -1);
    var n = 0;
    while (history[cur]) { n++; cur = addDays(cur, -1); }
    return n;
  }

  /* ---------------- СОСТОЯНИЕ ---------------- */
  var state = { marks: {}, day: "", level: 0, streak: 0, history: {} };
  var user = null, supabase = null, saveTimer = null;
  var isSupporter = false;
  var CONTENT = window.CONTENT || {};

  function loadLocal() {
    try { var r = localStorage.getItem(LS_STATE); if (r) return JSON.parse(r); } catch (e) {}
    return { marks: {}, day: "", level: 0, streak: 0, history: {} };
  }
  function saveLocal() { try { localStorage.setItem(LS_STATE, JSON.stringify(state)); } catch (e) {} }
  function persist() {
    saveLocal();
    if (user && supabase) { clearTimeout(saveTimer); saveTimer = setTimeout(cloudSave, 600); }
  }
  function recount() {
    state.level = Object.keys(state.history || {}).length;
    state.streak = computeStreak(state.history || {}, todayStr());
  }
  function ensureToday() {
    var td = todayStr();
    if (state.day !== td) { state.marks = {}; state.day = td; }
  }

  function keyOf(t, i) { return t + ":" + i; }
  function allItemKeys() {
    var ks = [];
    getThemes().forEach(function (th) { th.items.forEach(function (_, i) { ks.push(keyOf(th.id, i)); }); });
    return ks;
  }
  function isTodayComplete() {
    var ks = allItemKeys();
    for (var i = 0; i < ks.length; i++) if (!state.marks[ks[i]]) return false;
    return ks.length > 0;
  }

  /* ---------------- ОБЛАКО ---------------- */
  function initSupabase() {
    if (!CFG.SUPABASE_URL || !CFG.SUPABASE_ANON_KEY || !window.supabase) return;
    supabase = window.supabase.createClient(CFG.SUPABASE_URL, CFG.SUPABASE_ANON_KEY);
    supabase.auth.getSession().then(function (res) {
      if (res.data && res.data.session) onSignedIn(res.data.session.user);
    });
    supabase.auth.onAuthStateChange(function (_e, session) {
      if (session && session.user) onSignedIn(session.user); else onSignedOut();
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
      .then(function () {}, function () {});
  }
  function mergeCloud(cloud) {
    if (!cloud) return;
    var td = todayStr();
    var hist = {}; var k;
    for (k in (state.history || {})) hist[k] = true;
    for (k in (cloud.history || {})) hist[k] = true;
    state.history = hist;
    // сегодняшние отметки: объединяем, если запись относится к сегодня
    var marks = {};
    if (state.day === td) for (k in state.marks) if (state.marks[k]) marks[k] = true;
    if (cloud.day === td) for (k in (cloud.marks || {})) if (cloud.marks[k]) marks[k] = true;
    state.marks = marks; state.day = td;
    if (cloud.auto != null) state.auto = cloud.auto;
    if (cloud.cycle != null) state.cycle = Math.max(state.cycle || 0, cloud.cycle || 0);
    recount();
  }

  /* ---------------- РЕНДЕР АФФИРМАЦИЙ ---------------- */
  var tabsEl = $("tabs"), listEl = $("affList"), barFill = $("barFill"),
      progTxt = $("progTxt"), resetBtn = $("resetBtn");
  var active = null;
  var CHECK = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>';

  function buildTabs() {
    var themes = getThemes();
    if (!active || !themes.some(function (x) { return x.id === active; })) active = themes[0].id;
    tabsEl.innerHTML = "";
    themes.forEach(function (th) {
      var b = document.createElement("button");
      b.className = "tab"; b.type = "button"; b.textContent = th.label;
      b.setAttribute("role", "tab");
      b.setAttribute("aria-selected", th.id === active ? "true" : "false");
      b.addEventListener("click", function () { active = th.id; syncTabs(); renderList(); });
      tabsEl.appendChild(b);
    });
  }
  function syncTabs() {
    var themes = getThemes();
    Array.prototype.forEach.call(tabsEl.children, function (b, i) {
      b.setAttribute("aria-selected", themes[i].id === active ? "true" : "false");
    });
  }
  function renderList() {
    var theme = getThemes().filter(function (x) { return x.id === active; })[0];
    listEl.innerHTML = "";
    var items = theme.items;
    if (state.auto && isSupporter && items.length) {
      var off = (state.cycle || 0) % items.length;
      if (off) items = items.slice(off).concat(items.slice(0, off));
    }
    items.forEach(function (text, i) {
      var k = keyOf(theme.id, i);
      var btn = document.createElement("button");
      btn.className = "aff"; btn.type = "button";
      btn.setAttribute("data-done", state.marks[k] ? "1" : "0");
      btn.innerHTML = '<span class="mark">' + CHECK + '</span><span class="txt"></span>';
      btn.querySelector(".txt").textContent = text;
      btn.addEventListener("click", function () { onToggle(k, btn); });
      listEl.appendChild(btn);
    });
    updateProgress();
  }
  function updateProgress() {
    var ks = allItemKeys(), total = ks.length, done = 0;
    for (var i = 0; i < ks.length; i++) if (state.marks[ks[i]]) done++;
    barFill.style.width = (total ? Math.round(done / total * 100) : 0) + "%";
    progTxt.textContent = t("aff.progress", { done: done, total: total });
    updateNotif();
  }
  function onToggle(k, btn) {
    state.marks[k] = !state.marks[k];
    btn.setAttribute("data-done", state.marks[k] ? "1" : "0");
    var wasComplete = !!state.history[state.day];
    persist(); updateProgress();
    if (!wasComplete && isTodayComplete()) awardDay();
  }
  resetBtn.addEventListener("click", function () {
    state.marks = {}; persist(); renderList();
  });

  /* ---------------- УРОВЕНЬ / СЕРИЯ ---------------- */
  function awardDay() {
    var td = todayStr();
    state.history[td] = true;
    if (state.auto && isSupporter) state.cycle = (state.cycle || 0) + 1;
    recount();
    persist();
    updateLevelBadge(true);
    renderList();
    showLevelUp();
  }

  var levelBadge = $("levelBadge"), levelNum = $("levelNum");
  function updateLevelBadge(bump) {
    levelNum.textContent = state.level;
    levelBadge.style.display = state.level > 0 ? "inline-flex" : "none";
    if (bump) { levelBadge.classList.remove("bump"); void levelBadge.offsetWidth; levelBadge.classList.add("bump"); }
    updateNotif();
  }
  function updateNotif() {
    var pending = !isTodayComplete();
    var nd = $("notifDot"), md = $("miAccountDot");
    if (nd) nd.style.display = pending ? "block" : "none";
    if (md) md.style.display = pending ? "block" : "none";
  }

  function buildWeek(container) {
    container.innerHTML = "";
    var today = todayStr(), monday = addDays(today, -dowMon(today));
    var labels = ["week.mon","week.tue","week.wed","week.thu","week.fri","week.sat","week.sun"];
    for (var i = 0; i < 7; i++) {
      var ds = addDays(monday, i), done = !!state.history[ds];
      var cell = document.createElement("div");
      cell.className = "week-day" + (done ? " done" : "") + (ds === today ? " today" : "");
      cell.innerHTML = '<span class="wd-lbl">' + t(labels[i]) + '</span><span class="wd-dot">' + (done ? "✓" : "") + "</span>";
      container.appendChild(cell);
    }
  }
  function confetti() {
    var box = $("luConfetti"); box.innerHTML = "";
    var cols = ["#E4AC52", "#C79A3C", "#8878C0", "#F0C271", "#A497D6"];
    for (var i = 0; i < 26; i++) {
      var p = document.createElement("i");
      p.style.left = Math.round(Math.random() * 100) + "%";
      p.style.background = cols[i % cols.length];
      p.style.animationDuration = (1.6 + Math.random() * 1.4).toFixed(2) + "s";
      p.style.animationDelay = (Math.random() * 0.5).toFixed(2) + "s";
      p.style.transform = "rotate(" + Math.round(Math.random() * 360) + "deg)";
      box.appendChild(p);
    }
  }
  function showLevelUp() {
    $("luNum").textContent = state.level;
    $("luStreak").textContent = t("level.up.streak", { streak: state.streak });
    buildWeek($("luWeek"));
    confetti();
    openModal($("levelupModal"));
  }
  $("luClose").addEventListener("click", function () { closeModal($("levelupModal")); });

  /* ---------------- АККАУНТ UI ---------------- */
  var loginBtn = $("loginBtn"), registerBtn = $("registerBtn"),
      profile = $("profile"), profileName = $("profileName"), avatar = $("avatar"),
      cloudTag = $("cloudTag"), saveBanner = $("saveBanner");

  function showLoggedIn(email) {
    loginBtn.style.display = "none"; registerBtn.style.display = "none";
    profile.style.display = "flex";
    profileName.textContent = (email || "").split("@")[0] || t("ui.profile");
    avatar.firstChild.nodeValue = ((email || "?")[0] || "?").toUpperCase();
    cloudTag.style.display = "inline-flex";
    saveBanner.classList.add("hidden");
  }
  function showLoggedOut() {
    loginBtn.style.display = ""; registerBtn.style.display = "";
    profile.style.display = "none";
    cloudTag.style.display = "none";
    if (CFG.SUPABASE_URL) saveBanner.classList.remove("hidden"); else saveBanner.classList.add("hidden");
  }
  function onSignedIn(u) {
    user = u; showLoggedIn(u.email || "");
    loadSupporter();
    cloudLoad().then(function (cloud) {
      mergeCloud(cloud); saveLocal(); cloudSave();
      renderList(); updateLevelBadge(false); refreshQuotes(); updateAutoUI();
    });
  }
  function onSignedOut() {
    user = null; isSupporter = false; showLoggedOut();
    updateAutoUI(); refreshQuotes(); renderList();
  }
  function loadSupporter() {
    if (!supabase || !user) return;
    supabase.from("profiles").select("is_supporter").eq("user_id", user.id).maybeSingle()
      .then(function (r) {
        isSupporter = !!(r.data && r.data.is_supporter);
        updateAutoUI(); refreshQuotes(); renderList();
      }, function () {});
  }

  /* ---------------- Выпадающие меню ---------------- */
  function closeMenus() {
    $("langMenu").classList.remove("open"); $("langBtn").setAttribute("aria-expanded", "false");
    $("profileMenu").classList.remove("open"); $("profileBtn").setAttribute("aria-expanded", "false");
  }
  function toggleMenu(menu, btn) {
    var open = menu.classList.contains("open"); closeMenus();
    if (!open) { menu.classList.add("open"); btn.setAttribute("aria-expanded", "true"); }
  }
  $("langBtn").addEventListener("click", function (e) { e.stopPropagation(); toggleMenu($("langMenu"), $("langBtn")); });
  $("profileBtn").addEventListener("click", function (e) { e.stopPropagation(); toggleMenu($("profileMenu"), $("profileBtn")); });
  document.addEventListener("click", closeMenus);

  /* профиль-меню действия */
  $("miAccount").addEventListener("click", openAccount);
  levelBadge.addEventListener("click", openAccount);
  $("miSupport").addEventListener("click", function () { openDonate(); });
  $("miIdea").addEventListener("click", function () {
    copyText(CONTACT_EMAIL); toast(t("idea.copied") + " · " + CONTACT_EMAIL);
  });
  $("miLogout").addEventListener("click", function () { if (supabase) supabase.auth.signOut(); });

  /* ---------------- Личный кабинет ---------------- */
  function openAccount() {
    $("accEmail").textContent = user ? user.email : "—";
    $("accLevel").textContent = state.level;
    $("accStreak").textContent = state.streak;
    $("accTotal").textContent = Object.keys(state.history || {}).length;
    buildWeek($("accWeek"));
    openModal($("accountModal"));
  }
  $("accClose").addEventListener("click", function () { closeModal($("accountModal")); });
  $("accCloseBtn").addEventListener("click", function () { closeModal($("accountModal")); });

  /* ---------------- Модалки (общее) ---------------- */
  function openModal(m) { m.classList.add("open"); }
  function closeModal(m) { m.classList.remove("open"); }
  document.querySelectorAll(".modal-back").forEach(function (m) {
    m.addEventListener("click", function (e) { if (e.target === m) closeModal(m); });
  });
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape") document.querySelectorAll(".modal-back.open").forEach(closeModal);
  });

  /* ---------------- Вход / регистрация ---------------- */
  var modal = $("authModal"), authTitle = $("authTitle"), authSub = $("authSub"),
      authForm = $("authForm"), authSubmit = $("authSubmit"), authSwitch = $("authSwitch"),
      authMsg = $("authMsg"), emailInp = $("email"), passInp = $("password");
  var mode = "register";

  function refreshAuthTexts() {
    if (mode === "register") {
      authTitle.textContent = t("ui.register");
      authSub.textContent = t("modal.register.sub");
      authSubmit.textContent = t("modal.register.submit");
      authSwitch.innerHTML = t("modal.haveAccount") + ' <a id="switchLink">' + t("modal.login.submit") + "</a>";
    } else {
      authTitle.textContent = t("ui.login");
      authSub.textContent = t("modal.login.sub");
      authSubmit.textContent = t("modal.login.submit");
      authSwitch.innerHTML = t("modal.noAccount") + ' <a id="switchLink">' + t("modal.register.submit") + "</a>";
    }
    $("switchLink").addEventListener("click", function () { setMode(mode === "register" ? "login" : "register"); });
  }
  function setMode(m) { mode = m; clearMsg(); refreshAuthTexts(); }
  function openAuth(m) {
    if (!CFG.SUPABASE_URL) { alert(t("alert.notConfigured")); return; }
    setMode(m); openModal(modal); setTimeout(function () { emailInp.focus(); }, 50);
  }
  function clearMsg() { authMsg.className = "msg"; authMsg.textContent = ""; }
  function showMsg(text, kind) { authMsg.className = "msg " + kind; authMsg.textContent = text; }

  loginBtn.addEventListener("click", function () { openAuth("login"); });
  registerBtn.addEventListener("click", function () { openAuth("register"); });
  $("bannerRegister").addEventListener("click", function () { openAuth("register"); });
  $("authClose").addEventListener("click", function () { closeModal(modal); });

  authForm.addEventListener("submit", function (e) {
    e.preventDefault();
    if (!supabase) { showMsg(t("msg.notConnected"), "err"); return; }
    var email = emailInp.value.trim(), pass = passInp.value;
    authSubmit.disabled = true; clearMsg();
    var op = mode === "register"
      ? supabase.auth.signUp({ email: email, password: pass })
      : supabase.auth.signInWithPassword({ email: email, password: pass });
    op.then(function (res) {
      authSubmit.disabled = false;
      if (res.error) { showMsg(translateErr(res.error.message), "err"); return; }
      if (mode === "register" && res.data && res.data.user && !res.data.session) { showMsg(t("msg.checkEmail"), "ok"); return; }
      showMsg(t("msg.success"), "ok"); setTimeout(function () { closeModal(modal); }, 900);
    }, function () { authSubmit.disabled = false; showMsg(t("msg.serverErr"), "err"); });
  });

  function translateErr(m) {
    m = (m || "").toLowerCase();
    if (m.indexOf("invalid login") >= 0) return t("err.invalidLogin");
    if (m.indexOf("already registered") >= 0) return t("err.alreadyRegistered");
    if (m.indexOf("password") >= 0 && m.indexOf("6") >= 0) return t("err.passwordShort");
    if (m.indexOf("email not confirmed") >= 0) return t("err.notConfirmed");
    if (m.indexOf("rate limit") >= 0) return t("err.rateLimit");
    return t("err.generic", { msg: m });
  }

  /* ---------------- Поддержать проект (донат) ---------------- */
  var donateModal = $("donateModal");
  var EMOJI = {
    "10":  ["🙂", "☕", "🌱"],
    "20":  ["😊", "✨", "🌿"],
    "50":  ["😍", "🔥", "💫"],
    "100": ["🤩", "💎", "⭐"],
    "500": ["🚀", "👑", "🌟"],
    "979": ["🏆", "🎉", "🥳", "💖"]
  };
  function openDonate() {
    var addr = CFG.USDT_TRC20_ADDRESS || "";
    if (addr) { $("usdtAddr").textContent = addr; $("usdtCopy").style.display = ""; }
    else { $("usdtAddr").textContent = t("donate.noAddress"); $("usdtCopy").style.display = "none"; }
    var rev = $("revolutBtn");
    if (CFG.REVOLUT_LINK) { rev.href = CFG.REVOLUT_LINK; rev.style.display = "flex"; }
    else rev.style.display = "none";
    $("donateStatus").textContent = "";
    Array.prototype.forEach.call($("amountGrid").children, function (b) { b.classList.remove("chosen"); });
    openModal(donateModal);
  }
  $("supportBtn").addEventListener("click", openDonate);
  $("donClose").addEventListener("click", function () { closeModal(donateModal); });

  $("usdtCopy").addEventListener("click", function () {
    var addr = CFG.USDT_TRC20_ADDRESS || "";
    if (!addr) return;
    var done = function () { $("usdtCopy").textContent = t("donate.copied"); setTimeout(function () { $("usdtCopy").textContent = t("donate.copy"); }, 1800); };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(addr).then(done, done);
    else { try { var ta = document.createElement("textarea"); ta.value = addr; document.body.appendChild(ta); ta.select(); document.execCommand("copy"); document.body.removeChild(ta); done(); } catch (e) {} }
  });

  function emojiBurst(amount) {
    var set = EMOJI[amount] || ["✨"], layer = $("emojiLayer");
    for (var i = 0; i < 12; i++) {
      var s = document.createElement("span");
      s.className = "emoji-fly";
      s.textContent = set[Math.floor(Math.random() * set.length)];
      s.style.left = (8 + Math.random() * 84) + "%";
      s.style.setProperty("--r", (Math.random() * 120 - 60).toFixed(0) + "deg");
      s.style.animationDelay = (Math.random() * 0.35).toFixed(2) + "s";
      s.style.fontSize = (20 + Math.random() * 16).toFixed(0) + "px";
      layer.appendChild(s);
      (function (el) { setTimeout(function () { if (el.parentNode) el.parentNode.removeChild(el); }, 2000); })(s);
    }
  }
  Array.prototype.forEach.call($("amountGrid").children, function (btn) {
    btn.addEventListener("click", function () {
      var amount = btn.getAttribute("data-amount");
      Array.prototype.forEach.call($("amountGrid").children, function (b) { b.classList.remove("chosen"); });
      btn.classList.add("chosen");
      emojiBurst(amount);
      var link = (CFG.STRIPE_LINKS && CFG.STRIPE_LINKS[amount]) || "";
      if (link && user) {
        link += (link.indexOf("?") < 0 ? "?" : "&") +
          "client_reference_id=" + encodeURIComponent(user.id) +
          "&prefilled_email=" + encodeURIComponent(user.email || "");
      }
      if (link) {
        $("donateStatus").textContent = t("donate.thanks");
        // открываем СИНХРОННО (в момент клика), иначе браузер блокирует вкладку
        var w = window.open(link, "_blank");
        if (w) { try { w.opener = null; } catch (e) {} }
        else { location.href = link; } // если попап заблокирован — переходим в этой же вкладке
      } else {
        $("donateStatus").textContent = t("donate.soon");
      }
    });
  });

  /* ---------------- Полоска бота ---------------- */
  (function () {
    var strip = $("botStrip");
    try { if (localStorage.getItem(LS_BOT) === "1") strip.classList.add("hidden"); } catch (e) {}
    $("botStripCta").addEventListener("click", function (e) {
      e.preventDefault();
      if (CFG.TELEGRAM_LINK) window.open(CFG.TELEGRAM_LINK, "_blank", "noopener");
      else location.href = "mailto:" + CONTACT_EMAIL + "?subject=" + encodeURIComponent("Персональный Telegram-бот «Я могу всё»");
    });
    $("botStripClose").addEventListener("click", function () {
      strip.classList.add("hidden");
      try { localStorage.setItem(LS_BOT, "1"); } catch (e) {}
    });
  })();

  /* ---------------- Тост + буфер обмена ---------------- */
  var toastEl = $("toast"), toastTimer;
  function toast(msg) {
    toastEl.textContent = msg; toastEl.classList.add("show");
    clearTimeout(toastTimer); toastTimer = setTimeout(function () { toastEl.classList.remove("show"); }, 2800);
  }
  function copyText(txt) {
    if (navigator.clipboard && navigator.clipboard.writeText) { navigator.clipboard.writeText(txt).catch(function () {}); return; }
    try { var ta = document.createElement("textarea"); ta.value = txt; document.body.appendChild(ta); ta.select(); document.execCommand("copy"); document.body.removeChild(ta); } catch (e) {}
  }

  /* ---------------- Ежедневная смена текстов (auto) ---------------- */
  function dayNumber() { return Math.floor(parseDate(todayStr()).getTime() / 86400000); }
  function refreshQuotes() {
    var on = !!state.auto && isSupporter, dn = dayNumber();
    document.querySelectorAll("[data-quote]").forEach(function (el) {
      var sec = el.getAttribute("data-quote");
      var pool = CONTENT[lang] && CONTENT[lang][sec];
      if (on && pool && pool.length) el.textContent = "«" + pool[dn % pool.length] + "»";
      else el.textContent = t("day." + sec + ".quote");
    });
  }
  function updateAutoUI() {
    var on = !!state.auto && isSupporter;
    document.querySelectorAll("[data-auto]").forEach(function (b) {
      b.setAttribute("aria-checked", on ? "true" : "false");
      b.classList.toggle("locked", !isSupporter);
    });
  }
  function onAutoClick() {
    if (!user) { toast(t("auto.needLogin")); return; }
    if (!isSupporter) { toast(t("auto.needSupport")); openDonate(); return; }
    state.auto = !state.auto; persist();
    updateAutoUI(); refreshQuotes(); renderList();
  }
  document.addEventListener("click", function (e) {
    var el = e.target;
    var infoBtn = el.closest ? el.closest("[data-autoinfo]") : null;
    if (infoBtn) { e.preventDefault(); e.stopPropagation(); openModal($("infoModal")); return; }
    var autoBtn = el.closest ? el.closest("[data-auto]") : null;
    if (autoBtn) { e.preventDefault(); e.stopPropagation(); onAutoClick(); }
  });
  $("infoClose").addEventListener("click", function () { closeModal($("infoModal")); });
  $("infoOk").addEventListener("click", function () { closeModal($("infoModal")); });

  /* ---------------- Установка на телефон ---------------- */
  $("installBtn").addEventListener("click", function () { openModal($("installModal")); });
  $("installClose").addEventListener("click", function () { closeModal($("installModal")); });
  $("installOk").addEventListener("click", function () { closeModal($("installModal")); });

  /* ---------------- Личный ассистент (скоро) ---------------- */
  $("miAssistant").addEventListener("click", function () { openModal($("assistantModal")); });
  $("assistantClose").addEventListener("click", function () { closeModal($("assistantModal")); });
  $("assistantOk").addEventListener("click", function () { closeModal($("assistantModal")); });

  /* ---------------- Дыхательная практика (орб) ---------------- */
  (function () {
    var breath = $("breath"), canvas = $("breathRing"), orbState = $("orbState");
    if (!breath || !canvas || !canvas.getContext) return;
    var ctx = canvas.getContext("2d");
    var DPR = window.devicePixelRatio || 1, SIZE = 210, CX = 105, CY = 105, R = 86;
    canvas.style.width = SIZE + "px"; canvas.style.height = SIZE + "px";
    canvas.width = SIZE * DPR; canvas.height = SIZE * DPR; ctx.scale(DPR, DPR);
    var cyan = ctx.createLinearGradient(0, 0, SIZE, SIZE);
    cyan.addColorStop(0, "#7dd3fc"); cyan.addColorStop(0.5, "#38bdf8"); cyan.addColorStop(1, "#0ea5e9");
    var INHALE = 4000, EXHALE = 8;
    var reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion:reduce)").matches;
    var state = "idle", t0 = 0, raf = null;
    function now() { return (window.performance && performance.now) ? performance.now() : Date.now(); }
    function clearRing() { ctx.clearRect(0, 0, SIZE, SIZE); }
    function arc(frac, style, glow, lw) {
      if (frac <= 0) return;
      ctx.lineCap = "round"; ctx.lineWidth = lw; ctx.strokeStyle = style;
      ctx.shadowColor = (typeof style === "string" ? style : "#38bdf8"); ctx.shadowBlur = glow;
      var s = -Math.PI / 2;
      ctx.beginPath(); ctx.arc(CX, CY, R, s, s + Math.min(frac, 1) * Math.PI * 2); ctx.stroke();
      ctx.shadowBlur = 0;
    }
    function setState(txt, size, ls) { orbState.textContent = txt; orbState.style.fontSize = size; orbState.style.letterSpacing = ls || "0"; }
    function stop() { breath.classList.remove("active"); clearRing(); if (raf) { cancelAnimationFrame(raf); raf = null; } }
    function loop() {
      var tn = now(), el = tn - t0; clearRing();
      if (state === "inhale") {
        var p = Math.min(1, el / INHALE);
        arc(p, cyan, 16, 11);
        setState(t("breath.inhale"), "15px", ".03em");
        if (p >= 1) { state = "hold"; t0 = tn; }
      } else if (state === "hold") {
        var g = reduce ? 18 : 16 + Math.sin(tn / 260) * 10;
        var lw = reduce ? 11 : 11 + Math.sin(tn / 260) * 2;
        arc(1, cyan, g, lw);
        setState(t("breath.hold"), "14px", ".02em");
      } else if (state === "exhale") {
        var remain = EXHALE - el / 1000;
        if (remain <= 0) { state = "idle"; setState("", "15px"); stop(); return; }
        arc(remain / EXHALE, "#9aa3b2", 6, 9);
        setState(String(Math.ceil(remain)), "30px", "0");
      } else { stop(); return; }
      raf = requestAnimationFrame(loop);
    }
    function startInhale() { state = "inhale"; t0 = now(); breath.classList.add("active"); if (!raf) raf = requestAnimationFrame(loop); }
    function startExhale() { if (state !== "inhale" && state !== "hold") return; state = "exhale"; t0 = now(); if (!raf) raf = requestAnimationFrame(loop); }
    breath.addEventListener("pointerdown", function (e) { e.preventDefault(); startInhale(); });
    breath.addEventListener("pointerup", startExhale);
    breath.addEventListener("pointerleave", startExhale);
    breath.addEventListener("pointercancel", startExhale);
  })();

  /* ---------------- СТАРТ ---------------- */
  state = loadLocal();
  ensureToday();
  recount();
  applyLang();          // отрисует текст, вкладки, список
  showLoggedOut();
  updateLevelBadge(false);

  if (window.__supabaseReady) initSupabase();
  else document.addEventListener("supabase-ready", initSupabase);
})();
