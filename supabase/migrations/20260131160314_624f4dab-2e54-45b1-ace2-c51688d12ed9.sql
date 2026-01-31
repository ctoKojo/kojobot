-- Enable realtime for profiles table to sync avatar changes across components
ALTER PUBLICATION supabase_realtime ADD TABLE public.profiles;