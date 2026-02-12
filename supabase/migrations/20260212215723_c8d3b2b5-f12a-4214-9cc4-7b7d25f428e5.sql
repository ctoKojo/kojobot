
-- Helper: check if a user is a student
CREATE OR REPLACE FUNCTION public.is_student(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = 'student'
  )
$$;

-- ===== PROFILES =====
CREATE POLICY "Reception can view all profiles"
ON public.profiles FOR SELECT
USING (has_role(auth.uid(), 'reception'));

CREATE POLICY "Reception can insert profiles"
ON public.profiles FOR INSERT
WITH CHECK (has_role(auth.uid(), 'reception'));

CREATE POLICY "Reception can update student profiles"
ON public.profiles FOR UPDATE
USING (has_role(auth.uid(), 'reception') AND (is_student(profiles.user_id) OR profiles.user_id = auth.uid()));

-- ===== GROUPS =====
CREATE POLICY "Reception can view groups"
ON public.groups FOR SELECT
USING (has_role(auth.uid(), 'reception'));

CREATE POLICY "Reception can insert groups"
ON public.groups FOR INSERT
WITH CHECK (has_role(auth.uid(), 'reception'));

CREATE POLICY "Reception can update groups"
ON public.groups FOR UPDATE
USING (has_role(auth.uid(), 'reception'));

-- ===== GROUP_STUDENTS =====
CREATE POLICY "Reception can view group students"
ON public.group_students FOR SELECT
USING (has_role(auth.uid(), 'reception'));

CREATE POLICY "Reception can insert group students"
ON public.group_students FOR INSERT
WITH CHECK (has_role(auth.uid(), 'reception'));

CREATE POLICY "Reception can update group students"
ON public.group_students FOR UPDATE
USING (has_role(auth.uid(), 'reception'));

-- ===== GROUP_LEVEL_PROGRESS =====
CREATE POLICY "Reception can view group level progress"
ON public.group_level_progress FOR SELECT
USING (has_role(auth.uid(), 'reception'));

CREATE POLICY "Reception can update group level progress"
ON public.group_level_progress FOR UPDATE
USING (has_role(auth.uid(), 'reception'));

-- ===== SESSIONS =====
CREATE POLICY "Reception can view sessions"
ON public.sessions FOR SELECT
USING (has_role(auth.uid(), 'reception'));

CREATE POLICY "Reception can insert sessions"
ON public.sessions FOR INSERT
WITH CHECK (has_role(auth.uid(), 'reception'));

CREATE POLICY "Reception can update scheduled sessions only"
ON public.sessions FOR UPDATE
USING (has_role(auth.uid(), 'reception') AND status = 'scheduled');

-- ===== ATTENDANCE =====
CREATE POLICY "Reception can view attendance"
ON public.attendance FOR SELECT
USING (has_role(auth.uid(), 'reception'));

CREATE POLICY "Reception can insert attendance"
ON public.attendance FOR INSERT
WITH CHECK (has_role(auth.uid(), 'reception'));

CREATE POLICY "Reception can update attendance for active sessions"
ON public.attendance FOR UPDATE
USING (has_role(auth.uid(), 'reception') AND session_id IN (
  SELECT id FROM public.sessions WHERE status != 'completed'
));

-- ===== MAKEUP_SESSIONS =====
CREATE POLICY "Reception can manage makeup sessions"
ON public.makeup_sessions FOR ALL
USING (has_role(auth.uid(), 'reception'));

-- ===== SUBSCRIPTIONS =====
CREATE POLICY "Reception can manage subscriptions"
ON public.subscriptions FOR ALL
USING (has_role(auth.uid(), 'reception'));

-- ===== PAYMENTS =====
CREATE POLICY "Reception can manage payments"
ON public.payments FOR ALL
USING (has_role(auth.uid(), 'reception'));

-- ===== EXPENSES =====
CREATE POLICY "Reception can view expenses"
ON public.expenses FOR SELECT
USING (has_role(auth.uid(), 'reception'));

CREATE POLICY "Reception can insert expenses"
ON public.expenses FOR INSERT
WITH CHECK (has_role(auth.uid(), 'reception'));

-- ===== NOTIFICATIONS =====
CREATE POLICY "Reception can view own notifications"
ON public.notifications FOR SELECT
USING (has_role(auth.uid(), 'reception') AND user_id = auth.uid());

CREATE POLICY "Reception can insert notifications"
ON public.notifications FOR INSERT
WITH CHECK (has_role(auth.uid(), 'reception'));

-- ===== USER_ROLES =====
CREATE POLICY "Reception can view own role"
ON public.user_roles FOR SELECT
USING (has_role(auth.uid(), 'reception') AND user_id = auth.uid());

-- ===== ACTIVITY_LOGS =====
CREATE POLICY "Reception can view own logs"
ON public.activity_logs FOR SELECT
USING (has_role(auth.uid(), 'reception') AND user_id = auth.uid());

CREATE POLICY "Reception can insert own logs"
ON public.activity_logs FOR INSERT
WITH CHECK (has_role(auth.uid(), 'reception') AND user_id = auth.uid());

-- ===== INSTRUCTOR_SCHEDULES (as employee) =====
CREATE POLICY "Reception can view own schedule"
ON public.instructor_schedules FOR SELECT
USING (has_role(auth.uid(), 'reception') AND instructor_id = auth.uid());
