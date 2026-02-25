
CREATE OR REPLACE FUNCTION public.get_leaderboard(
  p_scope text,
  p_session_id uuid DEFAULT NULL,
  p_group_id uuid DEFAULT NULL,
  p_level_id uuid DEFAULT NULL,
  p_age_group_id uuid DEFAULT NULL,
  p_period text DEFAULT 'all_time',
  p_limit int DEFAULT 50,
  p_offset int DEFAULT 0
)
RETURNS TABLE (
  student_id uuid,
  student_name text,
  student_name_ar text,
  avatar_url text,
  sum_total_score numeric,
  sum_max_total_score numeric,
  percentage numeric,
  rank bigint,
  sessions_count bigint,
  group_name text,
  group_name_ar text,
  level_name text,
  level_name_ar text,
  total_count bigint
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_id uuid;
  v_is_admin boolean;
  v_is_instructor boolean;
  v_is_student boolean;
BEGIN
  v_caller_id := auth.uid();
  IF v_caller_id IS NULL THEN RETURN; END IF;

  v_is_admin := has_role(v_caller_id, 'admin'::app_role);
  v_is_instructor := has_role(v_caller_id, 'instructor'::app_role);
  v_is_student := has_role(v_caller_id, 'student'::app_role);

  -- Parameter validation
  IF p_scope = 'session' AND p_session_id IS NULL THEN RETURN; END IF;
  IF p_scope = 'group' AND p_group_id IS NULL THEN RETURN; END IF;
  IF p_scope = 'level' AND p_level_id IS NULL THEN RETURN; END IF;
  IF p_scope = 'age_group' AND p_age_group_id IS NULL THEN RETURN; END IF;
  IF p_scope = 'level_age_group' AND (p_level_id IS NULL OR p_age_group_id IS NULL) THEN RETURN; END IF;

  -- Role-based access: non-admin can only use group scope
  IF NOT v_is_admin THEN
    IF p_scope != 'group' THEN RETURN; END IF;
    IF p_group_id IS NULL THEN RETURN; END IF;

    -- Instructor: must own the group
    IF v_is_instructor AND NOT EXISTS (
      SELECT 1 FROM groups g WHERE g.id = p_group_id AND g.instructor_id = v_caller_id
    ) THEN RETURN; END IF;

    -- Student: must be active member
    IF v_is_student AND NOT v_is_instructor AND NOT EXISTS (
      SELECT 1 FROM group_students gs WHERE gs.group_id = p_group_id AND gs.student_id = v_caller_id AND gs.is_active = true
    ) THEN RETURN; END IF;

    -- If neither instructor nor student, deny
    IF NOT v_is_instructor AND NOT v_is_student THEN RETURN; END IF;
  END IF;

  RETURN QUERY
  WITH filtered_evals AS (
    SELECT
      se.student_id,
      se.session_id,
      se.total_score,
      se.max_total_score,
      s.group_id
    FROM session_evaluations se
    JOIN sessions s ON s.id = se.session_id
    JOIN groups g ON g.id = s.group_id
    WHERE
      -- Scope filtering
      CASE p_scope
        WHEN 'session' THEN se.session_id = p_session_id
        WHEN 'group' THEN s.group_id = p_group_id
        WHEN 'level_age_group' THEN g.level_id = p_level_id AND g.age_group_id = p_age_group_id
        WHEN 'level' THEN g.level_id = p_level_id
        WHEN 'age_group' THEN g.age_group_id = p_age_group_id
        WHEN 'all' THEN true
        ELSE false
      END
      -- Period filtering on session_date
      AND CASE p_period
        WHEN 'monthly' THEN s.session_date >= date_trunc('month', CURRENT_DATE)
        WHEN 'weekly' THEN s.session_date >= date_trunc('week', CURRENT_DATE)
        WHEN 'all_time' THEN true
        ELSE true
      END
  ),
  aggregated AS (
    SELECT
      fe.student_id,
      SUM(fe.total_score) AS agg_total_score,
      SUM(fe.max_total_score) AS agg_max_total_score,
      ROUND(SUM(fe.total_score) / NULLIF(SUM(fe.max_total_score), 0) * 100, 1) AS agg_percentage,
      COUNT(DISTINCT fe.session_id) AS agg_sessions_count,
      -- Pick most recent group for display
      (ARRAY_AGG(fe.group_id ORDER BY fe.session_id DESC))[1] AS latest_group_id
    FROM filtered_evals fe
    GROUP BY fe.student_id
  ),
  ranked AS (
    SELECT
      a.*,
      DENSE_RANK() OVER (
        ORDER BY a.agg_percentage DESC, a.agg_sessions_count DESC, a.agg_total_score DESC,
        COALESCE(p.full_name, '') ASC
      ) AS computed_rank,
      p.full_name,
      COALESCE(p.full_name_ar, p.full_name) AS full_name_ar,
      p.avatar_url AS p_avatar_url,
      g.name AS g_name,
      COALESCE(g.name_ar, g.name) AS g_name_ar,
      l.name AS l_name,
      COALESCE(l.name_ar, l.name) AS l_name_ar,
      COUNT(*) OVER() AS cnt
    FROM aggregated a
    JOIN profiles p ON p.user_id = a.student_id
    LEFT JOIN groups g ON g.id = a.latest_group_id
    LEFT JOIN levels l ON l.id = g.level_id
  )
  SELECT
    r.student_id,
    r.full_name,
    r.full_name_ar,
    r.p_avatar_url,
    r.agg_total_score,
    r.agg_max_total_score,
    r.agg_percentage,
    r.computed_rank,
    r.agg_sessions_count,
    r.g_name,
    r.g_name_ar,
    r.l_name,
    r.l_name_ar,
    r.cnt
  FROM ranked r
  ORDER BY r.computed_rank, r.full_name
  LIMIT p_limit OFFSET p_offset;
END;
$$;
