import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { useProfile } from '@/hooks/useProfile';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { User, Mail, Phone, Calendar, Save, ArrowLeft, Camera, Loader2, DollarSign } from 'lucide-react';
import { ImageCropDialog } from '@/components/ImageCropDialog';

export default function Profile() {
  const { isRTL, language } = useLanguage();
  const { user, role } = useAuth();
  const { profile, loading, updateProfile } = useProfile();
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [saving, setSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [cropSrc, setCropSrc] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    full_name: '',
    full_name_ar: '',
    phone: '',
  });
  const [salaryData, setSalaryData] = useState<{
    currentSalary: any | null;
    payments: any[];
    hourlyCalc: { totalHours: number; roundedHours: number; totalPay: number; hasInferred: boolean } | null;
  }>({ currentSalary: null, payments: [], hourlyCalc: null });
  const [salaryLoading, setSalaryLoading] = useState(false);

  // Sync form data when profile loads
  if (profile && !formData.full_name && profile.full_name) {
    setFormData({
      full_name: profile.full_name || '',
      full_name_ar: profile.full_name_ar || '',
      phone: profile.phone || '',
    });
  }

  // Fetch salary data for instructor/reception
  useEffect(() => {
    if (!user || !role || !profile) return;
    if (role !== 'instructor' && role !== 'reception') return;
    
    const fetchSalary = async () => {
      setSalaryLoading(true);
      const [salaryRes, paymentsRes] = await Promise.all([
        supabase.from('employee_salaries').select('*').eq('employee_id', user.id).eq('is_active', true).maybeSingle(),
        supabase.from('salary_payments').select('*').eq('employee_id', user.id).order('month', { ascending: false }).limit(12),
      ]);

      let hourlyCalc = null;
      if (profile.is_paid_trainee && profile.hourly_rate) {
        const now = new Date();
        const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
        const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];
        const { data: attData } = await supabase
          .from('session_staff_attendance')
          .select('actual_hours, status, session_id')
          .eq('staff_id', user.id)
          .in('status', ['confirmed', 'inferred']);
        const sIds = [...new Set((attData || []).map(a => a.session_id))];
        const { data: sessData } = await supabase
          .from('sessions').select('id, session_date')
          .in('id', sIds.length > 0 ? sIds : ['none'])
          .gte('session_date', monthStart).lte('session_date', monthEnd);
        const validSessions = new Set((sessData || []).map(s => s.id));
        const filtered = (attData || []).filter(a => validSessions.has(a.session_id));
        const totalHours = filtered.reduce((sum, a) => sum + Number(a.actual_hours), 0);
        const roundedHours = Math.round(totalHours * 4) / 4;
        hourlyCalc = {
          totalHours,
          roundedHours,
          totalPay: roundedHours * Number(profile.hourly_rate),
          hasInferred: filtered.some(a => a.status === 'inferred'),
        };
      }

      setSalaryData({
        currentSalary: salaryRes.data,
        payments: paymentsRes.data || [],
        hourlyCalc,
      });
      setSalaryLoading(false);
    };
    fetchSalary();
  }, [user, role, profile]);

  const handleAvatarClick = () => {
    fileInputRef.current?.click();
  };

  const handleAvatarChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast({
        title: isRTL ? 'خطأ' : 'Error',
        description: isRTL ? 'يرجى اختيار صورة صالحة' : 'Please select a valid image',
        variant: 'destructive',
      });
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast({
        title: isRTL ? 'خطأ' : 'Error',
        description: isRTL ? 'حجم الصورة يجب أن يكون أقل من 5 ميجابايت' : 'Image size must be less than 5MB',
        variant: 'destructive',
      });
      return;
    }

    const objectUrl = URL.createObjectURL(file);
    setCropSrc(objectUrl);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleCroppedAvatar = async (croppedFile: File) => {
    if (!user || !profile) return;

    setUploadingAvatar(true);
    try {
      const fileExt = 'jpg';
      const fileName = `${user.id}-${Date.now()}.${fileExt}`;
      const filePath = `${user.id}/${fileName}`;

      if (profile.avatar_url) {
        const oldPath = profile.avatar_url.split('/avatars/')[1];
        if (oldPath) {
          await supabase.storage.from('avatars').remove([oldPath]);
        }
      }

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, croppedFile, {
          cacheControl: '3600',
          upsert: true,
        });

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from('avatars')
        .getPublicUrl(filePath);

      const avatarUrl = urlData.publicUrl;
      const { error } = await updateProfile({ avatar_url: avatarUrl });
      if (error) throw error;

      toast({
        title: isRTL ? 'تم التحديث' : 'Updated',
        description: isRTL ? 'تم تغيير الصورة الشخصية بنجاح' : 'Profile picture updated successfully',
      });
    } catch (error) {
      console.error('Error uploading avatar:', error);
      toast({
        title: isRTL ? 'خطأ' : 'Error',
        description: isRTL ? 'فشل في رفع الصورة' : 'Failed to upload image',
        variant: 'destructive',
      });
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleSave = async () => {
    if (!profile) return;

    setSaving(true);
    try {
      const { error } = await updateProfile({
        full_name: formData.full_name,
        full_name_ar: formData.full_name_ar || null,
        phone: formData.phone || null,
      });

      if (error) throw error;

      toast({
        title: isRTL ? 'تم الحفظ' : 'Saved',
        description: isRTL ? 'تم تحديث الملف الشخصي بنجاح' : 'Profile updated successfully',
      });
    } catch (error) {
      console.error('Error updating profile:', error);
      toast({
        title: isRTL ? 'خطأ' : 'Error',
        description: isRTL ? 'فشل في تحديث الملف الشخصي' : 'Failed to update profile',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const getRoleBadge = () => {
    const roleLabels = {
      admin: { en: 'Administrator', ar: 'مدير النظام' },
      instructor: { en: 'Instructor', ar: 'مدرب' },
      student: { en: 'Student', ar: 'طالب' },
    };
    return role ? roleLabels[role]?.[isRTL ? 'ar' : 'en'] : '';
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        {/* Finance Section for Instructor/Reception */}
        {(role === 'instructor' || role === 'reception') && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <DollarSign className="h-5 w-5" />
                {isRTL ? 'المالية' : 'Finance'}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {salaryLoading ? (
                <p className="text-center text-muted-foreground py-4">{isRTL ? 'جاري التحميل...' : 'Loading...'}</p>
              ) : (
                <div className="space-y-4">
                  {/* Current Salary */}
                  <div className="grid gap-4 grid-cols-1 md:grid-cols-2">
                    <div className="p-4 rounded-lg border">
                      <p className="text-sm text-muted-foreground">
                        {salaryData.hourlyCalc ? (isRTL ? 'الراتب (بالساعة)' : 'Salary (Hourly)') : (isRTL ? 'الراتب الأساسي' : 'Base Salary')}
                      </p>
                      <p className="text-xl font-bold mt-1">
                        {salaryData.hourlyCalc 
                          ? `${salaryData.hourlyCalc.roundedHours} ${isRTL ? 'ساعة' : 'hrs'} = ${salaryData.hourlyCalc.totalPay} ${isRTL ? 'ج.م' : 'EGP'}`
                          : salaryData.currentSalary ? `${salaryData.currentSalary.base_salary} ${isRTL ? 'ج.م' : 'EGP'}` : (isRTL ? 'غير محدد' : 'Not set')}
                      </p>
                      {salaryData.hourlyCalc && (
                        <p className="text-xs text-muted-foreground mt-1">
                          {profile?.hourly_rate} {isRTL ? 'ج.م/ساعة' : 'EGP/hr'} × {salaryData.hourlyCalc.roundedHours} {isRTL ? 'ساعة' : 'hrs'}
                          {salaryData.hourlyCalc.hasInferred && <span className="text-amber-500 ms-2">⚠ {isRTL ? 'يشمل ساعات تقديرية' : 'Includes inferred hours'}</span>}
                        </p>
                      )}
                    </div>
                    <div className="p-4 rounded-lg border">
                      <p className="text-sm text-muted-foreground">{isRTL ? 'إجمالي المدفوع' : 'Total Paid'}</p>
                      <p className="text-xl font-bold text-green-600 mt-1">
                        {salaryData.payments.reduce((sum, p) => sum + Number(p.net_amount || 0), 0)} {isRTL ? 'ج.م' : 'EGP'}
                      </p>
                    </div>
                  </div>

                  {/* Payment History */}
                  {salaryData.payments.length > 0 && (
                    <div className="space-y-2">
                      <h3 className="font-medium text-sm text-muted-foreground">{isRTL ? 'سجل الرواتب' : 'Salary History'}</h3>
                      {salaryData.payments.map((payment: any) => (
                        <div key={payment.id} className="flex items-center justify-between p-3 rounded-lg border">
                          <div>
                            <p className="font-medium text-sm">
                              {new Date(payment.month).toLocaleDateString(language === 'ar' ? 'ar-EG' : 'en-US', { year: 'numeric', month: 'long' })}
                            </p>
                            <div className="flex gap-3 mt-1 text-xs flex-wrap">
                              <span className="text-muted-foreground">{isRTL ? 'أساسي:' : 'Base:'} {payment.base_amount}</span>
                              {Number(payment.deductions) > 0 && (
                                <span className="text-destructive">
                                  {isRTL ? 'خصم:' : 'Ded:'} -{payment.deductions}
                                  {payment.deduction_reason && <span className="ms-1">({language === 'ar' && payment.deduction_reason_ar ? payment.deduction_reason_ar : payment.deduction_reason})</span>}
                                </span>
                              )}
                              {Number(payment.bonus) > 0 && (
                                <span className="text-green-600">
                                  {isRTL ? 'بونص:' : 'Bonus:'} +{payment.bonus}
                                  {payment.bonus_reason && <span className="ms-1">({language === 'ar' && payment.bonus_reason_ar ? payment.bonus_reason_ar : payment.bonus_reason})</span>}
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="font-bold text-sm">{payment.net_amount} {isRTL ? 'ج.م' : 'EGP'}</p>
                            <Badge className={payment.status === 'paid' ? 'bg-green-100 text-green-800' : 'bg-orange-100 text-orange-800'}>
                              {payment.status === 'paid' ? (isRTL ? 'مصروف' : 'Paid') : (isRTL ? 'معلق' : 'Pending')}
                            </Badge>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {salaryData.payments.length === 0 && !salaryData.currentSalary && !salaryData.hourlyCalc && (
                    <p className="text-center text-muted-foreground py-4">{isRTL ? 'لا توجد بيانات مالية بعد' : 'No financial data yet'}</p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold">
              {isRTL ? 'الملف الشخصي' : 'Profile'}
            </h1>
            <p className="text-muted-foreground">
              {isRTL ? 'إدارة معلوماتك الشخصية' : 'Manage your personal information'}
            </p>
          </div>
        </div>

        <div className="grid gap-6 md:grid-cols-3">
          {/* Profile Card */}
          <Card className="md:col-span-1">
            <CardContent className="pt-6">
              <div className="flex flex-col items-center text-center">
                {/* Avatar with upload button */}
                <div className="relative group mb-4">
                  <Avatar className="h-24 w-24">
                    <AvatarImage src={profile?.avatar_url || ''} />
                    <AvatarFallback className="text-2xl bg-primary text-primary-foreground">
                      {profile ? getInitials(profile.full_name) : 'U'}
                    </AvatarFallback>
                  </Avatar>
                  
                  {/* Upload overlay - only for admin */}
                  {role === 'admin' && (
                    <>
                      <button
                        onClick={handleAvatarClick}
                        disabled={uploadingAvatar}
                        className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-full opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer disabled:cursor-not-allowed"
                      >
                        {uploadingAvatar ? (
                          <Loader2 className="h-6 w-6 text-white animate-spin" />
                        ) : (
                          <Camera className="h-6 w-6 text-white" />
                        )}
                      </button>
                      
                      {/* Hidden file input */}
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        onChange={handleAvatarChange}
                        className="hidden"
                      />
                    </>
                  )}
                </div>

                {role === 'admin' && (
                  <p className="text-xs text-muted-foreground mb-2">
                    {isRTL ? 'انقر على الصورة لتغييرها' : 'Click on image to change'}
                  </p>
                )}

                <h2 className="text-xl font-semibold">
                  {isRTL ? profile?.full_name_ar || profile?.full_name : profile?.full_name}
                </h2>
                <p className="text-muted-foreground">{profile?.email}</p>
                <span className="mt-2 inline-flex items-center rounded-full bg-primary/10 px-3 py-1 text-sm font-medium text-primary">
                  {getRoleBadge()}
                </span>
              </div>
            </CardContent>
          </Card>

          {/* Edit Form */}
          <Card className="md:col-span-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5" />
                {isRTL ? 'المعلومات الشخصية' : 'Personal Information'}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="full_name">
                    {isRTL ? 'الاسم (English)' : 'Full Name (English)'}
                  </Label>
                  <Input
                    id="full_name"
                    value={formData.full_name}
                    onChange={(e) =>
                      setFormData({ ...formData, full_name: e.target.value })
                    }
                    placeholder="Enter your full name"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="full_name_ar">
                    {isRTL ? 'الاسم (عربي)' : 'Full Name (Arabic)'}
                  </Label>
                  <Input
                    id="full_name_ar"
                    value={formData.full_name_ar}
                    onChange={(e) =>
                      setFormData({ ...formData, full_name_ar: e.target.value })
                    }
                    placeholder="أدخل اسمك الكامل"
                    dir="rtl"
                  />
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="email" className="flex items-center gap-2">
                    <Mail className="h-4 w-4" />
                    {isRTL ? 'البريد الإلكتروني' : 'Email'}
                  </Label>
                  <Input
                    id="email"
                    value={profile?.email || ''}
                    disabled
                    className="bg-muted"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone" className="flex items-center gap-2">
                    <Phone className="h-4 w-4" />
                    {isRTL ? 'رقم الهاتف' : 'Phone Number'}
                  </Label>
                  <Input
                    id="phone"
                    value={formData.phone}
                    onChange={(e) =>
                      setFormData({ ...formData, phone: e.target.value })
                    }
                    placeholder={isRTL ? 'أدخل رقم الهاتف' : 'Enter phone number'}
                  />
                </div>
              </div>

              {profile?.date_of_birth && (
                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <Calendar className="h-4 w-4" />
                    {isRTL ? 'تاريخ الميلاد' : 'Date of Birth'}
                  </Label>
                  <Input
                    value={new Date(profile.date_of_birth).toLocaleDateString(
                      isRTL ? 'ar-EG' : 'en-US'
                    )}
                    disabled
                    className="bg-muted"
                  />
                </div>
              )}

              {(profile?.specialization || profile?.specialization_ar) && (
                <div className="space-y-2">
                  <Label>{isRTL ? 'التخصص' : 'Specialization'}</Label>
                  <Input
                    value={
                      isRTL
                        ? profile.specialization_ar || profile.specialization || ''
                        : profile.specialization || ''
                    }
                    disabled
                    className="bg-muted"
                  />
                </div>
              )}

              <div className="flex justify-end pt-4">
                <Button onClick={handleSave} disabled={saving}>
                  <Save className="h-4 w-4 mr-2" />
                  {saving
                    ? isRTL
                      ? 'جاري الحفظ...'
                      : 'Saving...'
                    : isRTL
                    ? 'حفظ التغييرات'
                    : 'Save Changes'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {cropSrc && (
        <ImageCropDialog
          open={!!cropSrc}
          imageSrc={cropSrc}
          onClose={() => {
            URL.revokeObjectURL(cropSrc);
            setCropSrc(null);
          }}
          onCropComplete={handleCroppedAvatar}
        />
      )}
    </DashboardLayout>
  );
}
