
-- =============================================
-- Phase 1: Performance Management System Migration
-- =============================================

-- 1.1 Add columns to instructor_warnings
ALTER TABLE public.instructor_warnings
  ADD COLUMN IF NOT EXISTS reference_id UUID,
  ADD COLUMN IF NOT EXISTS reference_type TEXT,
  ADD COLUMN IF NOT EXISTS severity TEXT NOT NULL DEFAULT 'minor';

-- Unique partial index to prevent duplicate automated warnings
CREATE UNIQUE INDEX IF NOT EXISTS idx_warnings_no_duplicate
  ON public.instructor_warnings (instructor_id, warning_type, reference_id)
  WHERE reference_id IS NOT NULL AND is_active = true;

-- 1.2 Add columns to warning_deduction_rules
ALTER TABLE public.warning_deduction_rules
  ADD COLUMN IF NOT EXISTS severity TEXT NOT NULL DEFAULT 'minor',
  ADD COLUMN IF NOT EXISTS action TEXT NOT NULL DEFAULT 'deduction',
  ADD COLUMN IF NOT EXISTS version INTEGER NOT NULL DEFAULT 1;

-- 1.3 Create performance_events table (Audit Log)
CREATE TABLE IF NOT EXISTS public.performance_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  instructor_id UUID NOT NULL,
  event_type TEXT NOT NULL CHECK (event_type IN (
    'reminder_sent', 'warning_created', 'deduction_pending',
    'deduction_applied', 'bonus_recommended', 'bonus_approved',
    'suspension_recommended', 'override_applied', 'escalation_event'
  )),
  reference_id UUID,
  reference_type TEXT,
  details JSONB NOT NULL DEFAULT '{}',
  is_archived BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_perf_events_instructor ON public.performance_events(instructor_id, created_at DESC)
  WHERE is_archived = false;

ALTER TABLE public.performance_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage performance events"
  ON public.performance_events FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Instructors can view their own performance events"
  ON public.performance_events FOR SELECT
  USING (has_role(auth.uid(), 'instructor'::app_role) AND instructor_id = auth.uid() AND is_archived = false);

-- 1.4 Create instructor_performance_metrics table
CREATE TABLE IF NOT EXISTS public.instructor_performance_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  instructor_id UUID NOT NULL,
  month DATE NOT NULL,
  avg_reply_time_hours NUMERIC NOT NULL DEFAULT 0,
  avg_grading_time_hours NUMERIC NOT NULL DEFAULT 0,
  total_warnings INTEGER NOT NULL DEFAULT 0,
  total_reminders INTEGER NOT NULL DEFAULT 0,
  total_students INTEGER NOT NULL DEFAULT 0,
  total_groups INTEGER NOT NULL DEFAULT 0,
  quality_score NUMERIC NOT NULL DEFAULT 100,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(instructor_id, month)
);

ALTER TABLE public.instructor_performance_metrics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage performance metrics"
  ON public.instructor_performance_metrics FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Instructors can view their own metrics"
  ON public.instructor_performance_metrics FOR SELECT
  USING (has_role(auth.uid(), 'instructor'::app_role) AND instructor_id = auth.uid());

-- Enable realtime on metrics only
ALTER PUBLICATION supabase_realtime ADD TABLE public.instructor_performance_metrics;

-- 1.5 Create system_health_metrics table
CREATE TABLE IF NOT EXISTS public.system_health_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date DATE NOT NULL UNIQUE,
  total_reminders INTEGER NOT NULL DEFAULT 0,
  total_warnings INTEGER NOT NULL DEFAULT 0,
  total_deductions INTEGER NOT NULL DEFAULT 0,
  avg_execution_time_ms INTEGER NOT NULL DEFAULT 0,
  errors_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.system_health_metrics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage system health metrics"
  ON public.system_health_metrics FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

-- 1.6 Create compute_quality_score function with workload weighting
CREATE OR REPLACE FUNCTION public.compute_quality_score(
  p_warnings INT,
  p_reminders INT,
  p_avg_reply NUMERIC,
  p_avg_grading NUMERIC,
  p_total_students INT
) RETURNS NUMERIC
LANGUAGE sql
IMMUTABLE
SET search_path = 'public'
AS $$
  SELECT GREATEST(20, LEAST(100,
    100 - (
      (
        (p_warnings * 5) +
        (p_reminders * 1) +
        LEAST(COALESCE(p_avg_reply, 0) / 12.0, 20) +
        LEAST(COALESCE(p_avg_grading, 0) / 24.0, 20)
      ) * (1 - LEAST(COALESCE(p_total_students, 0) / 50.0, 0.3))
    )
  ));
$$;

-- 1.7 Replace auto_warning_deduction trigger function
-- Now uses rolling 30-day window, severity matching, and deduction_pending pattern
CREATE OR REPLACE FUNCTION public.auto_warning_deduction()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
DECLARE
  v_warning_count INTEGER;
  v_rule RECORD;
  v_current_month DATE;
  v_existing UUID;
  v_snapshot JSONB;
  v_score NUMERIC;
  v_workload INTEGER;
BEGIN
  IF NEW.is_active = false THEN RETURN NEW; END IF;

  v_current_month := date_trunc('month', CURRENT_DATE)::date;

  -- Rolling 30-day window instead of lifetime count
  SELECT COUNT(*) INTO v_warning_count
  FROM public.instructor_warnings
  WHERE instructor_id = NEW.instructor_id
    AND warning_type = NEW.warning_type
    AND is_active = true
    AND created_at >= now() - interval '30 days';

  -- Get workload for snapshot
  SELECT COUNT(DISTINCT gs.student_id) INTO v_workload
  FROM public.group_students gs
  JOIN public.groups g ON gs.group_id = g.id
  WHERE g.instructor_id = NEW.instructor_id AND g.is_active = true AND gs.is_active = true;

  FOR v_rule IN
    SELECT * FROM public.warning_deduction_rules
    WHERE warning_type = NEW.warning_type
      AND is_active = true
      AND warning_count <= v_warning_count
      AND (severity = NEW.severity OR severity = 'minor')
    ORDER BY warning_count DESC, deduction_amount DESC
    LIMIT 1
  LOOP
    -- Check if already processed for this warning
    SELECT id INTO v_existing
    FROM public.performance_events
    WHERE instructor_id = NEW.instructor_id
      AND reference_id = NEW.id
      AND event_type IN ('deduction_pending', 'deduction_applied', 'suspension_recommended')
      AND is_archived = false
    LIMIT 1;

    IF v_existing IS NULL THEN
      -- Build snapshot for audit
      v_snapshot := jsonb_build_object(
        'warning_type', NEW.warning_type,
        'warning_count', v_warning_count,
        'severity', NEW.severity,
        'rule_id', v_rule.id,
        'rule_version', v_rule.version,
        'deduction_amount', v_rule.deduction_amount,
        'workload_students', v_workload
      );

      IF v_rule.action = 'suspension_recommendation' THEN
        -- Log suspension recommendation instead of deduction
        INSERT INTO public.performance_events (instructor_id, event_type, reference_id, reference_type, details)
        VALUES (NEW.instructor_id, 'suspension_recommended', NEW.id, 'warning', v_snapshot);

        -- Notify all admins
        INSERT INTO public.notifications (user_id, type, category, title, title_ar, message, message_ar, action_url)
        SELECT ur.user_id, 'warning', 'admin',
          'Suspension Recommendation', 'توصية بإيقاف مدرب',
          format('Instructor has %s %s warnings in 30 days. Review recommended.', v_warning_count, NEW.warning_type),
          format('المدرب لديه %s إنذار %s خلال 30 يوم. يُنصح بالمراجعة.', v_warning_count, NEW.warning_type),
          '/instructor-performance'
        FROM public.user_roles ur WHERE ur.role = 'admin';
      ELSE
        -- Register deduction_pending (processed by process-deductions function)
        INSERT INTO public.performance_events (instructor_id, event_type, reference_id, reference_type, details)
        VALUES (NEW.instructor_id, 'deduction_pending', NEW.id, 'warning', v_snapshot);
      END IF;

      -- Log warning_created event
      INSERT INTO public.performance_events (instructor_id, event_type, reference_id, reference_type, details)
      VALUES (NEW.instructor_id, 'warning_created', NEW.id, 'warning',
        jsonb_build_object('warning_type', NEW.warning_type, 'severity', NEW.severity, 'warning_count', v_warning_count));

      -- Notify the instructor about the warning
      INSERT INTO public.notifications (user_id, type, category, title, title_ar, message, message_ar, action_url)
      VALUES (
        NEW.instructor_id, 'warning', 'warning',
        'New Warning', 'إنذار جديد',
        format('You have received a %s severity warning: %s', NEW.severity, NEW.reason),
        format('لقد تلقيت إنذار بدرجة %s: %s', NEW.severity, COALESCE(NEW.reason_ar, NEW.reason)),
        '/my-instructor-warnings'
      );
    END IF;
  END LOOP;

  RETURN NEW;
END;
$function$;

-- 1.8 Performance indexes
CREATE INDEX IF NOT EXISTS idx_messages_conv_created ON public.messages(conversation_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_submissions_pending ON public.assignment_submissions(status, submitted_at)
  WHERE status = 'submitted';
CREATE INDEX IF NOT EXISTS idx_warnings_rolling ON public.instructor_warnings(instructor_id, warning_type, created_at)
  WHERE is_active = true;
