
-- ============================================================
-- PHASE 4: DATA QUALITY + AGING
-- ============================================================

CREATE TYPE public.installment_status AS ENUM (
  'pending', 'partial', 'paid', 'cancelled'
);

CREATE TYPE public.data_quality_issue_type AS ENUM (
  'unlinked_payment',
  'amount_mismatch',
  'orphan_paid_installment',
  'duplicate_link',
  'cancelled_subscription_with_payment'
);

-- ============================================================
-- TABLE: subscription_installments
-- ============================================================
CREATE TABLE public.subscription_installments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id uuid NOT NULL REFERENCES public.subscriptions(id) ON DELETE CASCADE,
  student_id uuid NOT NULL,
  installment_number integer NOT NULL,
  due_date date NOT NULL,
  amount numeric(12,2) NOT NULL CHECK (amount > 0),
  paid_amount numeric(12,2) NOT NULL DEFAULT 0 CHECK (paid_amount >= 0),
  status public.installment_status NOT NULL DEFAULT 'pending',
  paid_at timestamptz,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT installment_unique_per_sub UNIQUE (subscription_id, installment_number)
);

CREATE INDEX idx_installments_subscription ON public.subscription_installments(subscription_id);
CREATE INDEX idx_installments_student ON public.subscription_installments(student_id);
CREATE INDEX idx_installments_due_date ON public.subscription_installments(due_date) WHERE status <> 'paid';
CREATE INDEX idx_installments_status ON public.subscription_installments(status);

ALTER TABLE public.subscription_installments ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER enforce_via_rpc_subscription_installments
  BEFORE INSERT OR UPDATE OR DELETE ON public.subscription_installments
  FOR EACH ROW EXECUTE FUNCTION public.enforce_via_rpc();

CREATE TRIGGER update_subscription_installments_updated_at
  BEFORE UPDATE ON public.subscription_installments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE POLICY "Students view own installments"
  ON public.subscription_installments FOR SELECT
  USING (student_id = auth.uid());

CREATE POLICY "Parents view linked children installments"
  ON public.subscription_installments FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.parent_students ps
    WHERE ps.student_id = subscription_installments.student_id
      AND ps.parent_id = auth.uid()
  ));

CREATE POLICY "Staff view all installments"
  ON public.subscription_installments FOR SELECT
  USING (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'reception'::public.app_role)
  );

CREATE POLICY "no_direct_dml_subscription_installments"
  ON public.subscription_installments FOR ALL
  USING (false) WITH CHECK (false);

-- ============================================================
-- ADD installment_id to payments
-- ============================================================
ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS installment_id uuid REFERENCES public.subscription_installments(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_payments_installment ON public.payments(installment_id);

-- ============================================================
-- TABLE: unresolved_payments
-- ============================================================
CREATE TABLE public.unresolved_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id uuid NOT NULL REFERENCES public.payments(id) ON DELETE CASCADE,
  reason text NOT NULL,
  detected_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz,
  resolved_by uuid,
  resolution_notes text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'resolved', 'ignored')),
  CONSTRAINT unresolved_payment_unique UNIQUE (payment_id)
);

CREATE INDEX idx_unresolved_payments_status ON public.unresolved_payments(status);

ALTER TABLE public.unresolved_payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff view unresolved payments"
  ON public.unresolved_payments FOR SELECT
  USING (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'reception'::public.app_role)
  );

CREATE TRIGGER enforce_via_rpc_unresolved_payments
  BEFORE INSERT OR UPDATE OR DELETE ON public.unresolved_payments
  FOR EACH ROW EXECUTE FUNCTION public.enforce_via_rpc();

CREATE POLICY "no_direct_dml_unresolved_payments"
  ON public.unresolved_payments FOR ALL
  USING (false) WITH CHECK (false);

-- ============================================================
-- TABLE: data_quality_issues
-- ============================================================
CREATE TABLE public.data_quality_issues (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  issue_type public.data_quality_issue_type NOT NULL,
  entity_id uuid NOT NULL,
  entity_table text NOT NULL,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  detected_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','resolved','ignored'))
);

CREATE INDEX idx_dq_issues_type ON public.data_quality_issues(issue_type);
CREATE INDEX idx_dq_issues_status ON public.data_quality_issues(status);
CREATE INDEX idx_dq_issues_detected ON public.data_quality_issues(detected_at DESC);

ALTER TABLE public.data_quality_issues ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin view data quality issues"
  ON public.data_quality_issues FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE TRIGGER enforce_via_rpc_data_quality_issues
  BEFORE INSERT OR UPDATE OR DELETE ON public.data_quality_issues
  FOR EACH ROW EXECUTE FUNCTION public.enforce_via_rpc();

CREATE POLICY "no_direct_dml_data_quality_issues"
  ON public.data_quality_issues FOR ALL
  USING (false) WITH CHECK (false);

-- ============================================================
-- RPC: generate_subscription_installments
-- ============================================================
CREATE OR REPLACE FUNCTION public.generate_subscription_installments(p_subscription_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sub record;
  v_count integer := 0;
  v_installment_count integer;
  v_per_installment numeric;
  v_remaining numeric;
  v_due_date date;
  v_i integer;
  v_amount numeric;
BEGIN
  SELECT * INTO v_sub FROM public.subscriptions WHERE id = p_subscription_id FOR UPDATE;
  IF v_sub IS NULL THEN
    RAISE EXCEPTION 'Subscription not found';
  END IF;

  IF EXISTS (SELECT 1 FROM public.subscription_installments WHERE subscription_id = p_subscription_id) THEN
    RETURN 0;
  END IF;

  PERFORM set_config('app.via_rpc', 'true', true);

  IF v_sub.payment_type = 'full' OR v_sub.installment_amount IS NULL OR v_sub.installment_amount <= 0 THEN
    INSERT INTO public.subscription_installments (
      subscription_id, student_id, installment_number, due_date, amount
    ) VALUES (
      p_subscription_id, v_sub.student_id, 1,
      COALESCE(v_sub.start_date, CURRENT_DATE), v_sub.total_amount
    );
    RETURN 1;
  END IF;

  v_installment_count := GREATEST(1, CEIL(v_sub.total_amount / v_sub.installment_amount)::integer);
  v_per_installment := ROUND((v_sub.total_amount / v_installment_count)::numeric, 2);
  v_remaining := v_sub.total_amount;
  v_due_date := COALESCE(v_sub.start_date, CURRENT_DATE);

  FOR v_i IN 1..v_installment_count LOOP
    IF v_i = v_installment_count THEN
      v_amount := v_remaining;
    ELSE
      v_amount := v_per_installment;
      v_remaining := v_remaining - v_per_installment;
    END IF;

    INSERT INTO public.subscription_installments (
      subscription_id, student_id, installment_number, due_date, amount
    ) VALUES (
      p_subscription_id, v_sub.student_id, v_i, v_due_date, v_amount
    );
    v_count := v_count + 1;
    v_due_date := (v_due_date + interval '1 month')::date;
  END LOOP;

  RETURN v_count;
END;
$$;

-- ============================================================
-- RPC: backfill_payment_installments
-- ============================================================
CREATE OR REPLACE FUNCTION public.backfill_payment_installments()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_pay record;
  v_inst record;
  v_linked integer := 0;
  v_unresolved integer := 0;
  v_subs_seeded integer := 0;
  v_sub record;
BEGIN
  IF NOT public.has_role(v_user_id, 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'Only admins can backfill payment installments';
  END IF;

  PERFORM set_config('app.via_rpc', 'true', true);

  FOR v_sub IN
    SELECT s.id FROM public.subscriptions s
    WHERE NOT EXISTS (
      SELECT 1 FROM public.subscription_installments si WHERE si.subscription_id = s.id
    )
  LOOP
    PERFORM public.generate_subscription_installments(v_sub.id);
    v_subs_seeded := v_subs_seeded + 1;
  END LOOP;

  FOR v_pay IN
    SELECT p.id, p.subscription_id, p.amount, p.payment_date
    FROM public.payments p
    WHERE p.installment_id IS NULL
      AND p.payment_type = 'subscription'
      AND p.subscription_id IS NOT NULL
    ORDER BY p.payment_date ASC, p.created_at ASC
  LOOP
    SELECT * INTO v_inst
    FROM public.subscription_installments
    WHERE subscription_id = v_pay.subscription_id
      AND status IN ('pending', 'partial')
      AND ABS(amount - paid_amount - v_pay.amount) < 0.01
    ORDER BY due_date ASC
    LIMIT 1;

    IF v_inst IS NULL THEN
      SELECT * INTO v_inst
      FROM public.subscription_installments
      WHERE subscription_id = v_pay.subscription_id
        AND status IN ('pending', 'partial')
      ORDER BY due_date ASC
      LIMIT 1;
    END IF;

    IF v_inst IS NULL THEN
      INSERT INTO public.unresolved_payments (payment_id, reason)
      VALUES (v_pay.id, 'No matching installment found')
      ON CONFLICT (payment_id) DO NOTHING;
      v_unresolved := v_unresolved + 1;
      CONTINUE;
    END IF;

    UPDATE public.payments SET installment_id = v_inst.id WHERE id = v_pay.id;

    UPDATE public.subscription_installments
    SET paid_amount = LEAST(amount, paid_amount + v_pay.amount),
        status = CASE
          WHEN paid_amount + v_pay.amount >= amount - 0.01 THEN 'paid'::public.installment_status
          ELSE 'partial'::public.installment_status
        END,
        paid_at = CASE
          WHEN paid_amount + v_pay.amount >= amount - 0.01 THEN now()
          ELSE paid_at
        END
    WHERE id = v_inst.id;

    v_linked := v_linked + 1;
  END LOOP;

  RETURN jsonb_build_object(
    'subscriptions_seeded', v_subs_seeded,
    'payments_linked', v_linked,
    'unresolved', v_unresolved,
    'completed_at', now()
  );
END;
$$;

-- ============================================================
-- TRIGGER: auto-generate installments on subscription INSERT
-- ============================================================
CREATE OR REPLACE FUNCTION public.h_auto_gen_installments()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.total_amount > 0 THEN
    PERFORM public.generate_subscription_installments(NEW.id);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS h_auto_gen_installments ON public.subscriptions;
CREATE TRIGGER h_auto_gen_installments
  AFTER INSERT ON public.subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.h_auto_gen_installments();

-- ============================================================
-- TRIGGER: payments → update installment paid_amount/status
-- ============================================================
CREATE OR REPLACE FUNCTION public.i_update_installment_on_payment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_inst record;
  v_new_paid numeric;
BEGIN
  IF TG_OP = 'INSERT' AND NEW.installment_id IS NOT NULL THEN
    SELECT * INTO v_inst FROM public.subscription_installments WHERE id = NEW.installment_id FOR UPDATE;
    IF v_inst IS NULL THEN RETURN NEW; END IF;

    v_new_paid := v_inst.paid_amount + NEW.amount;
    UPDATE public.subscription_installments
    SET paid_amount = v_new_paid,
        status = CASE
          WHEN v_new_paid >= v_inst.amount - 0.01 THEN 'paid'::public.installment_status
          WHEN v_new_paid > 0 THEN 'partial'::public.installment_status
          ELSE 'pending'::public.installment_status
        END,
        paid_at = CASE
          WHEN v_new_paid >= v_inst.amount - 0.01 THEN now()
          ELSE paid_at
        END
    WHERE id = NEW.installment_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS i_update_installment_on_payment ON public.payments;
CREATE TRIGGER i_update_installment_on_payment
  AFTER INSERT ON public.payments
  FOR EACH ROW EXECUTE FUNCTION public.i_update_installment_on_payment();

-- ============================================================
-- RPC: record_payment_with_installment
-- ============================================================
CREATE OR REPLACE FUNCTION public.record_payment_with_installment(
  p_subscription_id uuid,
  p_installment_id uuid,
  p_amount numeric,
  p_payment_method public.payment_method_type,
  p_payment_date date DEFAULT CURRENT_DATE,
  p_transfer_type public.transfer_method_type DEFAULT NULL,
  p_notes text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_inst record;
  v_sub record;
  v_payment_id uuid;
BEGIN
  IF NOT (public.has_role(v_user_id, 'admin'::public.app_role)
       OR public.has_role(v_user_id, 'reception'::public.app_role)) THEN
    RAISE EXCEPTION 'Insufficient permissions to record payment';
  END IF;

  IF p_amount <= 0 THEN
    RAISE EXCEPTION 'Payment amount must be positive';
  END IF;

  SELECT * INTO v_inst FROM public.subscription_installments WHERE id = p_installment_id FOR UPDATE;
  IF v_inst IS NULL THEN
    RAISE EXCEPTION 'Installment not found';
  END IF;
  IF v_inst.subscription_id <> p_subscription_id THEN
    RAISE EXCEPTION 'Installment does not belong to the given subscription';
  END IF;
  IF v_inst.status = 'paid' THEN
    RAISE EXCEPTION 'Installment is already fully paid';
  END IF;
  IF v_inst.status = 'cancelled' THEN
    RAISE EXCEPTION 'Cannot pay a cancelled installment';
  END IF;
  IF p_amount > (v_inst.amount - v_inst.paid_amount) + 0.01 THEN
    RAISE EXCEPTION 'Payment amount (%) exceeds remaining installment balance (%)', p_amount, v_inst.amount - v_inst.paid_amount;
  END IF;

  SELECT * INTO v_sub FROM public.subscriptions WHERE id = p_subscription_id;

  PERFORM set_config('app.via_rpc', 'true', true);

  INSERT INTO public.payments (
    subscription_id, student_id, amount, payment_date,
    payment_method, payment_type, transfer_type, notes,
    recorded_by, installment_id, financial_period_month
  ) VALUES (
    p_subscription_id, v_sub.student_id, p_amount, p_payment_date,
    p_payment_method::text, 'subscription', p_transfer_type, p_notes,
    v_user_id, p_installment_id,
    date_trunc('month', p_payment_date)::date
  )
  RETURNING id INTO v_payment_id;

  RETURN v_payment_id;
END;
$$;

-- ============================================================
-- RPC: check_payment_data_quality
-- ============================================================
CREATE OR REPLACE FUNCTION public.check_payment_data_quality(p_period_month date DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_period_first date := CASE WHEN p_period_month IS NULL THEN NULL ELSE date_trunc('month', p_period_month)::date END;
  v_unlinked integer;
  v_orphan_paid integer;
  v_unresolved_pending integer;
  v_amount_mismatch integer;
BEGIN
  IF NOT (public.has_role(auth.uid(), 'admin'::public.app_role)
       OR public.has_role(auth.uid(), 'reception'::public.app_role)) THEN
    RAISE EXCEPTION 'Insufficient permissions';
  END IF;

  SELECT COUNT(*) INTO v_unlinked
  FROM public.payments
  WHERE payment_type = 'subscription'
    AND installment_id IS NULL
    AND (v_period_first IS NULL OR financial_period_month = v_period_first);

  SELECT COUNT(*) INTO v_orphan_paid
  FROM public.subscription_installments si
  WHERE si.status = 'paid'
    AND NOT EXISTS (SELECT 1 FROM public.payments p WHERE p.installment_id = si.id);

  SELECT COUNT(*) INTO v_unresolved_pending
  FROM public.unresolved_payments
  WHERE status = 'pending';

  SELECT COUNT(*) INTO v_amount_mismatch
  FROM public.subscription_installments si
  WHERE ABS(si.paid_amount - COALESCE(
    (SELECT SUM(p.amount) FROM public.payments p WHERE p.installment_id = si.id), 0
  )) > 0.01;

  RETURN jsonb_build_object(
    'period_month', v_period_first,
    'unlinked_subscription_payments', v_unlinked,
    'orphan_paid_installments', v_orphan_paid,
    'unresolved_pending', v_unresolved_pending,
    'amount_mismatches', v_amount_mismatch,
    'is_clean', (v_unlinked = 0 AND v_orphan_paid = 0 AND v_unresolved_pending = 0 AND v_amount_mismatch = 0),
    'checked_at', now()
  );
END;
$$;

-- ============================================================
-- RPC: check_data_quality_for_close
-- ============================================================
CREATE OR REPLACE FUNCTION public.check_data_quality_for_close(p_period_month date)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_dq jsonb;
BEGIN
  v_dq := public.check_payment_data_quality(p_period_month);
  RETURN (v_dq->>'is_clean')::boolean;
END;
$$;

-- ============================================================
-- RPC: get_aging_receivables (FAIL LOUD)
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_aging_receivables(p_as_of_date date DEFAULT CURRENT_DATE)
RETURNS TABLE (
  student_id uuid,
  student_name text,
  current_due numeric,
  overdue_1_30 numeric,
  overdue_31_60 numeric,
  overdue_61_90 numeric,
  overdue_90_plus numeric,
  total_outstanding numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_unlinked integer;
BEGIN
  IF NOT (public.has_role(auth.uid(), 'admin'::public.app_role)
       OR public.has_role(auth.uid(), 'reception'::public.app_role)) THEN
    RAISE EXCEPTION 'Insufficient permissions';
  END IF;

  SELECT COUNT(*) INTO v_unlinked
  FROM public.payments
  WHERE payment_type = 'subscription' AND installment_id IS NULL;

  IF v_unlinked > 0 THEN
    RAISE EXCEPTION 'AGING_DATA_QUALITY_ERROR: % subscription payments are not linked to installments. Run backfill_payment_installments before generating the aging report.', v_unlinked
      USING ERRCODE = 'data_exception';
  END IF;

  RETURN QUERY
  WITH unpaid AS (
    SELECT
      si.student_id,
      (si.amount - si.paid_amount) AS remaining,
      (p_as_of_date - si.due_date) AS days_overdue
    FROM public.subscription_installments si
    WHERE si.status IN ('pending', 'partial')
      AND si.amount - si.paid_amount > 0.01
  )
  SELECT
    u.student_id,
    COALESCE(pr.full_name, '—') AS student_name,
    SUM(CASE WHEN u.days_overdue <= 0 THEN u.remaining ELSE 0 END) AS current_due,
    SUM(CASE WHEN u.days_overdue BETWEEN 1 AND 30 THEN u.remaining ELSE 0 END) AS overdue_1_30,
    SUM(CASE WHEN u.days_overdue BETWEEN 31 AND 60 THEN u.remaining ELSE 0 END) AS overdue_31_60,
    SUM(CASE WHEN u.days_overdue BETWEEN 61 AND 90 THEN u.remaining ELSE 0 END) AS overdue_61_90,
    SUM(CASE WHEN u.days_overdue > 90 THEN u.remaining ELSE 0 END) AS overdue_90_plus,
    SUM(u.remaining) AS total_outstanding
  FROM unpaid u
  LEFT JOIN public.profiles pr ON pr.user_id = u.student_id
  GROUP BY u.student_id, pr.full_name
  ORDER BY total_outstanding DESC;
END;
$$;

-- ============================================================
-- RPC: get_aging_summary
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_aging_summary(p_as_of_date date DEFAULT CURRENT_DATE)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_unlinked integer;
  v_result jsonb;
BEGIN
  IF NOT (public.has_role(auth.uid(), 'admin'::public.app_role)
       OR public.has_role(auth.uid(), 'reception'::public.app_role)) THEN
    RAISE EXCEPTION 'Insufficient permissions';
  END IF;

  SELECT COUNT(*) INTO v_unlinked
  FROM public.payments
  WHERE payment_type = 'subscription' AND installment_id IS NULL;

  IF v_unlinked > 0 THEN
    RETURN jsonb_build_object(
      'error', 'AGING_DATA_QUALITY_ERROR',
      'unlinked_count', v_unlinked,
      'message', format('%s subscription payments need installment linking before aging is reliable', v_unlinked)
    );
  END IF;

  WITH unpaid AS (
    SELECT
      (si.amount - si.paid_amount) AS remaining,
      (p_as_of_date - si.due_date) AS days_overdue
    FROM public.subscription_installments si
    WHERE si.status IN ('pending', 'partial')
      AND si.amount - si.paid_amount > 0.01
  )
  SELECT jsonb_build_object(
    'as_of', p_as_of_date,
    'current_due', COALESCE(SUM(CASE WHEN days_overdue <= 0 THEN remaining END), 0),
    'overdue_1_30', COALESCE(SUM(CASE WHEN days_overdue BETWEEN 1 AND 30 THEN remaining END), 0),
    'overdue_31_60', COALESCE(SUM(CASE WHEN days_overdue BETWEEN 31 AND 60 THEN remaining END), 0),
    'overdue_61_90', COALESCE(SUM(CASE WHEN days_overdue BETWEEN 61 AND 90 THEN remaining END), 0),
    'overdue_90_plus', COALESCE(SUM(CASE WHEN days_overdue > 90 THEN remaining END), 0),
    'total_outstanding', COALESCE(SUM(remaining), 0),
    'student_count', COUNT(*)
  )
  INTO v_result
  FROM unpaid;

  RETURN v_result;
END;
$$;

-- ============================================================
-- RPC: resolve_unresolved_payment
-- ============================================================
CREATE OR REPLACE FUNCTION public.resolve_unresolved_payment(
  p_unresolved_id uuid,
  p_installment_id uuid,
  p_resolution_notes text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_unres record;
  v_inst record;
  v_pay record;
BEGIN
  IF NOT public.has_role(v_user_id, 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'Only admins can resolve unresolved payments';
  END IF;

  SELECT * INTO v_unres FROM public.unresolved_payments WHERE id = p_unresolved_id FOR UPDATE;
  IF v_unres IS NULL OR v_unres.status <> 'pending' THEN
    RAISE EXCEPTION 'Unresolved payment not found or already handled';
  END IF;

  SELECT * INTO v_pay FROM public.payments WHERE id = v_unres.payment_id FOR UPDATE;
  SELECT * INTO v_inst FROM public.subscription_installments WHERE id = p_installment_id FOR UPDATE;

  IF v_inst IS NULL THEN
    RAISE EXCEPTION 'Target installment not found';
  END IF;
  IF v_inst.subscription_id <> v_pay.subscription_id THEN
    RAISE EXCEPTION 'Installment belongs to a different subscription';
  END IF;

  PERFORM set_config('app.via_rpc', 'true', true);

  UPDATE public.payments SET installment_id = p_installment_id WHERE id = v_pay.id;

  UPDATE public.subscription_installments
  SET paid_amount = LEAST(amount, paid_amount + v_pay.amount),
      status = CASE
        WHEN paid_amount + v_pay.amount >= amount - 0.01 THEN 'paid'::public.installment_status
        ELSE 'partial'::public.installment_status
      END,
      paid_at = CASE
        WHEN paid_amount + v_pay.amount >= amount - 0.01 THEN now()
        ELSE paid_at
      END
  WHERE id = p_installment_id;

  UPDATE public.unresolved_payments
  SET status = 'resolved',
      resolved_by = v_user_id,
      resolved_at = now(),
      resolution_notes = p_resolution_notes
  WHERE id = p_unresolved_id;
END;
$$;

-- ============================================================
-- Pin search_path
-- ============================================================
ALTER FUNCTION public.generate_subscription_installments(uuid) SET search_path = public;
ALTER FUNCTION public.backfill_payment_installments() SET search_path = public;
ALTER FUNCTION public.h_auto_gen_installments() SET search_path = public;
ALTER FUNCTION public.i_update_installment_on_payment() SET search_path = public;
ALTER FUNCTION public.record_payment_with_installment(uuid, uuid, numeric, public.payment_method_type, date, public.transfer_method_type, text) SET search_path = public;
ALTER FUNCTION public.check_payment_data_quality(date) SET search_path = public;
ALTER FUNCTION public.check_data_quality_for_close(date) SET search_path = public;
ALTER FUNCTION public.get_aging_receivables(date) SET search_path = public;
ALTER FUNCTION public.get_aging_summary(date) SET search_path = public;
ALTER FUNCTION public.resolve_unresolved_payment(uuid, uuid, text) SET search_path = public;

-- ============================================================
-- Register approved RPCs
-- ============================================================
INSERT INTO public.approved_financial_rpcs (rpc_name, description) VALUES
  ('generate_subscription_installments', 'Phase 4: Auto-generate installment schedule for a subscription'),
  ('backfill_payment_installments', 'Phase 4: One-time + repeatable payment→installment linker'),
  ('record_payment_with_installment', 'Phase 4: Canonical subscription payment recording with installment'),
  ('check_payment_data_quality', 'Phase 4: Monitor unlinked payments and amount mismatches'),
  ('check_data_quality_for_close', 'Phase 4: Period-close gate for data quality'),
  ('get_aging_receivables', 'Phase 4: Per-student aging buckets, fail-loud on dirty data'),
  ('get_aging_summary', 'Phase 4: Aging totals for dashboards'),
  ('resolve_unresolved_payment', 'Phase 4: Manual resolution of unlinked payment')
ON CONFLICT (rpc_name) DO NOTHING;
