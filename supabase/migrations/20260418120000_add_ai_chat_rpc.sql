-- Add simplified RPC for the AI chat widget (no email/phone required from visitor).
-- The widget creates an anonymous thread; the Python AI agent responds to all open threads.

CREATE OR REPLACE FUNCTION public.create_ai_chat_thread(
  p_message TEXT,
  p_visitor_token UUID DEFAULT NULL
)
RETURNS TABLE (thread_id UUID, visitor_token UUID)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_thread_id     UUID;
  v_visitor_token UUID;
  v_message       TEXT;
  v_lead_id       UUID;
BEGIN
  v_message := trim(COALESCE(p_message, ''));

  IF v_message = '' THEN
    RAISE EXCEPTION 'Mensaje requerido';
  END IF;

  v_visitor_token := COALESCE(p_visitor_token, gen_random_uuid());

  INSERT INTO public.support_leads (full_name, email, phone, source)
  VALUES ('Visitante', 'anon@fichas.uy', '000', 'ai_widget')
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
    'Visitante',
    'anon@fichas.uy',
    '000',
    'open'
  )
  RETURNING id INTO v_thread_id;

  INSERT INTO public.support_messages (thread_id, sender_type, sender_user_id, sender_name, body)
  VALUES (v_thread_id, 'visitor', NULL, 'Visitante', v_message);

  RETURN QUERY SELECT v_thread_id, v_visitor_token;
END;
$$;

REVOKE ALL ON FUNCTION public.create_ai_chat_thread(TEXT, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_ai_chat_thread(TEXT, UUID) TO anon, authenticated;
