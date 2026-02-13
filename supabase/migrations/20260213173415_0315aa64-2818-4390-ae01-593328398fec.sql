
-- =============================================
-- SALARY WALLET SYSTEM - Sprint 1 Migration (Fixed)
-- =============================================

-- 1. salary_events table (Immutable Ledger)
CREATE TABLE public.salary_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL,
  month DATE NOT NULL,
  event_type TEXT NOT NULL CHECK (event_type IN ('base_salary', 'hourly_earning', 'bonus', 'deduction', 'warning_deduction')),
  amount NUMERIC NOT NULL CHECK (amount > 0),
  description TEXT,
  description_ar TEXT,
  source TEXT NOT NULL CHECK (source IN ('system', 'manual', 'warning_rule', 'session')),
  reference_id UUID,
  is_reversal BOOLEAN NOT NULL DEFAULT false,
  reversed_event_id UUID REFERENCES public.salary_events(id),
  metadata JSONB NOT NULL DEFAULT '{}',
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_salary_events_employee_month ON public.salary_events(employee_id, month);
CREATE INDEX idx_salary_events_created_at ON public.salary_events(created_at);
CREATE INDEX idx_salary_events_reversed ON public.salary_events(reversed_event_id) WHERE reversed_event_id IS NOT NULL;

ALTER TABLE public.salary_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage salary events"
  ON public.salary_events FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Employees can view their own events"
  ON public.salary_events FOR SELECT
  USING (employee_id = auth.uid());

-- 2. salary_month_snapshots table (Cache)
CREATE TABLE public.salary_month_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL,
  month DATE NOT NULL,
  base_amount NUMERIC NOT NULL DEFAULT 0,
  total_earnings NUMERIC NOT NULL DEFAULT 0,
  total_bonuses NUMERIC NOT NULL DEFAULT 0,
  total_deductions NUMERIC NOT NULL DEFAULT 0,
  net_amount NUMERIC NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'locked', 'paid')),
  finalized_at TIMESTAMPTZ,
  finalized_by UUID,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(employee_id, month)
);

ALTER TABLE public.salary_month_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage salary snapshots"
  ON public.salary_month_snapshots FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Employees can view their own snapshots"
  ON public.salary_month_snapshots FOR SELECT
  USING (employee_id = auth.uid());

-- 3. TRIGGER 1: Prevent mutation (immutable ledger)
CREATE OR REPLACE FUNCTION public.prevent_salary_events_mutation()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  RAISE EXCEPTION 'salary_events is append-only. Use a reversal event instead.';
  RETURN NULL;
END;
$$;

CREATE TRIGGER trg_prevent_salary_events_mutation
  BEFORE UPDATE OR DELETE ON public.salary_events
  FOR EACH ROW EXECUTE FUNCTION public.prevent_salary_events_mutation();

-- 4. TRIGGER 2: Enforce month lock
CREATE OR REPLACE FUNCTION public.enforce_month_lock()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
DECLARE v_status TEXT;
BEGIN
  SELECT status INTO v_status
  FROM public.salary_month_snapshots
  WHERE employee_id = NEW.employee_id AND month = NEW.month
  FOR UPDATE;

  IF v_status IS NULL THEN RETURN NEW; END IF;

  IF v_status = 'paid' THEN
    RAISE EXCEPTION 'Cannot add events to a paid month';
  END IF;

  IF v_status = 'locked' AND NEW.is_reversal = false THEN
    RAISE EXCEPTION 'Month is locked. Only reversal events allowed';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_enforce_month_lock
  BEFORE INSERT ON public.salary_events
  FOR EACH ROW EXECUTE FUNCTION public.enforce_month_lock();

-- 5. TRIGGER 3: Recalculate snapshot (FIXED: handle NULL base salary)
CREATE OR REPLACE FUNCTION public.recalculate_salary_snapshot()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_base NUMERIC;
  v_earnings NUMERIC;
  v_bonuses NUMERIC;
  v_deductions NUMERIC;
  v_net NUMERIC;
BEGIN
  -- Get base salary (default 0 if not found)
  SELECT COALESCE(es.base_salary, 0) INTO v_base
  FROM public.employee_salaries es
  WHERE es.employee_id = NEW.employee_id AND es.is_active = true
  ORDER BY es.effective_from DESC LIMIT 1;

  v_base := COALESCE(v_base, 0);

  SELECT
    COALESCE(SUM(CASE WHEN event_type = 'hourly_earning' AND NOT is_reversal THEN amount
                      WHEN event_type = 'hourly_earning' AND is_reversal THEN -amount ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN event_type IN ('bonus', 'base_salary') AND NOT is_reversal THEN amount
                      WHEN event_type IN ('bonus', 'base_salary') AND is_reversal THEN -amount ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN event_type IN ('deduction', 'warning_deduction') AND NOT is_reversal THEN amount
                      WHEN event_type IN ('deduction', 'warning_deduction') AND is_reversal THEN -amount ELSE 0 END), 0)
  INTO v_earnings, v_bonuses, v_deductions
  FROM public.salary_events
  WHERE employee_id = NEW.employee_id AND month = NEW.month;

  v_net := v_base + v_earnings + v_bonuses - v_deductions;

  INSERT INTO public.salary_month_snapshots (employee_id, month, base_amount, total_earnings, total_bonuses, total_deductions, net_amount, updated_at)
  VALUES (NEW.employee_id, NEW.month, v_base, v_earnings, v_bonuses, v_deductions, v_net, now())
  ON CONFLICT (employee_id, month) DO UPDATE SET
    base_amount = EXCLUDED.base_amount,
    total_earnings = EXCLUDED.total_earnings,
    total_bonuses = EXCLUDED.total_bonuses,
    total_deductions = EXCLUDED.total_deductions,
    net_amount = EXCLUDED.net_amount,
    updated_at = now();

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_recalculate_salary_snapshot
  AFTER INSERT ON public.salary_events
  FOR EACH ROW EXECUTE FUNCTION public.recalculate_salary_snapshot();

-- 6. TRIGGER 4: Auto warning deduction
CREATE OR REPLACE FUNCTION public.auto_warning_deduction()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_warning_count INTEGER;
  v_rule RECORD;
  v_current_month DATE;
  v_existing UUID;
  v_new_net NUMERIC;
BEGIN
  IF NEW.is_active = false THEN RETURN NEW; END IF;

  v_current_month := date_trunc('month', CURRENT_DATE)::date;

  SELECT COUNT(*) INTO v_warning_count
  FROM public.instructor_warnings
  WHERE instructor_id = NEW.instructor_id AND warning_type = NEW.warning_type AND is_active = true;

  FOR v_rule IN
    SELECT * FROM public.warning_deduction_rules
    WHERE warning_type = NEW.warning_type AND is_active = true AND warning_count <= v_warning_count
    ORDER BY warning_count DESC LIMIT 1
  LOOP
    SELECT id INTO v_existing
    FROM public.salary_events
    WHERE employee_id = NEW.instructor_id AND month = v_current_month
      AND event_type = 'warning_deduction' AND source = 'warning_rule'
      AND reference_id = NEW.id AND NOT is_reversal
    LIMIT 1;

    IF v_existing IS NULL THEN
      INSERT INTO public.salary_events (employee_id, month, event_type, amount, description, description_ar, source, reference_id, created_by, metadata)
      VALUES (
        NEW.instructor_id, v_current_month, 'warning_deduction', v_rule.deduction_amount,
        format('Warning deduction: %s warnings of type %s', v_warning_count, NEW.warning_type),
        format('خصم إنذار: %s إنذارات من نوع %s', v_warning_count, NEW.warning_type),
        'warning_rule', NEW.id, NEW.issued_by,
        jsonb_build_object('warning_type', NEW.warning_type, 'warning_count', v_warning_count, 'rule_id', v_rule.id)
      );

      SELECT net_amount INTO v_new_net FROM public.salary_month_snapshots
      WHERE employee_id = NEW.instructor_id AND month = v_current_month;

      INSERT INTO public.notifications (user_id, type, category, title, title_ar, message, message_ar, action_url)
      VALUES (
        NEW.instructor_id, 'warning', 'financial',
        'Warning Deduction Applied', 'تم تطبيق خصم إنذار',
        format('Deduction of %s EGP applied. Current balance: %s EGP', v_rule.deduction_amount, COALESCE(v_new_net, 0)),
        format('تم خصم %s ج.م. رصيدك الحالي: %s ج.م', v_rule.deduction_amount, COALESCE(v_new_net, 0)),
        '/profile'
      );
    END IF;
  END LOOP;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_auto_warning_deduction
  AFTER INSERT ON public.instructor_warnings
  FOR EACH ROW EXECUTE FUNCTION public.auto_warning_deduction();

-- 7. Rebuild snapshot function
CREATE OR REPLACE FUNCTION public.rebuild_salary_snapshot(p_employee_id UUID, p_month DATE)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_base NUMERIC;
  v_earnings NUMERIC;
  v_bonuses NUMERIC;
  v_deductions NUMERIC;
  v_net NUMERIC;
BEGIN
  SELECT COALESCE(es.base_salary, 0) INTO v_base
  FROM public.employee_salaries es
  WHERE es.employee_id = p_employee_id AND es.is_active = true
  ORDER BY es.effective_from DESC LIMIT 1;

  v_base := COALESCE(v_base, 0);

  SELECT
    COALESCE(SUM(CASE WHEN event_type = 'hourly_earning' AND NOT is_reversal THEN amount
                      WHEN event_type = 'hourly_earning' AND is_reversal THEN -amount ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN event_type IN ('bonus', 'base_salary') AND NOT is_reversal THEN amount
                      WHEN event_type IN ('bonus', 'base_salary') AND is_reversal THEN -amount ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN event_type IN ('deduction', 'warning_deduction') AND NOT is_reversal THEN amount
                      WHEN event_type IN ('deduction', 'warning_deduction') AND is_reversal THEN -amount ELSE 0 END), 0)
  INTO v_earnings, v_bonuses, v_deductions
  FROM public.salary_events WHERE employee_id = p_employee_id AND month = p_month;

  v_net := v_base + v_earnings + v_bonuses - v_deductions;

  INSERT INTO public.salary_month_snapshots (employee_id, month, base_amount, total_earnings, total_bonuses, total_deductions, net_amount, updated_at)
  VALUES (p_employee_id, p_month, v_base, v_earnings, v_bonuses, v_deductions, v_net, now())
  ON CONFLICT (employee_id, month) DO UPDATE SET
    base_amount = EXCLUDED.base_amount, total_earnings = EXCLUDED.total_earnings,
    total_bonuses = EXCLUDED.total_bonuses, total_deductions = EXCLUDED.total_deductions,
    net_amount = EXCLUDED.net_amount, updated_at = now();
END;
$$;

-- 8. Data migration
INSERT INTO public.salary_events (employee_id, month, event_type, amount, description, description_ar, source, metadata, created_at)
SELECT sp.employee_id, sp.month, 'bonus', sp.bonus,
  COALESCE(sp.bonus_reason, 'Migrated bonus'), COALESCE(sp.bonus_reason_ar, 'بونص مُرحّل'),
  'manual', jsonb_build_object('migrated_from', 'salary_payments', 'original_id', sp.id), sp.created_at
FROM public.salary_payments sp WHERE sp.base_amount = 0 AND sp.bonus > 0;

INSERT INTO public.salary_events (employee_id, month, event_type, amount, description, description_ar, source, metadata, created_at)
SELECT sp.employee_id, sp.month, 'deduction', sp.deductions,
  COALESCE(sp.deduction_reason, 'Migrated deduction'), COALESCE(sp.deduction_reason_ar, 'خصم مُرحّل'),
  'manual', jsonb_build_object('migrated_from', 'salary_payments', 'original_id', sp.id), sp.created_at
FROM public.salary_payments sp WHERE sp.base_amount = 0 AND sp.deductions > 0;
