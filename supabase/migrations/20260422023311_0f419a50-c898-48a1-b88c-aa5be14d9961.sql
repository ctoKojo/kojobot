INSERT INTO public.approved_financial_rpcs (rpc_name, description, version)
VALUES (
  'transfer_treasury_funds',
  'تحويل أموال بين حسابات الخزينة (نقدي/بنك/محافظ) - ينشئ قيد محاسبي متوازن تلقائياً',
  1
)
ON CONFLICT (rpc_name) DO UPDATE SET
  description = EXCLUDED.description;