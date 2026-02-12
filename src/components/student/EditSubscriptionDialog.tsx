import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useLanguage } from '@/contexts/LanguageContext';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  subscription: any;
  studentName: string;
  onSuccess: () => void;
}

export function EditSubscriptionDialog({ open, onOpenChange, subscription, studentName, onSuccess }: Props) {
  const { isRTL, language } = useLanguage();
  const { toast } = useToast();
  const [plans, setPlans] = useState<any[]>([]);
  const [selectedPlanId, setSelectedPlanId] = useState('');
  const [paymentType, setPaymentType] = useState<'full' | 'installment'>('full');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [totalAmount, setTotalAmount] = useState(0);
  const [paidAmount, setPaidAmount] = useState(0);
  const [installmentAmount, setInstallmentAmount] = useState<number | null>(null);
  const [nextPaymentDate, setNextPaymentDate] = useState('');
  const [isSuspended, setIsSuspended] = useState(false);
  const [status, setStatus] = useState('active');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open && subscription) {
      setSelectedPlanId(subscription.pricing_plan_id || '');
      setPaymentType(subscription.payment_type || 'full');
      setStartDate(subscription.start_date || '');
      setEndDate(subscription.end_date || '');
      setTotalAmount(Number(subscription.total_amount) || 0);
      setPaidAmount(Number(subscription.paid_amount) || 0);
      setInstallmentAmount(subscription.installment_amount ? Number(subscription.installment_amount) : null);
      setNextPaymentDate(subscription.next_payment_date || '');
      setIsSuspended(subscription.is_suspended || false);
      setStatus(subscription.status || 'active');
      setNotes(subscription.notes || '');

      supabase.from('pricing_plans').select('*').eq('is_active', true).then(({ data }) => {
        setPlans((data as any) || []);
      });
    }
  }, [open, subscription]);

  const selectedPlan = plans.find(p => p.id === selectedPlanId);
  const remaining = Math.max(0, totalAmount - paidAmount);

  const handlePlanChange = (planId: string) => {
    setSelectedPlanId(planId);
    const plan = plans.find(p => p.id === planId);
    if (plan) {
      setTotalAmount(plan.price_3_months);
      setInstallmentAmount(plan.price_1_month);
    }
  };

  const handleSave = async () => {
    if (!subscription?.id) return;
    setSaving(true);
    try {
      const updateData: Record<string, any> = {
        pricing_plan_id: selectedPlanId || null,
        payment_type: paymentType,
        start_date: startDate,
        end_date: endDate,
        total_amount: totalAmount,
        paid_amount: paidAmount,
        remaining_amount: remaining,
        installment_amount: paymentType === 'installment' ? installmentAmount : null,
        next_payment_date: nextPaymentDate || null,
        is_suspended: isSuspended,
        status,
        notes: notes || null,
      };

      const { error } = await supabase
        .from('subscriptions')
        .update(updateData)
        .eq('id', subscription.id);

      if (error) throw error;

      toast({ title: isRTL ? 'تم تعديل الاشتراك بنجاح' : 'Subscription updated successfully' });
      onOpenChange(false);
      onSuccess();
    } catch (e: any) {
      toast({ title: isRTL ? 'حدث خطأ' : 'Error', description: e.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{isRTL ? 'تعديل الاشتراك' : 'Edit Subscription'}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="p-3 rounded-lg border bg-muted/50">
            <p className="font-medium">{studentName}</p>
          </div>

          <div>
            <Label>{isRTL ? 'الباقة' : 'Pricing Plan'}</Label>
            <Select value={selectedPlanId} onValueChange={handlePlanChange}>
              <SelectTrigger><SelectValue placeholder={isRTL ? 'اختر الباقة' : 'Select plan'} /></SelectTrigger>
              <SelectContent>
                {plans.map(p => (
                  <SelectItem key={p.id} value={p.id}>
                    {language === 'ar' ? p.name_ar : p.name} ({p.attendance_mode}) - {p.price_3_months} {isRTL ? 'ج.م' : 'EGP'}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>{isRTL ? 'نوع الدفع' : 'Payment Type'}</Label>
            <Select value={paymentType} onValueChange={v => setPaymentType(v as 'full' | 'installment')}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="full">{isRTL ? 'كامل (3 شهور)' : 'Full (3 months)'}</SelectItem>
                <SelectItem value="installment">{isRTL ? 'تقسيط شهري' : 'Monthly Installment'}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>{isRTL ? 'الحالة' : 'Status'}</Label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="active">{isRTL ? 'فعال' : 'Active'}</SelectItem>
                <SelectItem value="expired">{isRTL ? 'منتهي' : 'Expired'}</SelectItem>
                <SelectItem value="cancelled">{isRTL ? 'ملغي' : 'Cancelled'}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>{isRTL ? 'تاريخ البداية' : 'Start Date'}</Label>
              <Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} />
            </div>
            <div>
              <Label>{isRTL ? 'تاريخ النهاية' : 'End Date'}</Label>
              <Input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>{isRTL ? 'المبلغ الإجمالي' : 'Total Amount'}</Label>
              <Input type="number" value={totalAmount} onChange={e => setTotalAmount(+e.target.value)} min={0} />
            </div>
            <div>
              <Label>{isRTL ? 'المبلغ المدفوع' : 'Paid Amount'}</Label>
              <Input type="number" value={paidAmount} onChange={e => setPaidAmount(+e.target.value)} min={0} />
            </div>
          </div>

          {paymentType === 'installment' && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>{isRTL ? 'القسط الشهري' : 'Monthly Installment'}</Label>
                <Input type="number" value={installmentAmount || ''} onChange={e => setInstallmentAmount(+e.target.value || null)} min={0} />
              </div>
              <div>
                <Label>{isRTL ? 'تاريخ الدفع القادم' : 'Next Payment Date'}</Label>
                <Input type="date" value={nextPaymentDate} onChange={e => setNextPaymentDate(e.target.value)} />
              </div>
            </div>
          )}

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={isSuspended}
              onChange={e => setIsSuspended(e.target.checked)}
              className="h-4 w-4 rounded border-primary text-primary"
            />
            <Label className="cursor-pointer">{isRTL ? 'إيقاف الحساب' : 'Suspend Account'}</Label>
          </div>

          <div>
            <Label>{isRTL ? 'ملاحظات' : 'Notes'}</Label>
            <Input value={notes} onChange={e => setNotes(e.target.value)} />
          </div>

          {/* Summary */}
          <Card className="bg-muted/30">
            <CardContent className="pt-4 space-y-2 text-sm">
              <div className="flex justify-between">
                <span>{isRTL ? 'الإجمالي' : 'Total'}</span>
                <span className="font-bold">{totalAmount} {isRTL ? 'ج.م' : 'EGP'}</span>
              </div>
              <div className="flex justify-between">
                <span>{isRTL ? 'المدفوع' : 'Paid'}</span>
                <span className="text-green-600">{paidAmount} {isRTL ? 'ج.م' : 'EGP'}</span>
              </div>
              <div className="flex justify-between">
                <span>{isRTL ? 'المتبقي' : 'Remaining'}</span>
                <span className={remaining > 0 ? 'text-orange-600' : 'text-green-600'}>{remaining} {isRTL ? 'ج.م' : 'EGP'}</span>
              </div>
              {isSuspended && (
                <Badge variant="destructive" className="w-full justify-center mt-2">
                  {isRTL ? '⚠️ الحساب موقوف' : '⚠️ Account Suspended'}
                </Badge>
              )}
            </CardContent>
          </Card>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>{isRTL ? 'إلغاء' : 'Cancel'}</Button>
          <Button onClick={handleSave} disabled={saving}>{saving ? (isRTL ? 'جاري الحفظ...' : 'Saving...') : (isRTL ? 'حفظ التعديلات' : 'Save Changes')}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
