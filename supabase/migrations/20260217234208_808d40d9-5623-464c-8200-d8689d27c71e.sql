
-- ================================================
-- FIX: Storage policies lack ownership validation
-- Remove overly permissive policies that allow any authenticated user
-- to update/delete files. Keep or add ownership-based policies.
-- ================================================

-- 1. AVATARS BUCKET
-- Drop the overly permissive policies (no ownership check)
DROP POLICY IF EXISTS "Users can update their avatars" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their avatars" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload avatars" ON storage.objects;

-- The ownership-based policies already exist:
-- "Users can update their own avatar" - uses (storage.foldername(name))[1] = auth.uid()::text
-- "Users can delete their own avatar" - uses (storage.foldername(name))[1] = auth.uid()::text
-- "Users can upload their own avatar" - uses (storage.foldername(name))[1] = auth.uid()::text

-- Also add admin ability to manage all avatars
CREATE POLICY "Admins can manage all avatars"
  ON storage.objects FOR ALL
  USING (bucket_id = 'avatars' AND has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (bucket_id = 'avatars' AND has_role(auth.uid(), 'admin'::app_role));

-- 2. ASSIGNMENTS BUCKET
-- Drop overly permissive policies
DROP POLICY IF EXISTS "Users can update assignment files" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete assignment files" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload assignment files" ON storage.objects;
DROP POLICY IF EXISTS "Users can view assignment files" ON storage.objects;

-- Add role-based policies: only admins/instructors can manage assignment files
-- Students can upload their own submission files
CREATE POLICY "Admins and instructors can manage assignment files"
  ON storage.objects FOR ALL
  USING (
    bucket_id = 'assignments'
    AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'instructor'::app_role))
  )
  WITH CHECK (
    bucket_id = 'assignments'
    AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'instructor'::app_role))
  );

-- Students can upload assignment submission files
CREATE POLICY "Students can upload assignment submissions"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'assignments'
    AND has_role(auth.uid(), 'student'::app_role)
  );

-- Keep public read access (assignments bucket is public)
-- "Public can view assignment files" already exists
