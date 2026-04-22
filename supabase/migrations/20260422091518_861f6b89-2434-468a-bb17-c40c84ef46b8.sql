-- 1. Telegram account links
CREATE TABLE public.telegram_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  chat_id bigint NOT NULL UNIQUE,
  telegram_username text,
  telegram_first_name text,
  is_active boolean NOT NULL DEFAULT true,
  linked_at timestamptz NOT NULL DEFAULT now(),
  unlinked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_telegram_links_user_id ON public.telegram_links(user_id);
CREATE INDEX idx_telegram_links_chat_id ON public.telegram_links(chat_id);

ALTER TABLE public.telegram_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own telegram link"
  ON public.telegram_links FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own telegram link"
  ON public.telegram_links FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own telegram link"
  ON public.telegram_links FOR DELETE
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all telegram links"
  ON public.telegram_links FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

-- 2. Linking codes (one-time codes to claim a chat_id)
CREATE TABLE public.telegram_link_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  code text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  used_at timestamptz,
  used_chat_id bigint,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_telegram_link_codes_user_id ON public.telegram_link_codes(user_id);
CREATE INDEX idx_telegram_link_codes_code ON public.telegram_link_codes(code) WHERE used_at IS NULL;

ALTER TABLE public.telegram_link_codes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own link codes"
  ON public.telegram_link_codes FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own link codes"
  ON public.telegram_link_codes FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- 3. Per-event channel preferences
CREATE TABLE public.notification_channel_preferences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  event_key text NOT NULL,
  email_enabled boolean NOT NULL DEFAULT true,
  telegram_enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, event_key)
);

CREATE INDEX idx_notif_prefs_user_event ON public.notification_channel_preferences(user_id, event_key);

ALTER TABLE public.notification_channel_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own notification preferences"
  ON public.notification_channel_preferences FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can view all preferences"
  ON public.notification_channel_preferences FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

-- 4. Telegram send log (mirrors email_send_log shape)
CREATE TABLE public.telegram_send_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  chat_id bigint NOT NULL,
  template_name text NOT NULL,
  status text NOT NULL,
  message_id bigint,
  error_message text,
  metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_telegram_send_log_user ON public.telegram_send_log(user_id, created_at DESC);
CREATE INDEX idx_telegram_send_log_template ON public.telegram_send_log(template_name, created_at DESC);

ALTER TABLE public.telegram_send_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view telegram send log"
  ON public.telegram_send_log FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

-- 5. Bot polling state (singleton)
CREATE TABLE public.telegram_bot_state (
  id int PRIMARY KEY CHECK (id = 1),
  update_offset bigint NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.telegram_bot_state (id, update_offset) VALUES (1, 0);

ALTER TABLE public.telegram_bot_state ENABLE ROW LEVEL SECURITY;
-- No policies = service-role only

-- 6. Inbox for incoming Telegram messages (for /start linking and future commands)
CREATE TABLE public.telegram_inbox (
  update_id bigint PRIMARY KEY,
  chat_id bigint NOT NULL,
  text text,
  raw_update jsonb NOT NULL,
  processed boolean NOT NULL DEFAULT false,
  processed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_telegram_inbox_chat_id ON public.telegram_inbox(chat_id);
CREATE INDEX idx_telegram_inbox_unprocessed ON public.telegram_inbox(processed) WHERE processed = false;

ALTER TABLE public.telegram_inbox ENABLE ROW LEVEL SECURITY;
-- No policies = service-role only

-- Updated_at triggers
CREATE TRIGGER trg_telegram_links_updated_at
  BEFORE UPDATE ON public.telegram_links
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER trg_notif_prefs_updated_at
  BEFORE UPDATE ON public.notification_channel_preferences
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- RPC: Generate a 6-character link code for current user
CREATE OR REPLACE FUNCTION public.generate_telegram_link_code()
RETURNS TABLE(code text, expires_at timestamptz)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_code text;
  v_expires timestamptz;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'unauthorized';
  END IF;

  -- Invalidate any pending codes for this user
  UPDATE public.telegram_link_codes
    SET used_at = now()
    WHERE user_id = v_user AND used_at IS NULL;

  -- Generate a 6-char alphanumeric code (uppercase, no confusing chars)
  v_code := upper(substring(translate(encode(gen_random_bytes(8), 'base64'), '+/=OIl0', 'XYZ123') from 1 for 6));
  v_expires := now() + interval '15 minutes';

  INSERT INTO public.telegram_link_codes (user_id, code, expires_at)
    VALUES (v_user, v_code, v_expires);

  RETURN QUERY SELECT v_code, v_expires;
END;
$$;

GRANT EXECUTE ON FUNCTION public.generate_telegram_link_code() TO authenticated;

-- RPC: Get effective channel preference for a user+event
-- Defaults: both channels ON if no row exists
CREATE OR REPLACE FUNCTION public.get_user_notification_channels(p_user_id uuid, p_event_key text)
RETURNS TABLE(email_enabled boolean, telegram_enabled boolean)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    COALESCE(p.email_enabled, true) AS email_enabled,
    COALESCE(p.telegram_enabled, true) AS telegram_enabled
  FROM (SELECT 1) AS dummy
  LEFT JOIN public.notification_channel_preferences p
    ON p.user_id = p_user_id AND p.event_key = p_event_key;
$$;

GRANT EXECUTE ON FUNCTION public.get_user_notification_channels(uuid, text) TO authenticated, service_role;