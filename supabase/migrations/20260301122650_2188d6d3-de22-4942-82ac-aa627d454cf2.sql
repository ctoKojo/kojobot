
-- Phase 2: XP Events table
CREATE TABLE public.student_xp_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL,
  event_type text NOT NULL, -- attendance, quiz_score, assignment_score, streak_bonus, achievement
  xp_amount integer NOT NULL,
  reference_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Index for fast lookups
CREATE INDEX idx_student_xp_events_student ON public.student_xp_events(student_id);
CREATE INDEX idx_student_xp_events_type ON public.student_xp_events(student_id, event_type);

-- RLS
ALTER TABLE public.student_xp_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Students can view own xp events"
  ON public.student_xp_events FOR SELECT
  USING (student_id = auth.uid());

CREATE POLICY "Admins full access xp events"
  ON public.student_xp_events FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "System can insert xp events"
  ON public.student_xp_events FOR INSERT
  WITH CHECK (true);

-- Phase 2: Streaks table
CREATE TABLE public.student_streaks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL UNIQUE,
  current_streak integer NOT NULL DEFAULT 0,
  longest_streak integer NOT NULL DEFAULT 0,
  last_activity_date date,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.student_streaks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Students can view own streak"
  ON public.student_streaks FOR SELECT
  USING (student_id = auth.uid());

CREATE POLICY "Admins full access streaks"
  ON public.student_streaks FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "System can upsert streaks"
  ON public.student_streaks FOR ALL
  USING (true) WITH CHECK (true);

-- Phase 3: Achievement definitions
CREATE TABLE public.achievements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text UNIQUE NOT NULL,
  title text NOT NULL,
  title_ar text NOT NULL,
  description text,
  description_ar text,
  icon_name text NOT NULL DEFAULT 'shield',
  xp_reward integer NOT NULL DEFAULT 100,
  condition_type text NOT NULL, -- attendance_count, quiz_score, streak, level_complete, assignment_count
  condition_value jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.achievements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active achievements"
  ON public.achievements FOR SELECT
  USING (is_active = true);

CREATE POLICY "Admins full access achievements"
  ON public.achievements FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Phase 3: Student achievements (earned)
CREATE TABLE public.student_achievements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL,
  achievement_id uuid NOT NULL REFERENCES public.achievements(id) ON DELETE CASCADE,
  earned_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(student_id, achievement_id)
);

CREATE INDEX idx_student_achievements_student ON public.student_achievements(student_id);

ALTER TABLE public.student_achievements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Students can view own achievements"
  ON public.student_achievements FOR SELECT
  USING (student_id = auth.uid());

CREATE POLICY "Admins full access student achievements"
  ON public.student_achievements FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "System can insert student achievements"
  ON public.student_achievements FOR INSERT
  WITH CHECK (true);
