import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Search, MoreHorizontal, Pencil, Trash2, UserPlus, Eye, CalendarDays, AlertCircle, Check, DollarSign } from 'lucide-react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useLanguage } from '@/contexts/LanguageContext';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Dialog as SalaryDialog, DialogContent as SalaryDialogContent, DialogHeader as SalaryDialogHeader, DialogTitle as SalaryDialogTitle, DialogFooter as SalaryDialogFooter } from '@/components/ui/dialog';
import {
  validateMobileNumber,
  validatePassword,
  validateEnglishName,
  validateArabicName,
  validateEmail,
  getLocalizedError,
} from '@/lib/validationUtils';
import { cn } from '@/lib/utils';

interface Instructor {
  id: string;
  user_id: string;
  full_name: string;
  full_name_ar: string | null;
  email: string;
  phone: string | null;
  avatar_url: string | null;
  specialization: string | null;
  specialization_ar: string | null;
  employment_status: 'permanent' | 'training' | null;
  work_type: string | null;
  is_paid_trainee: boolean | null;
  hourly_rate: number | null;
}

export default function InstructorsPage() {
  const { t, isRTL, language } = useLanguage();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [instructors, setInstructors] = useState<Instructor[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingInstructor, setEditingInstructor] = useState<Instructor | null>(null);
  const [formData, setFormData] = useState({
    full_name: '',
    full_name_ar: '',
    email: '',
    phone: '',
    specialization: '',
    specialization_ar: '',
    password: '',
    employment_status: 'training' as 'permanent' | 'training',
    work_type: 'full_time' as 'full_time' | 'part_time',
    is_paid_trainee: false,
    hourly_rate: '' as string | number,
  });
  const [formTouched, setFormTouched] = useState<Record<string, boolean>>({});

  // Salary dialog state
  const [salaryDialogOpen, setSalaryDialogOpen] = useState(false);
  const [salaryTarget, setSalaryTarget] = useState<Instructor | null>(null);
  const [salaryForm, setSalaryForm] = useState({ base_salary: '', effective_from: new Date().toISOString().split('T')[0] });
  const [salaryLoading, setSalaryLoading] = useState(false);
  const [salaries, setSalaries] = useState<Record<string, number>>({});

  // Validation results computed from form data
  const validationErrors = useMemo(() => {
    const nameResult = validateEnglishName(formData.full_name);
    const nameArResult = validateArabicName(formData.full_name_ar);
    const emailResult = validateEmail(formData.email);
    const phoneResult = validateMobileNumber(formData.phone);
    const passwordDetails = validatePassword(formData.password);

    return {
      full_name: getLocalizedError(nameResult, isRTL),
      full_name_ar: getLocalizedError(nameArResult, isRTL),
      email: getLocalizedError(emailResult, isRTL),
      phone: getLocalizedError(phoneResult, isRTL),
      password: !passwordDetails.isValid ? (isRTL ? 'كلمة المرور غير صالحة' : 'Password is invalid') : null,
      passwordDetails,
    };
  }, [formData, isRTL]);

  const isFormValid = useMemo(() => {
    const baseValid = !validationErrors.full_name && !validationErrors.phone;
    
    if (editingInstructor) {
      return baseValid;
    }
    
    // For new instructors, also validate email and password
    return baseValid && 
           !validationErrors.email && 
           validationErrors.passwordDetails.isValid;
  }, [validationErrors, editingInstructor]);

  useEffect(() => {
    fetchInstructors();
  }, []);

  const fetchInstructors = async () => {
    try {
      const { data: rolesData, error: rolesError } = await supabase
        .from('user_roles')
        .select('user_id')
        .eq('role', 'instructor');

      if (rolesError) throw rolesError;

      const instructorUserIds = rolesData?.map((r) => r.user_id) || [];

      if (instructorUserIds.length > 0) {
        const [profilesRes, salariesRes] = await Promise.all([
          supabase.from('profiles').select('*').in('user_id', instructorUserIds),
          supabase.from('employee_salaries').select('employee_id, base_salary').eq('is_active', true).in('employee_id', instructorUserIds),
        ]);

        if (profilesRes.error) throw profilesRes.error;
        setInstructors(profilesRes.data || []);
        
        const salMap: Record<string, number> = {};
        (salariesRes.data || []).forEach((s: any) => { salMap[s.employee_id] = s.base_salary; });
        setSalaries(salMap);
      } else {
        setInstructors([]);
      }
    } catch (error) {
      console.error('Error fetching instructors:', error);
      toast({
        variant: 'destructive',
        title: t.common.error,
        description: isRTL ? 'فشل في تحميل المدربين' : 'Failed to load instructors',
      });
    } finally {
      setLoading(false);
    }
  };

  const openSalaryDialog = (instructor: Instructor) => {
    setSalaryTarget(instructor);
    setSalaryForm({ base_salary: salaries[instructor.user_id]?.toString() || '', effective_from: new Date().toISOString().split('T')[0] });
    setSalaryDialogOpen(true);
  };

  const handleSetSalary = async () => {
    if (!salaryTarget || !salaryForm.base_salary) return;
    setSalaryLoading(true);
    try {
      await supabase.from('employee_salaries').update({ is_active: false } as any).eq('employee_id', salaryTarget.user_id).eq('is_active', true);
      const { error } = await supabase.from('employee_salaries').insert({
        employee_id: salaryTarget.user_id,
        employee_type: 'instructor',
        base_salary: Number(salaryForm.base_salary),
        effective_from: salaryForm.effective_from,
      } as any);
      if (error) throw error;
      toast({ title: isRTL ? 'تم تحديد الراتب بنجاح' : 'Salary set successfully' });
      setSalaryDialogOpen(false);
      fetchInstructors();
    } catch (error: any) {
      toast({ variant: 'destructive', title: isRTL ? 'خطأ' : 'Error', description: error.message });
    } finally {
      setSalaryLoading(false);
    }
  };

  const [saving, setSaving] = useState(false);

  const handleSubmit = async () => {
    // Mark all fields as touched to show all validation errors
    setFormTouched({
      full_name: true,
      full_name_ar: true,
      email: true,
      phone: true,
      password: true,
    });

    // Validate form before submission
    if (!isFormValid) {
      toast({
        variant: 'destructive',
        title: t.common.error,
        description: isRTL ? 'يرجى تصحيح الأخطاء في النموذج' : 'Please fix the errors in the form',
      });
      return;
    }

    setSaving(true);
    try {
      if (editingInstructor) {
          const { error } = await supabase
          .from('profiles')
          .update({
            full_name: formData.full_name,
            full_name_ar: formData.full_name_ar || null,
            phone: formData.phone || null,
            specialization: formData.specialization || null,
            specialization_ar: formData.specialization_ar || null,
            employment_status: formData.employment_status,
            work_type: formData.work_type,
            is_paid_trainee: formData.employment_status === 'training' ? formData.is_paid_trainee : false,
            hourly_rate: formData.employment_status === 'training' && formData.is_paid_trainee ? (Number(formData.hourly_rate) || null) : null,
          } as any)
          .eq('id', editingInstructor.id);

        if (error) throw error;
        toast({
          title: t.common.success,
          description: isRTL ? 'تم تحديث بيانات المدرب' : 'Instructor updated successfully',
        });
      } else {
        // Create new instructor via edge function
        const { data, error } = await supabase.functions.invoke('create-user', {
          body: {
            email: formData.email,
            password: formData.password,
            full_name: formData.full_name,
            full_name_ar: formData.full_name_ar || undefined,
            phone: formData.phone || undefined,
            role: 'instructor',
            specialization: formData.specialization || undefined,
            specialization_ar: formData.specialization_ar || undefined,
            employment_status: formData.employment_status,
            work_type: formData.work_type,
            is_paid_trainee: formData.employment_status === 'training' ? formData.is_paid_trainee : false,
            hourly_rate: formData.employment_status === 'training' && formData.is_paid_trainee ? (Number(formData.hourly_rate) || undefined) : undefined,
          }
        });

        if (error) throw error;
        if (data?.error) throw new Error(data.error);

        toast({
          title: t.common.success,
          description: isRTL ? 'تم إنشاء المدرب بنجاح' : 'Instructor created successfully',
        });
      }

      setIsDialogOpen(false);
      setEditingInstructor(null);
      resetForm();
      fetchInstructors();
    } catch (error: any) {
      console.error('Error saving instructor:', error);
      toast({
        variant: 'destructive',
        title: t.common.error,
        description: error.message || (isRTL ? 'فشل في حفظ بيانات المدرب' : 'Failed to save instructor'),
      });
    } finally {
      setSaving(false);
    }
  };

  const resetForm = () => {
    setFormData({
      full_name: '',
      full_name_ar: '',
      email: '',
      phone: '',
      specialization: '',
      specialization_ar: '',
      password: '',
      employment_status: 'training',
      work_type: 'full_time',
      is_paid_trainee: false,
      hourly_rate: '',
    });
    setFormTouched({});
  };

  const handleEdit = (instructor: Instructor) => {
    setEditingInstructor(instructor);
    setFormData({
      full_name: instructor.full_name,
      full_name_ar: instructor.full_name_ar || '',
      email: instructor.email,
      phone: instructor.phone || '',
      specialization: instructor.specialization || '',
      specialization_ar: instructor.specialization_ar || '',
      password: '',
      employment_status: instructor.employment_status || 'training',
      work_type: (instructor.work_type as 'full_time' | 'part_time') || 'full_time',
      is_paid_trainee: instructor.is_paid_trainee || false,
      hourly_rate: instructor.hourly_rate || '',
    });
    setIsDialogOpen(true);
  };

  const filteredInstructors = instructors.filter((instructor) =>
    instructor.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (instructor.full_name_ar && instructor.full_name_ar.includes(searchQuery)) ||
    instructor.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <DashboardLayout title={t.instructors.title}>
      <div className="space-y-6">
        {/* Header Actions */}
        <div className="flex flex-col sm:flex-row gap-4 justify-between">
          <div className="relative w-full sm:w-80">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder={t.common.search}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>

          <Button className="kojo-gradient" onClick={() => {
            setEditingInstructor(null);
            resetForm();
            setIsDialogOpen(true);
          }}>
            <UserPlus className="h-4 w-4 mr-2" />
            {t.instructors.addInstructor}
          </Button>
        </div>

        {/* Dialog */}
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>
                {editingInstructor ? t.instructors.editInstructor : t.instructors.addInstructor}
              </DialogTitle>
              <DialogDescription>
                {isRTL ? 'أدخل بيانات المدرب' : 'Enter instructor details'}
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4 max-h-[60vh] overflow-y-auto">
              {/* Full Name (English) */}
              <div className="grid gap-2">
                <Label htmlFor="full_name" className={cn(formTouched.full_name && validationErrors.full_name && 'text-destructive')}>
                  {t.students.fullName} (English) <span className="text-destructive">*</span>
                </Label>
                <div className="relative">
                  <Input
                    id="full_name"
                    value={formData.full_name}
                    onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                    onBlur={() => setFormTouched({ ...formTouched, full_name: true })}
                    className={cn(
                      formTouched.full_name && validationErrors.full_name && 'border-destructive focus-visible:ring-destructive'
                    )}
                    placeholder={isRTL ? 'الاسم بالإنجليزية' : 'Enter name in English'}
                  />
                </div>
                {formTouched.full_name && validationErrors.full_name && (
                  <p className="text-sm text-destructive flex items-center gap-1">
                    <AlertCircle className="h-3 w-3" />
                    {validationErrors.full_name}
                  </p>
                )}
              </div>

              {/* Full Name (Arabic) */}
              <div className="grid gap-2">
                <Label htmlFor="full_name_ar" className={cn(formTouched.full_name_ar && validationErrors.full_name_ar && 'text-destructive')}>
                  {t.students.fullName} (عربي)
                </Label>
                <Input
                  id="full_name_ar"
                  value={formData.full_name_ar}
                  onChange={(e) => setFormData({ ...formData, full_name_ar: e.target.value })}
                  onBlur={() => setFormTouched({ ...formTouched, full_name_ar: true })}
                  dir="rtl"
                  className={cn(
                    formTouched.full_name_ar && validationErrors.full_name_ar && 'border-destructive focus-visible:ring-destructive'
                  )}
                  placeholder="أدخل الاسم بالعربية"
                />
                {formTouched.full_name_ar && validationErrors.full_name_ar && (
                  <p className="text-sm text-destructive flex items-center gap-1">
                    <AlertCircle className="h-3 w-3" />
                    {validationErrors.full_name_ar}
                  </p>
                )}
              </div>

              {!editingInstructor && (
                <>
                  {/* Email */}
                  <div className="grid gap-2">
                    <Label htmlFor="email" className={cn(formTouched.email && validationErrors.email && 'text-destructive')}>
                      {t.auth.email} <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="email"
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      onBlur={() => setFormTouched({ ...formTouched, email: true })}
                      className={cn(
                        formTouched.email && validationErrors.email && 'border-destructive focus-visible:ring-destructive'
                      )}
                      placeholder="email@example.com"
                    />
                    {formTouched.email && validationErrors.email && (
                      <p className="text-sm text-destructive flex items-center gap-1">
                        <AlertCircle className="h-3 w-3" />
                        {validationErrors.email}
                      </p>
                    )}
                  </div>

                  {/* Password with requirements */}
                  <div className="grid gap-2">
                    <Label htmlFor="password" className={cn(formTouched.password && !validationErrors.passwordDetails.isValid && 'text-destructive')}>
                      {t.auth.password} <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="password"
                      type="password"
                      value={formData.password}
                      onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                      onBlur={() => setFormTouched({ ...formTouched, password: true })}
                      className={cn(
                        formData.password && !validationErrors.passwordDetails.isValid && 'border-destructive focus-visible:ring-destructive',
                        formData.password && validationErrors.passwordDetails.isValid && 'border-green-500 focus-visible:ring-green-500'
                      )}
                      placeholder={isRTL ? 'كلمة المرور' : 'Password'}
                    />
                    {formData.password && (
                      <div className="space-y-1 mt-1">
                        <p className={cn('text-xs flex items-center gap-1.5', validationErrors.passwordDetails.hasMinLength ? 'text-green-600' : 'text-muted-foreground')}>
                          {validationErrors.passwordDetails.hasMinLength ? <Check className="h-3 w-3" /> : <span className="h-3 w-3 rounded-full border border-current flex-shrink-0" />}
                          {isRTL ? 'على الأقل 8 حروف' : 'At least 8 characters'}
                        </p>
                        <p className={cn('text-xs flex items-center gap-1.5', validationErrors.passwordDetails.hasUppercase ? 'text-green-600' : 'text-muted-foreground')}>
                          {validationErrors.passwordDetails.hasUppercase ? <Check className="h-3 w-3" /> : <span className="h-3 w-3 rounded-full border border-current flex-shrink-0" />}
                          {isRTL ? 'حرف كبير واحد على الأقل' : 'One uppercase letter'}
                        </p>
                        <p className={cn('text-xs flex items-center gap-1.5', validationErrors.passwordDetails.hasLowercase ? 'text-green-600' : 'text-muted-foreground')}>
                          {validationErrors.passwordDetails.hasLowercase ? <Check className="h-3 w-3" /> : <span className="h-3 w-3 rounded-full border border-current flex-shrink-0" />}
                          {isRTL ? 'حرف صغير واحد على الأقل' : 'One lowercase letter'}
                        </p>
                        <p className={cn('text-xs flex items-center gap-1.5', validationErrors.passwordDetails.hasNumber ? 'text-green-600' : 'text-muted-foreground')}>
                          {validationErrors.passwordDetails.hasNumber ? <Check className="h-3 w-3" /> : <span className="h-3 w-3 rounded-full border border-current flex-shrink-0" />}
                          {isRTL ? 'رقم واحد على الأقل' : 'One number'}
                        </p>
                        <p className={cn('text-xs flex items-center gap-1.5', validationErrors.passwordDetails.hasSpecial ? 'text-green-600' : 'text-muted-foreground')}>
                          {validationErrors.passwordDetails.hasSpecial ? <Check className="h-3 w-3" /> : <span className="h-3 w-3 rounded-full border border-current flex-shrink-0" />}
                          {isRTL ? 'رمز خاص واحد (!@#$%...)' : 'One special character (!@#$%...)'}
                        </p>
                      </div>
                    )}
                  </div>
                </>
              )}

              {/* Phone */}
              <div className="grid gap-2">
                <Label htmlFor="phone" className={cn(formTouched.phone && validationErrors.phone && 'text-destructive')}>
                  {isRTL ? 'رقم الهاتف' : 'Phone'}
                </Label>
                <Input
                  id="phone"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  onBlur={() => setFormTouched({ ...formTouched, phone: true })}
                  className={cn(
                    formTouched.phone && validationErrors.phone && 'border-destructive focus-visible:ring-destructive'
                  )}
                  placeholder="01XXXXXXXXX"
                  maxLength={11}
                />
                {formTouched.phone && validationErrors.phone && (
                  <p className="text-sm text-destructive flex items-center gap-1">
                    <AlertCircle className="h-3 w-3" />
                    {validationErrors.phone}
                  </p>
                )}
                {!validationErrors.phone && (
                  <p className="text-xs text-muted-foreground">
                    {isRTL ? 'صيغة الموبايل المصري: 01XXXXXXXXX' : 'Egyptian mobile format: 01XXXXXXXXX'}
                  </p>
                )}
              </div>
              <div className="grid gap-2">
                <Label htmlFor="specialization">{t.instructors.specializations} (English)</Label>
                <Input
                  id="specialization"
                  value={formData.specialization}
                  onChange={(e) => setFormData({ ...formData, specialization: e.target.value })}
                  placeholder="e.g., Python, Scratch"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="specialization_ar">{t.instructors.specializations} (عربي)</Label>
                <Input
                  id="specialization_ar"
                  value={formData.specialization_ar}
                  onChange={(e) => setFormData({ ...formData, specialization_ar: e.target.value })}
                  placeholder="مثال: بايثون، سكراتش"
                  dir="rtl"
                />
              </div>
              
              {/* Employment Status */}
              <div className="grid gap-2">
                <Label>{isRTL ? 'حالة التوظيف' : 'Employment Status'} <span className="text-destructive">*</span></Label>
                <div className="flex gap-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="employment_status"
                      value="permanent"
                      checked={formData.employment_status === 'permanent'}
                      onChange={() => setFormData({ ...formData, employment_status: 'permanent', is_paid_trainee: false, hourly_rate: '' })}
                      className="h-4 w-4 text-primary"
                    />
                    <span className="text-sm">{isRTL ? 'مثبت' : 'Permanent'}</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="employment_status"
                      value="training"
                      checked={formData.employment_status === 'training'}
                      onChange={() => setFormData({ ...formData, employment_status: 'training' })}
                      className="h-4 w-4 text-primary"
                    />
                    <span className="text-sm">{isRTL ? 'تدريب' : 'Training'}</span>
                  </label>
                </div>
              </div>

              {/* Work Type - only for permanent employees */}
              {formData.employment_status === 'permanent' && (
                <div className="grid gap-2">
                  <Label>{isRTL ? 'نوع العمل' : 'Work Type'} <span className="text-destructive">*</span></Label>
                  <div className="flex gap-4">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="work_type"
                        value="full_time"
                        checked={formData.work_type === 'full_time'}
                        onChange={() => setFormData({ ...formData, work_type: 'full_time' })}
                        className="h-4 w-4 text-primary"
                      />
                      <span className="text-sm">{isRTL ? 'فول تايم' : 'Full-time'}</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="work_type"
                        value="part_time"
                        checked={formData.work_type === 'part_time'}
                        onChange={() => setFormData({ ...formData, work_type: 'part_time' })}
                        className="h-4 w-4 text-primary"
                      />
                      <span className="text-sm">{isRTL ? 'بارت تايم' : 'Part-time'}</span>
                    </label>
                  </div>
                </div>
              )}

              {/* Paid Trainee (only for training status) */}
              {formData.employment_status === 'training' && (
                <div className="grid gap-2">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.is_paid_trainee}
                      onChange={(e) => setFormData({ ...formData, is_paid_trainee: e.target.checked, hourly_rate: e.target.checked ? formData.hourly_rate : '' })}
                      className="h-4 w-4 rounded border-primary text-primary"
                    />
                    <span className="text-sm font-medium">{isRTL ? 'متدرب بمقابل' : 'Paid Trainee'}</span>
                  </label>
                </div>
              )}

              {/* Hourly Rate (only for paid trainees) */}
              {formData.employment_status === 'training' && formData.is_paid_trainee && (
                <div className="grid gap-2">
                  <Label htmlFor="hourly_rate">{isRTL ? 'سعر الساعة (ج.م)' : 'Hourly Rate (EGP)'}</Label>
                  <Input
                    id="hourly_rate"
                    type="number"
                    min="0"
                    step="0.01"
                    value={formData.hourly_rate}
                    onChange={(e) => setFormData({ ...formData, hourly_rate: e.target.value })}
                    placeholder={isRTL ? 'مثال: 100' : 'e.g., 100'}
                  />
                  <p className="text-xs text-muted-foreground">
                    {isRTL ? 'سعر الساعة اللي هيتحاسب بيه على كل سيشن' : 'Rate per hour for completed sessions'}
                  </p>
                </div>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsDialogOpen(false)} disabled={saving}>
                {t.common.cancel}
              </Button>
              <Button className="kojo-gradient" onClick={handleSubmit} disabled={saving}>
                {saving ? (isRTL ? 'جاري الحفظ...' : 'Saving...') : t.common.save}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Mobile Cards View */}
        <div className="block md:hidden space-y-3">
          {loading ? (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                {t.common.loading}
              </CardContent>
            </Card>
          ) : filteredInstructors.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                {isRTL ? 'لا يوجد مدربين' : 'No instructors found'}
              </CardContent>
            </Card>
          ) : (
            filteredInstructors.map((instructor) => (
              <Card 
                key={instructor.id} 
                className="cursor-pointer hover:bg-muted/50 transition-colors"
                onClick={() => navigate(`/instructor/${instructor.user_id}`)}
              >
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <Avatar className="h-10 w-10 flex-shrink-0">
                        <AvatarImage src={instructor.avatar_url || undefined} />
                        <AvatarFallback className="text-xs">
                          {instructor.full_name.slice(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0 flex-1">
                        <p className="font-medium truncate">
                          {language === 'ar' && instructor.full_name_ar 
                            ? instructor.full_name_ar 
                            : instructor.full_name}
                        </p>
                        <p className="text-sm text-muted-foreground truncate">{instructor.email}</p>
                      </div>
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                        <Button variant="ghost" size="icon" className="flex-shrink-0">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align={isRTL ? 'start' : 'end'}>
                        <DropdownMenuItem onClick={(e) => { e.stopPropagation(); navigate(`/instructor/${instructor.user_id}`); }}>
                          <Eye className="h-4 w-4 mr-2" />
                          {isRTL ? 'عرض الملف' : 'View Profile'}
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={(e) => { e.stopPropagation(); navigate(`/instructor-schedule/${instructor.user_id}`); }}>
                          <CalendarDays className="h-4 w-4 mr-2" />
                          {isRTL ? 'جدول العمل' : 'View Schedule'}
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleEdit(instructor); }}>
                          <Pencil className="h-4 w-4 mr-2" />
                          {t.common.edit}
                        </DropdownMenuItem>
                        {instructor.employment_status === 'permanent' && (
                          <DropdownMenuItem onClick={(e) => { e.stopPropagation(); openSalaryDialog(instructor); }}>
                            <DollarSign className="h-4 w-4 mr-2" />
                            {isRTL ? 'تحديد راتب' : 'Set Salary'}
                            {salaries[instructor.user_id] != null && (
                              <Badge variant="outline" className="ml-2 text-xs">{salaries[instructor.user_id]} {isRTL ? 'ج.م' : 'EGP'}</Badge>
                            )}
                          </DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {instructor.specialization && (
                      <Badge variant="secondary" className="text-xs">
                        {language === 'ar' && instructor.specialization_ar 
                          ? instructor.specialization_ar 
                          : instructor.specialization}
                      </Badge>
                    )}
                    <Badge 
                      variant={instructor.employment_status === 'permanent' ? 'default' : 'outline'}
                      className={cn(
                        "text-xs",
                        instructor.employment_status === 'permanent' 
                          ? "bg-green-600 hover:bg-green-700" 
                          : "border-amber-500 text-amber-600"
                      )}
                    >
                      {instructor.employment_status === 'permanent' 
                        ? (isRTL ? 'مثبت' : 'Permanent')
                        : (isRTL ? 'تدريب' : 'Training')}
                    </Badge>
                    {instructor.employment_status === 'permanent' && (
                      <Badge 
                        variant="outline"
                        className={cn(
                          "text-xs",
                          instructor.work_type === 'full_time' 
                            ? "border-blue-500 text-blue-600" 
                            : "border-purple-500 text-purple-600"
                        )}
                      >
                        {instructor.work_type === 'full_time' 
                          ? (isRTL ? 'فول تايم' : 'Full-time')
                          : (isRTL ? 'بارت تايم' : 'Part-time')}
                      </Badge>
                    )}
                    {instructor.employment_status === 'training' && instructor.is_paid_trainee && (
                      <Badge variant="outline" className="text-xs border-emerald-500 text-emerald-600">
                        {isRTL ? `متدرب بمقابل (${instructor.hourly_rate} ج.م/ساعة)` : `Paid Trainee (${instructor.hourly_rate} EGP/hr)`}
                      </Badge>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>

        {/* Desktop Table View */}
        <Card className="hidden md:block">
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t.students.fullName}</TableHead>
                  <TableHead>{t.auth.email}</TableHead>
                  <TableHead>{t.instructors.specializations}</TableHead>
                  <TableHead>{isRTL ? 'الحالة' : 'Status'}</TableHead>
                  <TableHead className="w-[100px]">{t.common.actions}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8">
                      {t.common.loading}
                    </TableCell>
                  </TableRow>
                ) : filteredInstructors.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                      {isRTL ? 'لا يوجد مدربين' : 'No instructors found'}
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredInstructors.map((instructor) => (
                    <TableRow key={instructor.id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <Avatar className="h-8 w-8">
                            <AvatarImage src={instructor.avatar_url || undefined} />
                            <AvatarFallback className="text-xs">
                              {instructor.full_name.slice(0, 2).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <span className="font-medium">
                            {language === 'ar' && instructor.full_name_ar 
                              ? instructor.full_name_ar 
                              : instructor.full_name}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>{instructor.email}</TableCell>
                      <TableCell>
                        {instructor.specialization ? (
                          <Badge variant="secondary">
                            {language === 'ar' && instructor.specialization_ar 
                              ? instructor.specialization_ar 
                              : instructor.specialization}
                          </Badge>
                        ) : '-'}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          <Badge 
                            variant={instructor.employment_status === 'permanent' ? 'default' : 'outline'}
                            className={cn(
                              instructor.employment_status === 'permanent' 
                                ? "bg-green-600 hover:bg-green-700" 
                                : "border-amber-500 text-amber-600"
                            )}
                          >
                            {instructor.employment_status === 'permanent' 
                              ? (isRTL ? 'مثبت' : 'Permanent')
                              : (isRTL ? 'تدريب' : 'Training')}
                          </Badge>
                          {instructor.employment_status === 'permanent' && (
                            <Badge 
                              variant="outline"
                              className={cn(
                                instructor.work_type === 'full_time' 
                                  ? "border-blue-500 text-blue-600" 
                                  : "border-purple-500 text-purple-600"
                              )}
                            >
                              {instructor.work_type === 'full_time' 
                                ? (isRTL ? 'فول تايم' : 'Full-time')
                                : (isRTL ? 'بارت تايم' : 'Part-time')}
                            </Badge>
                          )}
                          {instructor.employment_status === 'training' && instructor.is_paid_trainee && (
                            <Badge variant="outline" className="border-emerald-500 text-emerald-600">
                              {isRTL ? `بمقابل` : `Paid`}
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align={isRTL ? 'start' : 'end'}>
                              <DropdownMenuItem onClick={() => navigate(`/instructor/${instructor.user_id}`)}>
                                <Eye className="h-4 w-4 mr-2" />
                                {isRTL ? 'عرض الملف' : 'View Profile'}
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => navigate(`/instructor-schedule/${instructor.user_id}`)}>
                                <CalendarDays className="h-4 w-4 mr-2" />
                                {isRTL ? 'جدول العمل' : 'View Schedule'}
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleEdit(instructor)}>
                                <Pencil className="h-4 w-4 mr-2" />
                                {t.common.edit}
                              </DropdownMenuItem>
                              {instructor.employment_status === 'permanent' && (
                                <DropdownMenuItem onClick={() => openSalaryDialog(instructor)}>
                                  <DollarSign className="h-4 w-4 mr-2" />
                                  {isRTL ? 'تحديد راتب' : 'Set Salary'}
                                  {salaries[instructor.user_id] != null && (
                                    <Badge variant="outline" className="ml-2 text-xs">{salaries[instructor.user_id]} {isRTL ? 'ج.م' : 'EGP'}</Badge>
                                  )}
                                </DropdownMenuItem>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      {/* Set Salary Dialog */}
      <SalaryDialog open={salaryDialogOpen} onOpenChange={setSalaryDialogOpen}>
        <SalaryDialogContent>
          <SalaryDialogHeader>
            <SalaryDialogTitle>{isRTL ? 'تحديد راتب' : 'Set Salary'}</SalaryDialogTitle>
          </SalaryDialogHeader>
          {salaryTarget && (
            <div className="space-y-4 py-4">
              <div className="p-3 rounded-lg border bg-muted/50">
                <p className="font-medium">{language === 'ar' && salaryTarget.full_name_ar ? salaryTarget.full_name_ar : salaryTarget.full_name}</p>
                <p className="text-sm text-muted-foreground">{salaryTarget.email}</p>
              </div>
              <div>
                <Label>{isRTL ? 'الراتب الأساسي (ج.م)' : 'Base Salary (EGP)'} *</Label>
                <Input type="number" value={salaryForm.base_salary} onChange={e => setSalaryForm({ ...salaryForm, base_salary: e.target.value })} />
              </div>
              <div>
                <Label>{isRTL ? 'ساري من تاريخ' : 'Effective From'}</Label>
                <Input type="date" value={salaryForm.effective_from} onChange={e => setSalaryForm({ ...salaryForm, effective_from: e.target.value })} />
              </div>
            </div>
          )}
          <SalaryDialogFooter>
            <Button variant="outline" onClick={() => setSalaryDialogOpen(false)}>{isRTL ? 'إلغاء' : 'Cancel'}</Button>
            <Button onClick={handleSetSalary} disabled={salaryLoading}>{salaryLoading ? '...' : (isRTL ? 'حفظ' : 'Save')}</Button>
          </SalaryDialogFooter>
        </SalaryDialogContent>
      </SalaryDialog>
    </DashboardLayout>
  );
}
