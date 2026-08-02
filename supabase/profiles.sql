-- =====================================================================
--  Премиум-доступ: таблица профилей с флагом «поддержал проект»
--  Выполни это в Supabase → SQL Editor → Run (один раз).
--  Флаг is_supporter ставит ТОЛЬКО серверная функция (webhook Stripe).
--  Пользователь может лишь ЧИТАТЬ свой профиль — подделать нельзя.
-- =====================================================================

create table if not exists public.profiles (
  user_id      uuid primary key references auth.users (id) on delete cascade,
  is_supporter boolean not null default false,
  supported_at timestamptz,
  created_at   timestamptz not null default now()
);

alter table public.profiles enable row level security;

-- Пользователь видит только свой профиль
drop policy if exists "read own profile" on public.profiles;
create policy "read own profile"
  on public.profiles for select
  using (auth.uid() = user_id);

-- (намеренно НЕТ политик insert/update для пользователей — писать может
--  только серверная функция через service_role, что обходит RLS)

-- Автосоздание профиля при регистрации нового пользователя
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (user_id) values (new.id)
  on conflict (user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Создать профили для уже зарегистрированных пользователей
insert into public.profiles (user_id)
select id from auth.users
on conflict (user_id) do nothing;
