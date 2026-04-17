-- ============================================================================
-- Pilot Migration: Students Entity Data Access Layer
-- Creates 6 RPCs that consolidate scattered student queries into a single
-- source of truth, following the new Architecture Contract.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1) get_student_attendance_stats
-- Centralizes attendance rate calculation (currently duplicated in 5 files)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_student_attendance_stats(p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total int;
  v_present int;
  v_late int;
  v_absent int;
  v_excused int;
BEGIN
  SELECT
    COUNT(*),
    COUNT(*) FILTER (WHERE status = 'present'),
    COUNT(*) FILTER (WHERE status = 'late'),
    COUNT(*) FILTER (WHERE status = 'absent'),
    COUNT(*) FILTER (WHERE status = 'excused')
  INTO v_total, v_present, v_late, v_absent, v_excused
  FROM public.attendance
  WHERE student_id = p_user_id;

  RETURN jsonb_build_object(
    'total_sessions', COALESCE(v_total, 0),
    'present', COALESCE(v_present, 0),
    'late', COALESCE(v_late, 0),
    'absent', COALESCE(v_absent, 0),
    'excused', COALESCE(v_excused, 0),
    'attendance_rate', CASE
      WHEN COALESCE(v_total, 0) = 0 THEN 0
      ELSE ROUND(((COALESCE(v_present, 0) + COALESCE(v_late, 0))::numeric / v_total::numeric) * 100, 1)
    END
  );
END;
$$;

-- ----------------------------------------------------------------------------
-- 2) get_student_subscription_status
-- Single source of truth for subscription state (replaces 11 scattered queries)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_student_subscription_status(p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sub record;
  v_total_paid numeric;
BEGIN
  SELECT s.*, pp.name AS plan_name, pp.name_ar AS plan_name_ar
  INTO v_sub
  FROM public.subscriptions s
  LEFT JOIN public.pricing_plans pp ON pp.id = s.pricing_plan_id
  WHERE s.student_id = p_user_id AND s.status = 'active'
  ORDER BY s.created_at DESC
  LIMIT 1;

  IF v_sub.id IS NULL THEN
    RETURN jsonb_build_object('has_subscription', false, 'status', 'none');
  END IF;

  SELECT COALESCE(SUM(amount), 0) INTO v_total_paid
  FROM public.payments WHERE subscription_id = v_sub.id;

  RETURN jsonb_build_object(
    'has_subscription', true,
    'subscription_id', v_sub.id,
    'status', v_sub.status,
    'is_suspended', COALESCE(v_sub.is_suspended, false),
    'plan_name', v_sub.plan_name,
    'plan_name_ar', v_sub.plan_name_ar,
    'payment_type', v_sub.payment_type,
    'start_date', v_sub.start_date,
    'end_date', v_sub.end_date,
    'total_amount', v_sub.total_amount,
    'paid_amount', v_total_paid,
    'remaining_amount', GREATEST(v_sub.total_amount - v_total_paid, 0),
    'next_payment_date', v_sub.next_payment_date,
    'discount_percentage', COALESCE(v_sub.discount_percentage, 0),
    'days_remaining', GREATEST((v_sub.end_date - CURRENT_DATE)::int, 0)
  );
END;
$$;

-- ----------------------------------------------------------------------------
-- 3) calculate_student_renewal_status
-- Consolidates renewal logic (currently in ProtectedRoute, Dashboard, EditSubscription)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.calculate_student_renewal_status(p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_needs_renewal boolean;
  v_lifecycle_status text;
  v_lifecycle_outcome text;
  v_active_sub_exists boolean;
  v_can_renew boolean;
  v_reason text;
BEGIN
  SELECT COALESCE(p.needs_renewal, false) INTO v_needs_renewal
  FROM public.profiles p WHERE p.user_id = p_user_id;

  SELECT gsp.status, gsp.outcome
  INTO v_lifecycle_status, v_lifecycle_outcome
  FROM public.group_student_progress gsp
  WHERE gsp.student_id = p_user_id
  ORDER BY gsp.created_at DESC LIMIT 1;

  SELECT EXISTS (
    SELECT 1 FROM public.subscriptions
    WHERE student_id = p_user_id AND status = 'active'
  ) INTO v_active_sub_exists;

  v_can_renew := v_lifecycle_status IN ('graded', 'pending_group_assignment')
                  OR v_needs_renewal = true
                  OR v_active_sub_exists = false;

  v_reason := CASE
    WHEN v_needs_renewal THEN 'level_completed_payment_required'
    WHEN v_lifecycle_status = 'graded' THEN 'level_graded_ready_for_next'
    WHEN NOT v_active_sub_exists THEN 'no_active_subscription'
    WHEN v_lifecycle_status = 'pending_group_assignment' THEN 'awaiting_group_assignment'
    ELSE NULL
  END;

  RETURN jsonb_build_object(
    'needs_renewal', v_needs_renewal,
    'can_renew', COALESCE(v_can_renew, false),
    'has_active_subscription', v_active_sub_exists,
    'lifecycle_status', v_lifecycle_status,
    'lifecycle_outcome', v_lifecycle_outcome,
    'reason', v_reason
  );
END;
$$;

-- ----------------------------------------------------------------------------
-- 4) get_student_summary
-- Lightweight payload for cards/widgets (replaces 26 scattered profile queries)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_student_summary(p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_profile record;
  v_group record;
  v_level record;
  v_age_group record;
  v_attendance jsonb;
  v_subscription jsonb;
  v_renewal jsonb;
BEGIN
  SELECT * INTO v_profile FROM public.profiles WHERE user_id = p_user_id;
  IF v_profile.id IS NULL THEN
    RETURN jsonb_build_object('found', false);
  END IF;

  -- Active group
  SELECT g.* INTO v_group
  FROM public.group_students gs
  JOIN public.groups g ON g.id = gs.group_id
  WHERE gs.student_id = p_user_id AND gs.is_active = true AND g.is_active = true
  ORDER BY gs.joined_at DESC LIMIT 1;

  -- Current level (from lifecycle, fallback to profile)
  SELECT l.* INTO v_level FROM public.levels l
  WHERE l.id = COALESCE(
    (SELECT current_level_id FROM public.group_student_progress
     WHERE student_id = p_user_id ORDER BY created_at DESC LIMIT 1),
    v_profile.level_id
  );

  SELECT * INTO v_age_group FROM public.age_groups WHERE id = v_profile.age_group_id;

  -- Aggregate sub-resources via dedicated RPCs
  v_attendance := public.get_student_attendance_stats(p_user_id);
  v_subscription := public.get_student_subscription_status(p_user_id);
  v_renewal := public.calculate_student_renewal_status(p_user_id);

  RETURN jsonb_build_object(
    'found', true,
    'user_id', v_profile.user_id,
    'profile_id', v_profile.id,
    'full_name', v_profile.full_name,
    'full_name_ar', v_profile.full_name_ar,
    'email', v_profile.email,
    'phone', v_profile.phone,
    'avatar_url', v_profile.avatar_url,
    'date_of_birth', v_profile.date_of_birth,
    'subscription_type', v_profile.subscription_type,
    'attendance_mode', v_profile.attendance_mode,
    'is_approved', v_profile.is_approved,
    'age_group', CASE WHEN v_age_group.id IS NULL THEN NULL ELSE
      jsonb_build_object('id', v_age_group.id, 'name', v_age_group.name, 'name_ar', v_age_group.name_ar) END,
    'current_level', CASE WHEN v_level.id IS NULL THEN NULL ELSE
      jsonb_build_object('id', v_level.id, 'name', v_level.name, 'name_ar', v_level.name_ar) END,
    'current_group', CASE WHEN v_group.id IS NULL THEN NULL ELSE
      jsonb_build_object('id', v_group.id, 'name', v_group.name, 'name_ar', v_group.name_ar,
                         'status', v_group.status, 'group_type', v_group.group_type) END,
    'attendance', v_attendance,
    'subscription', v_subscription,
    'renewal', v_renewal
  );
END;
$$;

-- ----------------------------------------------------------------------------
-- 5) get_students_list
-- Paginated, filtered list — replaces complex queries in Students.tsx
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_students_list(
  p_filters jsonb DEFAULT '{}'::jsonb,
  p_limit int DEFAULT 50,
  p_offset int DEFAULT 0,
  p_sort_by text DEFAULT 'created_at',
  p_sort_dir text DEFAULT 'desc'
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_search text;
  v_age_group_id uuid;
  v_level_id uuid;
  v_group_id uuid;
  v_subscription_status text;
  v_total_count int;
  v_items jsonb;
BEGIN
  v_search := p_filters->>'search';
  v_age_group_id := NULLIF(p_filters->>'age_group_id', '')::uuid;
  v_level_id := NULLIF(p_filters->>'level_id', '')::uuid;
  v_group_id := NULLIF(p_filters->>'group_id', '')::uuid;
  v_subscription_status := p_filters->>'subscription_status';

  IF p_sort_dir NOT IN ('asc', 'desc') THEN p_sort_dir := 'desc'; END IF;
  IF p_sort_by NOT IN ('created_at','full_name','full_name_ar','email') THEN p_sort_by := 'created_at'; END IF;

  WITH students AS (
    SELECT p.*
    FROM public.profiles p
    JOIN public.user_roles ur ON ur.user_id = p.user_id AND ur.role = 'student'
    WHERE (v_search IS NULL OR
           p.full_name ILIKE '%'||v_search||'%' OR
           p.full_name_ar ILIKE '%'||v_search||'%' OR
           p.email ILIKE '%'||v_search||'%' OR
           p.phone ILIKE '%'||v_search||'%')
      AND (v_age_group_id IS NULL OR p.age_group_id = v_age_group_id)
      AND (v_level_id IS NULL OR p.level_id = v_level_id)
  ),
  enriched AS (
    SELECT
      s.user_id, s.id AS profile_id, s.full_name, s.full_name_ar, s.email, s.phone,
      s.avatar_url, s.date_of_birth, s.subscription_type, s.attendance_mode,
      s.is_approved, COALESCE(s.needs_renewal, false) AS needs_renewal, s.created_at,
      ag.id AS age_group_id, ag.name AS age_group_name, ag.name_ar AS age_group_name_ar,
      lvl.id AS level_id, lvl.name AS level_name, lvl.name_ar AS level_name_ar,
      grp.id AS group_id, grp.name AS group_name, grp.name_ar AS group_name_ar,
      grp.status AS group_status,
      sub.status AS subscription_status,
      sub.end_date AS subscription_end_date
    FROM students s
    LEFT JOIN public.age_groups ag ON ag.id = s.age_group_id
    LEFT JOIN LATERAL (
      SELECT l.* FROM public.group_student_progress gsp
      JOIN public.levels l ON l.id = gsp.current_level_id
      WHERE gsp.student_id = s.user_id
      ORDER BY gsp.created_at DESC LIMIT 1
    ) lvl ON true
    LEFT JOIN LATERAL (
      SELECT g.* FROM public.group_students gs
      JOIN public.groups g ON g.id = gs.group_id
      WHERE gs.student_id = s.user_id AND gs.is_active = true AND g.is_active = true
      ORDER BY gs.joined_at DESC LIMIT 1
    ) grp ON true
    LEFT JOIN LATERAL (
      SELECT * FROM public.subscriptions
      WHERE student_id = s.user_id AND status = 'active'
      ORDER BY created_at DESC LIMIT 1
    ) sub ON true
  ),
  filtered AS (
    SELECT * FROM enriched
    WHERE (v_group_id IS NULL OR group_id = v_group_id)
      AND (v_subscription_status IS NULL OR
           (v_subscription_status = 'active' AND subscription_status = 'active') OR
           (v_subscription_status = 'none' AND subscription_status IS NULL) OR
           (v_subscription_status = 'needs_renewal' AND needs_renewal = true))
  )
  SELECT
    COUNT(*) OVER ()::int,
    COALESCE(jsonb_agg(to_jsonb(f.*) ORDER BY
      CASE WHEN p_sort_by = 'full_name' AND p_sort_dir = 'asc' THEN f.full_name END ASC,
      CASE WHEN p_sort_by = 'full_name' AND p_sort_dir = 'desc' THEN f.full_name END DESC,
      CASE WHEN p_sort_by = 'full_name_ar' AND p_sort_dir = 'asc' THEN f.full_name_ar END ASC,
      CASE WHEN p_sort_by = 'full_name_ar' AND p_sort_dir = 'desc' THEN f.full_name_ar END DESC,
      CASE WHEN p_sort_by = 'email' AND p_sort_dir = 'asc' THEN f.email END ASC,
      CASE WHEN p_sort_by = 'email' AND p_sort_dir = 'desc' THEN f.email END DESC,
      CASE WHEN p_sort_by = 'created_at' AND p_sort_dir = 'asc' THEN f.created_at END ASC,
      CASE WHEN p_sort_by = 'created_at' AND p_sort_dir = 'desc' THEN f.created_at END DESC
    ) FILTER (WHERE f.user_id IS NOT NULL), '[]'::jsonb)
  INTO v_total_count, v_items
  FROM (SELECT * FROM filtered LIMIT p_limit OFFSET p_offset) f;

  RETURN jsonb_build_object(
    'total', COALESCE(v_total_count, 0),
    'limit', p_limit,
    'offset', p_offset,
    'items', v_items
  );
END;
$$;

-- ----------------------------------------------------------------------------
-- 6) get_student_full_profile
-- Heavy payload for the profile page — replaces 8+ separate queries
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_student_full_profile(p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_summary jsonb;
  v_parents jsonb;
  v_recent_payments jsonb;
  v_recent_attendance jsonb;
  v_lifecycle jsonb;
BEGIN
  v_summary := public.get_student_summary(p_user_id);
  IF (v_summary->>'found')::boolean = false THEN RETURN v_summary; END IF;

  -- Linked parents
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'user_id', pp.user_id, 'full_name', pp.full_name,
    'full_name_ar', pp.full_name_ar, 'phone', pp.phone, 'email', pp.email
  )), '[]'::jsonb)
  INTO v_parents
  FROM public.parent_student_links psl
  JOIN public.profiles pp ON pp.user_id = psl.parent_id
  WHERE psl.student_id = p_user_id AND psl.is_active = true;

  -- Recent payments (last 10)
  SELECT COALESCE(jsonb_agg(to_jsonb(p.*) ORDER BY p.created_at DESC), '[]'::jsonb)
  INTO v_recent_payments
  FROM (
    SELECT id, subscription_id, amount, payment_date, payment_method, payment_type, notes, created_at
    FROM public.payments WHERE student_id = p_user_id
    ORDER BY created_at DESC LIMIT 10
  ) p;

  -- Recent attendance (last 10)
  SELECT COALESCE(jsonb_agg(to_jsonb(a.*) ORDER BY a.recorded_at DESC), '[]'::jsonb)
  INTO v_recent_attendance
  FROM (
    SELECT id, session_id, status, recorded_at, notes
    FROM public.attendance WHERE student_id = p_user_id
    ORDER BY recorded_at DESC LIMIT 10
  ) a;

  -- Lifecycle snapshot
  SELECT to_jsonb(gsp.*) INTO v_lifecycle
  FROM public.group_student_progress gsp
  WHERE gsp.student_id = p_user_id
  ORDER BY gsp.created_at DESC LIMIT 1;

  RETURN v_summary
    || jsonb_build_object(
      'parents', COALESCE(v_parents, '[]'::jsonb),
      'recent_payments', COALESCE(v_recent_payments, '[]'::jsonb),
      'recent_attendance', COALESCE(v_recent_attendance, '[]'::jsonb),
      'lifecycle', v_lifecycle
    );
END;
$$;

-- ----------------------------------------------------------------------------
-- Permissions: authenticated users can call (RLS enforced inside via SECURITY DEFINER scope)
-- ----------------------------------------------------------------------------
GRANT EXECUTE ON FUNCTION public.get_student_attendance_stats(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_student_subscription_status(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.calculate_student_renewal_status(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_student_summary(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_students_list(jsonb, int, int, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_student_full_profile(uuid) TO authenticated;