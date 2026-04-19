import { useQuery, useQueryClient } from '@tanstack/react-query';
import { DashboardLayout } from '@/components/DashboardLayout';
import { PageHeader } from '@/components/shared/PageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2, CheckCircle2, XCircle } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { formatDate } from '@/lib/timeUtils';
import { useState } from 'react';

export default function FinanceReopenRequests() {
  const { isRTL } = useLanguage();
  const { user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [working, setWorking] = useState<string | null>(null);

  const { data: requests = [], isLoading } = useQuery({
    queryKey: ['reopen-requests'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('reopen_requests')
        .select('*')
        .order('requested_at', { ascending: false })
        .limit(100);
      if (error) throw error;
      return data ?? [];
    },
  });

  const handleAction = async (id: string, approve: boolean) => {
    setWorking(id);
    try {
      const rpc = approve ? 'approve_reopen_request' : 'cancel_reopen_request';
      const { error } = await supabase.rpc(rpc, { p_request_id: id });
      if (error) throw error;
      toast({
        title: approve
          ? (isRTL ? '✅ تمت الموافقة وأُعيد فتح الفترة' : '✅ Approved & period reopened')
          : (isRTL ? 'تم الإلغاء' : 'Cancelled'),
      });
      qc.invalidateQueries({ queryKey: ['reopen-requests'] });
      qc.invalidateQueries({ queryKey: ['financial-periods'] });
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setWorking(null);
    }
  };

  return (
    <DashboardLayout>
      <PageHeader
        title={isRTL ? 'طلبات إعادة فتح الفترات' : 'Period Reopen Requests'}
        subtitle={isRTL ? 'موافقة مزدوجة — الموافق ≠ الطالب' : 'Dual approval — approver ≠ requester'}
        icon={CheckCircle2}
      />

      <Card>
        <CardHeader>
          <CardTitle>{isRTL ? 'الطلبات' : 'Requests'}</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center p-8"><Loader2 className="animate-spin" /></div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{isRTL ? 'الشهر' : 'Period'}</TableHead>
                  <TableHead>{isRTL ? 'الحالة' : 'Status'}</TableHead>
                  <TableHead>{isRTL ? 'الطالب' : 'Requester'}</TableHead>
                  <TableHead>{isRTL ? 'السبب' : 'Reason'}</TableHead>
                  <TableHead>{isRTL ? 'تاريخ' : 'When'}</TableHead>
                  <TableHead className="text-end">{isRTL ? 'إجراءات' : 'Actions'}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {requests.map((r: any) => {
                  const sameUser = r.requested_by === user?.id;
                  return (
                    <TableRow key={r.id}>
                      <TableCell className="font-mono">{r.period_month?.slice(0, 7)}</TableCell>
                      <TableCell><Badge variant="outline">{r.status}</Badge></TableCell>
                      <TableCell className="text-xs font-mono">{String(r.requested_by).slice(0, 8)}…</TableCell>
                      <TableCell className="text-xs max-w-md">{r.reason}</TableCell>
                      <TableCell className="text-xs">{formatDate(r.requested_at)}</TableCell>
                      <TableCell className="text-end space-x-2">
                        {r.status === 'pending' && (
                          <>
                            <Button
                              size="sm"
                              variant="default"
                              disabled={sameUser || working === r.id}
                              onClick={() => handleAction(r.id, true)}
                              title={sameUser ? (isRTL ? 'لا يمكنك الموافقة على طلبك' : 'Cannot approve own request') : ''}
                            >
                              {working === r.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <CheckCircle2 className="h-3 w-3" />}
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              disabled={working === r.id}
                              onClick={() => handleAction(r.id, false)}
                            >
                              <XCircle className="h-3 w-3" />
                            </Button>
                          </>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
                {requests.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground py-6">
                      {isRTL ? 'لا توجد طلبات' : 'No requests'}
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
