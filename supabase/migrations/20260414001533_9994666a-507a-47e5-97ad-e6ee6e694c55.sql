
-- =============================================
-- 1. FIX push_subscriptions: restrict SELECT to own rows
-- =============================================
DROP POLICY IF EXISTS "Service role can read all subscriptions" ON public.push_subscriptions;
CREATE POLICY "Users can read own push subscriptions"
  ON public.push_subscriptions FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- =============================================
-- 2. FIX student_streaks: restrict ALL to service_role, SELECT to own
-- =============================================
DROP POLICY IF EXISTS "System can upsert streaks" ON public.student_streaks;
DROP POLICY IF EXISTS "Students can view own streak" ON public.student_streaks;

CREATE POLICY "Students can view own streak"
  ON public.student_streaks FOR SELECT
  TO authenticated
  USING (student_id = auth.uid());

CREATE POLICY "Service role can manage streaks"
  ON public.student_streaks FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- =============================================
-- 3. FIX student_achievements: restrict INSERT to service_role
-- =============================================
DROP POLICY IF EXISTS "System can insert student achievements" ON public.student_achievements;
CREATE POLICY "Service role can insert achievements"
  ON public.student_achievements FOR INSERT
  TO service_role
  WITH CHECK (true);

-- =============================================
-- 4. FIX student_xp_events: restrict INSERT to service_role
-- =============================================
DROP POLICY IF EXISTS "System can insert xp events" ON public.student_xp_events;
CREATE POLICY "Service role can insert xp events"
  ON public.student_xp_events FOR INSERT
  TO service_role
  WITH CHECK (true);

-- =============================================
-- 5. FIX parent_link_codes: restrict SELECT to admin/reception
-- =============================================
DROP POLICY IF EXISTS "Anyone can select by code value" ON public.parent_link_codes;
CREATE POLICY "Admin and reception can read link codes"
  ON public.parent_link_codes FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'reception'));

-- =============================================
-- 6. Remove profiles and group_students from Realtime
-- =============================================
DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime DROP TABLE public.profiles;
  EXCEPTION WHEN undefined_object THEN
    NULL;
  END;
  BEGIN
    ALTER PUBLICATION supabase_realtime DROP TABLE public.group_students;
  EXCEPTION WHEN undefined_object THEN
    NULL;
  END;
END
$$;

-- =============================================
-- 7. FIX storage: assignment files - restrict update/delete to owner
-- =============================================
DROP POLICY IF EXISTS "Users can delete assignment files" ON storage.objects;
DROP POLICY IF EXISTS "Users can update assignment files" ON storage.objects;

CREATE POLICY "Users can update own assignment files"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'assignments' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Users can delete own assignment files"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'assignments' AND (storage.foldername(name))[1] = auth.uid()::text);

-- =============================================
-- 8. FIX storage: remove overly broad avatar policies
-- =============================================
DROP POLICY IF EXISTS "Users can update their avatars" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their avatars" ON storage.objects;
