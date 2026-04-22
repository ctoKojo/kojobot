import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { DashboardLayout } from '@/components/DashboardLayout';
import { PageHeader } from '@/components/shared/PageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  GitCompareArrows,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  FileSearch,
  Loader2,
  Receipt,
  BookOpen,
  Wallet,
  Users,
} from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';

interface JournalLine {
  line_no: number;
  account_code: string;
  account_name: string;
  account_name_ar: string;
  debit: number;
  credit: number;
  is_customer: boolean;
}

interface PaymentRow {
  payment_id: string;
  subscription_id: string;
  student_id: string;
  student_name: string | null;
  student_name_ar: string | null;
  amount: number;
  payment_date: string;
  payment_method: string;
  payment_type: string;
  entry_id: string | null;
  voucher_no: string | null;
  entry_status: string | null;
  total_debit: number | null;
  lines: JournalLine[] | null;
  reconciliation_status:
    | 'matched'
    | 'missing_journal'
    | 'amount_mismatch'
    | 'unposted';
}

interface OrphanJournal {
  entry_id: string;
  voucher_no: string;
  entry_date: string;
  payment_id: string | null;
  total_debit: number;
  entry_status: string;
  lines: JournalLine[] | null;
}

interface SubscriptionSummary {
  subscription_id: string;
  student_id: string;
  student_name: string | null;
  student_name_ar: string | null;
  total_amount: number;
  status: string;
  created_at: string;
  total_paid_alltime: number;
  paid_in_period: number;
  journaled_in_period: number;
}

interface ReconciliationData {
  period_month: string;
  totals: {
    payments_count: number;
    payments_amount: number;
    journals_count: number;
    journals_amount: number;
    matched_count: number;
    missing_journal_count: number;
    amount_mismatch_count: number;
    unposted_count: number;
    orphan_journal_count: number;
    subscriptions_count: number;
  };
  rows: PaymentRow[];
  orphan_journals: OrphanJournal[];
  subscriptions: SubscriptionSummary[];
}

interface Props {
  embedded?: boolean;
}

const formatEGP = (n: number) =>
  new Intl.NumberFormat('en-EG', {
    style: 'currency',
    currency: 'EGP',
    maximumFractionDigits: 2,
  }).format(n);

const currentMonthIso = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};

export default function FinancePaymentReconciliation({ embedded = false }: Props) {
  const { isRTL } = useLanguage();
  const [periodInput, setPeriodInput] = useState<string>(currentMonthIso());
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [search, setSearch] = useState<string>('');

  const periodMonth = `${periodInput}-01`;

  const { data, isLoading, isFetching, refetch } = useQuery({
    queryKey: ['payment-journal-reconciliation', periodMonth],
    queryFn: async () => {
      const { data, error } = await (supabase.rpc as any)(
        'get_payment_journal_reconciliation',
        { p_period_month: periodMonth },
      );
      if (error) throw error;
      return data as ReconciliationData;
    },
  });

  const rows = data?.rows ?? [];
  const orphanJournals = data?.orphan_journals ?? [];
  const subscriptions = data?.subscriptions ?? [];
  const totals = data?.totals;

  const filteredRows = useMemo(() => {
    let r = rows;
    if (statusFilter !== 'all') {
      r = r.filter((row) => row.reconciliation_status === statusFilter);
    }
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      r = r.filter(
        (row) =>
          row.student_name?.toLowerCase().includes(q) ||
          row.student_name_ar?.toLowerCase().includes(q) ||
          row.voucher_no?.toLowerCase().includes(q),
      );
    }
    return r;
  }, [rows, statusFilter, search]);

  const filteredSubs = useMemo(() => {
    if (!search.trim()) return subscriptions;
    const q = search.trim().toLowerCase();
    return subscriptions.filter(
      (s) =>
        s.student_name?.toLowerCase().includes(q) ||
        s.student_name_ar?.toLowerCase().includes(q),
    );
  }, [subscriptions, search]);

  const renderStatusBadge = (status: PaymentRow['reconciliation_status']) => {
    const map = {
      matched: {
        icon: CheckCircle2,
        label: isRTL ? 'مطابق' : 'Matched',
        className: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/30',
      },
      amount_mismatch: {
        icon: AlertTriangle,
        label: isRTL ? 'مبلغ غير مطابق' : 'Amount Mismatch',
        className: 'bg-amber-500/10 text-amber-700 border-amber-500/30',
      },
      missing_journal: {
        icon: XCircle,
        label: isRTL ? 'بدون قيد' : 'No Journal',
        className: 'bg-rose-500/10 text-rose-600 border-rose-500/30',
      },
      unposted: {
        icon: AlertTriangle,
        label: isRTL ? 'قيد غير مرحل' : 'Unposted',
        className: 'bg-orange-500/10 text-orange-600 border-orange-500/30',
      },
    } as const;
    const cfg = map[status];
    const Icon = cfg.icon;
    return (
      <Badge variant="outline" className={`${cfg.className} gap-1.5 font-medium`}>
        <Icon className="h-3 w-3" />
        {cfg.label}
      </Badge>
    );
  };

  const renderJournalLines = (lines: JournalLine[] | null) => {
    if (!lines || lines.length === 0) {
      return <span className="text-xs text-muted-foreground">—</span>;
    }
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="sm" className="h-7 px-2">
              <FileSearch className="h-3.5 w-3.5 mr-1" />
              {lines.length} {isRTL ? 'سطور' : 'lines'}
            </Button>
          </TooltipTrigger>
          <TooltipContent side="left" className="max-w-md p-0">
            <div className="p-2 space-y-1">
              {lines.map((l) => (
                <div
                  key={l.line_no}
                  className="flex items-center justify-between gap-3 text-xs px-2 py-1 rounded bg-muted/40"
                >
                  <span className="font-mono text-muted-foreground">
                    {l.account_code}
                  </span>
                  <span className="flex-1 truncate">
                    {isRTL ? l.account_name_ar : l.account_name}
                  </span>
                  {l.debit > 0 ? (
                    <span className="text-emerald-600 font-medium">
                      Dr {formatEGP(l.debit)}
                    </span>
                  ) : (
                    <span className="text-rose-600 font-medium">
                      Cr {formatEGP(l.credit)}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  };

  const content = (
    <div className={embedded ? 'space-y-4' : 'container mx-auto p-4 md:p-6 space-y-6'}>
      {!embedded && (
        <PageHeader
          title={isRTL ? 'مطابقة الدفعات بالقيود' : 'Payment-Journal Reconciliation'}
          subtitle={
            isRTL
              ? 'قارن بين دفعات الطلاب والقيود المحاسبية المرتبطة بها لكل فترة مالية'
              : 'Match student payments against their related accounting journal entries per period'
          }
          icon={GitCompareArrows}
          gradient="from-cyan-500 to-blue-600"
        />
      )}

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">
                {isRTL ? 'الشهر المالي' : 'Period month'}
              </Label>
              <Input
                type="month"
                value={periodInput}
                onChange={(e) => setPeriodInput(e.target.value)}
                className="w-40"
              />
            </div>
            <div className="space-y-1.5 flex-1 min-w-[200px]">
              <Label className="text-xs">
                {isRTL ? 'بحث (طالب / سند)' : 'Search (student / voucher)'}
              </Label>
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={
                  isRTL ? 'اسم طالب أو رقم سند...' : 'Student name or voucher...'
                }
              />
            </div>
            <Button
              variant="outline"
              onClick={() => refetch()}
              disabled={isFetching}
            >
              {isFetching && (
                <Loader2 className={`h-4 w-4 animate-spin ${isRTL ? 'ml-2' : 'mr-2'}`} />
              )}
              {isRTL ? 'تحديث' : 'Refresh'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Summary cards */}
      {totals && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <SummaryCard
            icon={Receipt}
            label={isRTL ? 'إجمالي الدفعات' : 'Total Payments'}
            value={`${totals.payments_count} • ${formatEGP(totals.payments_amount)}`}
            tone="primary"
          />
          <SummaryCard
            icon={BookOpen}
            label={isRTL ? 'إجمالي القيود' : 'Total Journals'}
            value={`${totals.journals_count} • ${formatEGP(totals.journals_amount)}`}
            tone="primary"
          />
          <SummaryCard
            icon={CheckCircle2}
            label={isRTL ? 'مطابق تماماً' : 'Fully Matched'}
            value={`${totals.matched_count} / ${totals.payments_count}`}
            tone="success"
          />
          <SummaryCard
            icon={AlertTriangle}
            label={isRTL ? 'تحتاج مراجعة' : 'Need Review'}
            value={String(
              totals.missing_journal_count +
                totals.amount_mismatch_count +
                totals.unposted_count +
                totals.orphan_journal_count,
            )}
            tone={
              totals.missing_journal_count +
                totals.amount_mismatch_count +
                totals.unposted_count +
                totals.orphan_journal_count >
              0
                ? 'warning'
                : 'success'
            }
          />
        </div>
      )}

      <Tabs defaultValue="payments" className="space-y-3">
        <TabsList>
          <TabsTrigger value="payments" className="gap-2">
            <Receipt className="h-4 w-4" />
            {isRTL ? 'الدفعات' : 'Payments'}
            {rows.length > 0 && (
              <Badge variant="secondary" className="text-[10px] h-4 px-1.5">
                {rows.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="subscriptions" className="gap-2">
            <Users className="h-4 w-4" />
            {isRTL ? 'الاشتراكات' : 'Subscriptions'}
            {subscriptions.length > 0 && (
              <Badge variant="secondary" className="text-[10px] h-4 px-1.5">
                {subscriptions.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="orphans" className="gap-2">
            <AlertTriangle className="h-4 w-4" />
            {isRTL ? 'قيود يتيمة' : 'Orphan Journals'}
            {orphanJournals.length > 0 && (
              <Badge variant="destructive" className="text-[10px] h-4 px-1.5">
                {orphanJournals.length}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="payments" className="space-y-3">
          {/* Status filter chips */}
          <div className="flex flex-wrap gap-2">
            {[
              { key: 'all', label: isRTL ? 'الكل' : 'All' },
              { key: 'matched', label: isRTL ? 'مطابق' : 'Matched' },
              {
                key: 'amount_mismatch',
                label: isRTL ? 'مبلغ مختلف' : 'Amount mismatch',
              },
              {
                key: 'missing_journal',
                label: isRTL ? 'بدون قيد' : 'No journal',
              },
              { key: 'unposted', label: isRTL ? 'غير مرحل' : 'Unposted' },
            ].map((c) => (
              <Button
                key={c.key}
                size="sm"
                variant={statusFilter === c.key ? 'default' : 'outline'}
                onClick={() => setStatusFilter(c.key)}
                className="h-7 text-xs"
              >
                {c.label}
              </Button>
            ))}
          </div>

          <Card>
            <CardContent className="p-0">
              {isLoading ? (
                <div className="flex justify-center p-12">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : filteredRows.length === 0 ? (
                <div className="text-center text-muted-foreground py-12 text-sm">
                  {isRTL ? 'لا توجد دفعات في هذه الفترة' : 'No payments in this period'}
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{isRTL ? 'التاريخ' : 'Date'}</TableHead>
                        <TableHead>{isRTL ? 'الطالب' : 'Student'}</TableHead>
                        <TableHead>{isRTL ? 'المبلغ' : 'Amount'}</TableHead>
                        <TableHead>{isRTL ? 'الطريقة' : 'Method'}</TableHead>
                        <TableHead>{isRTL ? 'سند القيد' : 'Voucher'}</TableHead>
                        <TableHead>{isRTL ? 'القيد' : 'Journal'}</TableHead>
                        <TableHead>{isRTL ? 'السطور' : 'Lines'}</TableHead>
                        <TableHead>{isRTL ? 'الحالة' : 'Status'}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredRows.map((r) => (
                        <TableRow key={r.payment_id}>
                          <TableCell className="text-xs whitespace-nowrap">
                            {r.payment_date}
                          </TableCell>
                          <TableCell className="font-medium text-sm">
                            {isRTL
                              ? r.student_name_ar || r.student_name || '—'
                              : r.student_name || r.student_name_ar || '—'}
                          </TableCell>
                          <TableCell className="font-semibold">
                            {formatEGP(Number(r.amount))}
                          </TableCell>
                          <TableCell>
                            <Badge variant="secondary" className="text-[10px]">
                              {r.payment_method}
                            </Badge>
                          </TableCell>
                          <TableCell className="font-mono text-xs">
                            {r.voucher_no || '—'}
                          </TableCell>
                          <TableCell className="font-medium">
                            {r.total_debit != null ? formatEGP(Number(r.total_debit)) : '—'}
                          </TableCell>
                          <TableCell>{renderJournalLines(r.lines)}</TableCell>
                          <TableCell>
                            {renderStatusBadge(r.reconciliation_status)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="subscriptions">
          <Card>
            <CardContent className="p-0">
              {isLoading ? (
                <div className="flex justify-center p-12">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : filteredSubs.length === 0 ? (
                <div className="text-center text-muted-foreground py-12 text-sm">
                  {isRTL
                    ? 'لا توجد اشتراكات في هذه الفترة'
                    : 'No subscriptions in this period'}
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{isRTL ? 'الطالب' : 'Student'}</TableHead>
                        <TableHead>{isRTL ? 'الحالة' : 'Status'}</TableHead>
                        <TableHead>
                          {isRTL ? 'إجمالي الاشتراك' : 'Subscription Total'}
                        </TableHead>
                        <TableHead>
                          {isRTL ? 'مدفوع (إجمالي)' : 'Paid (lifetime)'}
                        </TableHead>
                        <TableHead>
                          {isRTL ? 'مدفوع بالفترة' : 'Paid in Period'}
                        </TableHead>
                        <TableHead>
                          {isRTL ? 'مرحّل بالقيود' : 'Journaled in Period'}
                        </TableHead>
                        <TableHead>{isRTL ? 'الفرق' : 'Variance'}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredSubs.map((s) => {
                        const variance =
                          Number(s.paid_in_period) - Number(s.journaled_in_period);
                        return (
                          <TableRow key={s.subscription_id}>
                            <TableCell className="font-medium text-sm">
                              {isRTL
                                ? s.student_name_ar || s.student_name || '—'
                                : s.student_name || s.student_name_ar || '—'}
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline" className="text-[10px]">
                                {s.status}
                              </Badge>
                            </TableCell>
                            <TableCell>{formatEGP(Number(s.total_amount))}</TableCell>
                            <TableCell>{formatEGP(Number(s.total_paid_alltime))}</TableCell>
                            <TableCell className="font-semibold">
                              {formatEGP(Number(s.paid_in_period))}
                            </TableCell>
                            <TableCell className="font-semibold">
                              {formatEGP(Number(s.journaled_in_period))}
                            </TableCell>
                            <TableCell>
                              {Math.abs(variance) < 0.01 ? (
                                <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-500/30 border">
                                  {isRTL ? 'مطابق' : 'OK'}
                                </Badge>
                              ) : (
                                <Badge variant="destructive">
                                  {formatEGP(variance)}
                                </Badge>
                              )}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="orphans">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-500" />
                {isRTL
                  ? 'قيود محاسبية بمصدر دفعة لكن بدون دفعة مقابلة في هذه الفترة'
                  : 'Payment-source journal entries with no matching payment in this period'}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {orphanJournals.length === 0 ? (
                <div className="text-center text-muted-foreground py-8 text-sm">
                  {isRTL ? 'لا توجد قيود يتيمة 🎉' : 'No orphan journals 🎉'}
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{isRTL ? 'التاريخ' : 'Date'}</TableHead>
                        <TableHead>{isRTL ? 'سند' : 'Voucher'}</TableHead>
                        <TableHead>{isRTL ? 'المبلغ' : 'Amount'}</TableHead>
                        <TableHead>{isRTL ? 'الحالة' : 'Status'}</TableHead>
                        <TableHead>{isRTL ? 'السطور' : 'Lines'}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {orphanJournals.map((j) => (
                        <TableRow key={j.entry_id}>
                          <TableCell className="text-xs whitespace-nowrap">
                            {j.entry_date}
                          </TableCell>
                          <TableCell className="font-mono text-xs">
                            {j.voucher_no}
                          </TableCell>
                          <TableCell className="font-semibold">
                            {formatEGP(Number(j.total_debit))}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">{j.entry_status}</Badge>
                          </TableCell>
                          <TableCell>{renderJournalLines(j.lines)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );

  if (embedded) return content;
  return <DashboardLayout>{content}</DashboardLayout>;
}

interface SummaryCardProps {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  tone: 'primary' | 'success' | 'warning';
}

function SummaryCard({ icon: Icon, label, value, tone }: SummaryCardProps) {
  const toneClass = {
    primary: 'border-primary/30 bg-primary/5 text-primary',
    success: 'border-emerald-500/30 bg-emerald-500/5 text-emerald-600',
    warning: 'border-amber-500/30 bg-amber-500/5 text-amber-700',
  }[tone];
  return (
    <Card className={`border ${toneClass}`}>
      <CardContent className="p-4 flex items-center gap-3">
        <div className="rounded-lg bg-background/60 p-2">
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <div className="text-xs text-muted-foreground truncate">{label}</div>
          <div className="text-sm font-semibold truncate">{value}</div>
        </div>
      </CardContent>
    </Card>
  );
}
