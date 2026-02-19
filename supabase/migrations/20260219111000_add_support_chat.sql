-- Support chat with anonymous/auth users using auth.uid() + RLS + Realtime.

-- If this migration is re-run during local resets, recreate the schema deterministically.
DROP TABLE IF EXISTS public.support_messages CASCADE;
DROP TABLE IF EXISTS public.support_threads CASCADE;

CREATE TABLE public.support_threads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  visitor_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  visitor_name TEXT,
  visitor_email TEXT,
  visitor_phone TEXT,
  assigned_staff_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'open',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_message_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT support_threads_status_check CHECK (status IN ('open', 'closed'))
);

CREATE INDEX support_threads_visitor_id_idx
  ON public.support_threads(visitor_id);

CREATE INDEX support_threads_status_last_message_idx
  ON public.support_threads(status, last_message_at DESC);

CREATE TABLE public.support_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id UUID NOT NULL REFERENCES public.support_threads(id) ON DELETE CASCADE,
  sender_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  sender_type TEXT NOT NULL,
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT support_messages_sender_type_check CHECK (sender_type IN ('visitor', 'staff')),
  CONSTRAINT support_messages_body_len_check CHECK (char_length(body) BETWEEN 1 AND 2000)
);

CREATE INDEX support_messages_thread_created_idx
  ON public.support_messages(thread_id, created_at DESC);

CREATE OR REPLACE FUNCTION public.touch_support_thread_on_message()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.support_threads
  SET updated_at = now(),
      last_message_at = NEW.created_at
  WHERE id = NEW.thread_id;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_touch_support_thread_on_message ON public.support_messages;
CREATE TRIGGER trg_touch_support_thread_on_message
AFTER INSERT ON public.support_messages
FOR EACH ROW
EXECUTE FUNCTION public.touch_support_thread_on_message();

CREATE OR REPLACE FUNCTION public.set_support_thread_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  IF NEW.last_message_at IS NULL THEN
    NEW.last_message_at = now();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_support_thread_updated_at ON public.support_threads;
CREATE TRIGGER trg_set_support_thread_updated_at
BEFORE UPDATE ON public.support_threads
FOR EACH ROW
EXECUTE FUNCTION public.set_support_thread_updated_at();

ALTER TABLE public.support_threads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own support threads" ON public.support_threads;
DROP POLICY IF EXISTS "Users can create own support threads" ON public.support_threads;
DROP POLICY IF EXISTS "Users and staff can update support threads" ON public.support_threads;
DROP POLICY IF EXISTS "Users and staff can read support messages" ON public.support_messages;
DROP POLICY IF EXISTS "Users and staff can send support messages" ON public.support_messages;

CREATE POLICY "Users can view own support threads"
ON public.support_threads
FOR SELECT
TO authenticated
USING (
  visitor_id = auth.uid()
  OR public.has_role(auth.uid(), 'admin'::public.app_role)
  OR public.has_role(auth.uid(), 'moderator'::public.app_role)
);

CREATE POLICY "Users can create own support threads"
ON public.support_threads
FOR INSERT
TO authenticated
WITH CHECK (
  visitor_id = auth.uid()
  OR public.has_role(auth.uid(), 'admin'::public.app_role)
  OR public.has_role(auth.uid(), 'moderator'::public.app_role)
);

CREATE POLICY "Users and staff can update support threads"
ON public.support_threads
FOR UPDATE
TO authenticated
USING (
  visitor_id = auth.uid()
  OR public.has_role(auth.uid(), 'admin'::public.app_role)
  OR public.has_role(auth.uid(), 'moderator'::public.app_role)
)
WITH CHECK (
  visitor_id = auth.uid()
  OR public.has_role(auth.uid(), 'admin'::public.app_role)
  OR public.has_role(auth.uid(), 'moderator'::public.app_role)
);

CREATE POLICY "Users and staff can read support messages"
ON public.support_messages
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.support_threads st
    WHERE st.id = support_messages.thread_id
      AND (
        st.visitor_id = auth.uid()
        OR public.has_role(auth.uid(), 'admin'::public.app_role)
        OR public.has_role(auth.uid(), 'moderator'::public.app_role)
      )
  )
);

CREATE POLICY "Users and staff can send support messages"
ON public.support_messages
FOR INSERT
TO authenticated
WITH CHECK (
  sender_user_id = auth.uid()
  AND (
    (
      sender_type = 'visitor'
      AND EXISTS (
        SELECT 1
        FROM public.support_threads st
        WHERE st.id = support_messages.thread_id
          AND st.visitor_id = auth.uid()
          AND st.status = 'open'
      )
    )
    OR
    (
      sender_type = 'staff'
      AND EXISTS (
        SELECT 1
        FROM public.support_threads st
        WHERE st.id = support_messages.thread_id
          AND st.status = 'open'
          AND (
            public.has_role(auth.uid(), 'admin'::public.app_role)
            OR public.has_role(auth.uid(), 'moderator'::public.app_role)
          )
      )
    )
  )
);

-- Keep old RPCs removed so client doesn't depend on schema cache functions.
DROP FUNCTION IF EXISTS public.create_support_thread_and_message(TEXT, TEXT, TEXT, TEXT, UUID);
DROP FUNCTION IF EXISTS public.get_support_thread_messages(UUID, UUID);
DROP FUNCTION IF EXISTS public.send_support_message_from_visitor(UUID, UUID, TEXT, TEXT);

-- Ensure Postgres Changes can stream these tables.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'support_threads'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.support_threads;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'support_messages'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.support_messages;
  END IF;
END
$$;
