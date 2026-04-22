-- Fix search_path on log_financial_action so digest() (from pgcrypto in extensions schema) is resolvable
ALTER FUNCTION public.log_financial_action(text, uuid, text, date, numeric, jsonb, text)
  SET search_path TO 'public', 'extensions';

-- Also harden the auto_log_financial_change trigger function (called by triggers)
ALTER FUNCTION public.auto_log_financial_change()
  SET search_path TO 'public', 'extensions';