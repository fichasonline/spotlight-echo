-- Allow the support chat webhook to persist an automated staff reply for
-- the visitor's own open thread without exposing direct table writes.

CREATE OR REPLACE FUNCTION public.send_support_message_from_automation(
  p_thread_id UUID,
  p_visitor_token UUID,
  p_message TEXT,
  p_sender_name TEXT DEFAULT 'Fichas Online'
)
RETURNS TABLE (
  id UUID,
  created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_thread public.support_threads%ROWTYPE;
  v_body TEXT;
  v_sender_name TEXT;
  v_message_id UUID;
  v_created_at TIMESTAMPTZ;
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
    v_sender_name := 'Fichas Online';
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
    'staff',
    NULL,
    v_sender_name,
    v_body
  )
  RETURNING support_messages.id, support_messages.created_at
  INTO v_message_id, v_created_at;

  RETURN QUERY
  SELECT v_message_id, v_created_at;
END;
$$;

REVOKE ALL ON FUNCTION public.send_support_message_from_automation(UUID, UUID, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.send_support_message_from_automation(UUID, UUID, TEXT, TEXT) TO anon, authenticated;
