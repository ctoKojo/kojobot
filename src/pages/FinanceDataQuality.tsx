import { useQuery, useQueryClient } from '@tanstack/react-query';
import { DashboardLayout } from '@/components/DashboardLayout';
import { PageHeader } from '@/components/shared/PageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2, AlertTriangle, RefreshCw } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { formatDate } from '@/lib/timeUtils';
import { useState } from 'react';

export default function FinanceDataQuality() {
  const { isRTL } = useLanguage();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [working, setWorking] = useState(false);

  const { data: issues = [], isLoading } = useQuery({
    queryKey: ['data-quality-issues'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('data_quality_issues')
        .select('*')
        .eq('status', 'open')
        .order('detected_at', { ascending: false })
        .limit(200);
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: alerts = [] } = useQuery({
    queryKey: ['balance-alerts'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('balance_alerts')
        .select('*')
        .eq('status', 'pending')
        .order('detected_at', { ascending: false })
        .limit(100);
      if (error) throw error;
      return data ?? [];
    },
  });

  const handleBackfill = async () => {
    setWorking(true);
    try {
      const { data, error } = await supabase.rpc('backfill_payment_installments');
      if (error) throw error;
      toast({
        title: isRTL ? '✅ تمت إعادة الربط' : '✅ Backfill complete',
        description: JSON.stringify(data),
      });
      qc.invalidateQueries({ queryKey: ['data-quality-issues'] });
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setWorking(false);
    }
  };

  return (
    <DashboardLayout>
      <PageHeader
        title={isRTL ? 'جودة البيانات المالية' : 'Financial Data Quality'}
        subtitle={isRTL ? 'مراقبة المشاكل وإصلاحها قبل الإقفال' : 'Monitor & fix issues before period close'}
        icon={AlertTriangle}
      />

      <div className="grid gap-4 md:grid-cols-2 mb-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-destructive" />
              {isRTL ? 'مشاكل مفتوحة' : 'Open issues'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{issues.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-500" />
              {isRTL ? 'تنبيهات عدم تطابق' : 'Balance mismatches'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{alerts.length}</div>
          </CardContent>
        </Card>
      </div>

      <Card className="mb-4">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>{isRTL ? 'مشاكل البيانات' : 'Data quality issues'}</CardTitle>
            <Button size="sm" onClick={handleBackfill} disabled={working}>
              {working ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <RefreshCw className="h-3 w-3 mr-1" />}
              {isRTL ? 'إعادة ربط الأقساط' : 'Backfill installments'}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center p-8"><Loader2 className="animate-spin" /></div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{isRTL ? 'النوع' : 'Type'}</TableHead>
                  <TableHead>{isRTL ? 'الجدول' : 'Table'}</TableHead>
                  <TableHead>{isRTL ? 'الكيان' : 'Entity'}</TableHead>
                  <TableHead>{isRTL ? 'مكتشفة' : 'Detected'}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {issues.map((i: any) => (
                  <TableRow key={i.id}>
                    <TableCell><Badge variant="destructive">{i.issue_type}</Badge></TableCell>
                    <TableCell className="font-mono text-xs">{i.entity_table}</TableCell>
                    <TableCell className="font-mono text-xs">{i.entity_id.slice(0, 8)}…</TableCell>
                    <TableCell className="text-xs">{formatDate(i.detected_at)}</TableCell>
                  </TableRow>
                ))}
                {issues.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-muted-foreground py-6">
                      ✅ {isRTL ? 'لا توجد مشاكل' : 'No issues'}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{isRTL ? 'تنبيهات عدم تطابق الرصيد' : 'Balance mismatch alerts'}</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{isRTL ? 'النوع' : 'Type'}</TableHead>
                <TableHead>{isRTL ? 'الحساب' : 'Account'}</TableHead>
                <TableHead className="text-end">{isRTL ? 'مخزن' : 'Cached'}</TableHead>
                <TableHead className="text-end">{isRTL ? 'محسوب' : 'Computed'}</TableHead>
                <TableHead className="text-end">{isRTL ? 'الفرق' : 'Diff'}</TableHead>
                <TableHead>{isRTL ? 'الطريقة' : 'Method'}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {alerts.map((a: any) => (
                <TableRow key={a.id}>
                  <TableCell><Badge variant="outline">{a.account_type}</Badge></TableCell>
                  <TableCell className="font-mono text-xs">{a.account_id.slice(0, 8)}…</TableCell>
                  <TableCell className="text-end font-mono text-xs">{Number(a.cached_balance).toFixed(2)}</TableCell>
                  <TableCell className="text-end font-mono text-xs">{Number(a.computed_balance).toFixed(2)}</TableCell>
                  <TableCell className="text-end font-mono text-xs text-destructive">{Number(a.difference).toFixed(2)}</TableCell>
                  <TableCell><Badge variant="secondary">{a.detected_by_method}</Badge></TableCell>
                </TableRow>
              ))}
              {alerts.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-6">
                    ✅ {isRTL ? 'كل الأرصدة متطابقة' : 'All balances match'}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </DashboardLayout>
  );
}
