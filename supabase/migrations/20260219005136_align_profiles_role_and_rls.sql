-- Add role directly on profiles to support simple role checks from frontend
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'user';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'profiles_role_check'
  ) THEN
    ALTER TABLE public.profiles
    ADD CONSTRAINT profiles_role_check
    CHECK (role IN ('admin', 'moderator', 'user'));
  END IF;
END
$$;

-- Backfill role from user_roles if that table exists
DO $$
BEGIN
  IF to_regclass('public.user_roles') IS NOT NULL THEN
    UPDATE public.profiles p
    SET role = src.role_text
    FROM (
      SELECT
        ur.user_id,
        (
          ARRAY_AGG(
            ur.role::text
            ORDER BY CASE ur.role
              WHEN 'admin' THEN 1
              WHEN 'moderator' THEN 2
              ELSE 3
            END
          )
        )[1] AS role_text
      FROM public.user_roles ur
      GROUP BY ur.user_id
    ) src
    WHERE p.id = src.user_id;
  END IF;
END
$$;

-- Keep has_role available but make it aware of profiles.role
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    EXISTS (
      SELECT 1
      FROM public.profiles
      WHERE id = _user_id
        AND role = _role::text
    )
    OR EXISTS (
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
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id = _user_id
      AND role = 'admin'
  )
$$;

-- Update signup trigger function so default role is persisted in profiles
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, username, display_name, avatar_url, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'username', split_part(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1)),
    NEW.raw_user_meta_data->>'avatar_url',
    'user'
  )
  ON CONFLICT (id) DO NOTHING;

  -- Backwards compatibility for existing installs that still read user_roles
  IF to_regclass('public.user_roles') IS NOT NULL THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'user')
    ON CONFLICT (user_id, role) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;

-- User roles policies (optional table, but keep admin management consistent)
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
USING (public.is_admin(auth.uid()));

-- Events: public read, admin write
DROP POLICY IF EXISTS "Anyone can view events" ON public.events;
DROP POLICY IF EXISTS "Admins can insert events" ON public.events;
DROP POLICY IF EXISTS "Admins can update events" ON public.events;
DROP POLICY IF EXISTS "Admins can delete events" ON public.events;

CREATE POLICY "Anyone can view events"
ON public.events
FOR SELECT
USING (true);

CREATE POLICY "Admins can insert events"
ON public.events
FOR INSERT
TO authenticated
WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "Admins can update events"
ON public.events
FOR UPDATE
TO authenticated
USING (public.is_admin(auth.uid()));

CREATE POLICY "Admins can delete events"
ON public.events
FOR DELETE
TO authenticated
USING (public.is_admin(auth.uid()));

-- Articles: public read published, admin write
DROP POLICY IF EXISTS "Anyone can view published articles" ON public.articles;
DROP POLICY IF EXISTS "Admins can insert articles" ON public.articles;
DROP POLICY IF EXISTS "Admins can update articles" ON public.articles;
DROP POLICY IF EXISTS "Admins can delete articles" ON public.articles;

CREATE POLICY "Anyone can view published articles"
ON public.articles
FOR SELECT
USING (status = 'published' OR public.is_admin(auth.uid()));

CREATE POLICY "Admins can insert articles"
ON public.articles
FOR INSERT
TO authenticated
WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "Admins can update articles"
ON public.articles
FOR UPDATE
TO authenticated
USING (public.is_admin(auth.uid()));

CREATE POLICY "Admins can delete articles"
ON public.articles
FOR DELETE
TO authenticated
USING (public.is_admin(auth.uid()));

-- Posts: authenticated read/create, owner delete
DROP POLICY IF EXISTS "Anyone can view posts" ON public.posts;
DROP POLICY IF EXISTS "Authenticated can create posts" ON public.posts;
DROP POLICY IF EXISTS "Owner can update posts" ON public.posts;
DROP POLICY IF EXISTS "Owner can delete posts" ON public.posts;

CREATE POLICY "Authenticated can view posts"
ON public.posts
FOR SELECT
TO authenticated
USING (
  (is_hidden = false AND is_deleted = false)
  OR public.is_admin(auth.uid())
);

CREATE POLICY "Authenticated can create posts"
ON public.posts
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = author_id);

CREATE POLICY "Owner can update posts"
ON public.posts
FOR UPDATE
TO authenticated
USING (auth.uid() = author_id OR public.is_admin(auth.uid()));

CREATE POLICY "Owner can delete posts"
ON public.posts
FOR DELETE
TO authenticated
USING (auth.uid() = author_id);

-- Comments: authenticated read/create, owner delete
DROP POLICY IF EXISTS "Anyone can view comments" ON public.comments;
DROP POLICY IF EXISTS "Authenticated can create comments" ON public.comments;
DROP POLICY IF EXISTS "Owner can update comments" ON public.comments;
DROP POLICY IF EXISTS "Owner can delete comments" ON public.comments;

CREATE POLICY "Authenticated can view comments"
ON public.comments
FOR SELECT
TO authenticated
USING (is_deleted = false OR public.is_admin(auth.uid()));

CREATE POLICY "Authenticated can create comments"
ON public.comments
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = author_id);

CREATE POLICY "Owner can update comments"
ON public.comments
FOR UPDATE
TO authenticated
USING (auth.uid() = author_id OR public.is_admin(auth.uid()));

CREATE POLICY "Owner can delete comments"
ON public.comments
FOR DELETE
TO authenticated
USING (auth.uid() = author_id);

-- Likes: authenticated read/create/delete own
DROP POLICY IF EXISTS "Anyone can view likes" ON public.post_likes;
DROP POLICY IF EXISTS "Authenticated can like" ON public.post_likes;
DROP POLICY IF EXISTS "Users can unlike" ON public.post_likes;

CREATE POLICY "Authenticated can view likes"
ON public.post_likes
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Authenticated can like"
ON public.post_likes
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can unlike"
ON public.post_likes
FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

-- Reports: authenticated insert, only admins read/update
DROP POLICY IF EXISTS "Authenticated can create reports" ON public.reports;
DROP POLICY IF EXISTS "Admins can view reports" ON public.reports;
DROP POLICY IF EXISTS "Admins can update reports" ON public.reports;

CREATE POLICY "Authenticated can create reports"
ON public.reports
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = reporter_id);

CREATE POLICY "Admins can view reports"
ON public.reports
FOR SELECT
TO authenticated
USING (public.is_admin(auth.uid()));

CREATE POLICY "Admins can update reports"
ON public.reports
FOR UPDATE
TO authenticated
USING (public.is_admin(auth.uid()));
