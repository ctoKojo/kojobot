import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Pencil, DollarSign } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { formatDate } from '@/lib/timeUtils';

interface Props {
  studentId: string;
}

export function PaymentsHistory({ studentId }: Props) {
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

  const openEdit = (payment: any) => {
    setEditingPayment(payment);
    setEditDate(payment.payment_date);
    setEditDialog(true);
  };

  const handleSaveDate = async () => {
    if (!editingPayment || !editDate) return;
    
    // Validate not future
    if (editDate > new Date().toISOString().split('T')[0]) {
      toast({ title: isRTL ? 'لا يمكن اختيار تاريخ مستقبلي' : 'Cannot select a future date', variant: 'destructive' });
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase
        .from('payments')
        .update({ payment_date: editDate })
        .eq('id', editingPayment.id);

      if (error) throw error;

      toast({ title: isRTL ? 'تم تعديل تاريخ الدفع بنجاح' : 'Payment date updated successfully' });
      setEditDialog(false);
      fetchPayments();
      queryClient.invalidateQueries({ queryKey: ['payment-tracker'] });
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

  return (
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
                <Input
                  type="date"
                  value={editDate}
                  onChange={e => setEditDate(e.target.value)}
                  max={new Date().toISOString().split('T')[0]}
                />
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
    </Card>
  );
}
