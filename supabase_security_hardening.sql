-- SILENT CLIENT // SUPABASE RLS & RPC SECURITY HARDENING
-- Выполните этот SQL в панели Supabase (SQL Editor) для полной защиты базы от взлома с клиента

-- 1. Включаем RLS (Row Level Security) на profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Пользователи могут читать только свой профиль, а админы — все профили
DROP POLICY IF EXISTS "Users can view own profile or admins all" ON public.profiles;
CREATE POLICY "Users can view own profile or admins all"
ON public.profiles
FOR SELECT
USING (
  auth.uid() = id OR 
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);

-- Пользователи могут менять только свои базовые данные (без повышения роли)
DROP POLICY IF EXISTS "Users can update own safe fields" ON public.profiles;
CREATE POLICY "Users can update own safe fields"
ON public.profiles
FOR UPDATE
USING (auth.uid() = id)
WITH CHECK (
  auth.uid() = id AND
  role IS NOT DISTINCT FROM (SELECT role FROM public.profiles WHERE id = auth.uid())
);

-- 2. Включаем RLS на keys (прямой доступ к ключам запрещен обычным юзерам)
ALTER TABLE public.keys ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Only admins can view keys table" ON public.keys;
CREATE POLICY "Only admins can view keys table"
ON public.keys
FOR SELECT
USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);

-- 3. Функция проверки прав админа для RPC процедур
CREATE OR REPLACE FUNCTION public.check_is_admin()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() AND role = 'admin'
  );
END;
$$;

-- 4. Защита всех Admin RPC от вызова не-админами

CREATE OR REPLACE FUNCTION public.admin_get_keys(p_filter TEXT DEFAULT 'active')
RETURNS TABLE (
  key TEXT,
  plan_name TEXT,
  is_used BOOLEAN,
  used_by_username TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF NOT public.check_is_admin() THEN
    RAISE EXCEPTION 'Access Denied: Administrator role required';
  END IF;

  RETURN QUERY
  SELECT k.key_code AS key, k.plan_name, k.is_used, p.username AS used_by_username
  FROM public.keys k
  LEFT JOIN public.profiles p ON k.used_by = p.id
  WHERE 
    CASE 
      WHEN p_filter = 'active' THEN k.is_used = FALSE
      WHEN p_filter = 'used' THEN k.is_used = TRUE
      ELSE TRUE
    END
  ORDER BY k.created_at DESC;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_generate_keys(p_plan TEXT, p_days INT, p_count INT)
RETURNS TABLE (key_code TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_i INT;
  v_new_key TEXT;
BEGIN
  IF NOT public.check_is_admin() THEN
    RAISE EXCEPTION 'Access Denied: Administrator role required';
  END IF;

  IF p_count < 1 OR p_count > 200 THEN
    RAISE EXCEPTION 'Count must be between 1 and 200';
  END IF;

  FOR v_i IN 1..p_count LOOP
    v_new_key := 'SILENT-' || upper(substr(md5(random()::text), 1, 8)) || '-' || p_days;
    INSERT INTO public.keys (key_code, plan_name, days, is_used, created_at)
    VALUES (v_new_key, p_plan, p_days, FALSE, now());
  END LOOP;

  RETURN QUERY
  SELECT k.key_code FROM public.keys k
  ORDER BY k.created_at DESC
  LIMIT p_count;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_delete_key(p_key TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF NOT public.check_is_admin() THEN
    RAISE EXCEPTION 'Access Denied: Administrator role required';
  END IF;

  DELETE FROM public.keys WHERE key_code = p_key;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_get_all_users()
RETURNS TABLE (
  uid INT,
  username TEXT,
  active_sub TEXT,
  hwid TEXT,
  is_banned BOOLEAN,
  role TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF NOT public.check_is_admin() THEN
    RAISE EXCEPTION 'Access Denied: Administrator role required';
  END IF;

  RETURN QUERY
  SELECT p.uid, p.username, p.active_sub, p.hwid, p.is_banned, p.role
  FROM public.profiles p
  ORDER BY p.uid ASC;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_toggle_ban_user(target_uid INT, ban_state BOOLEAN)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF NOT public.check_is_admin() THEN
    RAISE EXCEPTION 'Access Denied: Administrator role required';
  END IF;

  UPDATE public.profiles
  SET is_banned = ban_state
  WHERE uid = target_uid AND role <> 'admin';
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_reset_user_hwid(target_uid INT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF NOT public.check_is_admin() THEN
    RAISE EXCEPTION 'Access Denied: Administrator role required';
  END IF;

  UPDATE public.profiles
  SET hwid = NULL
  WHERE uid = target_uid;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_remove_user_sub(target_uid INT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF NOT public.check_is_admin() THEN
    RAISE EXCEPTION 'Access Denied: Administrator role required';
  END IF;

  UPDATE public.profiles
  SET active_sub = 'Free', sub_expiry = NULL
  WHERE uid = target_uid;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_delete_user(target_uid INT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF NOT public.check_is_admin() THEN
    RAISE EXCEPTION 'Access Denied: Administrator role required';
  END IF;

  DELETE FROM public.profiles
  WHERE uid = target_uid AND role <> 'admin';
END;
$$;
