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
import { Users } from 'lucide-react';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  studentId: string;
  studentName: string;
  onSuccess: () => void;
  isRenewal?: boolean;
  previousSubscriptionId?: string;
}

export function CreateSubscriptionDialog({ open, onOpenChange, studentId, studentName, onSuccess, isRenewal, previousSubscriptionId }: Props) {
  const { isRTL, language } = useLanguage();
  const { user } = useAuth();
  const { toast } = useToast();
  const [plans, setPlans] = useState<any[]>([]);
  const [selectedPlanId, setSelectedPlanId] = useState('');
  const [paymentType, setPaymentType] = useState<'full' | 'installment'>('full');
  const [startDate, setStartDate] = useState('');
  const [paidAmount, setPaidAmount] = useState(0);
  const [notes, setNotes] = useState('');
  const [discountPercentage, setDiscountPercentage] = useState(0);
  const [saving, setSaving] = useState(false);
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split('T')[0]);
  const [hasActiveSubscription, setHasActiveSubscription] = useState(false);
  const [loadingCheck, setLoadingCheck] = useState(true);
  const [studentGroupInfo, setStudentGroupInfo] = useState<{ groupId: string; hasStarted: boolean; firstSessionDate: string | null } | null>(null);
  const [siblingInfo, setSiblingInfo] = useState<{ has_siblings: boolean; discount_percentage: number; sibling_names: string[] } | null>(null);

  useEffect(() => {
    if (open) {
      setLoadingCheck(true);
      setHasActiveSubscription(false);
      setStartDate('');
      setStudentGroupInfo(null);
      setSelectedPlanId('');
      setPaymentType('full');
      setPaidAmount(0);
      setNotes('');
      setDiscountPercentage(0);
      setPaymentDate(new Date().toISOString().split('T')[0]);
      setSiblingInfo(null);

      Promise.all([
        supabase.from('subscriptions').select('id').eq('student_id', studentId).eq('status', 'active').limit(1),
        supabase.from('pricing_plans').select('*').eq('is_active', true),
        supabase.from('group_students').select('group_id').eq('student_id', studentId).eq('is_active', true).limit(1),
        supabase.rpc('check_sibling_discount', { p_student_id: studentId }),
      ]).then(async ([subRes, plansRes, groupRes, siblingRes]) => {
        setHasActiveSubscription((subRes.data?.length || 0) > 0);
        setPlans((plansRes.data as any) || []);

        // Handle sibling discount
        if (siblingRes.data && typeof siblingRes.data === 'object') {
          const sd = siblingRes.data as any;
          if (sd.has_siblings) {
            setSiblingInfo({
              has_siblings: true,
              discount_percentage: sd.discount_percentage || 0,
              sibling_names: sd.sibling_names || [],
            });
            setDiscountPercentage(sd.discount_percentage || 0);
          }
        }

        const groupId = groupRes.data?.[0]?.group_id;
        if (groupId) {
          const [groupInfo, firstSession] = await Promise.all([
            supabase.from('groups').select('has_started').eq('id', groupId).single(),
            supabase.from('sessions').select('session_date').eq('group_id', groupId).order('session_date', { ascending: true }).limit(1).maybeSingle(),
          ]);
          
          const hasStarted = groupInfo.data?.has_started || false;
          const firstDate = firstSession.data?.session_date || null;
          setStudentGroupInfo({ groupId, hasStarted, firstSessionDate: firstDate });
          
          if (firstDate) {
            setStartDate(firstDate);
          }
        }

        setLoadingCheck(false);
      });
    }
  }, [open, studentId]);

  const selectedPlan = plans.find(p => p.id === selectedPlanId);
  const basePrice = selectedPlan
    ? (paymentType === 'installment' ? selectedPlan.price_1_month * 3 : selectedPlan.price_3_months)
    : 0;
  const discountAmount = Math.round(basePrice * discountPercentage / 100);
  const totalAmount = basePrice - discountAmount;
  const installmentAmount = selectedPlan ? Math.round(selectedPlan.price_1_month * (1 - discountPercentage / 100)) : 0;
  const remaining = Math.max(0, totalAmount - paidAmount);

  const handleSave = async () => {
    if (!selectedPlanId) {
      toast({ title: isRTL ? 'يرجى اختيار الباقة' : 'Please select a plan', variant: 'destructive' });
      return;
    }
    setSaving(true);
    try {
      // Close ALL active subscriptions for this student before creating a new one
      const { error: closeErr } = await supabase
        .from('subscriptions')
        .update({ status: 'completed' } as any)
        .eq('student_id', studentId)
        .eq('status', 'active');
      
      if (closeErr) {
        console.error('Failed to close previous subscriptions:', closeErr);
        // Don't block if there are no active subscriptions to close
        if (closeErr.code !== 'PGRST116') {
          throw new Error(isRTL ? 'فشل إغلاق الاشتراك السابق' : 'Failed to close previous subscription');
        }
      }

      // Get student's current level_id from profile
      const { data: profile } = await supabase.from('profiles').select('level_id').eq('user_id', studentId).single();
      const levelId = profile?.level_id || null;

      // Create subscription with null dates - RPC will set them when student is in a started group
      const { data: sub, error } = await supabase.from('subscriptions').insert({
        student_id: studentId,
        pricing_plan_id: selectedPlanId,
        payment_type: paymentType,
        start_date: null,
        end_date: null,
        total_amount: totalAmount,
        paid_amount: paidAmount,
        installment_amount: paymentType === 'installment' ? installmentAmount : null,
        next_payment_date: null,
        discount_percentage: discountPercentage,
        is_suspended: false,
        status: 'active',
        notes,
        level_id: levelId,
      } as any).select().single();

      if (error) throw error;

      if (paidAmount > 0 && sub) {
        await supabase.from('payments').insert({
          subscription_id: sub.id,
          student_id: studentId,
          amount: paidAmount,
          payment_date: paymentDate,
          payment_method: 'cash',
          payment_type: 'prior_payment',
          notes: isRTL ? 'دفعة مسبقة عند إنشاء الاشتراك' : 'Prior payment on subscription creation',
          recorded_by: user?.id,
        } as any);
      }

      // If student is in a started group, call RPC to auto-assign dates
      if (studentGroupInfo?.hasStarted && studentGroupInfo.groupId) {
        await supabase.rpc('assign_subscription_dates', {
          p_student_id: studentId,
          p_group_id: studentGroupInfo.groupId,
        } as any);
      }

      // Clear needs_renewal flag so student can access the platform
      await supabase.from('profiles').update({ needs_renewal: false } as any).eq('user_id', studentId);
      // Invalidate ProtectedRoute cache
      (window as any).__protectedRouteCacheReset?.();

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
   if (open && !loadingCheck && hasActiveSubscription && !isRenewal) {
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
          <DialogTitle>{isRenewal ? (isRTL ? 'تجديد الاشتراك' : 'Renew Subscription') : (isRTL ? 'إنشاء اشتراك جديد' : 'Create Subscription')}</DialogTitle>
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
                <Label>{isRTL ? 'نسبة الخصم الخاص %' : 'Special Discount %'}</Label>
                <Input type="number" value={discountPercentage} onChange={e => setDiscountPercentage(Math.min(100, Math.max(0, +e.target.value)))} min={0} max={100} placeholder="0" />
              </div>

              {studentGroupInfo?.hasStarted && studentGroupInfo.firstSessionDate ? (
                <div className="p-3 rounded-lg border bg-muted/30 text-sm">
                  <p className="text-muted-foreground">
                    {isRTL ? '📌 تاريخ البداية:' : '📌 Start Date:'}{' '}
                    <span className="font-medium text-foreground">{studentGroupInfo.firstSessionDate}</span>
                    {isRTL ? ' (تلقائي من أول سيشن)' : ' (auto from first session)'}
                  </p>
                </div>
              ) : (
                <div className="p-3 rounded-lg border bg-muted/30 text-sm">
                  <p className="text-muted-foreground">
                    {isRTL ? '📌 تاريخ البداية يتحدد تلقائياً عند إسناد الطالب لمجموعة' : '📌 Start date is set automatically when the student is assigned to a group'}
                  </p>
                </div>
              )}

              <div>
                <Label>{isRTL ? 'المبلغ المدفوع فعلاً' : 'Amount Already Paid'}</Label>
                <Input type="number" value={paidAmount} onChange={e => setPaidAmount(+e.target.value)} min={0} max={totalAmount} />
              </div>

              {paidAmount > 0 && (
                <div>
                  <Label>{isRTL ? 'تاريخ الدفع الفعلي' : 'Actual Payment Date'}</Label>
                  <Input type="date" value={paymentDate} onChange={e => setPaymentDate(e.target.value)} max={new Date().toISOString().split('T')[0]} />
                </div>
              )}

              <div>
                <Label>{isRTL ? 'ملاحظات' : 'Notes'}</Label>
                <Input value={notes} onChange={e => setNotes(e.target.value)} />
              </div>

              {selectedPlan && (
                <Card className="bg-muted/30">
                  <CardContent className="pt-4 space-y-2 text-sm">
                    {paymentType === 'installment' && selectedPlan.price_1_month * 3 !== selectedPlan.price_3_months && (
                      <div className="flex justify-between text-muted-foreground text-xs">
                        <span>{isRTL ? 'سعر الدفع الكامل (3 شهور)' : 'Full payment price (3 months)'}</span>
                        <span>{selectedPlan.price_3_months} {isRTL ? 'ج.م' : 'EGP'}</span>
                      </div>
                    )}
                    {discountPercentage > 0 && (
                      <>
                        <div className="flex justify-between">
                          <span>{isRTL ? 'السعر الأصلي' : 'Original Price'}</span>
                          <span className="line-through text-muted-foreground">{basePrice} {isRTL ? 'ج.م' : 'EGP'}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>{isRTL ? `خصم ${discountPercentage}%` : `${discountPercentage}% Discount`}</span>
                          <span className="text-destructive">-{discountAmount} {isRTL ? 'ج.م' : 'EGP'}</span>
                        </div>
                      </>
                    )}
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
                      <span className="text-emerald-600">{paidAmount} {isRTL ? 'ج.م' : 'EGP'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>{isRTL ? 'المتبقي' : 'Remaining'}</span>
                      <span className={remaining > 0 ? 'text-amber-600' : 'text-emerald-600'}>{remaining} {isRTL ? 'ج.م' : 'EGP'}</span>
                    </div>
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
