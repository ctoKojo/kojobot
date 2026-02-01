-- FIX 1: Remove student access to quiz_questions table (they should only access the view)
-- This prevents students from seeing correct_answer column before submission
DROP POLICY IF EXISTS "Students can view assigned quiz questions" ON public.quiz_questions;

-- Ensure instructors and admins still have access to the base table
-- (These policies already exist, but let's verify)

-- FIX 2: Fix profiles table - require authentication for SELECT
-- Drop existing public access policies
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Instructors can view their own profile and student profiles in " ON public.profiles;
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;

-- Recreate profiles policies with proper authentication requirements
CREATE POLICY "Admins can view all profiles" 
ON public.profiles 
FOR SELECT 
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Instructors can view relevant profiles" 
ON public.profiles 
FOR SELECT 
USING (
  has_role(auth.uid(), 'instructor'::app_role) AND (
    -- Their own profile
    user_id = auth.uid() 
    OR 
    -- Profiles of students in their groups
    user_id IN (
      SELECT gs.student_id 
      FROM group_students gs
      JOIN groups g ON gs.group_id = g.id
      WHERE g.instructor_id = auth.uid() AND gs.is_active = true
    )
  )
);

CREATE POLICY "Users can view their own profile" 
ON public.profiles 
FOR SELECT 
USING (auth.uid() = user_id);

-- FIX 3: Fix subscriptions table - ensure proper authentication
-- The current RLS should already be restricted, but let's verify the policies are correct
-- First check what policies exist and ensure no public access

-- Verify students can only view their own subscriptions (this policy exists)
-- Verify admins can manage all subscriptions (this policy exists)
-- No additional changes needed if policies are already properly scoped

-- Ensure subscriptions requires authentication - no changes needed based on existing policies:
-- "Students can view their subscription" - requires has_role(auth.uid(), 'student'::app_role) AND (student_id = auth.uid())
-- "Admins can manage subscriptions" - requires has_role(auth.uid(), 'admin'::app_role)