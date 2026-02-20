
-- 1. Add expected_sessions_count to levels
ALTER TABLE public.levels
ADD COLUMN expected_sessions_count INTEGER NOT NULL DEFAULT 12;

-- 2. Create curriculum_overview_latest view
CREATE OR REPLACE VIEW public.curriculum_overview_latest
WITH (security_invoker = true)
AS
WITH latest_version AS (
  SELECT age_group_id, level_id, MAX(version) AS version
  FROM curriculum_sessions
  WHERE is_active = true
  GROUP BY age_group_id, level_id
)
SELECT
  cs.age_group_id,
  cs.level_id,
  lv.version AS latest_version,
  BOOL_OR(cs.is_published) AS is_published,
  MAX(cs.published_at) AS published_at,
  COUNT(*) AS total_sessions,
  l.expected_sessions_count,
  COUNT(*) FILTER (
    WHERE cs.slides_url IS NOT NULL
    OR cs.summary_video_url IS NOT NULL
    OR cs.full_video_url IS NOT NULL
    OR cs.quiz_id IS NOT NULL
    OR cs.assignment_title IS NOT NULL
  ) AS filled_sessions,
  ROUND(
    COUNT(*) FILTER (
      WHERE cs.slides_url IS NOT NULL
      OR cs.summary_video_url IS NOT NULL
      OR cs.full_video_url IS NOT NULL
      OR cs.quiz_id IS NOT NULL
      OR cs.assignment_title IS NOT NULL
    )::numeric / GREATEST(l.expected_sessions_count, 1) * 100
  ) AS completion_percentage
FROM latest_version lv
JOIN curriculum_sessions cs
  ON cs.age_group_id = lv.age_group_id
  AND cs.level_id = lv.level_id
  AND cs.version = lv.version
  AND cs.is_active = true
JOIN levels l ON l.id = cs.level_id
GROUP BY cs.age_group_id, cs.level_id, lv.version, l.expected_sessions_count;

-- 3. RPC: publish_curriculum
CREATE OR REPLACE FUNCTION public.publish_curriculum(
  p_age_group_id UUID,
  p_level_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_latest_version INTEGER;
  v_session_count INTEGER;
  v_distinct_count INTEGER;
  v_expected INTEGER;
  v_caller_id UUID;
BEGIN
  v_caller_id := auth.uid();

  IF NOT has_role(v_caller_id, 'admin'::app_role) THEN
    RAISE EXCEPTION 'Only admins can publish curriculum';
  END IF;

  PERFORM 1 FROM curriculum_sessions
  WHERE age_group_id = p_age_group_id
    AND level_id = p_level_id
  FOR UPDATE;

  SELECT expected_sessions_count INTO v_expected
  FROM levels WHERE id = p_level_id;

  IF v_expected IS NULL THEN
    RAISE EXCEPTION 'Level not found';
  END IF;

  SELECT MAX(version) INTO v_latest_version
  FROM curriculum_sessions
  WHERE age_group_id = p_age_group_id
    AND level_id = p_level_id
    AND is_active = true;

  IF v_latest_version IS NULL THEN
    RAISE EXCEPTION 'No curriculum found';
  END IF;

  IF EXISTS (
    SELECT 1 FROM curriculum_sessions
    WHERE age_group_id = p_age_group_id
      AND level_id = p_level_id
      AND version = v_latest_version
      AND is_published = true
  ) THEN
    RETURN jsonb_build_object('published', false, 'reason', 'already_published');
  END IF;

  SELECT COUNT(*), COUNT(DISTINCT session_number)
  INTO v_session_count, v_distinct_count
  FROM curriculum_sessions
  WHERE age_group_id = p_age_group_id
    AND level_id = p_level_id
    AND version = v_latest_version
    AND is_active = true;

  IF v_distinct_count != v_expected THEN
    RAISE EXCEPTION 'Cannot publish: expected % distinct sessions, found % (% total rows)',
      v_expected, v_distinct_count, v_session_count;
  END IF;

  UPDATE curriculum_sessions
  SET is_published = false
  WHERE age_group_id = p_age_group_id
    AND level_id = p_level_id
    AND version < v_latest_version
    AND is_published = true;

  UPDATE curriculum_sessions
  SET is_published = true, published_at = now()
  WHERE age_group_id = p_age_group_id
    AND level_id = p_level_id
    AND version = v_latest_version
    AND is_active = true;

  RETURN jsonb_build_object(
    'published', true,
    'version', v_latest_version,
    'session_count', v_distinct_count
  );
END;
$$;

-- 4. RPC: clone_curriculum
CREATE OR REPLACE FUNCTION public.clone_curriculum(
  p_source_age_group_id UUID,
  p_source_level_id UUID,
  p_source_version INTEGER,
  p_target_age_group_id UUID,
  p_target_level_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_caller_id UUID;
  v_source_count INTEGER;
  v_target_version INTEGER;
  v_count INTEGER;
BEGIN
  v_caller_id := auth.uid();

  IF NOT has_role(v_caller_id, 'admin'::app_role) THEN
    RAISE EXCEPTION 'Only admins can clone curriculum';
  END IF;

  SELECT COUNT(*) INTO v_source_count
  FROM curriculum_sessions
  WHERE age_group_id = p_source_age_group_id
    AND level_id = p_source_level_id
    AND version = p_source_version
    AND is_active = true;

  IF v_source_count = 0 THEN
    RAISE EXCEPTION 'Source version does not exist';
  END IF;

  SELECT COALESCE(MAX(version), 0) + 1 INTO v_target_version
  FROM curriculum_sessions
  WHERE age_group_id = p_target_age_group_id
    AND level_id = p_target_level_id
    AND is_active = true;

  INSERT INTO curriculum_sessions (
    age_group_id, level_id, session_number,
    title, title_ar, description, description_ar,
    slides_url, summary_video_url, full_video_url,
    quiz_id,
    assignment_title, assignment_title_ar,
    assignment_description, assignment_description_ar,
    assignment_attachment_url, assignment_attachment_type,
    assignment_max_score,
    version, is_published, is_active
  )
  SELECT
    p_target_age_group_id, p_target_level_id, session_number,
    title, title_ar, description, description_ar,
    slides_url, summary_video_url, full_video_url,
    quiz_id,
    assignment_title, assignment_title_ar,
    assignment_description, assignment_description_ar,
    assignment_attachment_url, assignment_attachment_type,
    assignment_max_score,
    v_target_version, false, true
  FROM curriculum_sessions
  WHERE age_group_id = p_source_age_group_id
    AND level_id = p_source_level_id
    AND version = p_source_version
    AND is_active = true;

  GET DIAGNOSTICS v_count = ROW_COUNT;

  RETURN jsonb_build_object(
    'cloned', true,
    'target_version', v_target_version,
    'sessions_copied', v_count
  );
END;
$$;

-- 5. RPC: compare_curriculum_versions
CREATE OR REPLACE FUNCTION public.compare_curriculum_versions(
  p_age_group_id UUID,
  p_level_id UUID,
  p_version_a INTEGER,
  p_version_b INTEGER
)
RETURNS JSONB
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT COALESCE(jsonb_agg(row_to_json(diff)::jsonb), '[]'::jsonb)
  FROM (
    SELECT
      COALESCE(a.session_number, b.session_number) AS session_number,
      jsonb_strip_nulls(jsonb_build_object(
        'title', CASE WHEN a.title IS DISTINCT FROM b.title
          THEN jsonb_build_object('old', a.title, 'new', b.title) END,
        'title_ar', CASE WHEN a.title_ar IS DISTINCT FROM b.title_ar
          THEN jsonb_build_object('old', a.title_ar, 'new', b.title_ar) END,
        'slides_url', CASE WHEN a.slides_url IS DISTINCT FROM b.slides_url
          THEN jsonb_build_object('old', a.slides_url, 'new', b.slides_url) END,
        'summary_video_url', CASE WHEN a.summary_video_url IS DISTINCT FROM b.summary_video_url
          THEN jsonb_build_object('old', a.summary_video_url, 'new', b.summary_video_url) END,
        'full_video_url', CASE WHEN a.full_video_url IS DISTINCT FROM b.full_video_url
          THEN jsonb_build_object('old', a.full_video_url, 'new', b.full_video_url) END,
        'quiz_id', CASE WHEN a.quiz_id IS DISTINCT FROM b.quiz_id
          THEN jsonb_build_object('old', a.quiz_id, 'new', b.quiz_id) END,
        'assignment_title', CASE WHEN a.assignment_title IS DISTINCT FROM b.assignment_title
          THEN jsonb_build_object('old', a.assignment_title, 'new', b.assignment_title) END,
        'description', CASE WHEN a.description IS DISTINCT FROM b.description
          THEN jsonb_build_object('old', a.description, 'new', b.description) END
      )) AS changes
    FROM curriculum_sessions a
    FULL OUTER JOIN curriculum_sessions b
      ON a.session_number = b.session_number
      AND b.age_group_id = p_age_group_id
      AND b.level_id = p_level_id
      AND b.version = p_version_b
      AND b.is_active = true
    WHERE a.age_group_id = p_age_group_id
      AND a.level_id = p_level_id
      AND a.version = p_version_a
      AND a.is_active = true
    ORDER BY COALESCE(a.session_number, b.session_number)
  ) diff
  WHERE diff.changes != '{}'::jsonb;
$$;

-- 6. RPC: update_curriculum_session (Optimistic Locking)
CREATE OR REPLACE FUNCTION public.update_curriculum_session(
  p_id UUID,
  p_expected_updated_at TIMESTAMPTZ,
  p_data JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_caller_id UUID;
  v_current_updated_at TIMESTAMPTZ;
BEGIN
  v_caller_id := auth.uid();

  IF NOT has_role(v_caller_id, 'admin'::app_role) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  SELECT updated_at INTO v_current_updated_at
  FROM curriculum_sessions WHERE id = p_id FOR UPDATE;

  IF v_current_updated_at IS NULL THEN
    RAISE EXCEPTION 'Session not found';
  END IF;

  IF v_current_updated_at != p_expected_updated_at THEN
    RETURN jsonb_build_object(
      'updated', false,
      'reason', 'conflict',
      'current_updated_at', v_current_updated_at
    );
  END IF;

  UPDATE curriculum_sessions SET
    title = COALESCE(p_data->>'title', title),
    title_ar = COALESCE(p_data->>'title_ar', title_ar),
    description = p_data->>'description',
    description_ar = p_data->>'description_ar',
    slides_url = p_data->>'slides_url',
    summary_video_url = p_data->>'summary_video_url',
    full_video_url = p_data->>'full_video_url',
    quiz_id = CASE WHEN p_data->>'quiz_id' = '' OR p_data->>'quiz_id' IS NULL
              THEN NULL ELSE (p_data->>'quiz_id')::uuid END,
    assignment_title = p_data->>'assignment_title',
    assignment_title_ar = p_data->>'assignment_title_ar',
    assignment_description = p_data->>'assignment_description',
    assignment_description_ar = p_data->>'assignment_description_ar',
    assignment_attachment_url = p_data->>'assignment_attachment_url',
    assignment_attachment_type = p_data->>'assignment_attachment_type',
    assignment_max_score = CASE WHEN p_data->>'assignment_max_score' IS NULL
                           THEN assignment_max_score
                           ELSE (p_data->>'assignment_max_score')::integer END,
    updated_at = now()
  WHERE id = p_id;

  RETURN jsonb_build_object('updated', true);
END;
$$;
