-- Fix ambiguous column references in support chat RPCs.

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
  SELECT st.status
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

  SELECT st.*
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
