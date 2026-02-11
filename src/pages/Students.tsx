import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Search, MoreHorizontal, Pencil, Trash2, Eye, UserPlus, AlertCircle, Check } from 'lucide-react';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useLanguage } from '@/contexts/LanguageContext';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import {
  validateMobileNumber,
  validatePassword,
  validateEnglishName,
  validateArabicName,
  validateDateOfBirth,
  validateEmail,
  getLocalizedError,
} from '@/lib/validationUtils';
import { cn } from '@/lib/utils';

type SubscriptionType = 'kojo_squad' | 'kojo_core' | 'kojo_x';
type AttendanceMode = 'online' | 'offline';

interface Student {
  id: string;
  user_id: string;
  full_name: string;
  full_name_ar: string | null;
  email: string;
  phone: string | null;
  avatar_url: string | null;
  age_group_id: string | null;
  level_id: string | null;
  date_of_birth: string | null;
  subscription_type: SubscriptionType | null;
  attendance_mode: AttendanceMode | null;
}

interface StudentSubscription {
  student_id: string;
  status: string;
  is_suspended: boolean;
  remaining_amount: number | null;
  next_payment_date: string | null;
  paid_amount: number;
  total_amount: number;
}

interface AgeGroup {
  id: string;
  name: string;
  name_ar: string;
}

interface Level {
  id: string;
  name: string;
  name_ar: string;
}

export default function StudentsPage() {
  const { t, isRTL, language } = useLanguage();
  const { toast } = useToast();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [students, setStudents] = useState<Student[]>([]);
  const [subscriptions, setSubscriptions] = useState<StudentSubscription[]>([]);
  const [ageGroups, setAgeGroups] = useState<AgeGroup[]>([]);
  const [levels, setLevels] = useState<Level[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
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
  });
  const [formTouched, setFormTouched] = useState<Record<string, boolean>>({});

  // Validation results computed from form data
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
    
    if (editingStudent) {
      return baseValid;
    }
    
    // For new students, also validate email, password, and subscription type
    return baseValid && 
           !validationErrors.email && 
           validationErrors.passwordDetails.isValid && 
           formData.subscription_type !== '';
  }, [validationErrors, editingStudent, formData.subscription_type]);

  const subscriptionTypes: { value: SubscriptionType; label: string; labelAr: string }[] = [
    { value: 'kojo_squad', label: 'Kojo Squad', labelAr: 'كوجو سكواد' },
    { value: 'kojo_core', label: 'Kojo Core', labelAr: 'كوجو كور' },
    { value: 'kojo_x', label: 'Kojo X', labelAr: 'كوجو اكس' },
  ];

  const attendanceModes: { value: AttendanceMode; label: string; labelAr: string }[] = [
    { value: 'online', label: 'Online', labelAr: 'أونلاين' },
    { value: 'offline', label: 'Offline (In-Person)', labelAr: 'حضوري' },
  ];

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      // Fetch students with role 'student'
      const { data: rolesData, error: rolesError } = await supabase
        .from('user_roles')
        .select('user_id')
        .eq('role', 'student');

      if (rolesError) throw rolesError;

      const studentUserIds = rolesData?.map((r) => r.user_id) || [];

      if (studentUserIds.length > 0) {
        const { data: profilesData, error: profilesError } = await supabase
          .from('profiles')
          .select('*')
          .in('user_id', studentUserIds);

        if (profilesError) throw profilesError;
        setStudents((profilesData || []) as Student[]);

        // Fetch active subscriptions for all students
        const { data: subsData } = await supabase
          .from('subscriptions')
          .select('student_id, status, is_suspended, remaining_amount, next_payment_date, paid_amount, total_amount')
          .eq('status', 'active')
          .in('student_id', studentUserIds);
        setSubscriptions((subsData || []) as StudentSubscription[]);
      } else {
        setStudents([]);
        setSubscriptions([]);
      }

      // Fetch age groups
      const { data: ageGroupsData } = await supabase
        .from('age_groups')
        .select('id, name, name_ar')
        .eq('is_active', true);
      setAgeGroups(ageGroupsData || []);

      // Fetch levels
      const { data: levelsData } = await supabase
        .from('levels')
        .select('id, name, name_ar')
        .eq('is_active', true);
      setLevels(levelsData || []);

    } catch (error) {
      console.error('Error fetching data:', error);
      toast({
        variant: 'destructive',
        title: t.common.error,
        description: isRTL ? 'فشل في تحميل البيانات' : 'Failed to load data',
      });
    } finally {
      setLoading(false);
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
      date_of_birth: true,
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
      if (editingStudent) {
        // Update existing student profile
        const { error } = await supabase
          .from('profiles')
          .update({
            full_name: formData.full_name,
            full_name_ar: formData.full_name_ar || null,
            phone: formData.phone || null,
            date_of_birth: formData.date_of_birth || null,
            age_group_id: formData.age_group_id || null,
            level_id: formData.level_id || null,
            subscription_type: formData.subscription_type || null,
            attendance_mode: formData.attendance_mode,
          })
          .eq('id', editingStudent.id);

        if (error) throw error;
        toast({
          title: t.common.success,
          description: isRTL ? 'تم تحديث بيانات الطالب' : 'Student updated successfully',
        });
      } else {
        // Create new student via edge function

        const { data, error } = await supabase.functions.invoke('create-user', {
          body: {
            email: formData.email,
            password: formData.password,
            full_name: formData.full_name,
            full_name_ar: formData.full_name_ar || undefined,
            phone: formData.phone || undefined,
            role: 'student',
            date_of_birth: formData.date_of_birth || undefined,
            age_group_id: formData.age_group_id || undefined,
            level_id: formData.level_id || undefined,
            subscription_type: formData.subscription_type || undefined,
            attendance_mode: formData.attendance_mode,
          }
        });

        if (error) throw error;
        if (data?.error) throw new Error(data.error);

        toast({
          title: t.common.success,
          description: isRTL ? 'تم إنشاء الطالب بنجاح' : 'Student created successfully',
        });
      }

      setIsDialogOpen(false);
      setEditingStudent(null);
      resetForm();
      fetchData();
    } catch (error: any) {
      console.error('Error saving student:', error);
      toast({
        variant: 'destructive',
        title: t.common.error,
        description: error.message || (isRTL ? 'فشل في حفظ بيانات الطالب' : 'Failed to save student'),
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
      date_of_birth: '',
      age_group_id: '',
      level_id: '',
      password: '',
      subscription_type: '',
      attendance_mode: 'offline',
    });
    setFormTouched({});
  };

  const handleEdit = (student: Student) => {
    setEditingStudent(student);
    setFormData({
      full_name: student.full_name,
      full_name_ar: student.full_name_ar || '',
      email: student.email,
      phone: student.phone || '',
      date_of_birth: student.date_of_birth || '',
      age_group_id: student.age_group_id || '',
      level_id: student.level_id || '',
      password: '',
      subscription_type: student.subscription_type || '',
      attendance_mode: student.attendance_mode || 'offline',
    });
    setIsDialogOpen(true);
  };

  const filteredStudents = students.filter((student) =>
    student.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (student.full_name_ar && student.full_name_ar.includes(searchQuery)) ||
    student.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getAgeGroupName = (id: string | null) => {
    if (!id) return '-';
    const group = ageGroups.find((g) => g.id === id);
    return group ? (language === 'ar' ? group.name_ar : group.name) : '-';
  };

  const getLevelName = (id: string | null) => {
    if (!id) return '-';
    const level = levels.find((l) => l.id === id);
    return level ? (language === 'ar' ? level.name_ar : level.name) : '-';
  };

  const getSubscriptionTypeName = (type: SubscriptionType | null) => {
    if (!type) return '-';
    const found = subscriptionTypes.find((t) => t.value === type);
    return found ? (language === 'ar' ? found.labelAr : found.label) : '-';
  };

  const getAttendanceModeName = (mode: AttendanceMode | null) => {
    if (!mode) return language === 'ar' ? 'حضوري' : 'Offline';
    const found = attendanceModes.find((m) => m.value === mode);
    return found ? (language === 'ar' ? found.labelAr : found.label) : '-';
  };

  const getPaymentStatus = (userId: string) => {
    const sub = subscriptions.find(s => s.student_id === userId);
    if (!sub) return { label: isRTL ? 'لا اشتراك' : 'No Sub', variant: 'outline' as const, color: '' };
    if (sub.is_suspended) return { label: isRTL ? 'موقوف' : 'Suspended', variant: 'destructive' as const, color: '' };
    if (Number(sub.remaining_amount) <= 0) return { label: isRTL ? 'مدفوع' : 'Paid', variant: 'default' as const, color: 'bg-green-600 hover:bg-green-700' };
    if (sub.next_payment_date && new Date(sub.next_payment_date) < new Date()) return { label: isRTL ? 'متأخر' : 'Overdue', variant: 'destructive' as const, color: '' };
    return { label: isRTL ? 'جاري' : 'Active', variant: 'secondary' as const, color: '' };
  };

  return (
    <DashboardLayout title={t.students.title}>
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
            setEditingStudent(null);
            resetForm();
            setIsDialogOpen(true);
          }}>
            <UserPlus className="h-4 w-4 mr-2" />
            {t.students.addStudent}
          </Button>
        </div>

        {/* Dialog */}
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>
                {editingStudent ? t.students.editStudent : t.students.addStudent}
              </DialogTitle>
              <DialogDescription>
                {isRTL ? 'أدخل بيانات الطالب' : 'Enter student details'}
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

              {!editingStudent && (
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

              {/* Date of Birth */}
              <div className="grid gap-2">
                <Label htmlFor="dob" className={cn(formTouched.date_of_birth && validationErrors.date_of_birth && 'text-destructive')}>
                  {isRTL ? 'تاريخ الميلاد' : 'Date of Birth'}
                </Label>
                <Input
                  id="dob"
                  type="date"
                  value={formData.date_of_birth}
                  onChange={(e) => setFormData({ ...formData, date_of_birth: e.target.value })}
                  onBlur={() => setFormTouched({ ...formTouched, date_of_birth: true })}
                  max={new Date().toISOString().split('T')[0]}
                  className={cn(
                    formTouched.date_of_birth && validationErrors.date_of_birth && 'border-destructive focus-visible:ring-destructive'
                  )}
                />
                {formTouched.date_of_birth && validationErrors.date_of_birth && (
                  <p className="text-sm text-destructive flex items-center gap-1">
                    <AlertCircle className="h-3 w-3" />
                    {validationErrors.date_of_birth}
                  </p>
                )}
              </div>
              <div className="grid gap-2">
                <Label>{t.students.ageGroup}</Label>
                <Select
                  value={formData.age_group_id}
                  onValueChange={(value) => setFormData({ ...formData, age_group_id: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={isRTL ? 'اختر الفئة العمرية' : 'Select age group'} />
                  </SelectTrigger>
                  <SelectContent>
                    {ageGroups.map((group) => (
                      <SelectItem key={group.id} value={group.id}>
                        {language === 'ar' ? group.name_ar : group.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>{t.students.level}</Label>
                <Select
                  value={formData.level_id}
                  onValueChange={(value) => setFormData({ ...formData, level_id: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={isRTL ? 'اختر المستوى' : 'Select level'} />
                  </SelectTrigger>
                  <SelectContent>
                    {levels.map((level) => (
                      <SelectItem key={level.id} value={level.id}>
                        {language === 'ar' ? level.name_ar : level.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>{isRTL ? 'نوع الاشتراك' : 'Subscription Type'} *</Label>
                <Select
                  value={formData.subscription_type}
                  onValueChange={(value) => setFormData({ ...formData, subscription_type: value as SubscriptionType })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={isRTL ? 'اختر نوع الاشتراك' : 'Select subscription type'} />
                  </SelectTrigger>
                  <SelectContent>
                    {subscriptionTypes.map((type) => (
                      <SelectItem key={type.value} value={type.value}>
                        {language === 'ar' ? type.labelAr : type.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>{isRTL ? 'نوع الحضور' : 'Attendance Mode'} *</Label>
                <Select
                  value={formData.attendance_mode}
                  onValueChange={(value) => setFormData({ ...formData, attendance_mode: value as AttendanceMode })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={isRTL ? 'اختر نوع الحضور' : 'Select attendance mode'} />
                  </SelectTrigger>
                  <SelectContent>
                    {attendanceModes.map((mode) => (
                      <SelectItem key={mode.value} value={mode.value}>
                        {language === 'ar' ? mode.labelAr : mode.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
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
        <div className="block lg:hidden space-y-3">
          {loading ? (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                {t.common.loading}
              </CardContent>
            </Card>
          ) : filteredStudents.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                {isRTL ? 'لا يوجد طلاب' : 'No students found'}
              </CardContent>
            </Card>
          ) : (
            filteredStudents.map((student) => (
              <Card 
                key={student.id} 
                className="cursor-pointer hover:bg-muted/50 transition-colors"
                onClick={() => navigate(`/student/${student.user_id}`)}
              >
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <Avatar className="h-10 w-10 flex-shrink-0">
                        <AvatarImage src={student.avatar_url || undefined} />
                        <AvatarFallback className="text-xs">
                          {student.full_name.slice(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0 flex-1">
                        <p className="font-medium truncate">
                          {language === 'ar' && student.full_name_ar 
                            ? student.full_name_ar 
                            : student.full_name}
                        </p>
                        <p className="text-sm text-muted-foreground truncate">{student.email}</p>
                      </div>
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                        <Button variant="ghost" size="icon" className="flex-shrink-0">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align={isRTL ? 'start' : 'end'}>
                        <DropdownMenuItem onClick={(e) => { e.stopPropagation(); navigate(`/student/${student.user_id}`); }}>
                          <Eye className="h-4 w-4 mr-2" />
                          {isRTL ? 'عرض الملف' : 'View Profile'}
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleEdit(student); }}>
                          <Pencil className="h-4 w-4 mr-2" />
                          {t.common.edit}
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                  <div className="flex flex-wrap gap-2 mt-3">
                    <Badge variant="outline" className="text-xs">
                      {getAgeGroupName(student.age_group_id)}
                    </Badge>
                    <Badge variant="outline" className="text-xs">
                      {getLevelName(student.level_id)}
                    </Badge>
                    <Badge variant="secondary" className="text-xs">
                      {getSubscriptionTypeName(student.subscription_type)}
                    </Badge>
                    <Badge 
                      variant={student.attendance_mode === 'online' ? 'default' : 'outline'} 
                      className={`text-xs ${student.attendance_mode === 'online' ? 'bg-blue-500 hover:bg-blue-600' : ''}`}
                    >
                      {getAttendanceModeName(student.attendance_mode)}
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>

        {/* Desktop Table View */}
        <Card className="hidden lg:block">
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t.students.fullName}</TableHead>
                  <TableHead>{t.auth.email}</TableHead>
                  <TableHead>{t.students.ageGroup}</TableHead>
                  <TableHead>{t.students.level}</TableHead>
                  <TableHead>{isRTL ? 'الاشتراك' : 'Subscription'}</TableHead>
                  <TableHead>{isRTL ? 'حالة الدفع' : 'Payment'}</TableHead>
                  <TableHead>{isRTL ? 'نوع الحضور' : 'Attendance'}</TableHead>
                  <TableHead className="w-[100px]">{t.common.actions}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8">
                      {t.common.loading}
                    </TableCell>
                  </TableRow>
                ) : filteredStudents.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                      {isRTL ? 'لا يوجد طلاب' : 'No students found'}
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredStudents.map((student) => (
                    <TableRow key={student.id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <Avatar className="h-8 w-8">
                            <AvatarImage src={student.avatar_url || undefined} />
                            <AvatarFallback className="text-xs">
                              {student.full_name.slice(0, 2).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <span className="font-medium">
                            {language === 'ar' && student.full_name_ar 
                              ? student.full_name_ar 
                              : student.full_name}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>{student.email}</TableCell>
                      <TableCell>{getAgeGroupName(student.age_group_id)}</TableCell>
                      <TableCell>{getLevelName(student.level_id)}</TableCell>
                      <TableCell>
                        <Badge variant="secondary">
                          {getSubscriptionTypeName(student.subscription_type)}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {(() => {
                          const ps = getPaymentStatus(student.user_id);
                          return (
                            <Badge variant={ps.variant} className={ps.color}>
                              {ps.label}
                            </Badge>
                          );
                        })()}
                      </TableCell>
                      <TableCell>
                        <Badge 
                          variant={student.attendance_mode === 'online' ? 'default' : 'outline'}
                          className={student.attendance_mode === 'online' ? 'bg-blue-500 hover:bg-blue-600' : ''}
                        >
                          {getAttendanceModeName(student.attendance_mode)}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align={isRTL ? 'start' : 'end'}>
                            <DropdownMenuItem onClick={() => navigate(`/student/${student.user_id}`)}>
                              <Eye className="h-4 w-4 mr-2" />
                              {isRTL ? 'عرض الملف' : 'View Profile'}
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleEdit(student)}>
                              <Pencil className="h-4 w-4 mr-2" />
                              {t.common.edit}
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
