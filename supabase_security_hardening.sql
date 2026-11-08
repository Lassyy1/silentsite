-- ============================================================================
-- SILENT CLIENT // SUPABASE HARDENED PRODUCTION SECURITY RIG
-- Выполните этот SQL в панели Supabase (SQL Editor)
-- ============================================================================

-- 0. КРИПТОГРАФИЧЕСКИЕ РАСШИРЕНИЯ
create extension if not exists pgcrypto;

-- ============================================================================
-- 1. ТАБЛИЦА ПРОФИЛЕЙ
-- ============================================================================
create table if not exists public.profiles (
  id uuid references auth.users on delete cascade primary key,
  username text,
  hwid text default 'Not linked',
  active_sub text default 'Free',
  sub_expiry timestamp with time zone,
  uid serial,
  role text default 'user',
  is_banned boolean default false,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.profiles add column if not exists uid serial;
alter table public.profiles add column if not exists role text default 'user';
alter table public.profiles add column if not exists is_banned boolean default false;
alter table public.profiles add column if not exists hwid text default 'Not linked';
alter table public.profiles add column if not exists active_sub text default 'Free';
alter table public.profiles add column if not exists sub_expiry timestamp with time zone;

alter table public.profiles enable row level security;

-- Хелпер проверки прав админа
create or replace function public.is_admin()
returns boolean as $$
begin
  return exists (
    select 1 from public.profiles 
    where id = auth.uid() and role = 'admin'
  );
end;
$$ language plpgsql security definer set search_path = public;

-- ПОЛИТИКИ ДОСТУПА (С проверкой бана на уровне RLS)
drop policy if exists "Users can view own profile" on public.profiles;
create policy "Users can view own profile" 
on public.profiles for select 
using ((auth.uid() = id and is_banned = false) or public.is_admin());

drop policy if exists "Users can update own profile" on public.profiles;
create policy "Users can update own profile" 
on public.profiles for update 
using (auth.uid() = id and is_banned = false);

-- ТРИГГЕР: Защита критических полей (роль, uid, подписка, дата окончания, бан)
-- Обычные юзеры через client SDK не могут повысить роль, выдать подписку или снять бан
create or replace function public.protect_profile_fields()
returns trigger as $$
begin
  if not public.is_admin() and current_setting('silent.internal_op', true) is distinct from 'true' then
    new.role := old.role;
    new.uid := old.uid;
    new.active_sub := old.active_sub;
    new.sub_expiry := old.sub_expiry;
    new.is_banned := old.is_banned;
  end if;
  return new;
end;
$$ language plpgsql security definer set search_path = public;

drop trigger if exists tr_protect_profile_fields on public.profiles;
create trigger tr_protect_profile_fields
  before update on public.profiles
  for each row execute procedure public.protect_profile_fields();

-- Автосоздание профиля при регистрации
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, username)
  values (new.id, coalesce(new.raw_user_meta_data->>'username', split_part(new.email, '@', 1)))
  on conflict (id) do nothing;
  return new;
end;
$$ language plpgsql security definer set search_path = public;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Назначение Lassyy1 главным администратором
update public.profiles set role = 'admin' where lower(username) = 'lassyy1' or uid = 1;

-- ============================================================================
-- 2. ВХОД ПО ЛОГИНУ С ЗАЩИТОЙ ОТ ПЕРЕБОРА (RATE LIMITING)
-- ============================================================================
create table if not exists public.rpc_rate_limits (
  caller_key text,
  created_at timestamp with time zone default now()
);

create index if not exists idx_rpc_rate_limits on public.rpc_rate_limits (caller_key, created_at);

create or replace function public.get_email_by_username(p_username text)
returns text as $$
declare
  u_email text;
  caller text;
  recent_calls int;
begin
  -- Извлекаем IP или заголовок запроса
  begin
    caller := coalesce(
      nullif(current_setting('request.headers', true)::json->>'cf-connecting-ip', ''),
      nullif(current_setting('request.headers', true)::json->>'x-forwarded-for', ''),
      'unknown_caller'
    );
  exception when others then
    caller := 'unknown_caller';
  end;

  -- Проверка лимита: максимум 15 запросов в минуту на IP
  select count(*) into recent_calls
  from public.rpc_rate_limits
  where caller_key = caller and created_at > now() - interval '1 minute';

  if recent_calls >= 15 then
    raise exception 'Слишком много попыток входа. Подождите минуту.';
  end if;

  insert into public.rpc_rate_limits (caller_key) values (caller);

  -- Периодическая очистка старых логов
  if random() < 0.05 then
    delete from public.rpc_rate_limits where created_at < now() - interval '10 minutes';
  end if;

  select u.email into u_email
  from auth.users u
  join public.profiles p on p.id = u.id
  where lower(p.username) = lower(trim(p_username))
  limit 1;

  return u_email;
end;
$$ language plpgsql security definer set search_path = public, auth;

grant execute on function public.get_email_by_username(text) to anon, authenticated;

-- ============================================================================
-- 3. ТАБЛИЦА ЛИЦЕНЗИОННЫХ КЛЮЧЕЙ
-- ============================================================================
create table if not exists public.license_keys (
  key text primary key,
  plan_name text not null,
  duration_days int not null,
  is_used boolean default false,
  used_by uuid references auth.users,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.license_keys enable row level security;

drop policy if exists "Only admins can view keys table" on public.license_keys;
create policy "Only admins can view keys table"
on public.license_keys for select
using (public.is_admin());

-- ============================================================================
-- 4. АТОМАРНАЯ АКТИВАЦИЯ КЛЮЧА (С КУМУЛЯТИВНЫМ ПРОДЛЕНИЕМ И ЗАЩИТОЙ ОТ ГОНОК)
-- ============================================================================
create or replace function public.activate_license_key(key_code text)
returns json as $$
declare
  k_rec record;
  current_prof record;
  new_expiry timestamp with time zone;
  clean_key text;
begin
  if auth.uid() is null then
    return json_build_object('success', false, 'message', 'Требуется авторизация');
  end if;

  select * into current_prof from public.profiles where id = auth.uid();
  if not found then
    return json_build_object('success', false, 'message', 'Профиль не найден');
  end if;

  if current_prof.is_banned then
    return json_build_object('success', false, 'message', 'Аккаунт заблокирован');
  end if;

  clean_key := upper(trim(key_code));

  -- Атомарный захват: выполняется строго для одного потока
  update public.license_keys 
  set is_used = true, used_by = auth.uid() 
  where upper(trim(key)) = clean_key and is_used = false
  returning * into k_rec;

  if k_rec is null then
    return json_build_object('success', false, 'message', 'Ключ недействителен или уже активирован');
  end if;

  -- Кумулятивный расчет: если есть активная подписка, продлеваем от её окончания
  if k_rec.duration_days >= 9999 then
    new_expiry := now() + interval '100 years';
  else
    if current_prof.sub_expiry is not null and current_prof.sub_expiry > now() then
      new_expiry := current_prof.sub_expiry + (k_rec.duration_days || ' days')::interval;
    else
      new_expiry := now() + (k_rec.duration_days || ' days')::interval;
    end if;
  end if;

  -- Включаем флаг внутренней операции для триггера защиты полей
  perform set_config('silent.internal_op', 'true', true);

  update public.profiles
  set active_sub = k_rec.plan_name, sub_expiry = new_expiry
  where id = auth.uid();

  return json_build_object('success', true, 'plan', k_rec.plan_name);
end;
$$ language plpgsql security definer set search_path = public;

grant execute on function public.activate_license_key(text) to authenticated;
revoke execute on function public.activate_license_key(text) from anon, public;

-- ============================================================================
-- 5. КРИПТОСТОЙКИЙ ГЕНЕРАТОР КЛЮЧЕЙ (SILENT-XXXX-XXXX-XXXX-XXXX, 80 бит энтропии)
-- ============================================================================
create or replace function public.generate_secure_key_code()
returns text as $$
declare
  chars text := '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  raw_bytes bytea;
  res text := 'SILENT-';
  i int;
  b int;
begin
  -- Supabase хранит расширения в схеме extensions, либо fallback на нативный sha256/uuid
  begin
    raw_bytes := extensions.gen_random_bytes(16);
  exception when others then
    begin
      raw_bytes := gen_random_bytes(16);
    exception when others then
      raw_bytes := sha256((gen_random_uuid()::text || clock_timestamp()::text || random()::text)::bytea);
    end;
  end;

  for i in 1..16 loop
    b := get_byte(raw_bytes, i - 1);
    res := res || substr(chars, (b % 32) + 1, 1);
    if i in (4, 8, 12) then
      res := res || '-';
    end if;
  end loop;
  return res;
end;
$$ language plpgsql security definer set search_path = public, extensions;

-- ============================================================================
-- 6. АДМИН-ПАНЕЛЬ (СЕРВЕРНАЯ ЗАЩИТА)
-- ============================================================================
drop function if exists public.admin_generate_keys(text, int, int);
drop function if exists public.admin_get_keys(text);
drop function if exists public.admin_get_all_users();

create or replace function public.admin_generate_keys(p_plan text, p_days int, p_count int default 1)
returns table(key_code text) as $$
declare
  i int;
  new_k text;
  max_c int := least(greatest(p_count, 1), 100);
begin
  if not public.is_admin() then
    raise exception 'Access denied: admin only';
  end if;

  for i in 1..max_c loop
    new_k := public.generate_secure_key_code();
    insert into public.license_keys (key, plan_name, duration_days)
    values (new_k, p_plan, p_days);
    key_code := new_k;
    return next;
  end loop;
end;
$$ language plpgsql security definer set search_path = public;

create or replace function public.admin_get_keys(p_filter text default 'all')
returns table(
  key text,
  plan_name text,
  duration_days int,
  is_used boolean,
  used_by_username text,
  created_at timestamp with time zone
) as $$
begin
  if not public.is_admin() then
    raise exception 'Access denied: admin only';
  end if;

  return query
  select 
    k.key, 
    k.plan_name, 
    k.duration_days, 
    k.is_used, 
    p.username as used_by_username, 
    k.created_at
  from public.license_keys k
  left join public.profiles p on p.id = k.used_by
  where 
    case 
      when p_filter = 'active' then k.is_used = false
      when p_filter = 'used' then k.is_used = true
      else true
    end
  order by k.created_at desc
  limit 300;
end;
$$ language plpgsql security definer set search_path = public;

create or replace function public.admin_delete_key(p_key text)
returns boolean as $$
begin
  if not public.is_admin() then
    raise exception 'Access denied: admin only';
  end if;

  delete from public.license_keys where key = p_key and is_used = false;
  return true;
end;
$$ language plpgsql security definer set search_path = public;

create or replace function public.admin_get_all_users()
returns table(
  uid int,
  id uuid,
  username text,
  hwid text,
  active_sub text,
  sub_expiry timestamp with time zone,
  created_at timestamp with time zone,
  role text,
  is_banned boolean
) as $$
begin
  if not public.is_admin() then
    raise exception 'Access denied: admin only';
  end if;

  return query
  select p.uid, p.id, p.username, p.hwid, p.active_sub, p.sub_expiry, p.created_at, p.role, p.is_banned
  from public.profiles p
  order by p.uid asc;
end;
$$ language plpgsql security definer set search_path = public;

create or replace function public.admin_reset_user_hwid(target_uid int)
returns boolean as $$
begin
  if not public.is_admin() then
    raise exception 'Access denied: admin only';
  end if;

  perform set_config('silent.internal_op', 'true', true);

  update public.profiles
  set hwid = 'Not linked'
  where uid = target_uid;

  return true;
end;
$$ language plpgsql security definer set search_path = public;

create or replace function public.admin_remove_user_sub(target_uid int)
returns boolean as $$
begin
  if not public.is_admin() then
    raise exception 'Access denied: admin only';
  end if;

  perform set_config('silent.internal_op', 'true', true);

  update public.profiles
  set active_sub = 'Free', sub_expiry = null
  where uid = target_uid;

  return true;
end;
$$ language plpgsql security definer set search_path = public;

create or replace function public.admin_toggle_ban_user(target_uid int, ban_state boolean)
returns boolean as $$
begin
  if not public.is_admin() then
    raise exception 'Access denied: admin only';
  end if;

  perform set_config('silent.internal_op', 'true', true);

  update public.profiles
  set is_banned = ban_state
  where uid = target_uid and role <> 'admin';

  return true;
end;
$$ language plpgsql security definer set search_path = public;

create or replace function public.admin_delete_user(target_uid int)
returns boolean as $$
declare
  target_id uuid;
begin
  if not public.is_admin() then
    raise exception 'Access denied: admin only';
  end if;

  select id into target_id from public.profiles where uid = target_uid and role <> 'admin';
  if target_id is null then
    return false;
  end if;

  delete from auth.users where id = target_id;
  return true;
end;
$$ language plpgsql security definer set search_path = public, auth;

-- ============================================================================
-- 7. ПРИВЯЗКА И ВАЛИДАЦИЯ HWID ДЛЯ ЛАУНЧЕРА
-- ============================================================================
create or replace function public.client_bind_or_verify_hwid(user_hwid text)
returns json as $$
declare
  p_rec record;
begin
  select * into p_rec from public.profiles where id = auth.uid();
  if not found then
    return json_build_object('success', false, 'message', 'Профиль не найден');
  end if;

  if p_rec.is_banned then
    return json_build_object('success', false, 'message', 'Аккаунт заблокирован');
  end if;

  if p_rec.hwid is null or p_rec.hwid = 'Not linked' or p_rec.hwid = '' then
    perform set_config('silent.internal_op', 'true', true);
    update public.profiles set hwid = user_hwid where id = auth.uid();
    return json_build_object('success', true, 'status', 'linked', 'message', 'HWID успешно привязан');
  elsif p_rec.hwid = user_hwid then
    return json_build_object('success', true, 'status', 'matched', 'message', 'HWID подтвержден');
  else
    return json_build_object('success', false, 'status', 'mismatch', 'message', 'HWID не совпадает. Требуется сброс HWID.');
  end if;
end;
$$ language plpgsql security definer set search_path = public;

-- ============================================================================
-- 8. ХРАНИЛИЩЕ СЕКРЕТОВ И ВЫДАЧА AES-256 КЛЮЧА ТОЛЬКО ПО ПЛАТНОЙ ПОДПИСКЕ
-- ============================================================================
create table if not exists public.app_secrets (
  id text primary key,
  secret_val text not null
);

alter table public.app_secrets enable row level security;

-- Прямой доступ к секретам с клиента запрещен полностью
drop policy if exists "Deny all client access to app_secrets" on public.app_secrets;
create policy "Deny all client access to app_secrets"
on public.app_secrets for select
using (false);

-- Мастер-ключ AES-256 (32 байта в hex) для шифрования silent-client.enc
insert into public.app_secrets (id, secret_val)
values ('client_aes_key', 'b8f2d5e7a1c3e9f40826471928374651a2b3c4d5e6f708192a3b4c5d6e7f8091')
on conflict (id) do nothing;

create or replace function public.get_client_decryption_key()
returns json as $$
declare
  p_rec record;
  key_val text;
begin
  if auth.uid() is null then
    return json_build_object('success', false, 'message', 'Требуется авторизация');
  end if;

  select * into p_rec from public.profiles where id = auth.uid();
  if not found then
    return json_build_object('success', false, 'message', 'Профиль не найден');
  end if;

  if p_rec.is_banned then
    return json_build_object('success', false, 'message', 'Аккаунт заблокирован');
  end if;

  if p_rec.active_sub is null or p_rec.active_sub = 'Free' then
    return json_build_object('success', false, 'message', 'Требуется активная платная подписка');
  end if;

  if p_rec.sub_expiry is not null and p_rec.sub_expiry < now() then
    return json_build_object('success', false, 'message', 'Срок вашей подписки истек');
  end if;

  select secret_val into key_val from public.app_secrets where id = 'client_aes_key';
  if key_val is null then
    return json_build_object('success', false, 'message', 'Ключ шифрования не настроен на сервере');
  end if;

  return json_build_object('success', true, 'aes_key', key_val);
end;
$$ language plpgsql security definer set search_path = public;

grant execute on function public.get_client_decryption_key() to authenticated;
revoke execute on function public.get_client_decryption_key() from anon, public;

