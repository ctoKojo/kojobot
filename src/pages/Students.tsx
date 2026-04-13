import { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Search, MoreHorizontal, Pencil, Trash2, Eye, UserPlus, AlertCircle, Check, GraduationCap, Users, TrendingUp } from 'lucide-react';
import { AvatarUpload } from '@/components/AvatarUpload';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { PageHeader } from '@/components/shared/PageHeader';
import { StatsGrid, type StatItem } from '@/components/shared/StatsGrid';
import { TableToolbar, type ColumnDef } from '@/components/shared/TableToolbar';
import { SortableTableHead, useTableSort } from '@/components/shared/SortableTableHead';
import { DataTablePagination } from '@/components/ui/data-table-pagination';
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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
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
import { CredentialsDialog } from '@/components/CredentialsDialog';
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
import { GROUP_TYPES_LIST, type GroupType as SubscriptionType } from '@/lib/constants';
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
  min_age: number;
  max_age: number;
}

interface Level {
  id: string;
  name: string;
  name_ar: string;
  level_order: number;
}

export default function StudentsPage() {
  const { t, isRTL, language } = useLanguage();
  const { toast } = useToast();
  const { user, role } = useAuth();
  const isAdmin = role === 'admin' || role === 'reception';
  const [deleteTarget, setDeleteTarget] = useState<Student | null>(null);
  const [deleting, setDeleting] = useState(false);
  const navigate = useNavigate();
  const [students, setStudents] = useState<Student[]>([]);
  const [subscriptions, setSubscriptions] = useState<StudentSubscription[]>([]);
  const [activeGroupStudentIds, setActiveGroupStudentIds] = useState<Set<string>>(new Set());
  const [ageGroups, setAgeGroups] = useState<AgeGroup[]>([]);
  const [pricingPlans, setPricingPlans] = useState<PricingPlan[]>([]);
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
    // Subscription fields
    pricing_plan_id: '',
    payment_type: 'full' as PaymentType,
    sub_paid_amount: 0,
    sub_notes: '',
    discount_percentage: 0,
    payment_date: new Date().toISOString().split('T')[0],
    // Parent linking
    parent_id: '',
  });
  const [formTouched, setFormTouched] = useState<Record<string, boolean>>({});
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);

  // Parent search state
  const [parentSearchQuery, setParentSearchQuery] = useState('');
  const [parentSearchResults, setParentSearchResults] = useState<Array<{ id: string; full_name: string; full_name_ar: string | null; phone: string | null; email: string | null; children_count: number }>>([]);
  const [parentSearching, setParentSearching] = useState(false);
  const [selectedParent, setSelectedParent] = useState<{ id: string; full_name: string; full_name_ar: string | null; phone: string | null; children_count: number } | null>(null);
  const parentSearchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Credentials dialog state
  const [credentialsDialog, setCredentialsDialog] = useState<{ open: boolean; email: string; password: string; name: string; avatarUrl?: string | null; levelName?: string; subscriptionType?: string; attendanceMode?: string; ageGroupName?: string }>({ open: false, email: '', password: '', name: '' });

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

  const subscriptionTypes = GROUP_TYPES_LIST;

  // Table sort
  const { sortKey, sortDirection, handleSort, sortData } = useTableSort();

  // Column visibility
  const [columnVisibility, setColumnVisibility] = useState<Record<string, boolean>>({
    name: true,
    email: true,
    ageGroup: true,
    level: true,
    subscription: true,
    payment: true,
    attendance: true,
  });
  const columns: ColumnDef[] = [
    { key: 'name', label: isRTL ? 'الاسم' : 'Name', visible: columnVisibility.name },
    { key: 'email', label: isRTL ? 'البريد' : 'Email', visible: columnVisibility.email },
    { key: 'ageGroup', label: isRTL ? 'الفئة العمرية' : 'Age Group', visible: columnVisibility.ageGroup },
    { key: 'level', label: isRTL ? 'المستوى' : 'Level', visible: columnVisibility.level },
    { key: 'subscription', label: isRTL ? 'الاشتراك' : 'Subscription', visible: columnVisibility.subscription },
    { key: 'payment', label: isRTL ? 'الدفع' : 'Payment', visible: columnVisibility.payment },
    { key: 'attendance', label: isRTL ? 'الحضور' : 'Attendance', visible: columnVisibility.attendance },
  ];
  const handleColumnToggle = (key: string) => {
    setColumnVisibility(prev => ({ ...prev, [key]: !prev[key] }));
  };

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 20;

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
        // Fetch active group memberships
        const { data: gsData } = await supabase
          .from('group_students')
          .select('student_id')
          .eq('is_active', true)
          .in('student_id', studentUserIds);
        setActiveGroupStudentIds(new Set((gsData || []).map(g => g.student_id)));
      } else {
        setStudents([]);
        setSubscriptions([]);
        setActiveGroupStudentIds(new Set());
      }
      // Fetch age groups
      const { data: ageGroupsData } = await supabase
        .from('age_groups')
        .select('id, name, name_ar, min_age, max_age')
        .eq('is_active', true);
      setAgeGroups(ageGroupsData || []);

      // Fetch levels
      const { data: levelsData } = await supabase
        .from('levels')
        .select('id, name, name_ar, level_order')
        .eq('is_active', true)
        .order('level_order');
      setLevels(levelsData || []);

      // Fetch pricing plans
      const { data: plansData } = await supabase
        .from('pricing_plans')
        .select('*')
        .eq('is_active', true);
      setPricingPlans((plansData || []) as PricingPlan[]);

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
      // Helper to upload avatar
      const uploadAvatar = async (userId: string): Promise<string | null> => {
        if (!avatarFile) return null;
        const fileExt = avatarFile.name.split('.').pop();
        const filePath = `${userId}/${userId}-${Date.now()}.${fileExt}`;
        const { error: uploadError } = await supabase.storage
          .from('avatars')
          .upload(filePath, avatarFile, { cacheControl: '3600', upsert: true });
        if (uploadError) throw uploadError;
        const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(filePath);
        return urlData.publicUrl;
      };

      if (editingStudent) {
        let avatarUrl = editingStudent.avatar_url;
        if (avatarFile) {
          avatarUrl = await uploadAvatar(editingStudent.user_id);
        } else if (!avatarPreview && editingStudent.avatar_url) {
          avatarUrl = null;
        }

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
            avatar_url: avatarUrl,
          })
          .eq('id', editingStudent.id);

        if (error) throw error;
        toast({
          title: t.common.success,
          description: isRTL ? 'تم تحديث بيانات الطالب' : 'Student updated successfully',
        });
      } else {
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
        if (data?.error) throw { error: data.error, error_ar: data.error_ar };

        // Upload avatar for new user
        let createdAvatarUrl: string | null = null;
        if (avatarFile && data?.user_id) {
          createdAvatarUrl = await uploadAvatar(data.user_id);
          if (createdAvatarUrl) {
            await supabase.from('profiles').update({ avatar_url: createdAvatarUrl } as any).eq('user_id', data.user_id);
          }
        }

        // Auto-create subscription if pricing plan selected
        if (formData.pricing_plan_id && data?.user_id) {
          const selectedPlan = pricingPlans.find(p => p.id === formData.pricing_plan_id);
          if (selectedPlan) {
            const discountPct = formData.discount_percentage || 0;
            const baseTotal = formData.payment_type === 'installment' ? selectedPlan.price_1_month * 3 : selectedPlan.price_3_months;
            const totalAmount = Math.round(baseTotal * (1 - discountPct / 100));
            const baseInstallment = selectedPlan.price_1_month;
            const installmentAmount = Math.round(baseInstallment * (1 - discountPct / 100));

            // Create subscription with null dates - will be set automatically by RPC when assigned to a started group
            const { data: sub, error: subError } = await supabase.from('subscriptions').insert({
              student_id: data.user_id,
              pricing_plan_id: formData.pricing_plan_id,
              payment_type: formData.payment_type,
              start_date: null,
              end_date: null,
              total_amount: totalAmount,
              paid_amount: formData.sub_paid_amount,
              installment_amount: formData.payment_type === 'installment' ? installmentAmount : null,
              next_payment_date: null,
              is_suspended: false,
              status: 'active',
              notes: formData.sub_notes || null,
              discount_percentage: discountPct,
            } as any).select().single();

            if (subError) {
              console.error('Error creating subscription:', subError);
            } else if (formData.sub_paid_amount > 0 && sub) {
              await supabase.from('payments').insert({
                subscription_id: sub.id,
                student_id: data.user_id,
                amount: formData.sub_paid_amount,
                payment_date: formData.payment_date,
                payment_method: 'cash',
                payment_type: 'prior_payment',
                notes: isRTL ? 'دفعة مسبقة عند إنشاء الاشتراك' : 'Prior payment on subscription creation',
                recorded_by: user?.id,
              } as any);
            }
          }
        }

        const levelName = levels.find(l => l.id === formData.level_id)?.name;
        const ageGroup = ageGroups.find(a => a.id === formData.age_group_id);
        const ageGroupName = ageGroup?.name;

        // Show credentials dialog
        setCredentialsDialog({
          open: true,
          email: formData.email,
          password: formData.password,
          name: formData.full_name,
          avatarUrl: createdAvatarUrl,
          levelName,
          subscriptionType: formData.subscription_type || undefined,
          attendanceMode: formData.attendance_mode,
          ageGroupName,
        });
      }

      // For edit mode, close immediately. For create, credentials dialog handles cleanup.
      if (editingStudent) {
        setIsDialogOpen(false);
        setEditingStudent(null);
        resetForm();
        fetchData();
      }
    } catch (error: any) {
      console.error('Error saving student:', error);
      // Extract bilingual error message from edge function response
      let errorMessage: string;
      if (error?.error_ar && isRTL) {
        errorMessage = error.error_ar;
      } else if (error?.error) {
        errorMessage = error.error;
      } else if (typeof error?.message === 'string') {
        // Try to parse edge function error from message
        try {
          const parsed = JSON.parse(error.message);
          errorMessage = isRTL ? (parsed.error_ar || parsed.error) : parsed.error;
        } catch {
          errorMessage = error.message;
        }
      } else {
        errorMessage = isRTL ? 'فشل في حفظ بيانات الطالب' : 'Failed to save student';
      }
      toast({
        variant: 'destructive',
        title: t.common.error,
        description: errorMessage,
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
      pricing_plan_id: '',
      payment_type: 'full',
      sub_paid_amount: 0,
      sub_notes: '',
      discount_percentage: 0,
      payment_date: new Date().toISOString().split('T')[0],
    });
    setFormTouched({});
    setAvatarFile(null);
    setAvatarPreview(null);
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
      pricing_plan_id: '',
      payment_type: 'full',
      sub_paid_amount: 0,
      sub_notes: '',
      discount_percentage: 0,
      payment_date: new Date().toISOString().split('T')[0],
    });
    setAvatarFile(null);
    setAvatarPreview(student.avatar_url || null);
    setIsDialogOpen(true);
  };

  const handleDeleteStudent = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const { data, error } = await supabase.functions.invoke('delete-users', {
        body: { user_id: deleteTarget.user_id }
      });

      if (error) throw error;
      if (data?.error) throw { error: data.error, error_ar: data.error_ar };

      toast({
        title: t.common.success,
        description: isRTL ? 'تم حذف الطالب بنجاح' : 'Student deleted successfully',
      });
      setDeleteTarget(null);
      fetchData();
    } catch (error: any) {
      let errorMessage: string;
      if (error?.error_ar && isRTL) {
        errorMessage = error.error_ar;
      } else if (error?.error) {
        errorMessage = error.error;
      } else {
        errorMessage = isRTL ? 'فشل في حذف الطالب' : 'Failed to delete student';
      }
      toast({
        variant: 'destructive',
        title: t.common.error,
        description: errorMessage,
      });
    } finally {
      setDeleting(false);
    }
  };

  const filteredStudents = useMemo(() => {
    const filtered = students.filter((student) =>
      student.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (student.full_name_ar && student.full_name_ar.includes(searchQuery)) ||
      student.email.toLowerCase().includes(searchQuery.toLowerCase())
    );
    // Sort
    return sortData(filtered, (item, key) => {
      switch (key) {
        case 'name': return language === 'ar' && item.full_name_ar ? item.full_name_ar : item.full_name;
        case 'email': return item.email;
        case 'ageGroup': return getAgeGroupName(item.age_group_id);
        case 'level': return getLevelName(item.level_id);
        default: return item[key];
      }
    });
  }, [students, searchQuery, sortKey, sortDirection, language]);

  // Paginated students
  const totalPages = Math.ceil(filteredStudents.length / pageSize) || 1;
  const paginatedStudents = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredStudents.slice(start, start + pageSize);
  }, [filteredStudents, currentPage, pageSize]);

  // Reset page when search changes
  useEffect(() => { setCurrentPage(1); }, [searchQuery]);

  // Calculate age from date of birth
  const calculateAge = (dob: string): number | null => {
    if (!dob) return null;
    const birthDate = new Date(dob);
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    return age;
  };

  // Find the most specific age group matching the given age
  const findMatchingAgeGroup = (age: number): string => {
    // Sort by range size (smallest first) to pick the most specific match
    const sorted = [...ageGroups]
      .filter(g => age >= g.min_age && age <= g.max_age)
      .sort((a, b) => (a.max_age - a.min_age) - (b.max_age - b.min_age));
    return sorted[0]?.id || '';
  };

  // Handle date of birth change with auto age group detection
  const handleDobChange = (dob: string) => {
    const age = calculateAge(dob);
    const ageGroupId = age !== null ? findMatchingAgeGroup(age) : '';
    setFormData(prev => ({ ...prev, date_of_birth: dob, age_group_id: ageGroupId }));
  };

  const calculatedAge = calculateAge(formData.date_of_birth);

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

  const statsItems: StatItem[] = [
    { label: isRTL ? 'إجمالي الطلاب' : 'Total Students', value: loading ? '...' : students.length, icon: GraduationCap, gradient: 'from-blue-500 to-blue-600' },
    { label: isRTL ? 'في مجموعات' : 'In Groups', value: loading ? '...' : students.filter(s => activeGroupStudentIds.has(s.user_id)).length, icon: Users, gradient: 'from-emerald-500 to-emerald-600' },
    { label: isRTL ? 'غير مسكّن' : 'No Group', value: loading ? '...' : students.filter(s => !activeGroupStudentIds.has(s.user_id)).length, icon: AlertCircle, gradient: 'from-amber-500 to-orange-500' },
    { label: isRTL ? 'اشتراك فعال' : 'Active Subs', value: loading ? '...' : subscriptions.length, icon: TrendingUp, gradient: 'from-purple-500 to-purple-600' },
  ];

  return (
    <DashboardLayout title={t.students.title}>
      <div className="space-y-6">
        {/* Page Header */}
        <PageHeader
          title={t.students.title}
          subtitle={isRTL ? 'إدارة الطلاب والاشتراكات' : 'Manage students and subscriptions'}
          icon={GraduationCap}
          gradient="from-blue-500 to-blue-600"
          actions={
            <Button className="kojo-gradient shadow-md" onClick={() => {
              setEditingStudent(null);
              resetForm();
              setIsDialogOpen(true);
            }}>
              <UserPlus className="h-4 w-4 me-2" />
              {t.students.addStudent}
            </Button>
          }
        />

        {/* Stats */}
        <StatsGrid stats={statsItems} />

        {/* Table Toolbar */}
        <TableToolbar
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          searchPlaceholder={isRTL ? 'بحث بالاسم أو الإيميل...' : 'Search by name or email...'}
          columns={columns}
          onColumnToggle={handleColumnToggle}
        />

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
              {/* Avatar Upload */}
              <AvatarUpload
                currentUrl={editingStudent?.avatar_url}
                name={formData.full_name || 'ST'}
                previewUrl={avatarPreview}
                onFileSelect={(file) => {
                  setAvatarFile(file);
                  setAvatarPreview(URL.createObjectURL(file));
                }}
                onRemove={() => {
                  setAvatarFile(null);
                  setAvatarPreview(null);
                }}
              />

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
                  onChange={(e) => {
                    handleDobChange(e.target.value);
                    setFormTouched({ ...formTouched, date_of_birth: true });
                  }}
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
                {calculatedAge !== null && (
                  <p className="text-sm text-muted-foreground">
                    {isRTL ? `العمر: ${calculatedAge} سنة` : `Age: ${calculatedAge} years`}
                  </p>
                )}
              </div>
              <div className="grid gap-2">
                <Label>{t.students.ageGroup}</Label>
                <Input
                  readOnly
                  value={formData.age_group_id ? getAgeGroupName(formData.age_group_id) : (isRTL ? 'يتحدد تلقائياً من تاريخ الميلاد' : 'Auto-detected from date of birth')}
                  className="bg-muted cursor-not-allowed"
                />
                {formData.date_of_birth && !formData.age_group_id && calculatedAge !== null && (
                  <p className="text-sm text-destructive flex items-center gap-1">
                    <AlertCircle className="h-3 w-3" />
                    {isRTL ? `لا توجد فئة عمرية مناسبة للعمر ${calculatedAge}` : `No age group matches age ${calculatedAge}`}
                  </p>
                )}
              </div>
              <div className="grid gap-2">
                <Label>{t.students.level}</Label>
                {editingStudent ? (
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
                ) : (
                  <>
                    <Select
                      value={formData.level_id}
                      onValueChange={(value) => setFormData({ ...formData, level_id: value })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder={isRTL ? 'اختر المستوى' : 'Select level'} />
                      </SelectTrigger>
                      <SelectContent>
                        {levels.filter(l => l.level_order === 0).map((level) => (
                          <SelectItem key={level.id} value={level.id}>
                            {language === 'ar' ? level.name_ar : level.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">
                      {isRTL
                        ? 'المستويات الأعلى تُحدد عبر امتحان تحديد المستوى فقط'
                        : 'Higher levels are determined by the placement exam only'}
                    </p>
                  </>
                )}
              </div>
              <div className="grid gap-2">
                <Label>{isRTL ? 'نوع الاشتراك' : 'Subscription Type'} *</Label>
                <Select
                  value={formData.subscription_type}
                  onValueChange={(value) => setFormData({ ...formData, subscription_type: value as SubscriptionType, pricing_plan_id: '' })}
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
                  onValueChange={(value) => setFormData({ ...formData, attendance_mode: value as AttendanceMode, pricing_plan_id: '' })}
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

              {/* Subscription Section - Only for new students */}
              {!editingStudent && (
                <>
                  <div className="border-t pt-4 mt-2">
                    <h4 className="font-semibold text-sm mb-3">{isRTL ? '📋 بيانات الاشتراك' : '📋 Subscription Details'}</h4>
                  </div>

                  <div className="grid gap-2">
                    <Label>{isRTL ? 'الباقة' : 'Pricing Plan'}</Label>
                    <Select
                      value={formData.pricing_plan_id}
                      onValueChange={(value) => setFormData({ ...formData, pricing_plan_id: value })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder={isRTL ? 'اختر الباقة' : 'Select plan'} />
                      </SelectTrigger>
                      <SelectContent>
                        {pricingPlans
                          .filter(p => {
                            // Filter plans matching subscription type & attendance mode
                            const matchType = !formData.subscription_type || p.group_type === formData.subscription_type;
                            const matchMode = !formData.attendance_mode || p.attendance_mode === formData.attendance_mode;
                            return matchType && matchMode;
                          })
                          .map(p => (
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
                        <Select
                          value={formData.payment_type}
                          onValueChange={(v) => setFormData({ ...formData, payment_type: v as PaymentType })}
                        >
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="full">{isRTL ? 'كامل (3 شهور)' : 'Full (3 months)'}</SelectItem>
                            <SelectItem value="installment">{isRTL ? 'تقسيط شهري' : 'Monthly Installment'}</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="grid gap-2">
                        <Label>{isRTL ? 'نسبة الخصم الخاص %' : 'Special Discount %'}</Label>
                        <Input
                          type="number"
                          value={formData.discount_percentage}
                          onChange={(e) => setFormData({ ...formData, discount_percentage: Math.min(100, Math.max(0, +e.target.value)) })}
                          min={0}
                          max={100}
                          placeholder="0"
                        />
                      </div>

                      <div className="grid gap-2">
                        <p className="text-xs text-muted-foreground">
                          {isRTL ? '📌 تاريخ البداية يتحدد تلقائياً عند إسناد الطالب لمجموعة' : '📌 Start date is set automatically when the student is assigned to a group'}
                        </p>
                      </div>

                      <div className="grid gap-2">
                        <Label>{isRTL ? 'المبلغ المدفوع فعلاً' : 'Amount Already Paid'}</Label>
                        <Input
                          type="number"
                          value={formData.sub_paid_amount}
                          onChange={(e) => setFormData({ ...formData, sub_paid_amount: +e.target.value })}
                          min={0}
                        />
                      </div>

                      {formData.sub_paid_amount > 0 && (
                        <div className="grid gap-2">
                          <Label>{isRTL ? 'تاريخ الدفع الفعلي' : 'Actual Payment Date'}</Label>
                          <Input
                            type="date"
                            value={formData.payment_date}
                            onChange={(e) => setFormData({ ...formData, payment_date: e.target.value })}
                            max={new Date().toISOString().split('T')[0]}
                          />
                        </div>
                      )}

                      <div className="grid gap-2">
                        <Label>{isRTL ? 'ملاحظات' : 'Notes'}</Label>
                        <Input
                          value={formData.sub_notes}
                          onChange={(e) => setFormData({ ...formData, sub_notes: e.target.value })}
                          placeholder={isRTL ? 'ملاحظات اختيارية' : 'Optional notes'}
                        />
                      </div>

                      {/* Summary Card */}
                      {(() => {
                        const plan = pricingPlans.find(p => p.id === formData.pricing_plan_id);
                        if (!plan) return null;
                        const discountPct = formData.discount_percentage || 0;
                        const originalTotal = formData.payment_type === 'installment' ? plan.price_1_month * 3 : plan.price_3_months;
                        const discountAmount = Math.round(originalTotal * discountPct / 100);
                        const total = originalTotal - discountAmount;
                        const monthlyOriginal = plan.price_1_month;
                        const monthlyAfterDiscount = Math.round(monthlyOriginal * (1 - discountPct / 100));
                        const remaining = Math.max(0, total - formData.sub_paid_amount);
                        return (
                          <Card className="bg-muted/30">
                            <CardContent className="pt-4 space-y-2 text-sm">
                              {discountPct > 0 && (
                                <>
                                  <div className="flex justify-between">
                                    <span>{isRTL ? 'السعر الأصلي' : 'Original Price'}</span>
                                    <span className="line-through text-muted-foreground">{originalTotal} {isRTL ? 'ج.م' : 'EGP'}</span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span>{isRTL ? `خصم ${discountPct}%` : `${discountPct}% Discount`}</span>
                                    <span className="text-destructive">-{discountAmount} {isRTL ? 'ج.م' : 'EGP'}</span>
                                  </div>
                                </>
                              )}
                              <div className="flex justify-between">
                                <span>{isRTL ? 'المبلغ الإجمالي' : 'Total'}</span>
                                <span className="font-bold">{total} {isRTL ? 'ج.م' : 'EGP'}</span>
                              </div>
                              {formData.payment_type === 'installment' && (
                                <div className="flex justify-between">
                                  <span>{isRTL ? 'القسط الشهري' : 'Monthly Installment'}</span>
                                  <span>{monthlyAfterDiscount} {isRTL ? 'ج.م' : 'EGP'}</span>
                                </div>
                              )}
                              <div className="flex justify-between">
                                <span>{isRTL ? 'المدفوع' : 'Paid'}</span>
                                <span className="text-emerald-600">{formData.sub_paid_amount} {isRTL ? 'ج.م' : 'EGP'}</span>
                              </div>
                              <div className="flex justify-between">
                                <span>{isRTL ? 'المتبقي' : 'Remaining'}</span>
                                <span className={remaining > 0 ? 'text-amber-600' : 'text-emerald-600'}>{remaining} {isRTL ? 'ج.م' : 'EGP'}</span>
                              </div>
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
            paginatedStudents.map((student) => (
              <Card 
                key={student.id} 
                className={cn(
                  "cursor-pointer hover:bg-muted/50 transition-colors",
                  !activeGroupStudentIds.has(student.user_id) && "border-destructive/50 bg-destructive/25"
                )}
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
                        {isAdmin && (
                          <DropdownMenuItem 
                            onClick={(e) => { e.stopPropagation(); setDeleteTarget(student); }}
                            className="text-destructive focus:text-destructive"
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            {isRTL ? 'حذف الطالب' : 'Delete Student'}
                          </DropdownMenuItem>
                        )}
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
                    {(() => {
                      const ps = getPaymentStatus(student.user_id);
                      return (
                        <Badge variant={ps.variant} className={`text-xs ${ps.color}`}>
                          {ps.label}
                        </Badge>
                      );
                    })()}
                    {!activeGroupStudentIds.has(student.user_id) && (
                      <Badge variant="destructive" className="text-xs">
                        {isRTL ? 'غير مسكّن' : 'No Group'}
                      </Badge>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>

        {/* Desktop Table View */}
        <Card className="hidden lg:block">
          <CardContent className="p-0">
            <Table className="table-fixed">
              <TableHeader>
                <TableRow className="bg-muted/30">
                  {columnVisibility.name && <SortableTableHead sortKey="name" currentSort={sortKey} currentDirection={sortDirection} onSort={handleSort} className="w-[18%]">{t.students.fullName}</SortableTableHead>}
                  {columnVisibility.email && <SortableTableHead sortKey="email" currentSort={sortKey} currentDirection={sortDirection} onSort={handleSort} className="w-[18%]">{t.auth.email}</SortableTableHead>}
                  {columnVisibility.ageGroup && <SortableTableHead sortKey="ageGroup" currentSort={sortKey} currentDirection={sortDirection} onSort={handleSort} className="w-[12%]">{t.students.ageGroup}</SortableTableHead>}
                  {columnVisibility.level && <SortableTableHead sortKey="level" currentSort={sortKey} currentDirection={sortDirection} onSort={handleSort} className="w-[12%]">{t.students.level}</SortableTableHead>}
                  {columnVisibility.subscription && <TableHead className="w-[13%]">{isRTL ? 'الاشتراك' : 'Subscription'}</TableHead>}
                  {columnVisibility.payment && <TableHead className="w-[12%]">{isRTL ? 'حالة الدفع' : 'Payment'}</TableHead>}
                  {columnVisibility.attendance && <TableHead className="w-[10%]">{isRTL ? 'نوع الحضور' : 'Attendance'}</TableHead>}
                  <TableHead className="w-[5%]">{t.common.actions}</TableHead>
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
                  paginatedStudents.map((student) => (
                    <TableRow 
                      key={student.id} 
                      className={cn(
                        "cursor-pointer hover:bg-muted/50",
                        !activeGroupStudentIds.has(student.user_id) && "bg-destructive/25"
                      )}
                      onClick={() => navigate(`/student/${student.user_id}`)}
                    >
                      {columnVisibility.name && (
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
                      )}
                      {columnVisibility.email && <TableCell className="truncate">{student.email}</TableCell>}
                      {columnVisibility.ageGroup && <TableCell>{getAgeGroupName(student.age_group_id)}</TableCell>}
                      {columnVisibility.level && <TableCell>{getLevelName(student.level_id)}</TableCell>}
                      {columnVisibility.subscription && (
                        <TableCell>
                          <Badge variant="secondary">
                            {getSubscriptionTypeName(student.subscription_type)}
                          </Badge>
                        </TableCell>
                      )}
                      {columnVisibility.payment && (
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
                      )}
                      {columnVisibility.attendance && (
                        <TableCell>
                          <Badge 
                            variant={student.attendance_mode === 'online' ? 'default' : 'outline'}
                            className={student.attendance_mode === 'online' ? 'bg-blue-500 hover:bg-blue-600' : ''}
                          >
                            {getAttendanceModeName(student.attendance_mode)}
                          </Badge>
                        </TableCell>
                      )}
                      <TableCell onClick={(e) => e.stopPropagation()}>
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
                            {isAdmin && (
                              <DropdownMenuItem 
                                onClick={() => setDeleteTarget(student)}
                                className="text-destructive focus:text-destructive"
                              >
                                <Trash2 className="h-4 w-4 mr-2" />
                                {isRTL ? 'حذف الطالب' : 'Delete Student'}
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
            {/* Pagination */}
            <DataTablePagination
              currentPage={currentPage}
              totalPages={totalPages}
              pageSize={pageSize}
              totalCount={filteredStudents.length}
              hasNextPage={currentPage < totalPages}
              hasPreviousPage={currentPage > 1}
              onPageChange={setCurrentPage}
            />
          </CardContent>
        </Card>
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {isRTL ? 'تأكيد حذف الطالب' : 'Confirm Delete Student'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {isRTL 
                ? `هل أنت متأكد من حذف الطالب "${deleteTarget?.full_name_ar || deleteTarget?.full_name}"؟ سيتم حذف جميع بياناته بشكل نهائي (الحضور، الكويزات، الاشتراكات، الإنذارات).`
                : `Are you sure you want to delete "${deleteTarget?.full_name}"? All their data will be permanently removed (attendance, quizzes, subscriptions, warnings).`
              }
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>
              {isRTL ? 'إلغاء' : 'Cancel'}
            </AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDeleteStudent} 
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? (isRTL ? 'جاري الحذف...' : 'Deleting...') : (isRTL ? 'حذف' : 'Delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Credentials Dialog */}
      <CredentialsDialog
        open={credentialsDialog.open}
        onClose={() => {
          setCredentialsDialog({ open: false, email: '', password: '', name: '', avatarUrl: null, levelName: undefined, subscriptionType: undefined, attendanceMode: undefined, ageGroupName: undefined });
          setIsDialogOpen(false);
          setEditingStudent(null);
          resetForm();
          fetchData();
        }}
        email={credentialsDialog.email}
        password={credentialsDialog.password}
        userName={credentialsDialog.name}
        avatarUrl={credentialsDialog.avatarUrl}
        levelName={credentialsDialog.levelName}
        subscriptionType={credentialsDialog.subscriptionType}
        attendanceMode={credentialsDialog.attendanceMode}
        ageGroupName={credentialsDialog.ageGroupName}
      />
    </DashboardLayout>
  );
}
