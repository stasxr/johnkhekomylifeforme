# Премиум-доступ (ежедневная смена текстов) — настройка проверки оплаты

Доступ открывается автоматически, когда залогиненный пользователь оплатит **≥ 10 €**.
Схема: пользователь платит → Stripe шлёт событие серверной функции Supabase → в базе
ставится `is_supporter = true` → на сайте разблокируются тумблеры «auto».

Нужно сделать один раз. Секретный ключ Stripe живёт **только на сервере** (в функции), в код сайта не попадает.

## Шаг 1. Таблица в базе
Supabase → **SQL Editor** → вставь и выполни файл `supabase/profiles.sql`.

## Шаг 2. Развернуть серверную функцию
Проще всего через Supabase CLI (в терминале, в папке проекта):
```bash
npm i -g supabase
supabase login
supabase link --project-ref zwlxbylelrultwqotrtb
supabase functions deploy stripe-webhook --no-verify-jwt
```
Функция появится по адресу:
`https://zwlxbylelrultwqotrtb.functions.supabase.co/stripe-webhook`

## Шаг 3. Задать секреты функции
```bash
supabase secrets set STRIPE_SECRET_KEY=sk_live_НОВЫЙ_КЛЮЧ
supabase secrets set STRIPE_WEBHOOK_SECRET=whsec_ИЗ_ШАГА_4
supabase secrets set SUPABASE_SERVICE_ROLE_KEY=service_role_из_Settings_API
```
> `SUPABASE_URL` обычно уже задан автоматически.
> `STRIPE_SECRET_KEY` — это **новый** ключ (старый ты перевыпустил). Здесь он безопасен — на сервере.

## Шаг 4. Создать webhook в Stripe
Stripe → **Developers → Webhooks → Add endpoint**:
- **Endpoint URL**: `https://zwlxbylelrultwqotrtb.functions.supabase.co/stripe-webhook`
- **Events**: выбери `checkout.session.completed`
- Создай → скопируй **Signing secret** (`whsec_...`) → вставь его в Шаге 3 (`STRIPE_WEBHOOK_SECRET`), затем передеплой:
  `supabase functions deploy stripe-webhook --no-verify-jwt`

## Готово
Теперь при оплате ≥10 € сайт сам открывает пользователю ежедневную смену текстов.
Сайт передаёт в Stripe `client_reference_id` (id пользователя) — по нему функция понимает, кому открыть доступ.

---
### Быстрая проверка без денег
В Supabase → **Table Editor → profiles** можно вручную поставить `is_supporter = true` своему пользователю, чтобы протестировать тумблеры.
