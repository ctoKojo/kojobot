import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  studentId: string;
  studentName: string;
  onSuccess: () => void;
}

export function CreateSubscriptionDialog({ open, onOpenChange, studentId, studentName, onSuccess }: Props) {
  const { isRTL, language } = useLanguage();
  const { user } = useAuth();
  const { toast } = useToast();
  const [plans, setPlans] = useState<any[]>([]);
  const [selectedPlanId, setSelectedPlanId] = useState('');
  const [paymentType, setPaymentType] = useState<'full' | 'installment'>('full');
  const [startDate, setStartDate] = useState('');
  const [paidAmount, setPaidAmount] = useState(0);
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [hasActiveSubscription, setHasActiveSubscription] = useState(false);
  const [loadingCheck, setLoadingCheck] = useState(true);

  useEffect(() => {
    if (open) {
      setLoadingCheck(true);
      setHasActiveSubscription(false);
      setStartDate('');

      // Check for existing active subscription, fetch plans, and fetch first session date in parallel
      Promise.all([
        supabase.from('subscriptions').select('id').eq('student_id', studentId).eq('status', 'active').limit(1),
        supabase.from('pricing_plans').select('*').eq('is_active', true),
        // Get student's group, then first session
        supabase.from('group_students').select('group_id').eq('student_id', studentId).eq('is_active', true).limit(1),
      ]).then(async ([subRes, plansRes, groupRes]) => {
        setHasActiveSubscription((subRes.data?.length || 0) > 0);
        setPlans((plansRes.data as any) || []);

        // Auto-set start date from first session
        const groupId = groupRes.data?.[0]?.group_id;
        if (groupId) {
          const { data: firstSession } = await supabase
            .from('sessions')
            .select('session_date')
            .eq('group_id', groupId)
            .order('session_date', { ascending: true })
            .limit(1)
            .maybeSingle();
          
          if (firstSession?.session_date) {
            setStartDate(firstSession.session_date);
          } else {
            setStartDate(new Date().toISOString().split('T')[0]);
          }
        } else {
          setStartDate(new Date().toISOString().split('T')[0]);
        }

        setLoadingCheck(false);
      });
    }
  }, [open, studentId]);

  const selectedPlan = plans.find(p => p.id === selectedPlanId);
  const totalAmount = selectedPlan ? selectedPlan.price_3_months : 0;
  const installmentAmount = selectedPlan ? selectedPlan.price_1_month : 0;
  const endDate = startDate ? new Date(new Date(startDate).getTime() + 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0] : '';
  const remaining = Math.max(0, totalAmount - paidAmount);

  const calcNextPaymentDate = () => {
    if (paymentType === 'full' || remaining <= 0) return null;
    const paidInstallments = Math.floor(paidAmount / installmentAmount);
    const start = new Date(startDate);
    return new Date(start.getTime() + paidInstallments * 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  };

  const handleSave = async () => {
    if (!selectedPlanId || !startDate) {
      toast({ title: isRTL ? 'يرجى ملء جميع الحقول' : 'Please fill all fields', variant: 'destructive' });
      return;
    }
    setSaving(true);
    try {
      const nextPaymentDate = calcNextPaymentDate();
      const isSuspended = nextPaymentDate && new Date(nextPaymentDate) < new Date() && remaining > 0;

      const { data: sub, error } = await supabase.from('subscriptions').insert({
        student_id: studentId,
        pricing_plan_id: selectedPlanId,
        payment_type: paymentType,
        start_date: startDate,
        end_date: endDate,
        total_amount: totalAmount,
        paid_amount: paidAmount,
        installment_amount: paymentType === 'installment' ? installmentAmount : null,
        next_payment_date: nextPaymentDate,
        is_suspended: !!isSuspended,
        status: 'active',
        notes,
      } as any).select().single();

      if (error) throw error;

      if (paidAmount > 0 && sub) {
        await supabase.from('payments').insert({
          subscription_id: sub.id,
          student_id: studentId,
          amount: paidAmount,
          payment_date: new Date().toISOString().split('T')[0],
          payment_method: 'cash',
          payment_type: 'prior_payment',
          notes: isRTL ? 'دفعة مسبقة عند إنشاء الاشتراك' : 'Prior payment on subscription creation',
          recorded_by: user?.id,
        } as any);
      }

      toast({ title: isRTL ? 'تم إنشاء الاشتراك بنجاح' : 'Subscription created successfully' });
      onOpenChange(false);
      onSuccess();
    } catch (e: any) {
      toast({ title: isRTL ? 'حدث خطأ' : 'Error occurred', description: e.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  // Show warning if already has active subscription
  if (open && !loadingCheck && hasActiveSubscription) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{isRTL ? 'لا يمكن إنشاء اشتراك' : 'Cannot Create Subscription'}</DialogTitle>
          </DialogHeader>
          <div className="py-6 text-center space-y-3">
            <Badge variant="destructive" className="text-sm px-4 py-1">
              {isRTL ? '⚠️ يوجد اشتراك فعال بالفعل' : '⚠️ Active subscription already exists'}
            </Badge>
            <p className="text-muted-foreground text-sm">
              {isRTL 
                ? `الطالب ${studentName} لديه اشتراك فعال حالياً. لا يمكن إنشاء اشتراك جديد إلا بعد انتهاء الاشتراك الحالي.`
                : `Student ${studentName} already has an active subscription. A new one can only be created after the current one expires.`}
            </p>
          </div>
          <DialogFooter>
            <Button onClick={() => onOpenChange(false)}>{isRTL ? 'حسناً' : 'OK'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{isRTL ? 'إنشاء اشتراك جديد' : 'Create Subscription'}</DialogTitle>
        </DialogHeader>
        {loadingCheck ? (
          <div className="py-8 text-center text-muted-foreground">{isRTL ? 'جاري التحميل...' : 'Loading...'}</div>
        ) : (
          <>
            <div className="space-y-4 py-4">
              <div className="p-3 rounded-lg border bg-muted/50">
                <p className="font-medium">{studentName}</p>
              </div>

              <div>
                <Label>{isRTL ? 'الباقة' : 'Pricing Plan'}</Label>
                <Select value={selectedPlanId} onValueChange={setSelectedPlanId}>
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
                <Label>{isRTL ? 'تاريخ البداية (تلقائي من أول سيشن)' : 'Start Date (auto from first session)'}</Label>
                <Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} />
              </div>

              <div>
                <Label>{isRTL ? 'المبلغ المدفوع فعلاً' : 'Amount Already Paid'}</Label>
                <Input type="number" value={paidAmount} onChange={e => setPaidAmount(+e.target.value)} min={0} max={totalAmount} />
              </div>

              <div>
                <Label>{isRTL ? 'ملاحظات' : 'Notes'}</Label>
                <Input value={notes} onChange={e => setNotes(e.target.value)} />
              </div>

              {selectedPlan && (
                <Card className="bg-muted/30">
                  <CardContent className="pt-4 space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span>{isRTL ? 'المبلغ الإجمالي' : 'Total Amount'}</span>
                      <span className="font-bold">{totalAmount} {isRTL ? 'ج.م' : 'EGP'}</span>
                    </div>
                    {paymentType === 'installment' && (
                      <div className="flex justify-between">
                        <span>{isRTL ? 'القسط الشهري' : 'Monthly Installment'}</span>
                        <span>{installmentAmount} {isRTL ? 'ج.م' : 'EGP'}</span>
                      </div>
                    )}
                    <div className="flex justify-between">
                      <span>{isRTL ? 'المدفوع' : 'Paid'}</span>
                      <span className="text-green-600">{paidAmount} {isRTL ? 'ج.م' : 'EGP'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>{isRTL ? 'المتبقي' : 'Remaining'}</span>
                      <span className={remaining > 0 ? 'text-orange-600' : 'text-green-600'}>{remaining} {isRTL ? 'ج.م' : 'EGP'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>{isRTL ? 'تاريخ النهاية' : 'End Date'}</span>
                      <span>{endDate}</span>
                    </div>
                    {calcNextPaymentDate() && (
                      <div className="flex justify-between">
                        <span>{isRTL ? 'الدفع القادم' : 'Next Payment'}</span>
                        <span>{calcNextPaymentDate()}</span>
                      </div>
                    )}
                    {calcNextPaymentDate() && new Date(calcNextPaymentDate()!) < new Date() && remaining > 0 && (
                      <Badge variant="destructive" className="w-full justify-center mt-2">
                        {isRTL ? '⚠️ الطالب متأخر - سيتم إيقاف الحساب' : '⚠️ Overdue - Account will be suspended'}
                      </Badge>
                    )}
                  </CardContent>
                </Card>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => onOpenChange(false)}>{isRTL ? 'إلغاء' : 'Cancel'}</Button>
              <Button onClick={handleSave} disabled={saving}>{saving ? (isRTL ? 'جاري الحفظ...' : 'Saving...') : (isRTL ? 'إنشاء الاشتراك' : 'Create Subscription')}</Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
