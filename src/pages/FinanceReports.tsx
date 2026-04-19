import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { DashboardLayout } from '@/components/DashboardLayout';
import { PageHeader } from '@/components/shared/PageHeader';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Loader2, Lock } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';

function useReport(rpc: string, periodMonth: string) {
  return useQuery({
    queryKey: [rpc, periodMonth],
    queryFn: async () => {
      const { data, error } = await supabase.rpc(rpc as any, { p_period_month: periodMonth });
      if (error) throw error;
      return data as any;
    },
  });
}

export default function FinanceReports() {
  const { isRTL } = useLanguage();
  const [periodMonth, setPeriodMonth] = useState(() => new Date().toISOString().slice(0, 7) + '-01');

  const tb = useReport('get_trial_balance', periodMonth);
  const is_ = useReport('get_income_statement', periodMonth);
  const bs = useReport('get_balance_sheet', periodMonth);
  const cf = useReport('get_cash_flow_statement', periodMonth);

  const isFromSnapshot = (report: any) => report?.source === 'snapshot';

  return (
    <DashboardLayout>
      <PageHeader
        title={isRTL ? 'التقارير المالية' : 'Financial Reports'}
        description={isRTL ? 'ميزان مراجعة، قائمة دخل، ميزانية، تدفقات نقدية' : 'Trial balance, income statement, balance sheet, cash flow'}
      />

      <Card className="mb-4">
        <CardContent className="pt-6 flex gap-3 items-end flex-wrap">
          <div className="space-y-1">
            <Label>{isRTL ? 'الشهر' : 'Period month'}</Label>
            <Input
              type="month"
              value={periodMonth.slice(0, 7)}
              onChange={(e) => setPeriodMonth(e.target.value + '-01')}
              className="w-48"
            />
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="tb">
        <TabsList>
          <TabsTrigger value="tb">{isRTL ? 'ميزان المراجعة' : 'Trial Balance'}</TabsTrigger>
          <TabsTrigger value="is">{isRTL ? 'قائمة الدخل' : 'Income Statement'}</TabsTrigger>
          <TabsTrigger value="bs">{isRTL ? 'الميزانية' : 'Balance Sheet'}</TabsTrigger>
          <TabsTrigger value="cf">{isRTL ? 'التدفقات النقدية' : 'Cash Flow'}</TabsTrigger>
        </TabsList>

        <TabsContent value="tb"><ReportPane title="Trial Balance" q={tb} isSnap={isFromSnapshot(tb.data)} isRTL={isRTL} /></TabsContent>
        <TabsContent value="is"><ReportPane title="Income Statement" q={is_} isSnap={isFromSnapshot(is_.data)} isRTL={isRTL} /></TabsContent>
        <TabsContent value="bs"><ReportPane title="Balance Sheet" q={bs} isSnap={isFromSnapshot(bs.data)} isRTL={isRTL} /></TabsContent>
        <TabsContent value="cf"><ReportPane title="Cash Flow Statement" q={cf} isSnap={isFromSnapshot(cf.data)} isRTL={isRTL} /></TabsContent>
      </Tabs>
    </DashboardLayout>
  );
}

function ReportPane({ title, q, isSnap, isRTL }: { title: string; q: any; isSnap: boolean; isRTL: boolean }) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>{title}</CardTitle>
            <CardDescription>
              {isSnap
                ? (isRTL ? '🔒 من اللقطة المُجمَّدة' : '🔒 From immutable snapshot')
                : (isRTL ? '⚡ مباشر من السجل' : '⚡ Live from journal')}
            </CardDescription>
          </div>
          {isSnap && (
            <Badge variant="outline" className="gap-1"><Lock className="h-3 w-3" /> {isRTL ? 'مغلقة' : 'Closed'}</Badge>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {q.isLoading ? (
          <div className="flex justify-center p-8"><Loader2 className="animate-spin" /></div>
        ) : q.error ? (
          <div className="text-sm text-destructive">{(q.error as any).message}</div>
        ) : (
          <pre className="text-xs overflow-auto bg-muted/30 p-3 rounded border">
            {JSON.stringify(q.data, null, 2)}
          </pre>
        )}
      </CardContent>
    </Card>
  );
}
