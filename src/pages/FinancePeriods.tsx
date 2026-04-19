import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { DashboardLayout } from '@/components/DashboardLayout';
import { PageHeader } from '@/components/shared/PageHeader';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Lock, Unlock, AlertTriangle, CheckCircle2, Loader2, Eye } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { formatDate } from '@/lib/timeUtils';

type Period = {
  id: string;
  period_month: string;
  status: 'open' | 'review' | 'closed' | 'reopened';
  opened_at: string;
  closed_at: string | null;
  closed_by: string | null;
  reopen_reason: string | null;
};

const statusVariant: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  open: 'default',
  review: 'secondary',
  closed: 'outline',
  reopened: 'destructive',
};

export default function FinancePeriods() {
  const { isRTL } = useLanguage();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [closeDialog, setCloseDialog] = useState<Period | null>(null);
  const [reopenDialog, setReopenDialog] = useState<Period | null>(null);
  const [reopenReason, setReopenReason] = useState('');
  const [working, setWorking] = useState(false);
  const [gateResults, setGateResults] = useState<any>(null);

  const { data: periods = [], isLoading } = useQuery<Period[]>({
    queryKey: ['financial-periods'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('financial_periods')
        .select('*')
        .order('period_month', { ascending: false })
        .limit(24);
      if (error) throw error;
      return (data ?? []) as Period[];
    },
  });

  const runPreCloseGates = async (period: Period) => {
    setWorking(true);
    setGateResults(null);
    try {
      const [dq, payroll] = await Promise.all([
        supabase.rpc('check_data_quality_for_close', { p_period_month: period.period_month }),
        supabase.rpc('check_payroll_reconciliation_for_close', { p_period_month: period.period_month }),
      ]);
      setGateResults({
        data_quality: dq.data,
        payroll: payroll.data,
        dq_error: dq.error?.message,
        payroll_error: payroll.error?.message,
      });
    } finally {
      setWorking(false);
    }
  };

  const handleClose = async () => {
    if (!closeDialog) return;
    setWorking(true);
    try {
      const { error } = await supabase.rpc('close_period_v2', {
        p_period_month: closeDialog.period_month,
      });
      if (error) throw error;
      toast({
        title: isRTL ? '✅ تم إقفال الفترة' : '✅ Period closed',
        description: isRTL ? 'تم تجميد الفترة وإصدار اللقطة.' : 'Period locked & snapshot generated.',
      });
      setCloseDialog(null);
      setGateResults(null);
      qc.invalidateQueries({ queryKey: ['financial-periods'] });
    } catch (err: any) {
      toast({
        title: isRTL ? 'فشل الإقفال' : 'Close failed',
        description: err.message,
        variant: 'destructive',
      });
    } finally {
      setWorking(false);
    }
  };

  const handleRequestReopen = async () => {
    if (!reopenDialog || reopenReason.trim().length < 20) {
      toast({
        title: isRTL ? 'سبب غير كافٍ' : 'Reason too short',
        description: isRTL ? 'مطلوب 20 حرفاً على الأقل.' : 'At least 20 characters required.',
        variant: 'destructive',
      });
      return;
    }
    setWorking(true);
    try {
      const { error } = await supabase.rpc('request_period_reopen', {
        p_period_month: reopenDialog.period_month,
        p_reason: reopenReason.trim(),
      });
      if (error) throw error;
      toast({
        title: isRTL ? 'تم تقديم الطلب' : 'Request submitted',
        description: isRTL
          ? 'يحتاج موافقة admin آخر.'
          : 'Awaits approval from a different admin.',
      });
      setReopenDialog(null);
      setReopenReason('');
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setWorking(false);
    }
  };

  return (
    <DashboardLayout>
      <PageHeader
        title={isRTL ? 'الفترات المالية' : 'Financial Periods'}
        subtitle={isRTL ? 'إدارة إقفال الفترات الشهرية وفتحها' : 'Manage monthly closing & reopening'}
        icon={Lock}
      />

      <Card>
        <CardHeader>
          <CardTitle>{isRTL ? 'الفترات' : 'Periods'}</CardTitle>
          <CardDescription>
            {isRTL ? 'آخر 24 شهراً' : 'Last 24 months'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center p-8"><Loader2 className="animate-spin" /></div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{isRTL ? 'الشهر' : 'Month'}</TableHead>
                  <TableHead>{isRTL ? 'الحالة' : 'Status'}</TableHead>
                  <TableHead>{isRTL ? 'فُتحت' : 'Opened'}</TableHead>
                  <TableHead>{isRTL ? 'أُقفلت' : 'Closed'}</TableHead>
                  <TableHead className="text-end">{isRTL ? 'إجراءات' : 'Actions'}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {periods.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="font-mono">{p.period_month.slice(0, 7)}</TableCell>
                    <TableCell>
                      <Badge variant={statusVariant[p.status]}>{p.status}</Badge>
                    </TableCell>
                    <TableCell>{formatDate(p.opened_at)}</TableCell>
                    <TableCell>{p.closed_at ? formatDate(p.closed_at) : '—'}</TableCell>
                    <TableCell className="text-end space-x-2">
                      {p.status === 'open' && (
                        <Button size="sm" variant="outline" onClick={() => { setCloseDialog(p); runPreCloseGates(p); }}>
                          <Lock className="h-3 w-3 mr-1" />
                          {isRTL ? 'إقفال' : 'Close'}
                        </Button>
                      )}
                      {p.status === 'closed' && (
                        <Button size="sm" variant="ghost" onClick={() => setReopenDialog(p)}>
                          <Unlock className="h-3 w-3 mr-1" />
                          {isRTL ? 'طلب فتح' : 'Request reopen'}
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Close dialog */}
      <Dialog open={!!closeDialog} onOpenChange={(o) => { if (!o) { setCloseDialog(null); setGateResults(null); } }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {isRTL ? `إقفال فترة ${closeDialog?.period_month.slice(0, 7)}` : `Close period ${closeDialog?.period_month.slice(0, 7)}`}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-3">
            <h4 className="font-medium">{isRTL ? 'فحوصات ما قبل الإقفال' : 'Pre-close gates'}</h4>
            {!gateResults ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                {isRTL ? 'جارٍ الفحص...' : 'Running checks...'}
              </div>
            ) : (
              <div className="space-y-2">
                <GateResult
                  label={isRTL ? 'جودة البيانات' : 'Data quality'}
                  result={gateResults.data_quality}
                  error={gateResults.dq_error}
                  isRTL={isRTL}
                />
                <GateResult
                  label={isRTL ? 'تسوية الرواتب' : 'Payroll reconciliation'}
                  result={gateResults.payroll}
                  error={gateResults.payroll_error}
                  isRTL={isRTL}
                />
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setCloseDialog(null)}>{isRTL ? 'إلغاء' : 'Cancel'}</Button>
            <Button
              variant="destructive"
              onClick={handleClose}
              disabled={working || !gateResults || gateResults.dq_error || gateResults.payroll_error}
            >
              {working ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Lock className="h-4 w-4 mr-2" />}
              {isRTL ? 'تأكيد الإقفال' : 'Confirm close'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reopen dialog */}
      <Dialog open={!!reopenDialog} onOpenChange={(o) => { if (!o) { setReopenDialog(null); setReopenReason(''); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{isRTL ? 'طلب فتح الفترة' : 'Request period reopen'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Label>{isRTL ? 'السبب (≥ 20 حرفاً)' : 'Reason (≥ 20 chars)'}</Label>
            <Textarea
              value={reopenReason}
              onChange={(e) => setReopenReason(e.target.value)}
              rows={4}
              placeholder={isRTL ? 'اكتب سبب الفتح بالتفصيل...' : 'Detailed justification...'}
            />
            <p className="text-xs text-muted-foreground">
              {isRTL
                ? '⚠️ يحتاج هذا الطلب موافقة من admin مختلف.'
                : '⚠️ Requires approval from a different admin.'}
            </p>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setReopenDialog(null)}>{isRTL ? 'إلغاء' : 'Cancel'}</Button>
            <Button onClick={handleRequestReopen} disabled={working}>
              {working && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              {isRTL ? 'تقديم الطلب' : 'Submit request'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}

function GateResult({ label, result, error, isRTL }: { label: string; result: any; error?: string; isRTL: boolean }) {
  const ok = !error && result?.passed !== false;
  return (
    <div className={`flex items-start gap-2 p-2 rounded border ${ok ? 'border-green-500/30 bg-green-500/5' : 'border-destructive/30 bg-destructive/5'}`}>
      {ok ? <CheckCircle2 className="h-4 w-4 text-green-600 mt-0.5" /> : <AlertTriangle className="h-4 w-4 text-destructive mt-0.5" />}
      <div className="text-sm flex-1">
        <div className="font-medium">{label}</div>
        {error && <div className="text-destructive text-xs">{error}</div>}
        {result?.issues_count > 0 && (
          <div className="text-xs text-muted-foreground">
            {isRTL ? `${result.issues_count} مشكلة` : `${result.issues_count} issues`}
          </div>
        )}
      </div>
    </div>
  );
}
