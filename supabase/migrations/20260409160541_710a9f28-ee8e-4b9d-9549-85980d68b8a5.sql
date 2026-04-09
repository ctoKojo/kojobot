
-- Reception SELECT policies for tables they need to view

-- warnings
CREATE POLICY "Reception can view warnings"
  ON public.warnings FOR SELECT
  USING (has_role(auth.uid(), 'reception'::app_role));

-- assignments
CREATE POLICY "Reception can view assignments"
  ON public.assignments FOR SELECT
  USING (has_role(auth.uid(), 'reception'::app_role));

-- assignment_submissions
CREATE POLICY "Reception can view assignment submissions"
  ON public.assignment_submissions FOR SELECT
  USING (has_role(auth.uid(), 'reception'::app_role));

-- quiz_submissions
CREATE POLICY "Reception can view quiz submissions"
  ON public.quiz_submissions FOR SELECT
  USING (has_role(auth.uid(), 'reception'::app_role));

-- quizzes
CREATE POLICY "Reception can view quizzes"
  ON public.quizzes FOR SELECT
  USING (has_role(auth.uid(), 'reception'::app_role));

-- quiz_assignments
CREATE POLICY "Reception can view quiz assignments"
  ON public.quiz_assignments FOR SELECT
  USING (has_role(auth.uid(), 'reception'::app_role));

-- curriculum_sessions
CREATE POLICY "Reception can view curriculum sessions"
  ON public.curriculum_sessions FOR SELECT
  USING (has_role(auth.uid(), 'reception'::app_role));

-- materials
CREATE POLICY "Reception can view materials"
  ON public.materials FOR SELECT
  USING (has_role(auth.uid(), 'reception'::app_role));

-- instructor_warnings
CREATE POLICY "Reception can view instructor warnings"
  ON public.instructor_warnings FOR SELECT
  USING (has_role(auth.uid(), 'reception'::app_role));

-- subscription_requests
CREATE POLICY "Reception can view subscription requests"
  ON public.subscription_requests FOR SELECT
  USING (has_role(auth.uid(), 'reception'::app_role));

CREATE POLICY "Reception can update subscription requests"
  ON public.subscription_requests FOR UPDATE
  USING (has_role(auth.uid(), 'reception'::app_role));

-- student_xp_events
CREATE POLICY "Reception can view xp events"
  ON public.student_xp_events FOR SELECT
  USING (has_role(auth.uid(), 'reception'::app_role));

-- student_streaks
CREATE POLICY "Reception can view streaks"
  ON public.student_streaks FOR SELECT
  USING (has_role(auth.uid(), 'reception'::app_role));

-- student_achievements
CREATE POLICY "Reception can view achievements"
  ON public.student_achievements FOR SELECT
  USING (has_role(auth.uid(), 'reception'::app_role));

-- student_level_transitions
CREATE POLICY "Reception can view level transitions"
  ON public.student_level_transitions FOR SELECT
  USING (has_role(auth.uid(), 'reception'::app_role));

-- student_track_choices
CREATE POLICY "Reception can view track choices"
  ON public.student_track_choices FOR SELECT
  USING (has_role(auth.uid(), 'reception'::app_role));

-- performance_events (if used in dashboards)
CREATE POLICY "Reception can view performance events"
  ON public.performance_events FOR SELECT
  USING (has_role(auth.uid(), 'reception'::app_role));
