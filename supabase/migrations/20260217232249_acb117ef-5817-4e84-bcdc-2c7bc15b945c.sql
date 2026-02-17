
-- Push subscriptions for Web Push API
CREATE TABLE public.push_subscriptions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  endpoint TEXT NOT NULL,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, endpoint)
);

ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own push subscriptions"
  ON public.push_subscriptions FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Service role can read all subscriptions"
  ON public.push_subscriptions FOR SELECT
  USING (true);

-- Enable realtime for push_subscriptions
ALTER PUBLICATION supabase_realtime ADD TABLE public.push_subscriptions;
