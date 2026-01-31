-- Fix overly permissive INSERT policies for activity_logs and notifications
DROP POLICY IF EXISTS "System can insert logs" ON public.activity_logs;
DROP POLICY IF EXISTS "System can insert notifications" ON public.notifications;

-- Create more restrictive policies - only authenticated users can insert
CREATE POLICY "Authenticated users can insert logs" ON public.activity_logs FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can insert notifications" ON public.notifications FOR INSERT WITH CHECK (auth.role() = 'authenticated');