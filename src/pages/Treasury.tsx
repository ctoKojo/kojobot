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
import { Wallet, Banknote, Smartphone, CreditCard, RefreshCw, Database, ArrowDownCircle, ArrowUpCircle } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { toast } from 'sonner';
import { format } from 'date-fns';

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
  const queryClient = useQueryClient();
  const [filterAccount, setFilterAccount] = useState<string>('all');
  const [filterSource, setFilterSource] = useState<string>('all');
  const [fromDate, setFromDate] = useState<string>('');
  const [toDate, setToDate] = useState<string>('');

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
      const { data, error } = await (supabase.rpc as any)('get_treasury_transactions', {
        p_limit: 200,
        p_account_code: filterAccount === 'all' ? null : filterAccount,
        p_from_date: fromDate || null,
        p_to_date: toDate || null,
        p_source: filterSource === 'all' ? null : filterSource,
      });
      if (error) throw error;
      return (data ?? []) as TreasuryTxn[];
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

  const totalLiquidity = balancesQuery.data?.reduce((s, b) => s + Number(b.balance), 0) ?? 0;

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
          description={isRTL ? 'الأرصدة اللحظية وحركات السيولة من دفتر اليومية' : 'Live liquidity balances and cash movements from the journal'}
        >
          <Button
            variant="outline"
            size="sm"
            onClick={() => refreshMvMutation.mutate()}
            disabled={refreshMvMutation.isPending}
          >
            <RefreshCw className={`h-4 w-4 ${isRTL ? 'ml-2' : 'mr-2'} ${refreshMvMutation.isPending ? 'animate-spin' : ''}`} />
            {isRTL ? 'تحديث الأرصدة' : 'Refresh Balances'}
          </Button>
        </PageHeader>

        {/* Liquidity Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          {balancesQuery.isLoading ? (
            Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-32" />)
          ) : (
            <>
              {balancesQuery.data?.map((b) => {
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
                  <p className="text-xs text-muted-foreground mt-1">{isRTL ? 'مجموع 4 حسابات' : '4 accounts sum'}</p>
                </CardContent>
              </Card>
            </>
          )}
        </div>

        <Tabs defaultValue="transactions" className="space-y-4">
          <TabsList className="grid w-full md:w-auto md:inline-grid grid-cols-2">
            <TabsTrigger value="transactions">{isRTL ? 'الحركات' : 'Transactions'}</TabsTrigger>
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
                        <SelectItem value="1120">{isRTL ? 'بنك' : 'Bank'}</SelectItem>
                        <SelectItem value="1130">InstaPay</SelectItem>
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

          {/* Maintenance Tab */}
          <TabsContent value="maintenance" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Database className="h-5 w-5" />
                  {isRTL ? 'ترحيل الحركات التاريخية' : 'Historical Backfill'}
                </CardTitle>
                <CardDescription>
                  {isRTL
                    ? 'يحوّل الدفعات والمصروفات والرواتب القديمة إلى قيود محاسبية. آمن — لا يكرر القيود الموجودة.'
                    : 'Convert legacy payments, expenses, and salaries into journal entries. Idempotent — never duplicates existing entries.'}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex flex-wrap gap-3">
                  <Button
                    variant="outline"
                    onClick={() => backfillMutation.mutate(true)}
                    disabled={backfillMutation.isPending}
                  >
                    {isRTL ? 'معاينة (Dry Run)' : 'Preview (Dry Run)'}
                  </Button>
                  <Button
                    onClick={() => {
                      if (confirm(isRTL ? 'تأكيد ترحيل القيود التاريخية؟' : 'Confirm backfill historical entries?')) {
                        backfillMutation.mutate(false);
                      }
                    }}
                    disabled={backfillMutation.isPending}
                  >
                    {backfillMutation.isPending && <RefreshCw className={`h-4 w-4 ${isRTL ? 'ml-2' : 'mr-2'} animate-spin`} />}
                    {isRTL ? 'تنفيذ الترحيل' : 'Run Backfill'}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  {isRTL
                    ? 'يجب تشغيل المعاينة أولاً للتحقق من العدد المتوقع.'
                    : 'Run preview first to verify expected counts.'}
                </p>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
