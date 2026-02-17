
-- Add special discount percentage column to subscriptions
ALTER TABLE public.subscriptions 
ADD COLUMN discount_percentage numeric NOT NULL DEFAULT 0;

-- Add comment for clarity
COMMENT ON COLUMN public.subscriptions.discount_percentage IS 'Special discount percentage applied to this subscription (0-100)';
