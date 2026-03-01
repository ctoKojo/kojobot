
-- Seasonal themes table for time-limited visual themes (e.g. Ramadan)
CREATE TABLE public.seasonal_themes (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  theme_key text NOT NULL,
  start_date date NOT NULL,
  end_date date NOT NULL,
  timezone text NOT NULL DEFAULT 'Africa/Cairo',
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- RLS: everyone can read, only admins can manage
ALTER TABLE public.seasonal_themes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active themes"
  ON public.seasonal_themes
  FOR SELECT
  USING (true);

CREATE POLICY "Admins can manage themes"
  ON public.seasonal_themes
  FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Insert Ramadan 2026 (official: Feb 19 start, ~Mar 20 end)
INSERT INTO public.seasonal_themes (theme_key, start_date, end_date, timezone)
VALUES ('ramadan', '2026-02-19', '2026-03-20', 'Africa/Cairo');
