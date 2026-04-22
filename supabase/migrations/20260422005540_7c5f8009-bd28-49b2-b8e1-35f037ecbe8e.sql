CREATE OR REPLACE FUNCTION public.auto_log_financial_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $function$
DECLARE
  v_entity_type text := TG_TABLE_NAME;
  v_action text;
  v_period date;
  v_amount numeric;
  v_details jsonb;
BEGIN
  v_action := lower(TG_OP);

  CASE TG_TABLE_NAME
    WHEN 'payments' THEN
      v_period := COALESCE(NEW.financial_period_month, OLD.financial_period_month);
      v_amount := COALESCE(NEW.amount, OLD.amount);
      v_details := jsonb_build_object(
        'student_id', COALESCE(NEW.student_id, OLD.student_id),
        'payment_method', COALESCE(NEW.payment_method, OLD.payment_method),
        'payment_type', COALESCE(NEW.payment_type, OLD.payment_type)
      );
    WHEN 'expenses' THEN
      v_period := COALESCE(NEW.financial_period_month, OLD.financial_period_month);
      v_amount := COALESCE(NEW.amount, OLD.amount);
      v_details := jsonb_build_object(
        'category', COALESCE(NEW.category, OLD.category),
        'description', COALESCE(NEW.description, OLD.description)
      );
    WHEN 'journal_entries' THEN
      v_period := date_trunc('month', COALESCE(NEW.entry_date, OLD.entry_date))::date;
      v_amount := COALESCE(NEW.total_debit, OLD.total_debit);
      v_details := jsonb_build_object(
        'voucher_no', COALESCE(NEW.voucher_no, OLD.voucher_no),
        'status', COALESCE(NEW.status, OLD.status),
        'source', COALESCE(NEW.source::text, OLD.source::text)
      );
    WHEN 'salary_payments' THEN
      v_period := date_trunc('month', COALESCE(NEW.payment_date, OLD.payment_date))::date;
      v_amount := COALESCE(NEW.net_amount, OLD.net_amount);
      v_details := jsonb_build_object(
        'employee_id', COALESCE(NEW.employee_id, OLD.employee_id)
      );
    WHEN 'payroll_runs' THEN
      v_period := COALESCE(NEW.period_month, OLD.period_month);
      v_amount := COALESCE(NEW.total_net, OLD.total_net);
      v_details := jsonb_build_object(
        'status', COALESCE(NEW.status, OLD.status),
        'employee_count', COALESCE(NEW.employee_count, OLD.employee_count)
      );
    WHEN 'financial_periods' THEN
      v_period := COALESCE(NEW.period_month, OLD.period_month);
      v_amount := NULL;
      v_details := jsonb_build_object(
        'old_status', OLD.status,
        'new_status', NEW.status,
        'reopen_reason', NEW.reopen_reason
      );
    ELSE
      v_details := '{}'::jsonb;
  END CASE;

  PERFORM log_financial_action(
    v_entity_type,
    COALESCE(NEW.id, OLD.id),
    v_action,
    v_period,
    v_amount,
    v_details,
    'auto_trigger'
  );

  RETURN COALESCE(NEW, OLD);
END;
$function$;