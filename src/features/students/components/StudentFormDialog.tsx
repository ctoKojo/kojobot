/**
 * StudentFormDialog — Create/Edit student form.
 *
 * 🚧 PILOT-PHASE NOTE (ARCHITECTURE.md migration tracker):
 * This dialog still imports `supabase` directly to preserve the existing
 * subscription-creation, parent-search, and edge-function invocation flows.
 * Step 3 of the Students pilot will extract these into:
 *   • parentsService.search()                   (parent-search)
 *   • subscriptionsService.createWithPayment()  (subscription + payment)
 *   • createUserService()                        (edge function wrapper)
 *
 * Until then the eslint-disable below is intentional and tracked.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
// eslint-disable-next-line no-restricted-imports
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { useToast } from '@/hooks/use-toast';
import { AvatarUpload } from '@/components/AvatarUpload';
import { CredentialsDialog } from '@/components/CredentialsDialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { AlertCircle, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  validateMobileNumber,
  validatePassword,
  validateEnglishName,
  validateArabicName,
  validateDateOfBirth,
  validateEmail,
  getLocalizedError,
} from '@/lib/validationUtils';
import { GROUP_TYPES_LIST, type GroupType as SubscriptionType } from '@/lib/constants';
import type { StudentListItem, AttendanceMode } from '../types';

type PaymentType = 'full' | 'installment';

interface PricingPlan {
  id: string;
  name: string;
  name_ar: string;
  group_type: string;
  attendance_mode: string;
  price_1_month: number;
  price_3_months: number;
  price_before_discount: number;
  discount_percentage: number;
}

interface AgeGroup {
  id: string;
  name: string;
  name_ar: string;
  min_age: number;
  max_age: number;
}

interface Level {
  id: string;
  name: string;
  name_ar: string;
  level_order: number;
}

interface StudentFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editingStudent: StudentListItem | null;
  onSaved: () => void;
}

export function StudentFormDialog({
  open,
  onOpenChange,
  editingStudent,
  onSaved,
}: StudentFormDialogProps) {
  const { t, isRTL, language } = useLanguage();
  const { toast } = useToast();
  const { user } = useAuth();

  const [ageGroups, setAgeGroups] = useState<AgeGroup[]>([]);
  const [levels, setLevels] = useState<Level[]>([]);
  const [pricingPlans, setPricingPlans] = useState<PricingPlan[]>([]);
  const [saving, setSaving] = useState(false);

  const [formData, setFormData] = useState({
    full_name: '',
    full_name_ar: '',
    email: '',
    phone: '',
    date_of_birth: '',
    age_group_id: '',
    level_id: '',
    password: '',
    subscription_type: '' as SubscriptionType | '',
    attendance_mode: 'offline' as AttendanceMode,
    pricing_plan_id: '',
    payment_type: 'full' as PaymentType,
    sub_paid_amount: 0,
    sub_notes: '',
    discount_percentage: 0,
    payment_date: new Date().toISOString().split('T')[0],
    parent_id: '',
  });
  const [formTouched, setFormTouched] = useState<Record<string, boolean>>({});
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);

  const [parentSearchQuery, setParentSearchQuery] = useState('');
  const [parentSearchResults, setParentSearchResults] = useState<Array<{ id: string; full_name: string; full_name_ar: string | null; phone: string | null; email: string | null; children_count: number }>>([]);
  const [parentSearching, setParentSearching] = useState(false);
  const [selectedParent, setSelectedParent] = useState<{ id: string; full_name: string; full_name_ar: string | null; phone: string | null; children_count: number } | null>(null);
  const parentSearchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [credentialsDialog, setCredentialsDialog] = useState<{ open: boolean; email: string; password: string; name: string; avatarUrl?: string | null; levelName?: string; subscriptionType?: string; attendanceMode?: string; ageGroupName?: string; linkCode?: string | null }>({ open: false, email: '', password: '', name: '' });

  const subscriptionTypes = GROUP_TYPES_LIST;
  const attendanceModes: { value: AttendanceMode; label: string; labelAr: string }[] = [
    { value: 'online', label: 'Online', labelAr: 'أونلاين' },
    { value: 'offline', label: 'Offline (In-Person)', labelAr: 'حضوري' },
  ];

  const validationErrors = useMemo(() => {
    const nameResult = validateEnglishName(formData.full_name);
    const nameArResult = validateArabicName(formData.full_name_ar);
    const emailResult = validateEmail(formData.email);
    const phoneResult = validateMobileNumber(formData.phone);
    const dobResult = validateDateOfBirth(formData.date_of_birth);
    const passwordDetails = validatePassword(formData.password);

    return {
      full_name: getLocalizedError(nameResult, isRTL),
      full_name_ar: getLocalizedError(nameArResult, isRTL),
      email: getLocalizedError(emailResult, isRTL),
      phone: getLocalizedError(phoneResult, isRTL),
      date_of_birth: getLocalizedError(dobResult, isRTL),
      password: !passwordDetails.isValid ? (isRTL ? 'كلمة المرور غير صالحة' : 'Password is invalid') : null,
      passwordDetails,
    };
  }, [formData, isRTL]);

  const isFormValid = useMemo(() => {
    const baseValid = !validationErrors.full_name && !validationErrors.phone && !validationErrors.date_of_birth;
    if (editingStudent) return baseValid;
    return baseValid &&
      !validationErrors.email &&
      validationErrors.passwordDetails.isValid &&
      formData.subscription_type !== '';
  }, [validationErrors, editingStudent, formData.subscription_type]);

  // Load reference data once when the dialog opens.
  useEffect(() => {
    if (!open) return;
    (async () => {
      const [{ data: ag }, { data: lv }, { data: pp }] = await Promise.all([
        supabase.from('age_groups').select('id, name, name_ar, min_age, max_age').eq('is_active', true),
        supabase.from('levels').select('id, name, name_ar, level_order').eq('is_active', true).order('level_order'),
        supabase.from('pricing_plans').select('*').eq('is_active', true),
      ]);
      setAgeGroups(ag || []);
      setLevels(lv || []);
      setPricingPlans((pp || []) as PricingPlan[]);
    })();
  }, [open]);

  // Hydrate form when editing.
  useEffect(() => {
    if (!open) return;
    if (editingStudent) {
      setFormData({
        full_name: editingStudent.full_name,
        full_name_ar: editingStudent.full_name_ar || '',
        email: editingStudent.email,
        phone: editingStudent.phone || '',
        date_of_birth: editingStudent.date_of_birth || '',
        age_group_id: editingStudent.age_group_id || '',
        level_id: editingStudent.level_id || '',
        password: '',
        subscription_type: editingStudent.subscription_type || '',
        attendance_mode: editingStudent.attendance_mode || 'offline',
        pricing_plan_id: '',
        payment_type: 'full',
        sub_paid_amount: 0,
        sub_notes: '',
        discount_percentage: 0,
        payment_date: new Date().toISOString().split('T')[0],
        parent_id: '',
      });
      setAvatarPreview(editingStudent.avatar_url || null);
    } else {
      resetForm();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, editingStudent?.user_id]);

  const resetForm = () => {
    setFormData({
      full_name: '', full_name_ar: '', email: '', phone: '', date_of_birth: '',
      age_group_id: '', level_id: '', password: '', subscription_type: '',
      attendance_mode: 'offline', pricing_plan_id: '', payment_type: 'full',
      sub_paid_amount: 0, sub_notes: '', discount_percentage: 0,
      payment_date: new Date().toISOString().split('T')[0], parent_id: '',
    });
    setFormTouched({});
    setAvatarFile(null);
    setAvatarPreview(null);
    setSelectedParent(null);
    setParentSearchQuery('');
    setParentSearchResults([]);
  };

  const calculateAge = (dob: string): number | null => {
    if (!dob) return null;
    const birthDate = new Date(dob);
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const m = today.getMonth() - birthDate.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) age--;
    return age;
  };

  const findMatchingAgeGroup = (age: number): string => {
    const sorted = [...ageGroups]
      .filter((g) => age >= g.min_age && age <= g.max_age)
      .sort((a, b) => (a.max_age - a.min_age) - (b.max_age - b.min_age));
    return sorted[0]?.id || '';
  };

  const handleDobChange = (dob: string) => {
    const age = calculateAge(dob);
    const ageGroupId = age !== null ? findMatchingAgeGroup(age) : '';
    setFormData((prev) => ({ ...prev, date_of_birth: dob, age_group_id: ageGroupId }));
  };

  const handleParentSearch = (q: string) => {
    setParentSearchQuery(q);
    if (parentSearchTimeout.current) clearTimeout(parentSearchTimeout.current);
    if (q.length < 2) { setParentSearchResults([]); return; }
    setParentSearching(true);
    parentSearchTimeout.current = setTimeout(async () => {
      const { data, error } = await supabase.rpc('search_parents', { p_query: q });
      if (!error && data) setParentSearchResults(data as never);
      setParentSearching(false);
    }, 300);
  };

  const calculatedAge = calculateAge(formData.date_of_birth);

  const getAgeGroupName = (id: string | null) => {
    if (!id) return '-';
    const g = ageGroups.find((x) => x.id === id);
    return g ? (language === 'ar' ? g.name_ar : g.name) : '-';
  };

  const handleSubmit = async () => {
    setFormTouched({ full_name: true, full_name_ar: true, email: true, phone: true, date_of_birth: true, password: true });
    if (!isFormValid) {
      toast({ variant: 'destructive', title: t.common.error, description: isRTL ? 'يرجى تصحيح الأخطاء' : 'Please fix the errors' });
      return;
    }
    setSaving(true);
    try {
      const uploadAvatar = async (uid: string): Promise<string | null> => {
        if (!avatarFile) return null;
        const fileExt = avatarFile.name.split('.').pop();
        const filePath = `${uid}/${uid}-${Date.now()}.${fileExt}`;
        const { error: upErr } = await supabase.storage.from('avatars').upload(filePath, avatarFile, { cacheControl: '3600', upsert: true });
        if (upErr) throw upErr;
        const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(filePath);
        return urlData.publicUrl;
      };

      if (editingStudent) {
        let avatarUrl = editingStudent.avatar_url;
        if (avatarFile) avatarUrl = await uploadAvatar(editingStudent.user_id);
        else if (!avatarPreview && editingStudent.avatar_url) avatarUrl = null;

        const { error } = await supabase.from('profiles').update({
          full_name: formData.full_name,
          full_name_ar: formData.full_name_ar || null,
          phone: formData.phone || null,
          date_of_birth: formData.date_of_birth || null,
          age_group_id: formData.age_group_id || null,
          level_id: formData.level_id || null,
          subscription_type: formData.subscription_type || null,
          attendance_mode: formData.attendance_mode,
          avatar_url: avatarUrl,
        }).eq('user_id', editingStudent.user_id);
        if (error) throw error;
        toast({ title: t.common.success, description: isRTL ? 'تم تحديث بيانات الطالب' : 'Student updated successfully' });
        onOpenChange(false);
        onSaved();
      } else {
        const { data, error } = await supabase.functions.invoke('create-user', {
          body: {
            email: formData.email, password: formData.password,
            full_name: formData.full_name, full_name_ar: formData.full_name_ar || undefined,
            phone: formData.phone || undefined, role: 'student',
            date_of_birth: formData.date_of_birth || undefined,
            age_group_id: formData.age_group_id || undefined,
            level_id: formData.level_id || undefined,
            subscription_type: formData.subscription_type || undefined,
            attendance_mode: formData.attendance_mode,
            parent_id: formData.parent_id || undefined,
          },
        });
        if (error) throw error;
        if (data?.error) throw { error: data.error, error_ar: data.error_ar };

        let createdAvatarUrl: string | null = null;
        if (avatarFile && data?.user_id) {
          createdAvatarUrl = await uploadAvatar(data.user_id);
          if (createdAvatarUrl) {
            await supabase.from('profiles').update({ avatar_url: createdAvatarUrl }).eq('user_id', data.user_id);
          }
        }

        if (formData.pricing_plan_id && data?.user_id) {
          const plan = pricingPlans.find((p) => p.id === formData.pricing_plan_id);
          if (plan) {
            const dPct = formData.discount_percentage || 0;
            const baseTotal = formData.payment_type === 'installment' ? plan.price_1_month * 3 : plan.price_3_months;
            const totalAmount = Math.round(baseTotal * (1 - dPct / 100));
            const installmentAmount = Math.round(plan.price_1_month * (1 - dPct / 100));
            const { data: sub, error: subErr } = await supabase.from('subscriptions').insert({
              student_id: data.user_id, pricing_plan_id: formData.pricing_plan_id,
              payment_type: formData.payment_type, start_date: null, end_date: null,
              total_amount: totalAmount, paid_amount: formData.sub_paid_amount,
              installment_amount: formData.payment_type === 'installment' ? installmentAmount : null,
              next_payment_date: null, is_suspended: false, status: 'active',
              notes: formData.sub_notes || null, discount_percentage: dPct,
            }).select().single();
            if (!subErr && formData.sub_paid_amount > 0 && sub) {
              await (supabase.rpc as any)('record_payment_atomic', {
                p_subscription_id: sub.id,
                p_student_id: data.user_id,
                p_amount: formData.sub_paid_amount,
                p_payment_date: formData.payment_date,
                p_payment_type: 'prior_payment',
                p_payment_method: 'cash',
                p_transfer_type: null,
                p_notes: isRTL ? 'دفعة مسبقة عند إنشاء الاشتراك' : 'Prior payment on subscription creation',
              });
            }
          }
        }

        const lvName = levels.find((l) => l.id === formData.level_id)?.name;
        const ag = ageGroups.find((a) => a.id === formData.age_group_id);

        setCredentialsDialog({
          open: true, email: formData.email, password: formData.password, name: formData.full_name,
          avatarUrl: createdAvatarUrl, levelName: lvName,
          subscriptionType: formData.subscription_type || undefined,
          attendanceMode: formData.attendance_mode, ageGroupName: ag?.name,
          linkCode: data?.link_code || null,
        });
      }
    } catch (err: unknown) {
      const e = err as { error?: string; error_ar?: string; message?: string };
      let msg: string;
      if (e?.error_ar && isRTL) msg = e.error_ar;
      else if (e?.error) msg = e.error;
      else if (typeof e?.message === 'string') {
        try { const p = JSON.parse(e.message); msg = isRTL ? (p.error_ar || p.error) : p.error; }
        catch { msg = e.message; }
      } else msg = isRTL ? 'فشل في حفظ البيانات' : 'Failed to save';
      toast({ variant: 'destructive', title: t.common.error, description: msg });
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingStudent ? t.students.editStudent : t.students.addStudent}</DialogTitle>
            <DialogDescription>{isRTL ? 'أدخل بيانات الطالب' : 'Enter student details'}</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4 max-h-[60vh] overflow-y-auto">
            <AvatarUpload
              currentUrl={editingStudent?.avatar_url}
              name={formData.full_name || 'ST'}
              previewUrl={avatarPreview}
              onFileSelect={(file) => { setAvatarFile(file); setAvatarPreview(URL.createObjectURL(file)); }}
              onRemove={() => { setAvatarFile(null); setAvatarPreview(null); }}
            />

            <div className="grid gap-2">
              <Label htmlFor="full_name" className={cn(formTouched.full_name && validationErrors.full_name && 'text-destructive')}>
                {t.students.fullName} (English) <span className="text-destructive">*</span>
              </Label>
              <Input id="full_name" value={formData.full_name}
                onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                onBlur={() => setFormTouched({ ...formTouched, full_name: true })}
                className={cn(formTouched.full_name && validationErrors.full_name && 'border-destructive focus-visible:ring-destructive')}
                placeholder={isRTL ? 'الاسم بالإنجليزية' : 'Enter name in English'} />
              {formTouched.full_name && validationErrors.full_name && (
                <p className="text-sm text-destructive flex items-center gap-1"><AlertCircle className="h-3 w-3" />{validationErrors.full_name}</p>
              )}
            </div>

            <div className="grid gap-2">
              <Label htmlFor="full_name_ar">{t.students.fullName} (عربي)</Label>
              <Input id="full_name_ar" dir="rtl" value={formData.full_name_ar}
                onChange={(e) => setFormData({ ...formData, full_name_ar: e.target.value })}
                placeholder="أدخل الاسم بالعربية" />
            </div>

            {!editingStudent && (
              <>
                <div className="grid gap-2">
                  <Label htmlFor="email">{t.auth.email} <span className="text-destructive">*</span></Label>
                  <Input id="email" type="email" value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    onBlur={() => setFormTouched({ ...formTouched, email: true })}
                    className={cn(formTouched.email && validationErrors.email && 'border-destructive focus-visible:ring-destructive')}
                    placeholder="email@example.com" />
                  {formTouched.email && validationErrors.email && (
                    <p className="text-sm text-destructive flex items-center gap-1"><AlertCircle className="h-3 w-3" />{validationErrors.email}</p>
                  )}
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="password">{t.auth.password} <span className="text-destructive">*</span></Label>
                  <Input id="password" type="password" value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    onBlur={() => setFormTouched({ ...formTouched, password: true })}
                    placeholder={isRTL ? 'كلمة المرور' : 'Password'} />
                  {formTouched.password && !validationErrors.passwordDetails.isValid && (
                    <div className="space-y-1 mt-1">
                      {[
                        { ok: validationErrors.passwordDetails.hasMinLength, ar: 'على الأقل 8 حروف', en: 'At least 8 characters' },
                        { ok: validationErrors.passwordDetails.hasUppercase, ar: 'حرف كبير', en: 'One uppercase' },
                        { ok: validationErrors.passwordDetails.hasLowercase, ar: 'حرف صغير', en: 'One lowercase' },
                        { ok: validationErrors.passwordDetails.hasNumber, ar: 'رقم', en: 'One number' },
                        { ok: validationErrors.passwordDetails.hasSpecial, ar: 'رمز خاص', en: 'One special char' },
                      ].map((r, i) => (
                        <p key={i} className={cn('text-xs flex items-center gap-1.5', r.ok ? 'text-emerald-600' : 'text-muted-foreground')}>
                          {r.ok ? <Check className="h-3 w-3" /> : <span className="h-3 w-3 rounded-full border border-current flex-shrink-0" />}
                          {isRTL ? r.ar : r.en}
                        </p>
                      ))}
                    </div>
                  )}
                </div>
              </>
            )}

            <div className="grid gap-2">
              <Label htmlFor="phone">{isRTL ? 'رقم الهاتف' : 'Phone'}</Label>
              <Input id="phone" value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                onBlur={() => setFormTouched({ ...formTouched, phone: true })}
                className={cn(formTouched.phone && validationErrors.phone && 'border-destructive focus-visible:ring-destructive')}
                placeholder="01XXXXXXXXX" maxLength={11} />
              {formTouched.phone && validationErrors.phone && (
                <p className="text-sm text-destructive flex items-center gap-1"><AlertCircle className="h-3 w-3" />{validationErrors.phone}</p>
              )}
            </div>

            <div className="grid gap-2">
              <Label htmlFor="dob">{isRTL ? 'تاريخ الميلاد' : 'Date of Birth'}</Label>
              <Input id="dob" type="date" value={formData.date_of_birth}
                onChange={(e) => { handleDobChange(e.target.value); setFormTouched({ ...formTouched, date_of_birth: true }); }}
                max={new Date().toISOString().split('T')[0]}
                className={cn(formTouched.date_of_birth && validationErrors.date_of_birth && 'border-destructive focus-visible:ring-destructive')} />
              {formTouched.date_of_birth && validationErrors.date_of_birth && (
                <p className="text-sm text-destructive flex items-center gap-1"><AlertCircle className="h-3 w-3" />{validationErrors.date_of_birth}</p>
              )}
              {calculatedAge !== null && (
                <p className="text-sm text-muted-foreground">{isRTL ? `العمر: ${calculatedAge} سنة` : `Age: ${calculatedAge} years`}</p>
              )}
            </div>

            <div className="grid gap-2">
              <Label>{t.students.ageGroup}</Label>
              <Input readOnly value={formData.age_group_id ? getAgeGroupName(formData.age_group_id) : (isRTL ? 'يتحدد تلقائياً' : 'Auto-detected')} className="bg-muted cursor-not-allowed" />
            </div>

            <div className="grid gap-2">
              <Label>{t.students.level}</Label>
              <Select value={formData.level_id} onValueChange={(v) => setFormData({ ...formData, level_id: v })}>
                <SelectTrigger><SelectValue placeholder={isRTL ? 'اختر المستوى' : 'Select level'} /></SelectTrigger>
                <SelectContent>
                  {(editingStudent ? levels : levels.filter((l) => l.level_order === 0)).map((level) => (
                    <SelectItem key={level.id} value={level.id}>{language === 'ar' ? level.name_ar : level.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {!editingStudent && (
                <p className="text-xs text-muted-foreground">{isRTL ? 'المستويات الأعلى تُحدد عبر امتحان تحديد المستوى' : 'Higher levels are determined by the placement exam'}</p>
              )}
            </div>

            {!editingStudent && (
              <div className="grid gap-2 border-t pt-4 mt-2">
                <Label>
                  {isRTL ? '👨‍👩‍👧 ولي الأمر' : '👨‍👩‍👧 Parent'}{' '}
                  <span className="text-xs font-normal text-muted-foreground">
                    {isRTL ? '(اختياري — يمكن ربطه لاحقاً)' : '(optional — can be linked later)'}
                  </span>
                </Label>
                {selectedParent ? (
                  <div className="flex items-center justify-between rounded-md border bg-primary/5 border-primary/20 p-3">
                    <div>
                      <p className="font-medium text-sm">{language === 'ar' && selectedParent.full_name_ar ? selectedParent.full_name_ar : selectedParent.full_name}</p>
                      <p className="text-xs text-muted-foreground">{selectedParent.phone}</p>
                      {selectedParent.children_count > 0 && (
                        <Badge variant="secondary" className="mt-1 text-xs">{isRTL ? `${selectedParent.children_count} طفل` : `${selectedParent.children_count} child(ren)`}</Badge>
                      )}
                    </div>
                    <Button variant="ghost" size="sm" onClick={() => { setSelectedParent(null); setFormData((p) => ({ ...p, parent_id: '' })); }}>
                      {isRTL ? 'تغيير' : 'Change'}
                    </Button>
                  </div>
                ) : (
                  <div className="relative">
                    <Input value={parentSearchQuery} onChange={(e) => handleParentSearch(e.target.value)}
                      placeholder={isRTL ? 'ابحث بالاسم أو الموبايل (اختياري)' : 'Search by name or phone (optional)'} />
                    {parentSearching && <div className="absolute top-2.5 end-3"><div className="h-4 w-4 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>}
                    {parentSearchResults.length > 0 && (
                      <div className="absolute z-50 w-full mt-1 rounded-md border bg-popover shadow-md max-h-48 overflow-auto">
                        {parentSearchResults.map((p) => (
                          <button key={p.id} type="button" className="w-full text-start px-3 py-2 hover:bg-accent text-sm flex items-center justify-between"
                            onClick={() => { setSelectedParent(p); setFormData((prev) => ({ ...prev, parent_id: p.id })); setParentSearchQuery(''); setParentSearchResults([]); }}>
                            <div>
                              <p className="font-medium">{language === 'ar' && p.full_name_ar ? p.full_name_ar : p.full_name}</p>
                              <p className="text-xs text-muted-foreground">{p.phone || p.email}</p>
                            </div>
                            {p.children_count > 0 && (
                              <Badge variant="outline" className="text-xs">{p.children_count} {isRTL ? 'طفل' : 'child'}</Badge>
                            )}
                          </button>
                        ))}
                      </div>
                    )}
                    {parentSearchQuery.length >= 2 && !parentSearching && parentSearchResults.length === 0 && (
                      <p className="text-xs text-muted-foreground mt-1">{isRTL ? 'لا يوجد ولي أمر بهذا الاسم — يمكن ربطه لاحقاً من بروفايل الطالب' : 'No parent found — you can link one later from the student profile'}</p>
                    )}
                  </div>
                )}
              </div>
            )}

            <div className="grid gap-2">
              <Label>{isRTL ? 'نوع الاشتراك' : 'Subscription Type'} *</Label>
              <Select value={formData.subscription_type} onValueChange={(v) => setFormData({ ...formData, subscription_type: v as SubscriptionType, pricing_plan_id: '' })}>
                <SelectTrigger><SelectValue placeholder={isRTL ? 'اختر النوع' : 'Select type'} /></SelectTrigger>
                <SelectContent>
                  {subscriptionTypes.map((tp) => (
                    <SelectItem key={tp.value} value={tp.value}>{language === 'ar' ? tp.labelAr : tp.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-2">
              <Label>{isRTL ? 'نوع الحضور' : 'Attendance Mode'} *</Label>
              <Select value={formData.attendance_mode} onValueChange={(v) => setFormData({ ...formData, attendance_mode: v as AttendanceMode, pricing_plan_id: '' })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {attendanceModes.map((m) => (
                    <SelectItem key={m.value} value={m.value}>{language === 'ar' ? m.labelAr : m.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {!editingStudent && (
              <>
                <div className="border-t pt-4 mt-2">
                  <h4 className="font-semibold text-sm mb-3">{isRTL ? '📋 بيانات الاشتراك' : '📋 Subscription Details'}</h4>
                </div>
                <div className="grid gap-2">
                  <Label>{isRTL ? 'الباقة' : 'Pricing Plan'}</Label>
                  <Select value={formData.pricing_plan_id} onValueChange={(v) => setFormData({ ...formData, pricing_plan_id: v })}>
                    <SelectTrigger><SelectValue placeholder={isRTL ? 'اختر الباقة' : 'Select plan'} /></SelectTrigger>
                    <SelectContent>
                      {pricingPlans
                        .filter((p) => (!formData.subscription_type || p.group_type === formData.subscription_type)
                          && (!formData.attendance_mode || p.attendance_mode === formData.attendance_mode))
                        .map((p) => (
                          <SelectItem key={p.id} value={p.id}>
                            {language === 'ar' ? p.name_ar : p.name} - {p.price_3_months} {isRTL ? 'ج.م' : 'EGP'}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>

                {formData.pricing_plan_id && (
                  <>
                    <div className="grid gap-2">
                      <Label>{isRTL ? 'نوع الدفع' : 'Payment Type'}</Label>
                      <Select value={formData.payment_type} onValueChange={(v) => setFormData({ ...formData, payment_type: v as PaymentType })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="full">{isRTL ? 'كامل (3 شهور)' : 'Full (3 months)'}</SelectItem>
                          <SelectItem value="installment">{isRTL ? 'تقسيط شهري' : 'Monthly Installment'}</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="grid gap-2">
                      <Label>{isRTL ? 'نسبة الخصم %' : 'Discount %'}</Label>
                      <Input type="number" value={formData.discount_percentage}
                        onChange={(e) => setFormData({ ...formData, discount_percentage: Math.min(100, Math.max(0, +e.target.value)) })}
                        min={0} max={100} placeholder="0" />
                    </div>

                    <div className="grid gap-2">
                      <Label>{isRTL ? 'المبلغ المدفوع' : 'Amount Paid'}</Label>
                      <Input type="number" value={formData.sub_paid_amount}
                        onChange={(e) => setFormData({ ...formData, sub_paid_amount: +e.target.value })} min={0} />
                    </div>

                    {formData.sub_paid_amount > 0 && (
                      <div className="grid gap-2">
                        <Label>{isRTL ? 'تاريخ الدفع' : 'Payment Date'}</Label>
                        <Input type="date" value={formData.payment_date}
                          onChange={(e) => setFormData({ ...formData, payment_date: e.target.value })}
                          max={new Date().toISOString().split('T')[0]} />
                      </div>
                    )}

                    <div className="grid gap-2">
                      <Label>{isRTL ? 'ملاحظات' : 'Notes'}</Label>
                      <Input value={formData.sub_notes} onChange={(e) => setFormData({ ...formData, sub_notes: e.target.value })} placeholder={isRTL ? 'اختياري' : 'Optional'} />
                    </div>

                    {(() => {
                      const plan = pricingPlans.find((p) => p.id === formData.pricing_plan_id);
                      if (!plan) return null;
                      const dPct = formData.discount_percentage || 0;
                      const orig = formData.payment_type === 'installment' ? plan.price_1_month * 3 : plan.price_3_months;
                      const dAmt = Math.round(orig * dPct / 100);
                      const total = orig - dAmt;
                      const remaining = Math.max(0, total - formData.sub_paid_amount);
                      return (
                        <Card className="bg-muted/30">
                          <CardContent className="pt-4 space-y-2 text-sm">
                            {dPct > 0 && (
                              <>
                                <div className="flex justify-between"><span>{isRTL ? 'الأصلي' : 'Original'}</span><span className="line-through text-muted-foreground">{orig} {isRTL ? 'ج.م' : 'EGP'}</span></div>
                                <div className="flex justify-between"><span>{isRTL ? `خصم ${dPct}%` : `${dPct}% Discount`}</span><span className="text-destructive">-{dAmt}</span></div>
                              </>
                            )}
                            <div className="flex justify-between"><span>{isRTL ? 'الإجمالي' : 'Total'}</span><span className="font-bold">{total}</span></div>
                            <div className="flex justify-between"><span>{isRTL ? 'المدفوع' : 'Paid'}</span><span className="text-emerald-600">{formData.sub_paid_amount}</span></div>
                            <div className="flex justify-between"><span>{isRTL ? 'المتبقي' : 'Remaining'}</span><span className={remaining > 0 ? 'text-amber-600' : 'text-emerald-600'}>{remaining}</span></div>
                          </CardContent>
                        </Card>
                      );
                    })()}
                  </>
                )}
              </>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>{t.common.cancel}</Button>
            <Button className="kojo-gradient" onClick={handleSubmit} disabled={saving}>
              {saving ? (isRTL ? 'جاري الحفظ...' : 'Saving...') : t.common.save}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <CredentialsDialog
        open={credentialsDialog.open}
        onClose={() => {
          setCredentialsDialog({ open: false, email: '', password: '', name: '' });
          onOpenChange(false);
          resetForm();
          onSaved();
        }}
        email={credentialsDialog.email}
        password={credentialsDialog.password}
        userName={credentialsDialog.name}
        avatarUrl={credentialsDialog.avatarUrl}
        levelName={credentialsDialog.levelName}
        subscriptionType={credentialsDialog.subscriptionType}
        attendanceMode={credentialsDialog.attendanceMode}
        ageGroupName={credentialsDialog.ageGroupName}
        linkCode={credentialsDialog.linkCode}
      />
    </>
  );
}
