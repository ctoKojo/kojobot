-- Fix: Restrict notifications INSERT to admins and service role only
-- This prevents any authenticated user from creating notifications for other users

-- Drop the overly permissive policy
DROP POLICY IF EXISTS "Authenticated users can insert notifications" ON public.notifications;

-- Create policy for admins to insert notifications
CREATE POLICY "Admins can insert notifications"
ON public.notifications FOR INSERT
TO authenticated
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Note: Edge functions using service_role key bypass RLS automatically,
-- so they can still create notifications without an explicit policy