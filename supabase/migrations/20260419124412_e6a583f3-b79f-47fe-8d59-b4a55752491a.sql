
-- ============================================================================
-- PHASE 2.1: Chart of Accounts
-- ============================================================================

CREATE TYPE public.account_type AS ENUM ('asset','liability','equity','revenue','expense');
CREATE TYPE public.normal_side_type AS ENUM ('debit','credit');
CREATE TYPE public.journal_entry_status AS ENUM ('draft','posted','reversed');
CREATE TYPE public.journal_source_type AS ENUM ('payment','expense','salary','manual','adjustment','closing','reversal');

CREATE TABLE public.chart_of_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  name_ar text NOT NULL,
  account_type public.account_type NOT NULL,
  normal_side public.normal_side_type NOT NULL,
  parent_id uuid REFERENCES public.chart_of_accounts(id) ON DELETE RESTRICT,
  is_control boolean NOT NULL DEFAULT false,
  is_system boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  description text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_coa_code ON public.chart_of_accounts(code);
CREATE INDEX idx_coa_parent ON public.chart_of_accounts(parent_id);
CREATE INDEX idx_coa_type ON public.chart_of_accounts(account_type) WHERE is_active;

ALTER TABLE public.chart_of_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can view COA"
  ON public.chart_of_accounts FOR SELECT
  USING (
    public.has_role(auth.uid(), 'admin'::app_role) OR
    public.has_role(auth.uid(), 'reception'::app_role)
  );

INSERT INTO public.chart_of_accounts (code, name, name_ar, account_type, normal_side, is_control, is_system) VALUES
('1000','Assets','الأصول','asset','debit',false,true),
('1100','Current Assets','الأصول المتداولة','asset','debit',false,true),
('1110','Cash on Hand','النقدية بالخزينة','asset','debit',false,true),
('1120','Bank Account','الحساب البنكي','asset','debit',false,true),
('1130','InstaPay Wallet','محفظة إنستا باي','asset','debit',false,true),
('1140','E-Wallet','المحفظة الإلكترونية','asset','debit',false,true),
('1200','Accounts Receivable','الذمم المدينة','asset','debit',true,true),
('1210','Students Receivable','حسابات الطلاب','asset','debit',true,true),
('1300','Employee Advances','سلف الموظفين','asset','debit',true,true),
('2000','Liabilities','الخصوم','liability','credit',false,true),
('2100','Current Liabilities','الخصوم المتداولة','liability','credit',false,true),
('2110','Salaries Payable','رواتب مستحقة','liability','credit',true,true),
('2120','Accrued Expenses','مصروفات مستحقة','liability','credit',false,true),
('2200','Deferred Revenue','إيرادات مؤجلة','liability','credit',false,true),
('3000','Equity','حقوق الملكية','equity','credit',false,true),
('3100','Owner Capital','رأس المال','equity','credit',false,true),
('3200','Retained Earnings','الأرباح المحتجزة','equity','credit',false,true),
('3300','Current Year P&L','أرباح/خسائر العام الجاري','equity','credit',false,true),
('4000','Revenue','الإيرادات','revenue','credit',false,true),
('4100','Subscription Revenue','إيرادات الاشتراكات','revenue','credit',false,true),
('4200','Other Revenue','إيرادات أخرى','revenue','credit',false,true),
('5000','Expenses','المصروفات','expense','debit',false,true),
('5100','Salaries Expense','مصروف الرواتب','expense','debit',false,true),
('5200','Bonuses Expense','مصروف المكافآت','expense','debit',false,true),
('5300','Operating Expenses','مصروفات تشغيلية','expense','debit',false,true),
('5310','Rent Expense','إيجار','expense','debit',false,true),
('5320','Utilities Expense','مرافق','expense','debit',false,true),
('5330','Marketing Expense','تسويق','expense','debit',false,true),
('5340','Office Supplies','مستلزمات مكتبية','expense','debit',false,true),
('5350','Software & Tools','برامج وأدوات','expense','debit',false,true),
('5390','Other Expenses','مصروفات أخرى','expense','debit',false,true);

UPDATE public.chart_of_accounts SET parent_id = (SELECT id FROM public.chart_of_accounts WHERE code='1000') WHERE code IN ('1100','1200','1300');
UPDATE public.chart_of_accounts SET parent_id = (SELECT id FROM public.chart_of_accounts WHERE code='1100') WHERE code IN ('1110','1120','1130','1140');
UPDATE public.chart_of_accounts SET parent_id = (SELECT id FROM public.chart_of_accounts WHERE code='1200') WHERE code='1210';
UPDATE public.chart_of_accounts SET parent_id = (SELECT id FROM public.chart_of_accounts WHERE code='2000') WHERE code IN ('2100','2200');
UPDATE public.chart_of_accounts SET parent_id = (SELECT id FROM public.chart_of_accounts WHERE code='2100') WHERE code IN ('2110','2120');
UPDATE public.chart_of_accounts SET parent_id = (SELECT id FROM public.chart_of_accounts WHERE code='3000') WHERE code IN ('3100','3200','3300');
UPDATE public.chart_of_accounts SET parent_id = (SELECT id FROM public.chart_of_accounts WHERE code='4000') WHERE code IN ('4100','4200');
UPDATE public.chart_of_accounts SET parent_id = (SELECT id FROM public.chart_of_accounts WHERE code='5000') WHERE code IN ('5100','5200','5300','5390');
UPDATE public.chart_of_accounts SET parent_id = (SELECT id FROM public.chart_of_accounts WHERE code='5300') WHERE code IN ('5310','5320','5330','5340','5350');

-- ============================================================================
-- PHASE 2.2: Payment Accounts Mapping
-- ============================================================================

CREATE TABLE public.payment_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_method public.payment_method_type NOT NULL,
  transfer_type public.transfer_method_type,
  gl_account_id uuid NOT NULL REFERENCES public.chart_of_accounts(id),
  is_active boolean NOT NULL DEFAULT true,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX uq_payment_accounts_method_cash
  ON public.payment_accounts(payment_method)
  WHERE transfer_type IS NULL;
CREATE UNIQUE INDEX uq_payment_accounts_method_transfer
  ON public.payment_accounts(payment_method, transfer_type)
  WHERE transfer_type IS NOT NULL;

ALTER TABLE public.payment_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can view payment accounts"
  ON public.payment_accounts FOR SELECT
  USING (
    public.has_role(auth.uid(), 'admin'::app_role) OR
    public.has_role(auth.uid(), 'reception'::app_role)
  );

INSERT INTO public.payment_accounts (payment_method, transfer_type, gl_account_id) VALUES
('cash', NULL, (SELECT id FROM public.chart_of_accounts WHERE code='1110')),
('transfer', 'bank', (SELECT id FROM public.chart_of_accounts WHERE code='1120')),
('transfer', 'instapay', (SELECT id FROM public.chart_of_accounts WHERE code='1130')),
('transfer', 'wallet', (SELECT id FROM public.chart_of_accounts WHERE code='1140'));

-- ============================================================================
-- PHASE 2.3: Customer & Employee Subledgers
-- ============================================================================

CREATE TABLE public.customer_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL UNIQUE REFERENCES public.profiles(user_id) ON DELETE CASCADE,
  control_account_id uuid NOT NULL REFERENCES public.chart_of_accounts(id),
  cached_balance numeric(14,2) NOT NULL DEFAULT 0,
  cached_balance_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_cust_acc_student ON public.customer_accounts(student_id);

ALTER TABLE public.customer_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can view customer accounts"
  ON public.customer_accounts FOR SELECT
  USING (
    public.has_role(auth.uid(), 'admin'::app_role) OR
    public.has_role(auth.uid(), 'reception'::app_role)
  );

CREATE POLICY "Students view own customer account"
  ON public.customer_accounts FOR SELECT
  USING (student_id = auth.uid());

CREATE POLICY "Linked parents view children customer accounts"
  ON public.customer_accounts FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.parent_students ps
    WHERE ps.student_id = customer_accounts.student_id
      AND ps.parent_id = auth.uid()
  ));

CREATE TABLE public.employee_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL UNIQUE REFERENCES public.profiles(user_id) ON DELETE CASCADE,
  control_account_id uuid NOT NULL REFERENCES public.chart_of_accounts(id),
  cached_balance numeric(14,2) NOT NULL DEFAULT 0,
  cached_balance_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_emp_acc_employee ON public.employee_accounts(employee_id);

ALTER TABLE public.employee_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can view employee accounts"
  ON public.employee_accounts FOR SELECT
  USING (
    public.has_role(auth.uid(), 'admin'::app_role) OR
    public.has_role(auth.uid(), 'reception'::app_role)
  );

CREATE POLICY "Employees view own"
  ON public.employee_accounts FOR SELECT
  USING (employee_id = auth.uid());

-- ============================================================================
-- PHASE 2.4: Journal Entries
-- ============================================================================

CREATE SEQUENCE public.voucher_no_seq START 1;

CREATE TABLE public.journal_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  voucher_no text NOT NULL UNIQUE,
  entry_date date NOT NULL,
  posted_at timestamptz,
  status public.journal_entry_status NOT NULL DEFAULT 'draft',
  source public.journal_source_type NOT NULL,
  source_id uuid,
  description text,
  description_ar text,
  total_debit numeric(14,2) NOT NULL DEFAULT 0,
  total_credit numeric(14,2) NOT NULL DEFAULT 0,
  financial_period_month date NOT NULL,
  reversed_by_entry_id uuid REFERENCES public.journal_entries(id),
  reversal_of_entry_id uuid REFERENCES public.journal_entries(id),
  created_by uuid NOT NULL,
  posted_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_je_period_status ON public.journal_entries(financial_period_month, status) WHERE status='posted';
CREATE INDEX idx_je_source ON public.journal_entries(source, source_id);
CREATE INDEX idx_je_date ON public.journal_entries(entry_date DESC);

ALTER TABLE public.journal_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff view JE"
  ON public.journal_entries FOR SELECT
  USING (
    public.has_role(auth.uid(), 'admin'::app_role) OR
    public.has_role(auth.uid(), 'reception'::app_role)
  );

CREATE TABLE public.journal_entry_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  journal_entry_id uuid NOT NULL REFERENCES public.journal_entries(id) ON DELETE CASCADE,
  line_no int NOT NULL,
  account_id uuid NOT NULL REFERENCES public.chart_of_accounts(id),
  customer_account_id uuid REFERENCES public.customer_accounts(id),
  employee_account_id uuid REFERENCES public.employee_accounts(id),
  debit numeric(14,2) NOT NULL DEFAULT 0,
  credit numeric(14,2) NOT NULL DEFAULT 0,
  description text,
  posted_at timestamptz,
  financial_period_month date NOT NULL,
  CONSTRAINT chk_debit_or_credit CHECK (
    (debit > 0 AND credit = 0) OR (debit = 0 AND credit > 0)
  ),
  CONSTRAINT chk_subledger_one CHECK (
    NOT (customer_account_id IS NOT NULL AND employee_account_id IS NOT NULL)
  ),
  UNIQUE (journal_entry_id, line_no)
);

CREATE INDEX idx_jel_account_posted ON public.journal_entry_lines(account_id, posted_at DESC) WHERE posted_at IS NOT NULL;
CREATE INDEX idx_jel_customer ON public.journal_entry_lines(customer_account_id, posted_at DESC) WHERE customer_account_id IS NOT NULL;
CREATE INDEX idx_jel_employee ON public.journal_entry_lines(employee_account_id, posted_at DESC) WHERE employee_account_id IS NOT NULL;
CREATE INDEX idx_jel_period ON public.journal_entry_lines(financial_period_month);

ALTER TABLE public.journal_entry_lines ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff view JE lines"
  ON public.journal_entry_lines FOR SELECT
  USING (
    public.has_role(auth.uid(), 'admin'::app_role) OR
    public.has_role(auth.uid(), 'reception'::app_role)
  );

CREATE POLICY "Customer sees own JE lines"
  ON public.journal_entry_lines FOR SELECT
  USING (
    customer_account_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.customer_accounts ca
      WHERE ca.id = journal_entry_lines.customer_account_id
        AND (ca.student_id = auth.uid() OR EXISTS (
          SELECT 1 FROM public.parent_students ps
          WHERE ps.student_id = ca.student_id AND ps.parent_id = auth.uid()
        ))
    )
  );

CREATE POLICY "Employee sees own JE lines"
  ON public.journal_entry_lines FOR SELECT
  USING (
    employee_account_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.employee_accounts ea
      WHERE ea.id = journal_entry_lines.employee_account_id
        AND ea.employee_id = auth.uid()
    )
  );

CREATE TRIGGER enforce_via_rpc_je
  BEFORE INSERT OR UPDATE OR DELETE ON public.journal_entries
  FOR EACH ROW EXECUTE FUNCTION public.enforce_via_rpc();

CREATE TRIGGER enforce_via_rpc_jel
  BEFORE INSERT OR UPDATE OR DELETE ON public.journal_entry_lines
  FOR EACH ROW EXECUTE FUNCTION public.enforce_via_rpc();

CREATE TRIGGER enforce_via_rpc_cust_acc
  BEFORE INSERT OR UPDATE OR DELETE ON public.customer_accounts
  FOR EACH ROW EXECUTE FUNCTION public.enforce_via_rpc();

CREATE TRIGGER enforce_via_rpc_emp_acc
  BEFORE INSERT OR UPDATE OR DELETE ON public.employee_accounts
  FOR EACH ROW EXECUTE FUNCTION public.enforce_via_rpc();

-- ============================================================================
-- PHASE 2.5: Balance Alerts
-- ============================================================================

CREATE TYPE public.balance_alert_status AS ENUM ('pending','acknowledged','rebuilt','false_positive');
CREATE TYPE public.balance_alert_method AS ENUM ('trigger','page','cron');
CREATE TYPE public.balance_account_type AS ENUM ('customer','employee','gl');

CREATE TABLE public.balance_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_type public.balance_account_type NOT NULL,
  account_id uuid NOT NULL,
  cached_balance numeric(14,2) NOT NULL,
  computed_balance numeric(14,2) NOT NULL,
  difference numeric(14,2) NOT NULL,
  detected_at timestamptz NOT NULL DEFAULT now(),
  detected_by_method public.balance_alert_method NOT NULL,
  detected_by uuid,
  status public.balance_alert_status NOT NULL DEFAULT 'pending',
  acknowledged_at timestamptz,
  acknowledged_by uuid,
  rebuilt_at timestamptz,
  rebuilt_by uuid,
  notes text
);

CREATE INDEX idx_balance_alerts_pending ON public.balance_alerts(detected_at DESC) WHERE status='pending';
CREATE INDEX idx_balance_alerts_account ON public.balance_alerts(account_type, account_id);

ALTER TABLE public.balance_alerts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage balance alerts"
  ON public.balance_alerts FOR ALL
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- ============================================================================
-- PHASE 2.6: Voucher No Generator
-- ============================================================================

CREATE OR REPLACE FUNCTION public.generate_voucher_no(p_source public.journal_source_type, p_date date DEFAULT CURRENT_DATE)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_prefix text;
  v_seq bigint;
BEGIN
  v_prefix := CASE p_source
    WHEN 'payment' THEN 'PV'
    WHEN 'expense' THEN 'EV'
    WHEN 'salary' THEN 'SV'
    WHEN 'manual' THEN 'JV'
    WHEN 'adjustment' THEN 'AJ'
    WHEN 'closing' THEN 'CL'
    WHEN 'reversal' THEN 'RV'
    ELSE 'GV'
  END;
  v_seq := nextval('public.voucher_no_seq');
  RETURN v_prefix || '-' || to_char(p_date,'YYYYMM') || '-' || lpad(v_seq::text, 6, '0');
END;
$$;

-- ============================================================================
-- PHASE 2.7: Balance Validation Trigger
-- ============================================================================

CREATE OR REPLACE FUNCTION public.b_validate_journal_balance()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_total_d numeric(14,2);
  v_total_c numeric(14,2);
BEGIN
  IF NEW.status = 'posted' AND (OLD.status IS DISTINCT FROM 'posted') THEN
    SELECT COALESCE(SUM(debit),0), COALESCE(SUM(credit),0)
      INTO v_total_d, v_total_c
    FROM public.journal_entry_lines
    WHERE journal_entry_id = NEW.id;

    IF v_total_d = 0 OR v_total_c = 0 THEN
      RAISE EXCEPTION 'JOURNAL_EMPTY: Cannot post entry % with no lines', NEW.voucher_no;
    END IF;

    IF abs(v_total_d - v_total_c) > 0.005 THEN
      RAISE EXCEPTION 'JOURNAL_UNBALANCED: voucher % debits (%) != credits (%)',
        NEW.voucher_no, v_total_d, v_total_c;
    END IF;

    NEW.total_debit := v_total_d;
    NEW.total_credit := v_total_c;
    NEW.posted_at := COALESCE(NEW.posted_at, now());

    UPDATE public.journal_entry_lines
       SET posted_at = NEW.posted_at,
           financial_period_month = NEW.financial_period_month
     WHERE journal_entry_id = NEW.id;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER b_validate_journal_balance_trg
  BEFORE UPDATE ON public.journal_entries
  FOR EACH ROW EXECUTE FUNCTION public.b_validate_journal_balance();

-- ============================================================================
-- PHASE 2.8: updated_at triggers
-- ============================================================================

CREATE TRIGGER trg_coa_updated_at
  BEFORE UPDATE ON public.chart_of_accounts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER trg_je_updated_at
  BEFORE UPDATE ON public.journal_entries
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER trg_cust_acc_updated_at
  BEFORE UPDATE ON public.customer_accounts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER trg_emp_acc_updated_at
  BEFORE UPDATE ON public.employee_accounts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================================
-- PHASE 2.9: Register approved RPCs
-- ============================================================================

INSERT INTO public.approved_financial_rpcs (rpc_name, description) VALUES
  ('post_journal_entry', 'Posts a draft JE after balance validation'),
  ('reverse_journal_entry', 'Creates a reversal JE for an existing posted entry'),
  ('get_or_create_customer_account', 'Idempotent customer subledger setup'),
  ('get_or_create_employee_account', 'Idempotent employee subledger setup'),
  ('rebuild_customer_balance', 'Recompute customer cached balance from JE lines'),
  ('rebuild_employee_balance', 'Recompute employee cached balance from JE lines'),
  ('post_payment_journal', 'Auto-post journal for a payment'),
  ('post_expense_journal', 'Auto-post journal for an expense'),
  ('post_salary_journal', 'Auto-post journal for a salary payment')
ON CONFLICT (rpc_name) DO NOTHING;
