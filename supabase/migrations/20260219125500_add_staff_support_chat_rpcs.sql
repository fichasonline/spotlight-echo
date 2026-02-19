-- Staff RPCs for support chat management (admin/moderator).

CREATE OR REPLACE FUNCTION public.list_support_threads_for_staff(
  p_status TEXT DEFAULT 'open',
  p_limit INTEGER DEFAULT 100
)
RETURNS TABLE (
  id UUID,
  visitor_name TEXT,
  visitor_email TEXT,
  visitor_phone TEXT,
  status TEXT,
  created_at TIMESTAMPTZ,
  last_message_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_staff BOOLEAN;
  v_limit INTEGER;
BEGIN
  v_is_staff := (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'moderator'::public.app_role)
  );

  IF v_is_staff IS NOT TRUE THEN
    RAISE EXCEPTION 'No autorizado';
  END IF;

  v_limit := LEAST(GREATEST(COALESCE(p_limit, 100), 1), 500);

  RETURN QUERY
  SELECT
    st.id,
    st.visitor_name,
    st.visitor_email,
    st.visitor_phone,
    st.status,
    st.created_at,
    st.last_message_at
  FROM public.support_threads st
  WHERE COALESCE(p_status, 'all') = 'all'
     OR st.status = p_status
  ORDER BY st.last_message_at DESC
  LIMIT v_limit;
END;
$$;

CREATE OR REPLACE FUNCTION public.list_support_messages_for_staff(
  p_thread_id UUID
)
RETURNS TABLE (
  id UUID,
  thread_id UUID,
  sender_type TEXT,
  sender_name TEXT,
  body TEXT,
  created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_staff BOOLEAN;
BEGIN
  v_is_staff := (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'moderator'::public.app_role)
  );

  IF v_is_staff IS NOT TRUE THEN
    RAISE EXCEPTION 'No autorizado';
  END IF;

  RETURN QUERY
  SELECT
    m.id,
    m.thread_id,
    m.sender_type,
    m.sender_name,
    m.body,
    m.created_at
  FROM public.support_messages m
  WHERE m.thread_id = p_thread_id
  ORDER BY m.created_at ASC;
END;
$$;

CREATE OR REPLACE FUNCTION public.send_support_message_from_staff(
  p_thread_id UUID,
  p_message TEXT,
  p_sender_name TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_staff BOOLEAN;
  v_message_id UUID;
  v_body TEXT;
  v_sender_name TEXT;
  v_thread_status TEXT;
BEGIN
  v_is_staff := (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'moderator'::public.app_role)
  );

  IF v_is_staff IS NOT TRUE THEN
    RAISE EXCEPTION 'No autorizado';
  END IF;

  v_body := trim(COALESCE(p_message, ''));
  IF v_body = '' THEN
    RAISE EXCEPTION 'Mensaje requerido';
  END IF;

  SELECT st.status
  INTO v_thread_status
  FROM public.support_threads st
  WHERE st.id = p_thread_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Conversacion no encontrada';
  END IF;

  IF v_thread_status <> 'open' THEN
    RAISE EXCEPTION 'Conversacion cerrada';
  END IF;

  v_sender_name := trim(COALESCE(p_sender_name, ''));
  IF v_sender_name = '' THEN
    SELECT COALESCE(p.display_name, 'Staff')
    INTO v_sender_name
    FROM public.profiles p
    WHERE p.id = auth.uid();

    v_sender_name := COALESCE(v_sender_name, 'Staff');
  END IF;

  INSERT INTO public.support_messages (
    thread_id,
    sender_type,
    sender_user_id,
    sender_name,
    body
  )
  VALUES (
    p_thread_id,
    'staff',
    auth.uid(),
    v_sender_name,
    v_body
  )
  RETURNING id INTO v_message_id;

  RETURN v_message_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.set_support_thread_status_for_staff(
  p_thread_id UUID,
  p_status TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_staff BOOLEAN;
BEGIN
  v_is_staff := (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'moderator'::public.app_role)
  );

  IF v_is_staff IS NOT TRUE THEN
    RAISE EXCEPTION 'No autorizado';
  END IF;

  IF p_status NOT IN ('open', 'closed') THEN
    RAISE EXCEPTION 'Estado invalido';
  END IF;

  UPDATE public.support_threads st
  SET status = p_status
  WHERE st.id = p_thread_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Conversacion no encontrada';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.list_support_threads_for_staff(TEXT, INTEGER) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.list_support_messages_for_staff(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.send_support_message_from_staff(UUID, TEXT, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.set_support_thread_status_for_staff(UUID, TEXT) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.list_support_threads_for_staff(TEXT, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION public.list_support_messages_for_staff(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.send_support_message_from_staff(UUID, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_support_thread_status_for_staff(UUID, TEXT) TO authenticated;
