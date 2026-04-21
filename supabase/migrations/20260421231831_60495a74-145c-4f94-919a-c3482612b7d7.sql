
-- Create table to store raw Resend webhook events
CREATE TABLE public.email_delivery_events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  message_id TEXT,
  recipient_email TEXT NOT NULL,
  event_type TEXT NOT NULL,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  raw_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  resend_event_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT email_delivery_events_event_type_check CHECK (event_type IN (
    'email.sent',
    'email.delivered',
    'email.delivery_delayed',
    'email.bounced',
    'email.complained',
    'email.opened',
    'email.clicked',
    'email.failed'
  ))
);

CREATE UNIQUE INDEX idx_email_delivery_events_resend_id ON public.email_delivery_events (resend_event_id) WHERE resend_event_id IS NOT NULL;
CREATE INDEX idx_email_delivery_events_message ON public.email_delivery_events (message_id);
CREATE INDEX idx_email_delivery_events_recipient ON public.email_delivery_events (recipient_email);
CREATE INDEX idx_email_delivery_events_type_time ON public.email_delivery_events (event_type, occurred_at DESC);

ALTER TABLE public.email_delivery_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access on delivery events"
  ON public.email_delivery_events FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "Admins and reception can read delivery events"
  ON public.email_delivery_events FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'reception'::app_role));

-- Add latest delivery status columns to email_send_log for fast queries
ALTER TABLE public.email_send_log
  ADD COLUMN IF NOT EXISTS delivery_status TEXT,
  ADD COLUMN IF NOT EXISTS delivery_status_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS bounce_type TEXT,
  ADD COLUMN IF NOT EXISTS bounce_reason TEXT;

CREATE INDEX IF NOT EXISTS idx_email_send_log_delivery_status ON public.email_send_log (delivery_status) WHERE delivery_status IS NOT NULL;
