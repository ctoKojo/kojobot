
-- Function to auto-initialize salary snapshots for all active employees for a given month
CREATE OR REPLACE FUNCTION public.init_salary_month(p_month date DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_month date;
  v_count int := 0;
  v_emp record;
BEGIN
  -- Default to current month
  v_month := COALESCE(p_month, date_trunc('month', now())::date);

  -- Loop through all active employees with a base salary
  FOR v_emp IN
    SELECT es.employee_id, es.base_salary
    FROM employee_salaries es
    JOIN user_roles ur ON ur.user_id = es.employee_id
    JOIN profiles p ON p.user_id = es.employee_id
    WHERE es.is_active = true
      AND p.employment_status != 'terminated'
      AND ur.role IN ('instructor', 'reception')
  LOOP
    -- Only create if no snapshot exists yet
    IF NOT EXISTS (
      SELECT 1 FROM salary_month_snapshots
      WHERE employee_id = v_emp.employee_id AND month = v_month
    ) THEN
      INSERT INTO salary_month_snapshots (employee_id, month, base_amount, total_earnings, total_bonuses, total_deductions, net_amount, status)
      VALUES (v_emp.employee_id, v_month, v_emp.base_salary, 0, 0, 0, v_emp.base_salary, 'open');
      v_count := v_count + 1;
    END IF;
  END LOOP;

  RETURN jsonb_build_object('initialized', v_count, 'month', v_month);
END;
$$;
