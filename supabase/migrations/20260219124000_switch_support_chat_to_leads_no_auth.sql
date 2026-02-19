-- Switch support chat to lead-based visitor token flow (no anonymous Auth users required).

-- Rebuild support schema to remove dependency on auth anonymous users.
DROP TABLE IF EXISTS public.support_messages CASCADE;
DROP TABLE IF EXISTS public.support_threads CASCADE;
DROP TABLE IF EXISTS public.support_leads CASCADE;

CREATE TABLE public.support_leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT NOT NULL,
  source TEXT NOT NULL DEFAULT 'chat_widget',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT support_leads_email_len_check CHECK (char_length(email) BETWEEN 3 AND 320)
);

CREATE INDEX support_leads_created_at_idx
  ON public.support_leads(created_at DESC);

CREATE TABLE public.support_threads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID NOT NULL REFERENCES public.support_leads(id) ON DELETE CASCADE,
  visitor_token UUID NOT NULL DEFAULT gen_random_uuid(),
  visitor_name TEXT NOT NULL,
  visitor_email TEXT NOT NULL,
  visitor_phone TEXT NOT NULL,
  assigned_staff_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'open',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_message_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT support_threads_status_check CHECK (status IN ('open', 'closed')),
  CONSTRAINT support_threads_email_len_check CHECK (char_length(visitor_email) BETWEEN 3 AND 320)
);

CREATE UNIQUE INDEX support_threads_visitor_token_key
  ON public.support_threads(visitor_token);

CREATE INDEX support_threads_status_last_message_idx
  ON public.support_threads(status, last_message_at DESC);

CREATE TABLE public.support_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id UUID NOT NULL REFERENCES public.support_threads(id) ON DELETE CASCADE,
  sender_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  sender_type TEXT NOT NULL,
  sender_name TEXT,
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

ALTER TABLE public.support_leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_threads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Staff can select support leads" ON public.support_leads;
DROP POLICY IF EXISTS "Staff can update support leads" ON public.support_leads;
DROP POLICY IF EXISTS "Staff can select support threads" ON public.support_threads;
DROP POLICY IF EXISTS "Staff can update support threads" ON public.support_threads;
DROP POLICY IF EXISTS "Staff can insert support threads" ON public.support_threads;
DROP POLICY IF EXISTS "Staff can read support messages" ON public.support_messages;
DROP POLICY IF EXISTS "Staff can send support messages" ON public.support_messages;

CREATE POLICY "Staff can select support leads"
ON public.support_leads
FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::public.app_role)
  OR public.has_role(auth.uid(), 'moderator'::public.app_role)
);

CREATE POLICY "Staff can update support leads"
ON public.support_leads
FOR UPDATE
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::public.app_role)
  OR public.has_role(auth.uid(), 'moderator'::public.app_role)
)
WITH CHECK (
  public.has_role(auth.uid(), 'admin'::public.app_role)
  OR public.has_role(auth.uid(), 'moderator'::public.app_role)
);

CREATE POLICY "Staff can select support threads"
ON public.support_threads
FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::public.app_role)
  OR public.has_role(auth.uid(), 'moderator'::public.app_role)
);

CREATE POLICY "Staff can update support threads"
ON public.support_threads
FOR UPDATE
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::public.app_role)
  OR public.has_role(auth.uid(), 'moderator'::public.app_role)
)
WITH CHECK (
  public.has_role(auth.uid(), 'admin'::public.app_role)
  OR public.has_role(auth.uid(), 'moderator'::public.app_role)
);

CREATE POLICY "Staff can insert support threads"
ON public.support_threads
FOR INSERT
TO authenticated
WITH CHECK (
  public.has_role(auth.uid(), 'admin'::public.app_role)
  OR public.has_role(auth.uid(), 'moderator'::public.app_role)
);

CREATE POLICY "Staff can read support messages"
ON public.support_messages
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.support_threads st
    WHERE st.id = support_messages.thread_id
      AND (
        public.has_role(auth.uid(), 'admin'::public.app_role)
        OR public.has_role(auth.uid(), 'moderator'::public.app_role)
      )
  )
);

CREATE POLICY "Staff can send support messages"
ON public.support_messages
FOR INSERT
TO authenticated
WITH CHECK (
  sender_type = 'staff'
  AND sender_user_id = auth.uid()
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
);

DROP FUNCTION IF EXISTS public.create_support_thread_and_message(TEXT, TEXT, TEXT, TEXT, UUID);
DROP FUNCTION IF EXISTS public.get_support_thread_messages(UUID, UUID);
DROP FUNCTION IF EXISTS public.send_support_message_from_visitor(UUID, UUID, TEXT, TEXT);

CREATE OR REPLACE FUNCTION public.create_support_thread_and_message(
  p_name TEXT,
  p_email TEXT,
  p_phone TEXT,
  p_message TEXT,
  p_visitor_token UUID DEFAULT NULL
)
RETURNS TABLE (thread_id UUID, visitor_token UUID)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_thread_id UUID;
  v_visitor_token UUID;
  v_name TEXT;
  v_email TEXT;
  v_phone TEXT;
  v_message TEXT;
  v_lead_id UUID;
BEGIN
  v_name := trim(COALESCE(p_name, ''));
  v_email := lower(trim(COALESCE(p_email, '')));
  v_phone := trim(COALESCE(p_phone, ''));
  v_message := trim(COALESCE(p_message, ''));

  IF v_name = '' THEN
    RAISE EXCEPTION 'Nombre requerido';
  END IF;

  IF v_email = '' OR position('@' IN v_email) = 0 THEN
    RAISE EXCEPTION 'Email invalido';
  END IF;

  IF v_phone = '' THEN
    RAISE EXCEPTION 'Telefono requerido';
  END IF;

  IF v_message = '' THEN
    RAISE EXCEPTION 'Mensaje requerido';
  END IF;

  v_visitor_token := COALESCE(p_visitor_token, gen_random_uuid());

  INSERT INTO public.support_leads (full_name, email, phone, source)
  VALUES (v_name, v_email, v_phone, 'chat_widget')
  RETURNING id INTO v_lead_id;

  INSERT INTO public.support_threads (
    lead_id,
    visitor_token,
    visitor_name,
    visitor_email,
    visitor_phone,
    status
  )
  VALUES (
    v_lead_id,
    v_visitor_token,
    v_name,
    v_email,
    v_phone,
    'open'
  )
  RETURNING id INTO v_thread_id;

  INSERT INTO public.support_messages (
    thread_id,
    sender_type,
    sender_user_id,
    sender_name,
    body
  )
  VALUES (
    v_thread_id,
    'visitor',
    NULL,
    v_name,
    v_message
  );

  RETURN QUERY SELECT v_thread_id, v_visitor_token;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_support_thread_messages(
  p_thread_id UUID,
  p_visitor_token UUID
)
RETURNS TABLE (
  id UUID,
  sender_type TEXT,
  sender_name TEXT,
  body TEXT,
  created_at TIMESTAMPTZ,
  thread_status TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_thread_status TEXT;
BEGIN
  SELECT status
  INTO v_thread_status
  FROM public.support_threads st
  WHERE st.id = p_thread_id
    AND st.visitor_token = p_visitor_token;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Conversacion no encontrada';
  END IF;

  RETURN QUERY
  SELECT
    m.id,
    m.sender_type,
    m.sender_name,
    m.body,
    m.created_at,
    v_thread_status
  FROM public.support_messages m
  WHERE m.thread_id = p_thread_id
  ORDER BY m.created_at ASC;
END;
$$;

CREATE OR REPLACE FUNCTION public.send_support_message_from_visitor(
  p_thread_id UUID,
  p_visitor_token UUID,
  p_message TEXT,
  p_sender_name TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_thread public.support_threads%ROWTYPE;
  v_sender_name TEXT;
  v_body TEXT;
  v_message_id UUID;
BEGIN
  v_body := trim(COALESCE(p_message, ''));

  IF v_body = '' THEN
    RAISE EXCEPTION 'Mensaje requerido';
  END IF;

  SELECT *
  INTO v_thread
  FROM public.support_threads st
  WHERE st.id = p_thread_id
    AND st.visitor_token = p_visitor_token;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Conversacion no encontrada';
  END IF;

  IF v_thread.status <> 'open' THEN
    RAISE EXCEPTION 'Conversacion cerrada';
  END IF;

  v_sender_name := trim(COALESCE(p_sender_name, ''));
  IF v_sender_name = '' THEN
    v_sender_name := v_thread.visitor_name;
  END IF;

  INSERT INTO public.support_messages (
    thread_id,
    sender_type,
    sender_user_id,
    sender_name,
    body
  )
  VALUES (
    v_thread.id,
    'visitor',
    NULL,
    v_sender_name,
    v_body
  )
  RETURNING id INTO v_message_id;

  RETURN v_message_id;
END;
$$;

REVOKE ALL ON FUNCTION public.create_support_thread_and_message(TEXT, TEXT, TEXT, TEXT, UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_support_thread_messages(UUID, UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.send_support_message_from_visitor(UUID, UUID, TEXT, TEXT) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.create_support_thread_and_message(TEXT, TEXT, TEXT, TEXT, UUID) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_support_thread_messages(UUID, UUID) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.send_support_message_from_visitor(UUID, UUID, TEXT, TEXT) TO anon, authenticated;

-- Ensure staff realtime subscriptions keep working.
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
