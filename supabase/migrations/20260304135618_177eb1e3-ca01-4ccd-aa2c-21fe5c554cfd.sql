
-- Add payment tracking columns to subscription_requests
ALTER TABLE public.subscription_requests
ADD COLUMN IF NOT EXISTS paymob_order_id text,
ADD COLUMN IF NOT EXISTS payment_status text NOT NULL DEFAULT 'unpaid',
ADD COLUMN IF NOT EXISTS payment_method text,
ADD COLUMN IF NOT EXISTS amount_cents integer,
ADD COLUMN IF NOT EXISTS paid_at timestamptz;

-- Add index for webhook lookups
CREATE INDEX IF NOT EXISTS idx_subscription_requests_paymob_order
ON public.subscription_requests (paymob_order_id)
WHERE paymob_order_id IS NOT NULL;
