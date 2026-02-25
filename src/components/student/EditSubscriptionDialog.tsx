import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  subscription: any;
  studentId: string;
  studentName: string;
  onSuccess: () => void;
}

export function EditSubscriptionDialog({ open, onOpenChange, subscription, studentId, studentName, onSuccess }: Props) {
  const { isRTL, language } = useLanguage();
  const { role } = useAuth();
  const { toast } = useToast();
  const isAdmin = role === 'admin';

  const [plans, setPlans] = useState<any[]>([]);
  const [selectedPlanId, setSelectedPlanId] = useState('');
  const [paymentType, setPaymentType] = useState<'full' | 'installment'>('full');
  const [totalAmount, setTotalAmount] = useState(0);
  const [paidAmount, setPaidAmount] = useState(0);
  const [installmentAmount, setInstallmentAmount] = useState<number | null>(null);
  const [nextPaymentDate, setNextPaymentDate] = useState('');
  const [isSuspended, setIsSuspended] = useState(false);
  const [status, setStatus] = useState('active');
  const [notes, setNotes] = useState('');
  const [discountPercentage, setDiscountPercentage] = useState(0);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open && subscription) {
      setSelectedPlanId(subscription.pricing_plan_id || '');
      setPaymentType(subscription.payment_type || 'full');
      setTotalAmount(Number(subscription.total_amount) || 0);
      setPaidAmount(Number(subscription.paid_amount) || 0);
      setInstallmentAmount(subscription.installment_amount ? Number(subscription.installment_amount) : null);
      setNextPaymentDate(subscription.next_payment_date || '');
      setIsSuspended(subscription.is_suspended || false);
      setStatus(subscription.status || 'active');
      setNotes(subscription.notes || '');
      setDiscountPercentage(Number(subscription.discount_percentage) || 0);

      supabase.from('pricing_plans').select('*').eq('is_active', true).then(res => {
        setPlans((res.data as any) || []);
      });
    }
  }, [open, subscription]);

  const selectedPlan = plans.find(p => p.id === selectedPlanId);
  const remaining = Math.max(0, totalAmount - paidAmount);

  // Shared calculation logic
  const recalcAmounts = (plan: any, pt: 'full' | 'installment', disc: number) => {
    if (!plan) return;
    const base = pt === 'installment' ? plan.price_1_month * 3 : plan.price_3_months;
    const discounted = Math.round(base * (1 - disc / 100));
    const inst = Math.round(plan.price_1_month * (1 - disc / 100));
    setTotalAmount(discounted);
    setInstallmentAmount(inst);
  };

  const handlePlanChange = (planId: string) => {
    setSelectedPlanId(planId);
    const plan = plans.find(p => p.id === planId);
    if (plan) recalcAmounts(plan, paymentType, discountPercentage);
  };

  const handlePaymentTypeChange = (pt: 'full' | 'installment') => {
    setPaymentType(pt);
    if (selectedPlan) recalcAmounts(selectedPlan, pt, discountPercentage);
  };

  const handleDiscountChange = (pct: number) => {
    const safePct = Math.min(100, Math.max(0, pct));
    setDiscountPercentage(safePct);
    if (selectedPlan) recalcAmounts(selectedPlan, paymentType, safePct);
  };

  const handleSave = async () => {
    if (!subscription?.id) return;
    setSaving(true);
    try {
      const updateData: Record<string, any> = {
        pricing_plan_id: selectedPlanId || null,
        payment_type: paymentType,
        total_amount: totalAmount,
        installment_amount: paymentType === 'installment' ? installmentAmount : null,
        next_payment_date: nextPaymentDate || null,
        is_suspended: isSuspended,
        status,
        notes: notes || null,
        discount_percentage: discountPercentage,
      };
      // paid_amount removed — source of truth is payments table

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
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isRTL ? 'تعديل الاشتراك' : 'Edit Subscription'}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="p-3 rounded-lg border bg-muted/50">
            <p className="font-medium">{studentName}</p>
          </div>

          {/* Reception warning banner */}
          {!isAdmin && (
            <div className="flex items-center gap-2 p-3 rounded-lg border border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/30 text-sm">
              <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />
              <span className="text-amber-800 dark:text-amber-300">
                {isRTL ? 'التعديلات المالية تحتاج موافقة الأدمن' : 'Financial changes require admin approval'}
              </span>
            </div>
          )}

          <div>
            <Label>{isRTL ? 'الباقة' : 'Pricing Plan'}</Label>
            <Select value={selectedPlanId} onValueChange={handlePlanChange} disabled={!isAdmin}>
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
            <Select value={paymentType} onValueChange={v => handlePaymentTypeChange(v as 'full' | 'installment')} disabled={!isAdmin}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="full">{isRTL ? 'كامل (3 شهور)' : 'Full (3 months)'}</SelectItem>
                <SelectItem value="installment">{isRTL ? 'تقسيط شهري' : 'Monthly Installment'}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>{isRTL ? 'الحالة' : 'Status'}</Label>
            <Select value={status} onValueChange={setStatus} disabled={!isAdmin}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="active">{isRTL ? 'فعال' : 'Active'}</SelectItem>
                <SelectItem value="expired">{isRTL ? 'منتهي' : 'Expired'}</SelectItem>
                <SelectItem value="cancelled">{isRTL ? 'ملغي' : 'Cancelled'}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>{isRTL ? 'نسبة الخصم الخاص %' : 'Special Discount %'}</Label>
            <Input 
              type="number" 
              value={discountPercentage} 
              onChange={e => handleDiscountChange(+e.target.value)} 
              min={0} 
              max={100} 
              placeholder="0"
              disabled={!isAdmin}
            />
          </div>

          {paymentType === 'installment' && (
            <div>
              <Label>{isRTL ? 'تاريخ الدفع القادم' : 'Next Payment Date'}</Label>
              <Input type="date" value={nextPaymentDate} onChange={e => setNextPaymentDate(e.target.value)} />
            </div>
          )}

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={isSuspended}
              onChange={e => setIsSuspended(e.target.checked)}
              className="h-4 w-4 rounded border-primary text-primary"
              disabled={!isAdmin}
            />
            <Label className="cursor-pointer">{isRTL ? 'إيقاف الحساب' : 'Suspend Account'}</Label>
          </div>

          <div>
            <Label>{isRTL ? 'ملاحظات' : 'Notes'}</Label>
            <Input value={notes} onChange={e => setNotes(e.target.value)} />
          </div>

          {/* Summary Card */}
          <Card className="bg-muted/30">
            <CardContent className="pt-4 space-y-2 text-sm">
              {selectedPlan && discountPercentage > 0 && (
                <>
                  <div className="flex justify-between">
                    <span>{isRTL ? 'السعر الأصلي' : 'Original Price'}</span>
                    <span className="line-through text-muted-foreground">
                      {paymentType === 'installment' ? selectedPlan.price_1_month * 3 : selectedPlan.price_3_months} {isRTL ? 'ج.م' : 'EGP'}
                    </span>
                  </div>
                  <div className="flex justify-between text-green-600">
                    <span>{isRTL ? `خصم ${discountPercentage}%` : `${discountPercentage}% Discount`}</span>
                    <span>
                      -{Math.round((paymentType === 'installment' ? selectedPlan.price_1_month * 3 : selectedPlan.price_3_months) * discountPercentage / 100)} {isRTL ? 'ج.م' : 'EGP'}
                    </span>
                  </div>
                </>
              )}
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
              {paymentType === 'installment' && installmentAmount && (
                <div className="flex justify-between">
                  <span>{isRTL ? 'القسط الشهري' : 'Monthly Installment'}</span>
                  <span className="font-medium">{installmentAmount} {isRTL ? 'ج.م' : 'EGP'}</span>
                </div>
              )}
              {subscription?.start_date && (
                <div className="flex justify-between text-muted-foreground">
                  <span>{isRTL ? 'فترة الاشتراك' : 'Subscription Period'}</span>
                  <span>{subscription.start_date} → {subscription.end_date}</span>
                </div>
              )}
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
