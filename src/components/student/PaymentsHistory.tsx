import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Pencil, DollarSign, Calendar, TrendingUp, CheckCircle, Clock, BookOpen } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { formatDate } from '@/lib/timeUtils';
import { calculateReceivables } from '@/lib/receivablesCalculator';

interface Props {
  studentId: string;
  subscription?: any;
  attendance?: any[];
}

export function PaymentsHistory({ studentId, subscription, attendance }: Props) {
  const { isRTL, language } = useLanguage();
  const { role } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [payments, setPayments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [editDialog, setEditDialog] = useState(false);
  const [editingPayment, setEditingPayment] = useState<any>(null);
  const [editDate, setEditDate] = useState('');
  const [saving, setSaving] = useState(false);

  const canEdit = role === 'admin' || role === 'reception';

  const fetchPayments = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('payments')
      .select('*')
      .eq('student_id', studentId)
      .order('payment_date', { ascending: false });
    setPayments(data || []);
    setLoading(false);
  };

  useEffect(() => { fetchPayments(); }, [studentId]);

  // Financial calculations
  const totalAmount = subscription?.total_amount || 0;
  const calculatedPaid = useMemo(() => payments.reduce((sum, p) => sum + (p.amount || 0), 0), [payments]);
  const remainingAmount = Math.max(0, totalAmount - calculatedPaid);
  const lastPayment = payments.length > 0 ? payments[0] : null;

  // Academic calculations
  const completedSessions = useMemo(() => {
    if (!attendance) return 0;
    return attendance.filter(a => a.status === 'present' || a.status === 'late').length;
  }, [attendance]);
  const remainingSessions = Math.max(0, 12 - completedSessions);

  // Receivables table
  const receivables = useMemo(() => {
    if (!totalAmount) return [];
    const sortedPayments = [...payments].sort((a, b) => new Date(a.payment_date).getTime() - new Date(b.payment_date).getTime());
    return calculateReceivables(totalAmount, 12, sortedPayments);
  }, [totalAmount, payments]);

  // Subscription status
  const subscriptionStatus = subscription?.is_suspended 
    ? (isRTL ? 'موقوف' : 'Suspended')
    : subscription?.status === 'expired' 
      ? (isRTL ? 'منتهي' : 'Expired')
      : subscription 
        ? (isRTL ? 'فعال' : 'Active')
        : (isRTL ? 'لا يوجد' : 'None');

  const statusColor = subscription?.is_suspended 
    ? 'bg-red-100 text-red-800'
    : subscription?.status === 'expired' 
      ? 'bg-gray-100 text-gray-800'
      : subscription 
        ? 'bg-green-100 text-green-800'
        : 'bg-gray-100 text-gray-800';

  const openEdit = (payment: any) => {
    setEditingPayment(payment);
    setEditDate(payment.payment_date);
    setEditDialog(true);
  };

  const handleSaveDate = async () => {
    if (!editingPayment || !editDate) return;
    if (editDate > new Date().toISOString().split('T')[0]) {
      toast({ title: isRTL ? 'لا يمكن اختيار تاريخ مستقبلي' : 'Cannot select a future date', variant: 'destructive' });
      return;
    }
    setSaving(true);
    try {
      const { error } = await supabase.from('payments').update({ payment_date: editDate }).eq('id', editingPayment.id);
      if (error) throw error;
      toast({ title: isRTL ? 'تم تعديل تاريخ الدفع بنجاح' : 'Payment date updated successfully' });
      setEditDialog(false);
      fetchPayments();
      queryClient.invalidateQueries({ queryKey: ['payment-tracker'] });
      queryClient.invalidateQueries({ queryKey: ['finance-data'] });
      queryClient.invalidateQueries({ queryKey: ['cash-flow'] });
    } catch (e: any) {
      toast({ title: isRTL ? 'خطأ' : 'Error', description: e.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const paymentTypeLabel = (type: string) => {
    const map: Record<string, { en: string; ar: string }> = {
      prior_payment: { en: 'Prior Payment', ar: 'دفعة مسبقة' },
      regular: { en: 'Regular', ar: 'دفعة عادية' },
      installment: { en: 'Installment', ar: 'قسط' },
    };
    const label = map[type] || { en: type, ar: type };
    return isRTL ? label.ar : label.en;
  };

  const receivableStatusLabel = (status: string) => {
    const map: Record<string, { en: string; ar: string; color: string }> = {
      paid: { en: 'Paid', ar: 'مكتمل', color: 'bg-green-100 text-green-800' },
      partial: { en: 'Partial', ar: 'جزئي', color: 'bg-yellow-100 text-yellow-800' },
      unpaid: { en: 'Unpaid', ar: 'غير مدفوع', color: 'bg-red-100 text-red-800' },
    };
    return map[status] || map.unpaid;
  };

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      {subscription && (
        <div className="grid gap-4 grid-cols-2 md:grid-cols-4">
          <Card>
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center gap-2 mb-1">
                <DollarSign className="h-4 w-4 text-muted-foreground" />
                <span className="text-xs text-muted-foreground">{isRTL ? 'إجمالي التعاقد' : 'Total Contract'}</span>
              </div>
              <p className="text-xl font-bold">{totalAmount} <span className="text-sm font-normal">{isRTL ? 'ج.م' : 'EGP'}</span></p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center gap-2 mb-1">
                <TrendingUp className="h-4 w-4 text-green-600" />
                <span className="text-xs text-muted-foreground">{isRTL ? 'المدفوع' : 'Paid'}</span>
              </div>
              <p className="text-xl font-bold text-green-700">{calculatedPaid} <span className="text-sm font-normal">{isRTL ? 'ج.م' : 'EGP'}</span></p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center gap-2 mb-1">
                <DollarSign className="h-4 w-4 text-orange-600" />
                <span className="text-xs text-muted-foreground">{isRTL ? 'المتبقي' : 'Remaining'}</span>
              </div>
              <p className={`text-xl font-bold ${remainingAmount > 0 ? 'text-orange-600' : 'text-green-700'}`}>
                {remainingAmount} <span className="text-sm font-normal">{isRTL ? 'ج.م' : 'EGP'}</span>
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center gap-2 mb-1">
                <CheckCircle className="h-4 w-4 text-muted-foreground" />
                <span className="text-xs text-muted-foreground">{isRTL ? 'حالة الاشتراك' : 'Status'}</span>
              </div>
              <Badge className={statusColor}>{subscriptionStatus}</Badge>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center gap-2 mb-1">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <span className="text-xs text-muted-foreground">{isRTL ? 'بداية الاشتراك' : 'Start Date'}</span>
              </div>
              <p className="text-sm font-medium">{subscription.start_date ? formatDate(subscription.start_date) : '-'}</p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center gap-2 mb-1">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <span className="text-xs text-muted-foreground">{isRTL ? 'نهاية الاشتراك' : 'End Date'}</span>
              </div>
              <p className="text-sm font-medium">{subscription.end_date ? formatDate(subscription.end_date) : '-'}</p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center gap-2 mb-1">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <span className="text-xs text-muted-foreground">{isRTL ? 'آخر دفعة' : 'Last Payment'}</span>
              </div>
              {lastPayment ? (
                <div>
                  <p className="text-sm font-medium">{lastPayment.amount} {isRTL ? 'ج.م' : 'EGP'}</p>
                  <p className="text-xs text-muted-foreground">{formatDate(lastPayment.payment_date)}</p>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">-</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center gap-2 mb-1">
                <BookOpen className="h-4 w-4 text-muted-foreground" />
                <span className="text-xs text-muted-foreground">{isRTL ? 'السيشنات' : 'Sessions'}</span>
              </div>
              <p className="text-sm font-medium">
                <span className="text-green-700">{completedSessions}</span> / 12
                <span className="text-xs text-muted-foreground ml-1">
                  ({isRTL ? `${remainingSessions} متبقية` : `${remainingSessions} remaining`})
                </span>
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Payment History & Receivables Tabs */}
      <Tabs defaultValue="history">
        <TabsList>
          <TabsTrigger value="history">{isRTL ? 'سجل الدفعات' : 'Payment History'}</TabsTrigger>
          {totalAmount > 0 && (
            <TabsTrigger value="receivables">{isRTL ? 'جدول المستحقات' : 'Receivables'}</TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="history">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <DollarSign className="h-5 w-5" />
                {isRTL ? 'سجل الدفعات' : 'Payment History'}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <p className="text-center text-muted-foreground py-8">{isRTL ? 'جاري التحميل...' : 'Loading...'}</p>
              ) : payments.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">
                  <DollarSign className="h-12 w-12 mx-auto text-muted-foreground mb-2" />
                  {isRTL ? 'لا توجد دفعات مسجلة' : 'No payments recorded'}
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{isRTL ? 'تاريخ الدفع' : 'Payment Date'}</TableHead>
                      <TableHead>{isRTL ? 'المبلغ' : 'Amount'}</TableHead>
                      <TableHead>{isRTL ? 'النوع' : 'Type'}</TableHead>
                      <TableHead>{isRTL ? 'طريقة الدفع' : 'Method'}</TableHead>
                      <TableHead>{isRTL ? 'ملاحظات' : 'Notes'}</TableHead>
                      {canEdit && <TableHead>{isRTL ? 'تعديل' : 'Edit'}</TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {payments.map(p => (
                      <TableRow key={p.id}>
                        <TableCell>{formatDate(p.payment_date)}</TableCell>
                        <TableCell className="font-medium">{p.amount} {isRTL ? 'ج.م' : 'EGP'}</TableCell>
                        <TableCell>
                          <Badge variant="secondary">{paymentTypeLabel(p.payment_type)}</Badge>
                        </TableCell>
                        <TableCell>{p.payment_method === 'cash' ? (isRTL ? 'كاش' : 'Cash') : (isRTL ? 'تحويل' : 'Transfer')}</TableCell>
                        <TableCell className="text-muted-foreground text-sm max-w-[200px] truncate">{p.notes || '-'}</TableCell>
                        {canEdit && (
                          <TableCell>
                            <Button size="sm" variant="ghost" onClick={() => openEdit(p)}>
                              <Pencil className="h-3 w-3" />
                            </Button>
                          </TableCell>
                        )}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {totalAmount > 0 && (
          <TabsContent value="receivables">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5" />
                  {isRTL ? 'جدول المستحقات' : 'Receivables Schedule'}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{isRTL ? 'رقم السيشن' : 'Session #'}</TableHead>
                      <TableHead>{isRTL ? 'المستحق' : 'Due'}</TableHead>
                      <TableHead>{isRTL ? 'المدفوع' : 'Covered'}</TableHead>
                      <TableHead>{isRTL ? 'المتبقي' : 'Remaining'}</TableHead>
                      <TableHead>{isRTL ? 'الحالة' : 'Status'}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {receivables.map(row => {
                      const isCompleted = row.sessionNumber <= completedSessions;
                      const statusInfo = receivableStatusLabel(row.status);
                      return (
                        <TableRow key={row.sessionNumber} className={isCompleted ? 'bg-green-50 dark:bg-green-900/10' : ''}>
                          <TableCell className="font-medium">
                            {row.sessionNumber}
                            {isCompleted && <CheckCircle className="h-3 w-3 text-green-600 inline ml-1" />}
                          </TableCell>
                          <TableCell>{row.amountDue} {isRTL ? 'ج.م' : 'EGP'}</TableCell>
                          <TableCell className="text-green-700">{row.amountCovered} {isRTL ? 'ج.م' : 'EGP'}</TableCell>
                          <TableCell className={row.remaining > 0 ? 'text-orange-600' : ''}>{row.remaining} {isRTL ? 'ج.م' : 'EGP'}</TableCell>
                          <TableCell>
                            <Badge className={statusInfo.color}>{isRTL ? statusInfo.ar : statusInfo.en}</Badge>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
        )}
      </Tabs>

      {/* Edit Payment Date Dialog */}
      <Dialog open={editDialog} onOpenChange={setEditDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{isRTL ? 'تعديل تاريخ الدفع' : 'Edit Payment Date'}</DialogTitle>
          </DialogHeader>
          {editingPayment && (
            <div className="space-y-4 py-4">
              <div className="p-3 rounded-lg border bg-muted/50 text-sm space-y-1">
                <p><span className="text-muted-foreground">{isRTL ? 'المبلغ: ' : 'Amount: '}</span>{editingPayment.amount} {isRTL ? 'ج.م' : 'EGP'}</p>
                <p><span className="text-muted-foreground">{isRTL ? 'التاريخ الحالي: ' : 'Current Date: '}</span>{formatDate(editingPayment.payment_date)}</p>
              </div>
              <div>
                <Label>{isRTL ? 'تاريخ الدفع الجديد' : 'New Payment Date'}</Label>
                <Input type="date" value={editDate} onChange={e => setEditDate(e.target.value)} max={new Date().toISOString().split('T')[0]} />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialog(false)}>{isRTL ? 'إلغاء' : 'Cancel'}</Button>
            <Button onClick={handleSaveDate} disabled={saving}>
              {saving ? (isRTL ? 'جاري الحفظ...' : 'Saving...') : (isRTL ? 'حفظ' : 'Save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
