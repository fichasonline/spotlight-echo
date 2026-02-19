-- Repair schema/data drift that breaks feed read/write.

-- Feed flags required by policies and queries.
ALTER TABLE IF EXISTS public.posts
  ADD COLUMN IF NOT EXISTS is_hidden BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE IF EXISTS public.posts
  ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN NOT NULL DEFAULT false;

-- Ensure role primitives exist.
DO $$
BEGIN
  IF to_regtype('public.app_role') IS NULL THEN
    CREATE TYPE public.app_role AS ENUM ('admin', 'moderator', 'user');
  END IF;
END
$$;

CREATE TABLE IF NOT EXISTS public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  UNIQUE (user_id, role)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Canonical role helpers.
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

CREATE OR REPLACE FUNCTION public.is_admin(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.has_role(_user_id, 'admin'::public.app_role)
$$;

-- Keep signup flow creating profile + default role.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, username, display_name, avatar_url)
  VALUES (
    NEW.id,
    COALESCE(
      NULLIF(NEW.raw_user_meta_data->>'username', ''),
      NULLIF(split_part(COALESCE(NEW.email, ''), '@', 1), ''),
      'user'
    ),
    COALESCE(
      NULLIF(NEW.raw_user_meta_data->>'display_name', ''),
      NULLIF(split_part(COALESCE(NEW.email, ''), '@', 1), ''),
      'user'
    ),
    NEW.raw_user_meta_data->>'avatar_url'
  )
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'user')
  ON CONFLICT (user_id, role) DO NOTHING;

  RETURN NEW;
END;
$$;

DO $$
BEGIN
  IF to_regclass('auth.users') IS NOT NULL
     AND NOT EXISTS (
       SELECT 1
       FROM pg_trigger
       WHERE tgname = 'on_auth_user_created'
         AND tgrelid = 'auth.users'::regclass
         AND NOT tgisinternal
     ) THEN
    CREATE TRIGGER on_auth_user_created
      AFTER INSERT ON auth.users
      FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
  END IF;
END
$$;

-- Backfill profiles for existing auth users created before trigger or failed inserts.
INSERT INTO public.profiles (id, username, display_name, avatar_url)
SELECT
  u.id,
  COALESCE(
    NULLIF(u.raw_user_meta_data->>'username', ''),
    NULLIF(split_part(COALESCE(u.email, ''), '@', 1), ''),
    'user'
  ),
  COALESCE(
    NULLIF(u.raw_user_meta_data->>'display_name', ''),
    NULLIF(split_part(COALESCE(u.email, ''), '@', 1), ''),
    'user'
  ),
  u.raw_user_meta_data->>'avatar_url'
FROM auth.users u
LEFT JOIN public.profiles p ON p.id = u.id
WHERE p.id IS NULL;

-- Ensure at least one role for each profile.
INSERT INTO public.user_roles (user_id, role)
SELECT p.id, 'user'::public.app_role
FROM public.profiles p
WHERE NOT EXISTS (
  SELECT 1
  FROM public.user_roles ur
  WHERE ur.user_id = p.id
)
ON CONFLICT (user_id, role) DO NOTHING;

-- Keep role table policies aligned.
DROP POLICY IF EXISTS "Users can view own roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can manage roles" ON public.user_roles;

CREATE POLICY "Users can view own roles"
ON public.user_roles
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Admins can manage roles"
ON public.user_roles
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));
