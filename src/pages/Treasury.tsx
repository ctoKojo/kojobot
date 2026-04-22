import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { DashboardLayout } from '@/components/DashboardLayout';
import { PageHeader } from '@/components/shared/PageHeader';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Wallet, Banknote, Smartphone, CreditCard, RefreshCw, Database, ArrowDownCircle, ArrowUpCircle, CheckCircle2, AlertCircle, Scale, Heart, AlertTriangle, ArrowRightLeft } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { TreasuryTransferDialog } from '@/components/treasury/TreasuryTransferDialog';

interface TreasuryBalance {
  account_code: string;
  account_name: string;
  account_name_ar: string;
  balance: number;
}

interface TreasuryTxn {
  line_id: string;
  entry_id: string;
  voucher_no: string;
  entry_date: string;
  posted_at: string;
  source: string;
  source_id: string;
  account_code: string;
  account_name: string;
  debit: number;
  credit: number;
  description: string;
}

const ACCOUNT_META: Record<string, { icon: React.ElementType; gradient: string }> = {
  '1110': { icon: Banknote, gradient: 'from-emerald-500/20 to-emerald-500/5' },
  '1120': { icon: Wallet, gradient: 'from-blue-500/20 to-blue-500/5' },
  '1130': { icon: Smartphone, gradient: 'from-purple-500/20 to-purple-500/5' },
  '1140': { icon: CreditCard, gradient: 'from-orange-500/20 to-orange-500/5' },
};

const formatEGP = (n: number) =>
  new Intl.NumberFormat('en-EG', { style: 'currency', currency: 'EGP', maximumFractionDigits: 2 }).format(n);

export default function Treasury() {
  const { isRTL } = useLanguage();
  const { role } = useAuth();
  const queryClient = useQueryClient();
  const [filterAccount, setFilterAccount] = useState<string>('all');
  const [filterSource, setFilterSource] = useState<string>('all');
  const [fromDate, setFromDate] = useState<string>('');
  const [toDate, setToDate] = useState<string>('');
  const [openingAmount, setOpeningAmount] = useState<string>('');
  const [openingDate, setOpeningDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [openingNotes, setOpeningNotes] = useState<string>('');
  const [reconAccount, setReconAccount] = useState<string>('1110');
  const [reconActual, setReconActual] = useState<string>('');
  const [reconNotes, setReconNotes] = useState<string>('');
  const [transferOpen, setTransferOpen] = useState(false);

  const balancesQuery = useQuery({
    queryKey: ['treasury-balances'],
    queryFn: async () => {
      const { data, error } = await (supabase.rpc as any)('get_treasury_balances');
      if (error) throw error;
      return (data ?? []) as TreasuryBalance[];
    },
    refetchInterval: 30_000,
  });

  const txnsQuery = useQuery({
    queryKey: ['treasury-transactions', filterAccount, filterSource, fromDate, toDate],
    queryFn: async () => {
      // When user picks "Bank", fetch all then filter to include both 1120 + 1130 (InstaPay merged)
      const isBankMerged = filterAccount === '1120';
      const { data, error } = await (supabase.rpc as any)('get_treasury_transactions', {
        p_limit: 200,
        p_account_code: filterAccount === 'all' || isBankMerged ? null : filterAccount,
        p_from_date: fromDate || null,
        p_to_date: toDate || null,
        p_source: filterSource === 'all' ? null : filterSource,
      });
      if (error) throw error;
      const rows = (data ?? []) as TreasuryTxn[];
      return isBankMerged
        ? rows.filter((r) => r.account_code === '1120' || r.account_code === '1130')
        : rows;
    },
  });

  const backfillMutation = useMutation({
    mutationFn: async (dryRun: boolean) => {
      const { data, error } = await (supabase.rpc as any)('backfill_historical_journal_entries', {
        p_dry_run: dryRun,
      });
      if (error) throw error;
      return data as {
        dry_run: boolean;
        created_payment_je: number;
        created_expense_je: number;
        created_salary_je: number;
        skipped: number;
        errors: any[];
        total_created: number;
      };
    },
    onSuccess: (result) => {
      const label = result.dry_run ? (isRTL ? 'معاينة' : 'Preview') : (isRTL ? 'تم' : 'Done');
      toast.success(
        `${label}: ${result.total_created} ${isRTL ? 'قيد' : 'entries'} (${result.created_payment_je} ${isRTL ? 'دفعات' : 'payments'} • ${result.created_expense_je} ${isRTL ? 'مصروفات' : 'expenses'} • ${result.created_salary_je} ${isRTL ? 'رواتب' : 'salaries'})`,
      );
      if (!result.dry_run) {
        queryClient.invalidateQueries({ queryKey: ['treasury-balances'] });
        queryClient.invalidateQueries({ queryKey: ['treasury-transactions'] });
      }
      if (result.errors?.length > 0) {
        toast.error(`${result.errors.length} ${isRTL ? 'أخطاء' : 'errors'} - ${isRTL ? 'راجع الـ console' : 'check console'}`);
        console.error('Backfill errors:', result.errors);
      }
    },
    onError: (e: any) => toast.error(e.message ?? 'Backfill failed'),
  });

  const refreshMvMutation = useMutation({
    mutationFn: async () => {
      const { error } = await (supabase.rpc as any)('refresh_account_balances_mv');
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(isRTL ? 'تم تحديث الأرصدة' : 'Balances refreshed');
      queryClient.invalidateQueries({ queryKey: ['treasury-balances'] });
    },
    onError: (e: any) => toast.error(e.message ?? 'Refresh failed'),
  });

  // Opening balance status
  const openingStatusQuery = useQuery({
    queryKey: ['treasury-opening-status'],
    queryFn: async () => {
      const { data, error } = await (supabase.rpc as any)('get_treasury_opening_balance_status');
      if (error) throw error;
      return data as {
        is_set: boolean;
        amount?: number;
        as_of_date?: string;
        voucher_no?: string;
        posted_at?: string;
        description?: string;
      };
    },
  });

  const openingMutation = useMutation({
    mutationFn: async () => {
      const amt = parseFloat(openingAmount);
      if (!isFinite(amt) || amt <= 0) throw new Error(isRTL ? 'أدخل مبلغ صحيح' : 'Enter a valid amount');
      const { data, error } = await (supabase.rpc as any)('set_treasury_opening_balance', {
        p_amount: amt,
        p_as_of_date: openingDate,
        p_notes: openingNotes || null,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success(isRTL ? 'تم تسجيل الرصيد الافتتاحي' : 'Opening balance set');
      setOpeningAmount('');
      setOpeningNotes('');
      queryClient.invalidateQueries({ queryKey: ['treasury-balances'] });
      queryClient.invalidateQueries({ queryKey: ['treasury-transactions'] });
      queryClient.invalidateQueries({ queryKey: ['treasury-opening-status'] });
    },
    onError: (e: any) => toast.error(e.message ?? 'Failed'),
  });

  // Reconciliation summary
  const reconQuery = useQuery({
    queryKey: ['treasury-reconciliation'],
    queryFn: async () => {
      const { data, error } = await (supabase.rpc as any)('get_treasury_reconciliation_summary');
      if (error) throw error;
      return (data ?? []) as Array<{ account_code: string; account_name: string; account_name_ar: string; computed_balance: number }>;
    },
    refetchInterval: 30_000,
  });

  const adjustmentMutation = useMutation({
    mutationFn: async () => {
      const amt = parseFloat(reconActual);
      if (!isFinite(amt) || amt < 0) throw new Error(isRTL ? 'أدخل مبلغ صحيح' : 'Enter a valid amount');
      const { data, error } = await (supabase.rpc as any)('record_treasury_adjustment', {
        p_account_code: reconAccount,
        p_actual_amount: amt,
        p_notes: reconNotes || null,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (result: any) => {
      if (result?.no_adjustment_needed) {
        toast.success(isRTL ? 'الرصيد مطابق — لا حاجة لتسوية' : 'Balance matches — no adjustment needed');
      } else {
        toast.success(
          isRTL
            ? `تم تسجيل قيد تسوية ${result.difference > 0 ? 'زيادة' : 'عجز'} بمبلغ ${formatEGP(Math.abs(result.difference))}`
            : `Recorded ${result.difference > 0 ? 'surplus' : 'shortage'} adjustment of ${formatEGP(Math.abs(result.difference))}`,
        );
      }
      setReconActual('');
      setReconNotes('');
      queryClient.invalidateQueries({ queryKey: ['treasury-balances'] });
      queryClient.invalidateQueries({ queryKey: ['treasury-transactions'] });
      queryClient.invalidateQueries({ queryKey: ['treasury-reconciliation'] });
    },
    onError: (e: any) => toast.error(e.message ?? 'Adjustment failed'),
  });

  // Health check: balance alerts
  const alertsQuery = useQuery({
    queryKey: ['treasury-balance-alerts'],
    queryFn: async () => {
      const { data, error } = await (supabase.rpc as any)('get_pending_balance_alerts');
      if (error) throw error;
      return (data ?? []) as Array<{
        id: string;
        account_label: string;
        cached_balance: number;
        computed_balance: number;
        difference: number;
        detected_at: string;
        status: string;
      }>;
    },
    refetchInterval: 60_000,
  });

  // Merge InstaPay (1130) into Bank (1120) — they're the same account operationally
  const mergedBalances = (() => {
    const raw = balancesQuery.data ?? [];
    const bank = raw.find((b) => b.account_code === '1120');
    const insta = raw.find((b) => b.account_code === '1130');
    const others = raw.filter((b) => b.account_code !== '1120' && b.account_code !== '1130');
    const bankMerged: TreasuryBalance | null = (bank || insta)
      ? {
          account_code: '1120',
          account_name: 'Bank (incl. InstaPay)',
          account_name_ar: 'البنك (شامل إنستا باي)',
          balance: Number(bank?.balance ?? 0) + Number(insta?.balance ?? 0),
        }
      : null;
    // Order: Cash → Bank(+Insta) → E-Wallet
    const ordered: TreasuryBalance[] = [];
    const cash = others.find((b) => b.account_code === '1110');
    const wallet = others.find((b) => b.account_code === '1140');
    if (cash) ordered.push(cash);
    if (bankMerged) ordered.push(bankMerged);
    if (wallet) ordered.push(wallet);
    // Append any other unexpected accounts
    others.filter((b) => b.account_code !== '1110' && b.account_code !== '1140').forEach((b) => ordered.push(b));
    return ordered;
  })();

  const totalLiquidity = mergedBalances.reduce((s, b) => s + Number(b.balance), 0);

  const getSourceBadge = (source: string) => {
    const map: Record<string, { label: string; labelAr: string; variant: any }> = {
      payment: { label: 'Payment', labelAr: 'دفعة', variant: 'default' },
      expense: { label: 'Expense', labelAr: 'مصروف', variant: 'destructive' },
      salary: { label: 'Salary', labelAr: 'راتب', variant: 'secondary' },
      adjustment: { label: 'Adjustment', labelAr: 'تسوية', variant: 'outline' },
    };
    const m = map[source] ?? { label: source, labelAr: source, variant: 'outline' as const };
    return <Badge variant={m.variant}>{isRTL ? m.labelAr : m.label}</Badge>;
  };

  return (
    <DashboardLayout>
      <div className="container mx-auto p-4 md:p-6 space-y-6">
        <PageHeader
          title={isRTL ? 'الخزنة المالية' : 'Treasury'}
          subtitle={isRTL ? 'الأرصدة اللحظية وحركات السيولة من دفتر اليومية' : 'Live liquidity balances and cash movements from the journal'}
          icon={Wallet}
          gradient="from-emerald-500 to-blue-500"
          actions={
            <Button
              variant="outline"
              size="sm"
              onClick={() => refreshMvMutation.mutate()}
              disabled={refreshMvMutation.isPending}
            >
              <RefreshCw className={`h-4 w-4 ${isRTL ? 'ml-2' : 'mr-2'} ${refreshMvMutation.isPending ? 'animate-spin' : ''}`} />
              {isRTL ? 'تحديث الأرصدة' : 'Refresh Balances'}
            </Button>
          }
        />

        {/* Liquidity Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {balancesQuery.isLoading ? (
            Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-32" />)
          ) : (
            <>
              {mergedBalances.map((b) => {
                const meta = ACCOUNT_META[b.account_code] ?? { icon: Wallet, gradient: 'from-muted to-muted/50' };
                const Icon = meta.icon;
                return (
                  <Card key={b.account_code} className={`bg-gradient-to-br ${meta.gradient} border-border/50`}>
                    <CardHeader className="pb-2">
                      <div className="flex items-center justify-between">
                        <CardDescription className="text-xs font-medium">
                          {isRTL ? b.account_name_ar : b.account_name}
                        </CardDescription>
                        <Icon className="h-5 w-5 text-muted-foreground" />
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold tracking-tight">{formatEGP(Number(b.balance))}</div>
                      <p className="text-xs text-muted-foreground mt-1">#{b.account_code}</p>
                    </CardContent>
                  </Card>
                );
              })}
              <Card className="bg-gradient-to-br from-primary/20 to-primary/5 border-primary/30">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardDescription className="text-xs font-bold text-primary">
                      {isRTL ? 'إجمالي السيولة' : 'Total Liquidity'}
                    </CardDescription>
                    <Wallet className="h-5 w-5 text-primary" />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold tracking-tight text-primary">{formatEGP(totalLiquidity)}</div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {isRTL ? `مجموع ${mergedBalances.length} حسابات` : `${mergedBalances.length} accounts sum`}
                  </p>
                </CardContent>
              </Card>
            </>
          )}
        </div>

        <Tabs defaultValue="transactions" className="space-y-4">
          <TabsList className="grid w-full md:w-auto md:inline-grid grid-cols-2 md:grid-cols-4">
            <TabsTrigger value="transactions">{isRTL ? 'الحركات' : 'Transactions'}</TabsTrigger>
            <TabsTrigger value="reconciliation">{isRTL ? 'مطابقة الكاش' : 'Reconciliation'}</TabsTrigger>
            <TabsTrigger value="health">
              {isRTL ? 'فحص الصحة' : 'Health'}
              {(alertsQuery.data?.length ?? 0) > 0 && (
                <Badge variant="destructive" className="ml-2 h-4 px-1 text-[10px]">{alertsQuery.data?.length}</Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="maintenance">{isRTL ? 'الصيانة' : 'Maintenance'}</TabsTrigger>
          </TabsList>

          {/* Transactions Tab */}
          <TabsContent value="transactions" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">{isRTL ? 'الحركات الأخيرة' : 'Recent Movements'}</CardTitle>
                <CardDescription>
                  {isRTL ? 'كل الحركات المرحلة على حسابات السيولة' : 'All posted lines hitting cash accounts'}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Filters */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                  <div>
                    <Label className="text-xs">{isRTL ? 'الحساب' : 'Account'}</Label>
                    <Select value={filterAccount} onValueChange={setFilterAccount}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">{isRTL ? 'الكل' : 'All'}</SelectItem>
                        <SelectItem value="1110">{isRTL ? 'نقدي' : 'Cash'}</SelectItem>
                        <SelectItem value="1120">{isRTL ? 'بنك (شامل إنستا باي)' : 'Bank (incl. InstaPay)'}</SelectItem>
                        <SelectItem value="1140">{isRTL ? 'محفظة' : 'E-Wallet'}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs">{isRTL ? 'النوع' : 'Source'}</Label>
                    <Select value={filterSource} onValueChange={setFilterSource}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">{isRTL ? 'الكل' : 'All'}</SelectItem>
                        <SelectItem value="payment">{isRTL ? 'دفعة' : 'Payment'}</SelectItem>
                        <SelectItem value="expense">{isRTL ? 'مصروف' : 'Expense'}</SelectItem>
                        <SelectItem value="salary">{isRTL ? 'راتب' : 'Salary'}</SelectItem>
                        <SelectItem value="adjustment">{isRTL ? 'تسوية' : 'Adjustment'}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs">{isRTL ? 'من' : 'From'}</Label>
                    <Input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
                  </div>
                  <div>
                    <Label className="text-xs">{isRTL ? 'إلى' : 'To'}</Label>
                    <Input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} />
                  </div>
                </div>

                {/* Table */}
                <div className="rounded-lg border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{isRTL ? 'التاريخ' : 'Date'}</TableHead>
                        <TableHead>{isRTL ? 'سند' : 'Voucher'}</TableHead>
                        <TableHead>{isRTL ? 'النوع' : 'Source'}</TableHead>
                        <TableHead>{isRTL ? 'الحساب' : 'Account'}</TableHead>
                        <TableHead className="text-end">{isRTL ? 'مدين' : 'Debit'}</TableHead>
                        <TableHead className="text-end">{isRTL ? 'دائن' : 'Credit'}</TableHead>
                        <TableHead>{isRTL ? 'الوصف' : 'Description'}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {txnsQuery.isLoading ? (
                        <TableRow><TableCell colSpan={7}><Skeleton className="h-32" /></TableCell></TableRow>
                      ) : txnsQuery.data?.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={7} className="text-center text-muted-foreground py-12">
                            {isRTL ? 'لا توجد حركات — اضغط Backfill في تبويب الصيانة' : 'No movements yet — click Backfill in the Maintenance tab'}
                          </TableCell>
                        </TableRow>
                      ) : (
                        txnsQuery.data?.map((t) => (
                          <TableRow key={t.line_id}>
                            <TableCell className="font-mono text-xs">
                              {format(new Date(t.entry_date), 'yyyy-MM-dd')}
                            </TableCell>
                            <TableCell className="font-mono text-xs">{t.voucher_no}</TableCell>
                            <TableCell>{getSourceBadge(t.source)}</TableCell>
                            <TableCell className="text-sm">
                              <span className="font-mono text-xs text-muted-foreground">#{t.account_code}</span>{' '}
                              {t.account_name}
                            </TableCell>
                            <TableCell className="text-end font-mono">
                              {Number(t.debit) > 0 && (
                                <span className="text-emerald-600 dark:text-emerald-400 inline-flex items-center gap-1">
                                  <ArrowDownCircle className="h-3 w-3" />
                                  {formatEGP(Number(t.debit))}
                                </span>
                              )}
                            </TableCell>
                            <TableCell className="text-end font-mono">
                              {Number(t.credit) > 0 && (
                                <span className="text-rose-600 dark:text-rose-400 inline-flex items-center gap-1">
                                  <ArrowUpCircle className="h-3 w-3" />
                                  {formatEGP(Number(t.credit))}
                                </span>
                              )}
                            </TableCell>
                            <TableCell className="text-xs text-muted-foreground max-w-xs truncate">
                              {t.description}
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Reconciliation Tab */}
          <TabsContent value="reconciliation" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Scale className="h-5 w-5" />
                  {isRTL ? 'مطابقة الكاش الفعلي' : 'Cash Reconciliation'}
                </CardTitle>
                <CardDescription>
                  {isRTL ? 'عُدّ الكاش الفعلي اللي معاك. لو في فرق هيتسجّل قيد تسوية.' : 'Count actual cash. Any difference posts an adjustment entry.'}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="rounded-lg border p-3 space-y-2">
                  <p className="text-xs font-medium text-muted-foreground">
                    {isRTL ? 'الأرصدة المحسوبة' : 'Computed balances'}
                  </p>
                  {reconQuery.isLoading ? (
                    <Skeleton className="h-16" />
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                      {reconQuery.data?.map((r) => (
                        <div key={r.account_code} className="flex justify-between items-center text-sm py-1 px-2 rounded bg-muted/30">
                          <span className="font-mono text-xs text-muted-foreground">#{r.account_code} {isRTL ? r.account_name_ar : r.account_name}</span>
                          <span className="font-mono font-semibold">{formatEGP(Number(r.computed_balance))}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div>
                    <Label className="text-xs">{isRTL ? 'الحساب' : 'Account'} *</Label>
                    <Select value={reconAccount} onValueChange={setReconAccount}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="1110">{isRTL ? 'نقدي' : 'Cash on Hand'}</SelectItem>
                        <SelectItem value="1120">{isRTL ? 'بنك' : 'Bank'}</SelectItem>
                        <SelectItem value="1140">{isRTL ? 'محفظة إلكترونية' : 'E-Wallet'}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs">{isRTL ? 'المبلغ الفعلي' : 'Actual amount'} *</Label>
                    <Input type="number" step="0.01" min="0" placeholder="0.00" value={reconActual} onChange={(e) => setReconActual(e.target.value)} />
                  </div>
                  <div>
                    <Label className="text-xs">{isRTL ? 'ملاحظات' : 'Notes'}</Label>
                    <Input type="text" placeholder={isRTL ? 'عد آخر اليوم' : 'end-of-day count'} value={reconNotes} onChange={(e) => setReconNotes(e.target.value)} />
                  </div>
                </div>

                <Button onClick={() => adjustmentMutation.mutate()} disabled={adjustmentMutation.isPending || !reconActual}>
                  {adjustmentMutation.isPending && <RefreshCw className={`h-4 w-4 ${isRTL ? 'ml-2' : 'mr-2'} animate-spin`} />}
                  {isRTL ? 'قارن وسجّل التسوية' : 'Compare & Post Adjustment'}
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Health Tab */}
          <TabsContent value="health" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Heart className="h-5 w-5" />
                  {isRTL ? 'فحص صحة الأرصدة' : 'Balance Health Check'}
                </CardTitle>
                <CardDescription>
                  {isRTL ? 'تباينات بين الرصيد المخزّن والمحسوب' : 'Discrepancies between cached and computed balances'}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="text-sm text-muted-foreground">
                    {alertsQuery.isLoading
                      ? (isRTL ? 'جارٍ التحقق...' : 'Checking...')
                      : (alertsQuery.data?.length ?? 0) === 0
                        ? (isRTL ? '✅ كل الأرصدة سليمة' : '✅ All balances healthy')
                        : (isRTL ? `${alertsQuery.data?.length} تنبيه معلق` : `${alertsQuery.data?.length} pending alerts`)}
                  </div>
                  <Button variant="outline" size="sm" onClick={() => refreshMvMutation.mutate()} disabled={refreshMvMutation.isPending}>
                    <RefreshCw className={`h-3 w-3 ${isRTL ? 'ml-1' : 'mr-1'} ${refreshMvMutation.isPending ? 'animate-spin' : ''}`} />
                    {isRTL ? 'إعادة احتساب' : 'Recompute'}
                  </Button>
                </div>

                {alertsQuery.isLoading ? (
                  <Skeleton className="h-32" />
                ) : (alertsQuery.data?.length ?? 0) === 0 ? (
                  <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-6 text-center space-y-2">
                    <CheckCircle2 className="h-10 w-10 mx-auto text-emerald-600 dark:text-emerald-400" />
                    <p className="text-sm font-medium">{isRTL ? 'مفيش تباين' : 'No discrepancies'}</p>
                  </div>
                ) : (
                  <div className="rounded-lg border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>{isRTL ? 'الحساب' : 'Account'}</TableHead>
                          <TableHead className="text-end">{isRTL ? 'المخزّن' : 'Cached'}</TableHead>
                          <TableHead className="text-end">{isRTL ? 'المحسوب' : 'Computed'}</TableHead>
                          <TableHead className="text-end">{isRTL ? 'الفرق' : 'Difference'}</TableHead>
                          <TableHead>{isRTL ? 'وقت الكشف' : 'Detected'}</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {alertsQuery.data?.map((a) => (
                          <TableRow key={a.id}>
                            <TableCell className="text-sm font-medium">
                              <div className="flex items-center gap-2">
                                <AlertTriangle className="h-4 w-4 text-destructive" />
                                {a.account_label}
                              </div>
                            </TableCell>
                            <TableCell className="text-end font-mono text-sm">{formatEGP(Number(a.cached_balance))}</TableCell>
                            <TableCell className="text-end font-mono text-sm">{formatEGP(Number(a.computed_balance))}</TableCell>
                            <TableCell className="text-end font-mono text-sm font-bold text-destructive">{formatEGP(Number(a.difference))}</TableCell>
                            <TableCell className="text-xs text-muted-foreground">{format(new Date(a.detected_at), 'yyyy-MM-dd HH:mm')}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Maintenance Tab */}
          <TabsContent value="maintenance" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Database className="h-5 w-5" />
                  {isRTL ? 'الرصيد الافتتاحي للخزنة' : 'Treasury Opening Balance'}
                </CardTitle>
                <CardDescription>
                  {isRTL
                    ? 'سجّل رصيد الخزنة الفعلي اليوم. الحركات الجديدة بعد كده هتزيد أو تنقص الرصيد ده تلقائياً. الحركات القديمة (قبل اليوم) هتتجاهل.'
                    : "Record today's actual treasury cash. New movements will adjust this balance automatically. Legacy movements before today are ignored."}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {openingStatusQuery.isLoading ? (
                  <Skeleton className="h-24" />
                ) : openingStatusQuery.data?.is_set ? (
                  <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-4 space-y-2">
                    <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 font-semibold">
                      <CheckCircle2 className="h-5 w-5" />
                      {isRTL ? 'الرصيد الافتتاحي مُسجّل' : 'Opening balance is set'}
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
                      <div>
                        <p className="text-xs text-muted-foreground">{isRTL ? 'المبلغ' : 'Amount'}</p>
                        <p className="font-bold text-lg">{formatEGP(Number(openingStatusQuery.data.amount ?? 0))}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">{isRTL ? 'بتاريخ' : 'As of'}</p>
                        <p className="font-mono">{openingStatusQuery.data.as_of_date}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">{isRTL ? 'سند' : 'Voucher'}</p>
                        <p className="font-mono text-xs">{openingStatusQuery.data.voucher_no}</p>
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground pt-2 border-t border-border/50">
                      {isRTL
                        ? 'لو عايز تعدّل الرصيد ده، لازم تعمل قيد تسوية يدوي من قسم القيود المحاسبية.'
                        : 'To adjust this balance, post a manual adjustment entry from the journal.'}
                    </p>
                  </div>
                ) : (
                  <>
                    <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 flex items-start gap-2 text-sm">
                      <AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
                      <div>
                        <p className="font-semibold text-amber-700 dark:text-amber-300">
                          {isRTL ? 'تنبيه: عملية لمرة واحدة' : 'One-time operation'}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {isRTL
                            ? 'هيتسجل قيد افتتاحي: مدين النقدية / دائن الرصيد الافتتاحي. مش هتقدر تعمله تاني إلا بقيد تسوية.'
                            : 'A journal entry will be posted: Debit Cash / Credit Opening Equity. Cannot be re-run without a reversal entry.'}
                        </p>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      <div>
                        <Label htmlFor="ob-amount" className="text-xs">
                          {isRTL ? 'الرصيد الفعلي (ج.م)' : 'Actual cash (EGP)'} *
                        </Label>
                        <Input
                          id="ob-amount"
                          type="number"
                          step="0.01"
                          min="0"
                          placeholder="0.00"
                          value={openingAmount}
                          onChange={(e) => setOpeningAmount(e.target.value)}
                        />
                      </div>
                      <div>
                        <Label htmlFor="ob-date" className="text-xs">
                          {isRTL ? 'بتاريخ' : 'As of date'} *
                        </Label>
                        <Input
                          id="ob-date"
                          type="date"
                          value={openingDate}
                          onChange={(e) => setOpeningDate(e.target.value)}
                        />
                      </div>
                      <div>
                        <Label htmlFor="ob-notes" className="text-xs">
                          {isRTL ? 'ملاحظات (اختياري)' : 'Notes (optional)'}
                        </Label>
                        <Input
                          id="ob-notes"
                          type="text"
                          placeholder={isRTL ? 'مثلاً: عد الخزنة الفعلي' : 'e.g. physical cash count'}
                          value={openingNotes}
                          onChange={(e) => setOpeningNotes(e.target.value)}
                        />
                      </div>
                    </div>

                    <Button
                      onClick={() => {
                        const amt = parseFloat(openingAmount);
                        if (!isFinite(amt) || amt <= 0) {
                          toast.error(isRTL ? 'أدخل مبلغ صحيح' : 'Enter a valid amount');
                          return;
                        }
                        const msg = isRTL
                          ? `هيتم تسجيل رصيد افتتاحي ${formatEGP(amt)} بتاريخ ${openingDate}. متأكد؟`
                          : `Will set opening balance to ${formatEGP(amt)} as of ${openingDate}. Confirm?`;
                        if (confirm(msg)) openingMutation.mutate();
                      }}
                      disabled={openingMutation.isPending || !openingAmount}
                    >
                      {openingMutation.isPending && (
                        <RefreshCw className={`h-4 w-4 ${isRTL ? 'ml-2' : 'mr-2'} animate-spin`} />
                      )}
                      {isRTL ? 'تسجيل الرصيد الافتتاحي' : 'Set Opening Balance'}
                    </Button>
                  </>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
