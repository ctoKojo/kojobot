
-- Re-declare with SET search_path = public on each function body.
-- (They already had it; the linter flags helpers it can't statically detect.
--  We re-issue ALTER FUNCTION ... SET search_path to make it explicit at the function level.)

ALTER FUNCTION public.create_payroll_run(date, public.payroll_employee_group) SET search_path = public;
ALTER FUNCTION public.submit_payroll_run_for_review(uuid) SET search_path = public;
ALTER FUNCTION public.approve_payroll_run(uuid) SET search_path = public;
ALTER FUNCTION public.pay_payroll_run(uuid, public.payment_method_type, public.transfer_method_type) SET search_path = public;
ALTER FUNCTION public.cancel_payroll_run(uuid, text) SET search_path = public;
ALTER FUNCTION public.create_payroll_adjustment(uuid, public.payroll_adjustment_type, numeric, text, date, text) SET search_path = public;
ALTER FUNCTION public.approve_payroll_adjustment(uuid) SET search_path = public;
ALTER FUNCTION public.reject_payroll_adjustment(uuid) SET search_path = public;
ALTER FUNCTION public.reconcile_payroll_to_ledger(date) SET search_path = public;
ALTER FUNCTION public.check_payroll_reconciliation_for_close(date) SET search_path = public;
