-- Add admin channel override to email_event_mappings
-- Allows admin to force a notification event to specific channel(s),
-- overriding individual user preferences.
-- Values: 'user_choice' (default — user preference applies),
--         'email_only', 'telegram_only', 'both', 'none'

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'email_event_mappings'
      AND column_name = 'admin_channel_override'
  ) THEN
    ALTER TABLE public.email_event_mappings
      ADD COLUMN admin_channel_override text NOT NULL DEFAULT 'user_choice'
      CHECK (admin_channel_override IN ('user_choice','email_only','telegram_only','both','none'));
  END IF;
END $$;

-- Update get_user_notification_channels to honor admin override
CREATE OR REPLACE FUNCTION public.get_user_notification_channels(
  p_user_id uuid,
  p_event_key text
)
RETURNS TABLE(email_enabled boolean, telegram_enabled boolean)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_override text;
  v_user_email boolean;
  v_user_telegram boolean;
BEGIN
  -- 1) Read admin override for this event
  SELECT admin_channel_override INTO v_override
  FROM public.email_event_mappings
  WHERE event_key = p_event_key;

  -- If no mapping exists OR override = user_choice, fall through to user preferences
  IF v_override IS NULL OR v_override = 'user_choice' THEN
    SELECT
      COALESCE(p.email_enabled, true),
      COALESCE(p.telegram_enabled, true)
    INTO v_user_email, v_user_telegram
    FROM public.notification_channel_preferences p
    WHERE p.user_id = p_user_id AND p.event_key = p_event_key;

    RETURN QUERY SELECT
      COALESCE(v_user_email, true),
      COALESCE(v_user_telegram, true);
    RETURN;
  END IF;

  -- 2) Admin override applies — ignore user preference
  IF v_override = 'email_only' THEN
    RETURN QUERY SELECT true, false;
  ELSIF v_override = 'telegram_only' THEN
    RETURN QUERY SELECT false, true;
  ELSIF v_override = 'both' THEN
    RETURN QUERY SELECT true, true;
  ELSIF v_override = 'none' THEN
    RETURN QUERY SELECT false, false;
  ELSE
    RETURN QUERY SELECT true, true;
  END IF;
END;
$$;

-- Helper RPC: dismiss telegram link prompt (records timestamp on profile)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'profiles'
      AND column_name = 'telegram_prompt_dismissed_at'
  ) THEN
    ALTER TABLE public.profiles
      ADD COLUMN telegram_prompt_dismissed_at timestamptz;
  END IF;
END $$;