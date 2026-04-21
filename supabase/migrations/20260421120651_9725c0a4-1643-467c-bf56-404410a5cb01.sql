
DROP FUNCTION IF EXISTS public.validate_group_timeline();

CREATE OR REPLACE FUNCTION public.validate_group_timeline()
RETURNS TABLE (
  out_group_id UUID,
  out_group_name TEXT,
  out_issue_type TEXT,
  out_details JSONB
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_group RECORD;
  v_gap_numbers INTEGER[];
  v_actual_max_content INTEGER;
  v_orphan_makeup_count INTEGER;
  v_last_completed_date DATE;
  v_days_since INTEGER;
BEGIN
  FOR v_group IN
    SELECT g.id AS gid, g.name AS gname, g.last_delivered_content_number AS ldcn, g.owed_sessions_count AS osc
    FROM public.groups g
    WHERE g.is_active = true AND g.has_started = true AND g.status <> 'frozen'
  LOOP
    SELECT ARRAY(
      SELECT generate_series(1, COALESCE(MAX(s.session_number), 0))
      FROM public.sessions s WHERE s.group_id = v_group.gid
      EXCEPT
      SELECT s.session_number FROM public.sessions s WHERE s.group_id = v_group.gid
    ) INTO v_gap_numbers;

    IF array_length(v_gap_numbers, 1) > 0 THEN
      INSERT INTO public.data_quality_issues (entity_table, entity_id, issue_type, details)
      VALUES ('groups', v_group.gid, 'session_number_gap',
        jsonb_build_object('group_name', v_group.gname, 'missing_session_numbers', v_gap_numbers))
      ON CONFLICT DO NOTHING;
      out_group_id := v_group.gid; out_group_name := v_group.gname;
      out_issue_type := 'session_number_gap'; out_details := jsonb_build_object('missing', v_gap_numbers);
      RETURN NEXT;
    END IF;

    SELECT COALESCE(MAX(s.content_number), 0) INTO v_actual_max_content
    FROM public.sessions s
    WHERE s.group_id = v_group.gid AND s.status = 'completed' AND s.content_number IS NOT NULL;

    IF COALESCE(v_group.ldcn, 0) <> v_actual_max_content THEN
      INSERT INTO public.data_quality_issues (entity_table, entity_id, issue_type, details)
      VALUES ('groups', v_group.gid, 'counter_mismatch',
        jsonb_build_object('group_name', v_group.gname, 'cached', v_group.ldcn, 'actual', v_actual_max_content))
      ON CONFLICT DO NOTHING;
      out_group_id := v_group.gid; out_group_name := v_group.gname;
      out_issue_type := 'counter_mismatch';
      out_details := jsonb_build_object('cached', v_group.ldcn, 'actual', v_actual_max_content);
      RETURN NEXT;
    END IF;

    SELECT MAX(s.session_date) INTO v_last_completed_date
    FROM public.sessions s WHERE s.group_id = v_group.gid AND s.status = 'completed';

    IF v_last_completed_date IS NOT NULL THEN
      v_days_since := (CURRENT_DATE - v_last_completed_date);
      IF v_days_since > 14 AND NOT EXISTS (
        SELECT 1 FROM public.sessions s
        WHERE s.group_id = v_group.gid AND s.status = 'scheduled' AND s.session_date >= CURRENT_DATE
      ) THEN
        INSERT INTO public.data_quality_issues (entity_table, entity_id, issue_type, details)
        VALUES ('groups', v_group.gid, 'stale_no_upcoming',
          jsonb_build_object('group_name', v_group.gname, 'last_completed_date', v_last_completed_date, 'days_since', v_days_since))
        ON CONFLICT DO NOTHING;
        out_group_id := v_group.gid; out_group_name := v_group.gname;
        out_issue_type := 'stale_no_upcoming'; out_details := jsonb_build_object('days_since', v_days_since);
        RETURN NEXT;
      END IF;
    END IF;

    SELECT COUNT(*) INTO v_orphan_makeup_count
    FROM public.makeup_sessions ms
    WHERE ms.original_session_id IN (SELECT s.id FROM public.sessions s WHERE s.group_id = v_group.gid)
      AND ms.status = 'pending'
      AND NOT EXISTS (SELECT 1 FROM public.attendance a WHERE a.makeup_session_id = ms.id)
      AND ms.created_at < NOW() - INTERVAL '7 days';

    IF v_orphan_makeup_count > 0 THEN
      INSERT INTO public.data_quality_issues (entity_table, entity_id, issue_type, details)
      VALUES ('groups', v_group.gid, 'orphan_makeup_sessions',
        jsonb_build_object('group_name', v_group.gname, 'count', v_orphan_makeup_count))
      ON CONFLICT DO NOTHING;
      out_group_id := v_group.gid; out_group_name := v_group.gname;
      out_issue_type := 'orphan_makeup_sessions'; out_details := jsonb_build_object('count', v_orphan_makeup_count);
      RETURN NEXT;
    END IF;
  END LOOP;
END;
$$;

GRANT EXECUTE ON FUNCTION public.validate_group_timeline() TO authenticated;
