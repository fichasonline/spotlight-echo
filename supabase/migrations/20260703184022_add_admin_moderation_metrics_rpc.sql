-- Monthly moderation metrics for the admin dashboard.
-- Reads auth.users only inside a staff-gated SECURITY DEFINER RPC.

CREATE OR REPLACE FUNCTION public.get_admin_moderation_monthly_metrics(
  p_months INTEGER DEFAULT 12
)
RETURNS TABLE (
  month_start DATE,
  month_end DATE,
  support_threads_count BIGINT,
  auth_users_count BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_staff BOOLEAN;
  v_months INTEGER;
  v_start_month DATE;
BEGIN
  v_is_staff := (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'moderator'::public.app_role)
  );

  IF v_is_staff IS NOT TRUE THEN
    RAISE EXCEPTION 'No autorizado';
  END IF;

  v_months := LEAST(GREATEST(COALESCE(p_months, 12), 1), 36);
  v_start_month := (date_trunc('month', now()) - ((v_months - 1) * INTERVAL '1 month'))::DATE;

  RETURN QUERY
  WITH months AS (
    SELECT generate_series(
      v_start_month::TIMESTAMPTZ,
      date_trunc('month', now()),
      INTERVAL '1 month'
    )::DATE AS month_start
  ),
  support_threads_by_month AS (
    SELECT
      date_trunc('month', st.created_at)::DATE AS month_start,
      count(*)::BIGINT AS total
    FROM public.support_threads st
    WHERE st.created_at >= v_start_month::TIMESTAMPTZ
    GROUP BY 1
  ),
  auth_users_by_month AS (
    SELECT
      date_trunc('month', au.created_at)::DATE AS month_start,
      count(*)::BIGINT AS total
    FROM auth.users au
    WHERE au.created_at >= v_start_month::TIMESTAMPTZ
    GROUP BY 1
  )
  SELECT
    m.month_start,
    (m.month_start + INTERVAL '1 month' - INTERVAL '1 day')::DATE AS month_end,
    COALESCE(st.total, 0)::BIGINT AS support_threads_count,
    COALESCE(au.total, 0)::BIGINT AS auth_users_count
  FROM months m
  LEFT JOIN support_threads_by_month st ON st.month_start = m.month_start
  LEFT JOIN auth_users_by_month au ON au.month_start = m.month_start
  ORDER BY m.month_start DESC;
END;
$$;

REVOKE ALL ON FUNCTION public.get_admin_moderation_monthly_metrics(INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_admin_moderation_monthly_metrics(INTEGER) TO authenticated;
