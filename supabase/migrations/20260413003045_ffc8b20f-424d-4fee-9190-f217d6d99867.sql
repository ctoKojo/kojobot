
-- Table already created by failed migration, so use IF NOT EXISTS
CREATE TABLE IF NOT EXISTS public.parent_students (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  parent_id UUID NOT NULL,
  student_id UUID NOT NULL,
  relationship TEXT NOT NULL DEFAULT 'parent',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(parent_id, student_id)
);

ALTER TABLE public.parent_students ENABLE ROW LEVEL SECURITY;

-- Drop policies if they exist from partial migration
DROP POLICY IF EXISTS "Parents can view their linked students" ON public.parent_students;
DROP POLICY IF EXISTS "Admin and reception can insert parent_students" ON public.parent_students;
DROP POLICY IF EXISTS "Admin can delete parent_students" ON public.parent_students;
DROP POLICY IF EXISTS "Parents can view their children attendance" ON public.attendance;
DROP POLICY IF EXISTS "Parents can view their children submissions" ON public.assignment_submissions;
DROP POLICY IF EXISTS "Parents can view their children profiles" ON public.profiles;
DROP POLICY IF EXISTS "Parents can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Parents can view their children subscriptions" ON public.subscriptions;
DROP POLICY IF EXISTS "Parents can view their children payments" ON public.payments;
DROP POLICY IF EXISTS "Parents can view their children sessions" ON public.sessions;
DROP POLICY IF EXISTS "Parents can view their children groups" ON public.groups;
DROP POLICY IF EXISTS "Parents can view their children assignments" ON public.assignments;
DROP POLICY IF EXISTS "Parents can view levels" ON public.levels;
DROP POLICY IF EXISTS "Parents can view age_groups" ON public.age_groups;

-- Parent_students policies
CREATE POLICY "Parents can view their linked students"
  ON public.parent_students FOR SELECT TO authenticated
  USING (parent_id = auth.uid() OR public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'reception'));

CREATE POLICY "Admin and reception can insert parent_students"
  ON public.parent_students FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'reception'));

CREATE POLICY "Admin can delete parent_students"
  ON public.parent_students FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Attendance
CREATE POLICY "Parents can view their children attendance"
  ON public.attendance FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'parent') AND student_id IN (SELECT ps.student_id FROM public.parent_students ps WHERE ps.parent_id = auth.uid()));

-- Submissions
CREATE POLICY "Parents can view their children submissions"
  ON public.assignment_submissions FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'parent') AND student_id IN (SELECT ps.student_id FROM public.parent_students ps WHERE ps.parent_id = auth.uid()));

-- Profiles (children + own)
CREATE POLICY "Parents can view their children profiles"
  ON public.profiles FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'parent') AND (user_id = auth.uid() OR user_id IN (SELECT ps.student_id FROM public.parent_students ps WHERE ps.parent_id = auth.uid())));

-- Subscriptions
CREATE POLICY "Parents can view their children subscriptions"
  ON public.subscriptions FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'parent') AND student_id IN (SELECT ps.student_id FROM public.parent_students ps WHERE ps.parent_id = auth.uid()));

-- Payments
CREATE POLICY "Parents can view their children payments"
  ON public.payments FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'parent') AND student_id IN (SELECT ps.student_id FROM public.parent_students ps WHERE ps.parent_id = auth.uid()));

-- Sessions
CREATE POLICY "Parents can view their children sessions"
  ON public.sessions FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'parent') AND group_id IN (SELECT gs.group_id FROM public.group_students gs WHERE gs.student_id IN (SELECT ps.student_id FROM public.parent_students ps WHERE ps.parent_id = auth.uid())));

-- Groups
CREATE POLICY "Parents can view their children groups"
  ON public.groups FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'parent') AND id IN (SELECT gs.group_id FROM public.group_students gs WHERE gs.student_id IN (SELECT ps.student_id FROM public.parent_students ps WHERE ps.parent_id = auth.uid())));

-- Assignments
CREATE POLICY "Parents can view their children assignments"
  ON public.assignments FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'parent') AND (student_id IN (SELECT ps.student_id FROM public.parent_students ps WHERE ps.parent_id = auth.uid()) OR group_id IN (SELECT gs.group_id FROM public.group_students gs WHERE gs.student_id IN (SELECT ps.student_id FROM public.parent_students ps WHERE ps.parent_id = auth.uid()))));

-- Levels & age_groups (read-only for context)
CREATE POLICY "Parents can view levels"
  ON public.levels FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'parent'));

CREATE POLICY "Parents can view age_groups"
  ON public.age_groups FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'parent'));
