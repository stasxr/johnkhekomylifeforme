-- =====================================================================
--  Схема базы для сайта «Я могу всё»
--  Скопируй это целиком в Supabase → SQL Editor → New query → Run.
--  Создаёт таблицу прогресса и включает защиту: каждый пользователь
--  видит и меняет ТОЛЬКО свою строку.
-- =====================================================================

create table if not exists public.progress (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  data       jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

-- Включаем построчную защиту (Row Level Security)
alter table public.progress enable row level security;

-- Пользователь может читать свою строку
drop policy if exists "read own progress" on public.progress;
create policy "read own progress"
  on public.progress for select
  using (auth.uid() = user_id);

-- Пользователь может создавать свою строку
drop policy if exists "insert own progress" on public.progress;
create policy "insert own progress"
  on public.progress for insert
  with check (auth.uid() = user_id);

-- Пользователь может обновлять свою строку
drop policy if exists "update own progress" on public.progress;
create policy "update own progress"
  on public.progress for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
