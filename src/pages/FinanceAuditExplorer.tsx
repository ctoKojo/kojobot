import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { DashboardLayout } from '@/components/DashboardLayout';
import { PageHeader } from '@/components/shared/PageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ShieldCheck, AlertTriangle, Loader2 } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { formatDate } from '@/lib/timeUtils';

export default function FinanceAuditExplorer() {
  const { isRTL } = useLanguage();
  const { toast } = useToast();
  const [periodMonth, setPeriodMonth] = useState(() => new Date().toISOString().slice(0, 7) + '-01');
  const [verifying, setVerifying] = useState(false);
  const [verification, setVerification] = useState<any>(null);

  const { data: logs = [], isLoading } = useQuery({
    queryKey: ['audit-log', periodMonth],
    queryFn: async () => {
      const { data, error } = await (supabase.rpc as any)('get_audit_log_for_period', {
        p_period_month: periodMonth,
      });
      if (error) throw error;
      return (data ?? []) as any[];
    },
  });

  const handleVerify = async () => {
    setVerifying(true);
    try {
      const { data, error } = await (supabase.rpc as any)('verify_audit_chain', {});
      if (error) throw error;
      setVerification(data);
      toast({
        title: (data as any)?.valid ? '✅ Chain valid' : '❌ Chain broken',
        variant: (data as any)?.valid ? 'default' : 'destructive',
      });
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setVerifying(false);
    }
  };

  return (
    <DashboardLayout>
      <PageHeader
        title={isRTL ? 'مستكشف التدقيق' : 'Audit Explorer'}
        subtitle={isRTL ? 'سجل التدقيق غير القابل للتعديل + تحقق سلسلة الـ hash' : 'Tamper-evident audit log & hash chain verification'}
        icon={ShieldCheck}
      />

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5" />
            {isRTL ? 'سلسلة التدقيق' : 'Audit Chain'}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-3 items-end flex-wrap">
            <div className="space-y-1">
              <Label>{isRTL ? 'الشهر' : 'Period month'}</Label>
              <Input
                type="month"
                value={periodMonth.slice(0, 7)}
                onChange={(e) => setPeriodMonth(e.target.value + '-01')}
                className="w-48"
              />
            </div>
            <Button onClick={handleVerify} disabled={verifying}>
              {verifying && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              {isRTL ? 'التحقق من السلسلة' : 'Verify chain'}
            </Button>
          </div>

          {verification && (
            <div className={`p-3 rounded border ${(verification as any).valid ? 'border-green-500/30 bg-green-500/5' : 'border-destructive/30 bg-destructive/5'}`}>
              <div className="flex items-center gap-2 font-medium">
                {(verification as any).valid ? <ShieldCheck className="h-4 w-4 text-green-600" /> : <AlertTriangle className="h-4 w-4 text-destructive" />}
                {(verification as any).valid
                  ? (isRTL ? '✅ سلسلة سليمة' : '✅ Chain intact')
                  : (isRTL ? '❌ السلسلة مكسورة' : '❌ Chain broken')}
              </div>
              <pre className="text-xs mt-2 overflow-auto">{JSON.stringify(verification, null, 2)}</pre>
            </div>
          )}

          {isLoading ? (
            <div className="flex justify-center p-8"><Loader2 className="animate-spin" /></div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>#</TableHead>
                  <TableHead>{isRTL ? 'متى' : 'When'}</TableHead>
                  <TableHead>{isRTL ? 'الإجراء' : 'Action'}</TableHead>
                  <TableHead>{isRTL ? 'الكيان' : 'Entity'}</TableHead>
                  <TableHead>{isRTL ? 'المنفذ' : 'Actor'}</TableHead>
                  <TableHead className="text-end">{isRTL ? 'المبلغ' : 'Amount'}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logs.map((l) => (
                  <TableRow key={l.id}>
                    <TableCell className="font-mono text-xs">{l.sequence_number}</TableCell>
                    <TableCell className="text-xs">{formatDate(l.occurred_at)}</TableCell>
                    <TableCell><Badge variant="outline">{l.action}</Badge></TableCell>
                    <TableCell className="text-xs">{l.entity_type}</TableCell>
                    <TableCell className="text-xs">{l.actor_role ?? '—'}</TableCell>
                    <TableCell className="text-end font-mono text-xs">
                      {l.amount ? Number(l.amount).toFixed(2) : '—'}
                    </TableCell>
                  </TableRow>
                ))}
                {logs.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground py-6">
                      {isRTL ? 'لا توجد سجلات' : 'No entries'}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </DashboardLayout>
  );
}
