-- Prevent duplicate support leads when visitors start multiple chat threads.
-- Matching strategy: first by email (case-insensitive), then by full name (case-insensitive).

CREATE INDEX IF NOT EXISTS support_leads_email_ci_idx
  ON public.support_leads (lower(trim(email)));

CREATE INDEX IF NOT EXISTS support_leads_full_name_ci_idx
  ON public.support_leads (lower(trim(full_name)));

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
  v_name_key TEXT;
  v_matched_by_email BOOLEAN := FALSE;
BEGIN
  v_name := trim(COALESCE(p_name, ''));
  v_email := lower(trim(COALESCE(p_email, '')));
  v_phone := trim(COALESCE(p_phone, ''));
  v_message := trim(COALESCE(p_message, ''));
  v_name_key := lower(v_name);

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

  -- Serialize lead matching/creation for the same identity and avoid race-condition duplicates.
  PERFORM pg_advisory_xact_lock(hashtextextended('support_lead:' || v_email || '|' || v_name_key, 0));

  -- Prefer matching by email.
  SELECT sl.id
  INTO v_lead_id
  FROM public.support_leads sl
  WHERE lower(trim(sl.email)) = v_email
  ORDER BY sl.created_at ASC
  LIMIT 1;

  IF FOUND THEN
    v_matched_by_email := TRUE;
  ELSE
    -- Fallback match by full name.
    SELECT sl.id
    INTO v_lead_id
    FROM public.support_leads sl
    WHERE lower(trim(sl.full_name)) = v_name_key
    ORDER BY sl.created_at ASC
    LIMIT 1;
  END IF;

  IF v_lead_id IS NULL THEN
    INSERT INTO public.support_leads (full_name, email, phone, source)
    VALUES (v_name, v_email, v_phone, 'chat_widget')
    RETURNING id INTO v_lead_id;
  ELSIF v_matched_by_email THEN
    -- Keep lead contact data updated when email identifies the same person.
    UPDATE public.support_leads sl
    SET
      full_name = v_name,
      phone = v_phone,
      source = 'chat_widget'
    WHERE sl.id = v_lead_id
      AND (
        sl.full_name IS DISTINCT FROM v_name
        OR sl.phone IS DISTINCT FROM v_phone
        OR sl.source IS DISTINCT FROM 'chat_widget'
      );
  END IF;

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
