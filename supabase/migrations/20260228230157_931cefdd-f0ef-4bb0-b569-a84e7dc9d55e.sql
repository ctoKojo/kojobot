
-- 1. chatbot_rate_limits table
CREATE TABLE public.chatbot_rate_limits (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  student_id UUID NOT NULL UNIQUE,
  minute_count INTEGER NOT NULL DEFAULT 0,
  minute_reset_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  daily_count INTEGER NOT NULL DEFAULT 0,
  daily_reset_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.chatbot_rate_limits ENABLE ROW LEVEL SECURITY;
-- No policies = service_role only access

-- 2. chatbot_reports table
CREATE TABLE public.chatbot_reports (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  student_id UUID NOT NULL,
  conversation_id UUID NOT NULL REFERENCES public.chatbot_conversations(id) ON DELETE CASCADE,
  reported_message_id UUID NOT NULL REFERENCES public.chatbot_messages(id) ON DELETE CASCADE,
  context_messages JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.chatbot_reports ENABLE ROW LEVEL SECURITY;

-- Student can insert reports for their own conversations
CREATE POLICY "Students can report their own messages"
  ON public.chatbot_reports
  FOR INSERT
  TO authenticated
  WITH CHECK (
    student_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.chatbot_conversations cc
      WHERE cc.id = conversation_id AND cc.student_id = auth.uid()
    )
  );

-- Admin can read all reports
CREATE POLICY "Admins can read all reports"
  ON public.chatbot_reports
  FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

-- 3. Atomic rate limit RPC
CREATE OR REPLACE FUNCTION public.check_and_increment_chatbot_rate(p_student_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_rec RECORD;
  v_now TIMESTAMPTZ := now();
  v_minute_limit CONSTANT INTEGER := 6;
  v_daily_limit CONSTANT INTEGER := 120;
  v_cairo_tomorrow TIMESTAMPTZ;
  v_retry_after INTEGER := 0;
BEGIN
  -- Calculate Cairo tomorrow start
  v_cairo_tomorrow := (date_trunc('day', v_now AT TIME ZONE 'Africa/Cairo') + interval '1 day') AT TIME ZONE 'Africa/Cairo';

  -- Upsert + lock
  INSERT INTO chatbot_rate_limits (student_id, minute_count, minute_reset_at, daily_count, daily_reset_at)
  VALUES (p_student_id, 0, v_now + interval '1 minute', 0, v_cairo_tomorrow)
  ON CONFLICT (student_id) DO NOTHING;

  SELECT * INTO v_rec
  FROM chatbot_rate_limits
  WHERE student_id = p_student_id
  FOR UPDATE;

  -- Reset minute window if expired
  IF v_rec.minute_reset_at <= v_now THEN
    v_rec.minute_count := 0;
    v_rec.minute_reset_at := v_now + interval '1 minute';
  END IF;

  -- Reset daily window if expired
  IF v_rec.daily_reset_at <= v_now THEN
    v_rec.daily_count := 0;
    v_rec.daily_reset_at := v_cairo_tomorrow;
  END IF;

  -- Check limits
  IF v_rec.minute_count >= v_minute_limit THEN
    v_retry_after := GREATEST(1, EXTRACT(EPOCH FROM (v_rec.minute_reset_at - v_now))::INTEGER);
    UPDATE chatbot_rate_limits
    SET minute_count = v_rec.minute_count, minute_reset_at = v_rec.minute_reset_at,
        daily_count = v_rec.daily_count, daily_reset_at = v_rec.daily_reset_at
    WHERE student_id = p_student_id;

    RETURN jsonb_build_object(
      'allowed', false,
      'minute_remaining', 0,
      'daily_remaining', GREATEST(0, v_daily_limit - v_rec.daily_count),
      'retry_after_seconds', v_retry_after
    );
  END IF;

  IF v_rec.daily_count >= v_daily_limit THEN
    v_retry_after := GREATEST(1, EXTRACT(EPOCH FROM (v_rec.daily_reset_at - v_now))::INTEGER);
    UPDATE chatbot_rate_limits
    SET minute_count = v_rec.minute_count, minute_reset_at = v_rec.minute_reset_at,
        daily_count = v_rec.daily_count, daily_reset_at = v_rec.daily_reset_at
    WHERE student_id = p_student_id;

    RETURN jsonb_build_object(
      'allowed', false,
      'minute_remaining', GREATEST(0, v_minute_limit - v_rec.minute_count),
      'daily_remaining', 0,
      'retry_after_seconds', v_retry_after
    );
  END IF;

  -- Increment and save
  v_rec.minute_count := v_rec.minute_count + 1;
  v_rec.daily_count := v_rec.daily_count + 1;

  UPDATE chatbot_rate_limits
  SET minute_count = v_rec.minute_count, minute_reset_at = v_rec.minute_reset_at,
      daily_count = v_rec.daily_count, daily_reset_at = v_rec.daily_reset_at
  WHERE student_id = p_student_id;

  RETURN jsonb_build_object(
    'allowed', true,
    'minute_remaining', v_minute_limit - v_rec.minute_count,
    'daily_remaining', v_daily_limit - v_rec.daily_count,
    'retry_after_seconds', 0
  );
END;
$$;

-- REVOKE from all roles except service_role
REVOKE EXECUTE ON FUNCTION public.check_and_increment_chatbot_rate(UUID) FROM public, anon, authenticated;
