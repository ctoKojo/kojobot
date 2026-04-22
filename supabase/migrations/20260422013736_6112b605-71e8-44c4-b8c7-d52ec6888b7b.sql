
CREATE TABLE IF NOT EXISTS public.bulk_reminder_presets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  template_name text NOT NULL,
  filters jsonb NOT NULL DEFAULT '{}'::jsonb,
  custom_subject text,
  custom_message text,
  recipient_mode text NOT NULL DEFAULT 'smart' CHECK (recipient_mode IN ('parent', 'student', 'both', 'smart')),
  template_data jsonb DEFAULT '{}'::jsonb,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.bulk_reminder_presets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins and reception manage presets"
  ON public.bulk_reminder_presets
  FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'reception'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'reception'::app_role));

CREATE INDEX IF NOT EXISTS idx_bulk_reminder_presets_created_by ON public.bulk_reminder_presets(created_by);

CREATE TABLE IF NOT EXISTS public.scheduled_bulk_reminders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scheduled_at timestamptz NOT NULL,
  template_name text NOT NULL,
  recipient_mode text NOT NULL DEFAULT 'smart' CHECK (recipient_mode IN ('parent', 'student', 'both', 'smart')),
  student_ids uuid[] NOT NULL DEFAULT ARRAY[]::uuid[],
  template_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  custom_subject text,
  custom_message text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'sent', 'failed', 'cancelled')),
  result_summary jsonb,
  processed_at timestamptz,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.scheduled_bulk_reminders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins and reception manage scheduled reminders"
  ON public.scheduled_bulk_reminders
  FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'reception'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'reception'::app_role));

CREATE INDEX IF NOT EXISTS idx_scheduled_bulk_reminders_status_time ON public.scheduled_bulk_reminders(status, scheduled_at);

CREATE OR REPLACE FUNCTION public.tg_bulk_reminders_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;

DROP TRIGGER IF EXISTS trg_bulk_reminder_presets_updated_at ON public.bulk_reminder_presets;
CREATE TRIGGER trg_bulk_reminder_presets_updated_at
  BEFORE UPDATE ON public.bulk_reminder_presets
  FOR EACH ROW EXECUTE FUNCTION public.tg_bulk_reminders_updated_at();

DROP TRIGGER IF EXISTS trg_scheduled_bulk_reminders_updated_at ON public.scheduled_bulk_reminders;
CREATE TRIGGER trg_scheduled_bulk_reminders_updated_at
  BEFORE UPDATE ON public.scheduled_bulk_reminders
  FOR EACH ROW EXECUTE FUNCTION public.tg_bulk_reminders_updated_at();
