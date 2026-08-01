/* =====================================================================
   НАСТРОЙКИ САЙТА  —  единственный файл, который тебе нужно отредактировать.
   Вставь сюда ключи из Supabase (см. README.md, раздел «Шаг 2»).
   Пока поля пустые — сайт работает в «гостевом» режиме: прогресс
   сохраняется только в этом браузере, регистрация отключена.
   ===================================================================== */

window.APP_CONFIG = {
  // --- Supabase (регистрация по почте + сохранение прогресса в облаке) ---
  // Возьми на https://app.supabase.com → твой проект → Settings → API
  SUPABASE_URL:      "https://zwlxbylelrultwqotrtb.supabase.co",
  SUPABASE_ANON_KEY: "sb_publishable_MGMC-dH59FgsJRXOUmBTGw_3SjPGR-T",   // publishable key (безопасно показывать)

  // --- Telegram-бот (кнопка «Написать» в полоске про ассистента) ---
  // Ссылка на твой бот/канал, напр. "https://t.me/tvoy_bot". Пусто — откроется письмо на почту.
  TELEGRAM_LINK: "",

  // --- Revolut (личная ссылка для перевода) ---
  REVOLUT_LINK: "https://revolut.me/smiziyev",

  // --- Крипто-донат (USDT, сеть TRON / TRC-20) ---
  // ВАЖНО: вставь СВОЙ реальный адрес кошелька TRC-20. Пока пусто — в окне будет «адрес скоро».
  USDT_TRC20_ADDRESS: "TQNXKETiztp1qepNACLDhiRmggB3fT78oD",

  // --- Оплата картой (Stripe Payment Links по суммам, евро) ---
  // Сделай в Stripe отдельный Payment Link на каждую сумму и вставь сюда.
  // Пока какая-то ссылка пустая — по этой сумме покажется «скоро».
  STRIPE_LINKS: {
    "10":  "https://buy.stripe.com/6oUbJ32Ng8Kg2NTa3F8ww00",
    "20":  "https://buy.stripe.com/dRmcN7cnQd0w7497Vx8ww01",
    "50":  "https://buy.stripe.com/9B65kF9bE6C82NT3Fh8ww02",
    "100": "https://buy.stripe.com/3cI28t4Vo4u02NT1x98ww04",
    "500": "https://buy.stripe.com/fZubJ39bE7GcfAF4Jl8ww03",
    "979": "https://buy.stripe.com/aFabJ39bE8Kg2NTgs38ww05"
  }
};
