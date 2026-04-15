import { useState, useEffect } from 'react';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Eye, EyeOff, Mail, Lock, ArrowLeft, ArrowRight, GraduationCap, Briefcase, Users, Plus, X, Loader2, CheckCircle, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { LanguageToggle } from '@/components/LanguageToggle';
import { lovable } from '@/integrations/lovable/index';
import { supabase } from '@/integrations/supabase/client';
import { resetStatusCache } from '@/components/ProtectedRoute';
import { clearPendingStudentLogin, markPendingStudentLogin, markStudentSession } from '@/lib/studentSession';
import kojobotLogo from '@/assets/kojobot-main-logo.png';

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});
type LoginFormData = z.infer<typeof loginSchema>;

type UserType = 'student' | 'staff' | 'parent' | null;
type AuthStep = 'select' | 'login' | 'parent-google' | 'parent-register';

const roleCards = [
  {
    type: 'student' as const,
    icon: GraduationCap,
    en: 'Student',
    ar: 'طالب',
    descEn: 'Sign in with email & password',
    descAr: 'تسجيل الدخول بالإيميل وكلمة المرور',
  },
  {
    type: 'staff' as const,
    icon: Briefcase,
    en: 'Staff',
    ar: 'موظف',
    descEn: 'Sign in with email & password',
    descAr: 'تسجيل الدخول بالإيميل وكلمة المرور',
  },
  {
    type: 'parent' as const,
    icon: Users,
    en: 'Parent',
    ar: 'ولي أمر',
    descEn: 'Sign in with Google',
    descAr: 'تسجيل الدخول بحساب Google',
  },
];

export default function Auth() {
  const [userType, setUserType] = useState<UserType>(null);
  const [step, setStep] = useState<AuthStep>('select');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { toast } = useToast();
  const { user, role, signIn, loading, roleLoading } = useAuth();
  const { t, isRTL, language } = useLanguage();

  // Parent registration state
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [relationship, setRelationship] = useState('parent');
  const [codes, setCodes] = useState<string[]>(['']);
  const [linkResults, setLinkResults] = useState<{ code: string; status: string }[] | null>(null);

  // Pre-fill code from URL
  useEffect(() => {
    const codeParam = searchParams.get('code');
    if (codeParam) {
      setCodes([codeParam.trim().toUpperCase()]);
      setUserType('parent');
      setStep('parent-google');
    }
  }, [searchParams]);

  // Check parent approval status
  const [parentApproved, setParentApproved] = useState<boolean | null>(null);
  useEffect(() => {
    if (!user || role !== 'parent') { setParentApproved(null); return; }
    supabase.from('profiles').select('is_approved').eq('user_id', user.id).maybeSingle()
      .then(({ data }) => setParentApproved(data?.is_approved ?? false));
  }, [user, role]);

  // Handle auth state changes
  useEffect(() => {
    if (loading || roleLoading) return;

    if (user && role === 'parent') {
      if (parentApproved === null) return; // still loading
      navigate(parentApproved ? '/dashboard' : '/parent-pending', { replace: true });
    } else if (user && role && role !== 'parent') {
      navigate('/dashboard', { replace: true });
    } else if (user && !role && userType === 'parent') {
      // Google user without role → show registration form
      const meta = user.user_metadata;
      if (meta?.full_name || meta?.name) {
        setFullName(meta.full_name || meta.name || '');
      }
      if (user.phone) setPhone(user.phone);
      setStep('parent-register');
    } else if (user && !role && user.app_metadata?.provider === 'google') {
      // Returning Google user without role (e.g. refreshing page)
      setUserType('parent');
      const meta = user.user_metadata;
      if (meta?.full_name || meta?.name) {
        setFullName(meta.full_name || meta.name || '');
      }
      if (user.phone) setPhone(user.phone);
      setStep('parent-register');
    }
  }, [user, role, loading, roleLoading, navigate, userType, parentApproved]);

  const loginForm = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  });

  const handleLogin = async (data: LoginFormData) => {
    setIsLoading(true);
    try {
      // For students on shared devices: clear any stale session BEFORE signing in
      if (userType === 'student') {
        await supabase.auth.signOut();
        resetStatusCache();
        clearPendingStudentLogin();
        markPendingStudentLogin();
      }

      const { error } = await signIn(data.email, data.password);
      if (error) {
        toast({ variant: 'destructive', title: t.common.error, description: t.auth.loginError });
        return;
      }

      // Verify role from server
      const { data: roleData } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', (await supabase.auth.getUser()).data.user?.id ?? '')
        .single();

      const fetchedRole = roleData?.role as string | null;
      const staffRoles = ['admin', 'instructor', 'reception'];
      const isStaffRole = fetchedRole && staffRoles.includes(fetchedRole);
      const isStudentRole = fetchedRole === 'student';

      if (userType === 'student' && !isStudentRole) {
        await supabase.auth.signOut();
        resetStatusCache();
        clearPendingStudentLogin();
        toast({
          variant: 'destructive',
          title: isRTL ? 'خطأ' : 'Error',
          description: isRTL ? 'هذا الحساب ليس حساب طالب' : 'This is not a student account',
        });
        return;
      }

      if (isStudentRole) {
        const signedInUserId = (await supabase.auth.getUser()).data.user?.id;
        if (signedInUserId) {
          markStudentSession(signedInUserId);
        }
        clearPendingStudentLogin();
      }

      if (userType === 'staff' && !isStaffRole) {
        await supabase.auth.signOut();
        resetStatusCache();
        clearPendingStudentLogin();
        toast({
          variant: 'destructive',
          title: isRTL ? 'خطأ' : 'Error',
          description: isRTL ? 'هذا الحساب ليس حساب موظف' : 'This is not a staff account',
        });
        return;
      }
    } catch {
      clearPendingStudentLogin();
      toast({ variant: 'destructive', title: t.common.error, description: t.auth.loginError });
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setIsLoading(true);
    const result = await lovable.auth.signInWithOAuth('google', {
      redirect_uri: `${window.location.origin}/auth${codes[0] ? `?code=${codes[0]}` : ''}`,
    });
    if (result.error) {
      toast({
        variant: 'destructive',
        title: isRTL ? 'خطأ' : 'Error',
        description: isRTL ? 'فشل تسجيل الدخول بـ Google' : 'Google sign-in failed',
      });
      setIsLoading(false);
    }
  };

  // Parent registration handlers
  const addCodeField = () => { if (codes.length < 5) setCodes([...codes, '']); };
  const removeCodeField = (index: number) => { if (codes.length > 1) setCodes(codes.filter((_, i) => i !== index)); };
  const updateCode = (index: number, value: string) => {
    const upper = value.toUpperCase().replace(/[^A-Z0-9-]/g, '');
    const newCodes = [...codes];
    newCodes[index] = upper;
    setCodes(newCodes);
  };
  const handlePaste = (index: number, e: React.ClipboardEvent) => {
    const pasted = e.clipboardData.getData('text').trim();
    const parts = pasted.split(/[\s,\n]+/).filter(Boolean).map(p => p.toUpperCase().replace(/[^A-Z0-9-]/g, ''));
    if (parts.length > 1) {
      e.preventDefault();
      const newCodes = [...codes];
      newCodes.splice(index, 1, ...parts.slice(0, 5));
      setCodes(newCodes.slice(0, 5));
    }
  };

  const handleRegister = async () => {
    if (!fullName.trim()) {
      toast({ variant: 'destructive', title: isRTL ? 'خطأ' : 'Error', description: isRTL ? 'أدخل الاسم بالكامل' : 'Please enter your full name' });
      return;
    }
    setIsLoading(true);
    setLinkResults(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast({ variant: 'destructive', title: isRTL ? 'خطأ' : 'Error', description: isRTL ? 'سجل الدخول أولاً' : 'Please sign in first' });
        setIsLoading(false);
        return;
      }
      const validCodes = codes.filter(c => c.trim().length >= 8);
      const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
      const response = await fetch(`https://${projectId}.supabase.co/functions/v1/register-parent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` },
        body: JSON.stringify({
          codes: validCodes,
          profile: { full_name: fullName.trim(), full_name_ar: fullName.trim(), phone: phone.trim() || null, relationship },
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        if (data.details) setLinkResults(data.details);
        toast({ variant: 'destructive', title: isRTL ? 'خطأ' : 'Error', description: data.error || (isRTL ? 'حدث خطأ' : 'Something went wrong') });
      } else {
        if (data.details) setLinkResults(data.details);
        const msg = validCodes.length > 0
          ? (isRTL ? `تم التسجيل وربط ${data.linked} طالب` : `Registered & linked ${data.linked} student(s)`)
          : (isRTL ? 'تم التسجيل بنجاح! الإدارة هتربط أولادك قريباً' : 'Registered! Admin will link your children soon.');
        toast({ title: isRTL ? 'تم بنجاح!' : 'Success!', description: msg });
        setTimeout(() => { window.location.href = '/parent-pending'; }, 2000);
      }
    } catch {
      toast({ variant: 'destructive', title: isRTL ? 'خطأ' : 'Error', description: isRTL ? 'خطأ في الاتصال' : 'Connection error' });
    } finally {
      setIsLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'success': return <Badge className="bg-green-500"><CheckCircle className="h-3 w-3 mr-1" />{isRTL ? 'تم الربط' : 'Linked'}</Badge>;
      case 'invalid': return <Badge variant="destructive"><AlertCircle className="h-3 w-3 mr-1" />{isRTL ? 'كود غير صحيح' : 'Invalid code'}</Badge>;
      case 'expired': return <Badge variant="destructive"><AlertCircle className="h-3 w-3 mr-1" />{isRTL ? 'كود منتهي الصلاحية' : 'Code expired'}</Badge>;
      case 'already_used': return <Badge variant="destructive"><AlertCircle className="h-3 w-3 mr-1" />{isRTL ? 'كود مُستخدم بالفعل' : 'Already used'}</Badge>;
      default: return null;
    }
  };

  const ArrowIcon = isRTL ? ArrowLeft : ArrowRight;
  const BackArrow = isRTL ? ArrowRight : ArrowLeft;

  const goBack = () => {
    if (step === 'parent-register') {
      // Can't go back from registration if already signed in
      return;
    }
    setUserType(null);
    setStep('select');
    loginForm.reset();
  };

  const getTitle = () => {
    if (step === 'parent-register') return isRTL ? 'إكمال التسجيل' : 'Complete Registration';
    if (step === 'parent-google') return isRTL ? 'بوابة أولياء الأمور' : 'Parents Portal';
    if (step === 'login') return t.auth.welcomeBack;
    return isRTL ? 'تسجيل الدخول' : 'Sign In';
  };

  const getSubtitle = () => {
    if (step === 'parent-register') return isRTL ? 'أدخل بياناتك وكود الربط لمتابعة أولادك' : 'Fill your details and linking code';
    if (step === 'parent-google') return isRTL ? 'سجل دخولك بحساب Google لمتابعة أبنائك' : "Sign in with Google to follow your children's progress";
    if (step === 'login') return t.auth.loginSubtitle;
    return isRTL ? 'اختر نوع حسابك للمتابعة' : 'Choose your account type to continue';
  };

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center relative overflow-hidden"
      dir={isRTL ? 'rtl' : 'ltr'}
      style={{
        background: 'linear-gradient(160deg, #0a0a1a 0%, #0d0d2b 40%, #111133 70%, #0a0a1a 100%)',
        fontFamily: isRTL ? "'Cairo', sans-serif" : "'Poppins', sans-serif",
      }}
    >
      {/* Background glows */}
      <div style={{ position: 'absolute', width: 500, height: 500, top: -150, left: -100, background: 'rgba(100,85,240,.18)', borderRadius: '50%', filter: 'blur(100px)', pointerEvents: 'none' }} />
      <div style={{ position: 'absolute', width: 400, height: 400, bottom: -100, right: -80, background: 'rgba(97,186,226,.12)', borderRadius: '50%', filter: 'blur(100px)', pointerEvents: 'none' }} />
      <div style={{ position: 'absolute', width: 300, height: 300, top: '50%', left: '60%', background: 'rgba(97,186,226,.08)', borderRadius: '50%', filter: 'blur(80px)', pointerEvents: 'none' }} />
      <div className="absolute inset-0 opacity-[0.04]" style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, rgba(255,255,255,0.5) 1px, transparent 0)', backgroundSize: '40px 40px' }} />

      {/* Top bar */}
      <div className="absolute top-0 left-0 right-0 flex items-center justify-between px-6 py-4 z-20">
        <Link to={`/${language}`} className="flex items-center gap-2 text-white/60 hover:text-white transition-colors">
          {isRTL ? <ArrowRight className="w-4 h-4" /> : <ArrowLeft className="w-4 h-4" />}
          <img src={kojobotLogo} alt="Kojobot" className="h-8 object-contain" />
        </Link>
        <LanguageToggle />
      </div>

      {/* Main content */}
      <div className="relative z-10 w-full max-w-md px-6">
        <div className="text-center mb-8">
          <img src={kojobotLogo} alt="Kojobot" className="h-16 mx-auto mb-6 object-contain drop-shadow-lg" />
          <h1
            className="text-3xl font-bold mb-2"
            style={{
              background: 'linear-gradient(135deg, #a78bfa 0%, #818cf8 30%, #60a5fa 70%, #67e8f9 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
            }}
          >
            {getTitle()}
          </h1>
          <p className="text-white/50 text-sm">{getSubtitle()}</p>
        </div>

        {/* Glass card */}
        <div
          className="rounded-2xl p-8"
          style={{
            background: 'rgba(255,255,255,0.03)',
            border: '1px solid rgba(255,255,255,0.06)',
            backdropFilter: 'blur(20px)',
          }}
        >
          {step === 'select' && (
            <div className="space-y-3">
              {roleCards.map((card) => {
                const Icon = card.icon;
                return (
                  <button
                    key={card.type}
                    onClick={() => {
                      setUserType(card.type);
                      setStep(card.type === 'parent' ? 'parent-google' : 'login');
                    }}
                    className="w-full flex items-center gap-4 p-4 rounded-xl transition-all hover:scale-[1.02] active:scale-[0.98]"
                    style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', cursor: 'pointer' }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(100,85,240,0.12)'; e.currentTarget.style.borderColor = 'rgba(100,85,240,0.3)'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)'; }}
                  >
                    <div className="flex items-center justify-center w-12 h-12 rounded-xl" style={{ background: 'linear-gradient(135deg, rgba(100,85,240,0.2), rgba(97,186,226,0.2))' }}>
                      <Icon className="w-6 h-6 text-purple-400" />
                    </div>
                    <div className={`flex-1 ${isRTL ? 'text-right' : 'text-left'}`}>
                      <p className="text-white font-semibold text-base">{isRTL ? card.ar : card.en}</p>
                      <p className="text-white/40 text-xs mt-0.5">{isRTL ? card.descAr : card.descEn}</p>
                    </div>
                    <ArrowIcon className="w-4 h-4 text-white/30" />
                  </button>
                );
              })}
            </div>
          )}

          {step === 'parent-google' && (
            <div className="space-y-4">
              <button onClick={goBack} className="flex items-center gap-1 text-white/40 hover:text-white/70 text-sm transition-colors mb-2">
                <BackArrow className="w-4 h-4" />
                {isRTL ? 'رجوع' : 'Back'}
              </button>
              <Button
                onClick={handleGoogleSignIn}
                disabled={isLoading}
                className="w-full h-12 text-base font-semibold text-white border-0 transition-all hover:opacity-90 hover:scale-[1.02] active:scale-[0.98]"
                style={{ background: 'linear-gradient(135deg, #6455F0, #61BAE2)', borderRadius: 12, boxShadow: '0 4px 20px rgba(100,85,240,0.3)' }}
              >
                <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24">
                  <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
                  <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                  <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                  <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                </svg>
                {isLoading ? (isRTL ? 'جاري التحميل...' : 'Loading...') : (isRTL ? 'الدخول بحساب Google' : 'Sign in with Google')}
              </Button>
              <p className="text-white/30 text-xs text-center mt-4">
                {isRTL ? 'ستحتاج كود الربط الخاص بابنك للمتابعة' : "You will need your child's linking code to proceed"}
              </p>
            </div>
          )}

          {step === 'parent-register' && (
            <div className="space-y-5">
              {/* Signed in indicator */}
              <div className="flex items-center gap-2 text-white/50 text-sm">
                <CheckCircle className="h-4 w-4 text-green-400" />
                <span>{user?.email}</span>
              </div>

              {/* Personal info */}
              <div className="space-y-3">
                <div className="space-y-1">
                  <Label className="text-white/70 text-sm">{isRTL ? 'الاسم بالكامل' : 'Full Name'} *</Label>
                  <Input
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder={isRTL ? 'مثال: أحمد محمد' : 'e.g. Ahmed Mohamed'}
                    className="h-11 border-0 text-white placeholder:text-white/20 focus-visible:ring-1 focus-visible:ring-purple-500/50"
                    style={{ background: 'rgba(255,255,255,0.05)', borderRadius: 12 }}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-white/70 text-sm">{isRTL ? 'رقم الهاتف' : 'Phone Number'}</Label>
                  <Input
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder={isRTL ? 'مثال: 01xxxxxxxxx' : 'e.g. 01xxxxxxxxx'}
                    type="tel"
                    className="h-11 border-0 text-white placeholder:text-white/20 focus-visible:ring-1 focus-visible:ring-purple-500/50"
                    style={{ background: 'rgba(255,255,255,0.05)', borderRadius: 12 }}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-white/70 text-sm">{isRTL ? 'صلة القرابة' : 'Relationship'}</Label>
                  <Select value={relationship} onValueChange={setRelationship}>
                    <SelectTrigger className="h-11 border-0 text-white focus:ring-1 focus:ring-purple-500/50" style={{ background: 'rgba(255,255,255,0.05)', borderRadius: 12 }}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="father">{isRTL ? 'أب' : 'Father'}</SelectItem>
                      <SelectItem value="mother">{isRTL ? 'أم' : 'Mother'}</SelectItem>
                      <SelectItem value="guardian">{isRTL ? 'وصي' : 'Guardian'}</SelectItem>
                      <SelectItem value="parent">{isRTL ? 'ولي أمر' : 'Parent'}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Linking codes */}
              <div className="space-y-2">
                <Label className="text-white/70 text-sm">{isRTL ? 'كود الربط (اختياري)' : 'Linking Code (Optional)'}</Label>
                <p className="text-white/30 text-xs">
                  {isRTL ? 'لو عندك كود ربط من الأكاديمية، أدخله هنا. لو مش معاك كود، سجّل وهيتم ربط أولادك من الإدارة.' : "If you have a linking code, enter it. Otherwise, just register and admin will link your children."}
                </p>
                {codes.map((code, index) => (
                  <div key={index} className="flex gap-2 items-center">
                    <Input
                      value={code}
                      onChange={(e) => updateCode(index, e.target.value)}
                      onPaste={(e) => handlePaste(index, e)}
                      placeholder={isRTL ? 'مثال: KJB-A7X2-9P3M' : 'e.g. KJB-A7X2-9P3M'}
                      className="font-mono text-center tracking-wider h-11 border-0 text-white placeholder:text-white/20 focus-visible:ring-1 focus-visible:ring-purple-500/50"
                      style={{ background: 'rgba(255,255,255,0.05)', borderRadius: 12 }}
                      maxLength={14}
                    />
                    {codes.length > 1 && (
                      <button onClick={() => removeCodeField(index)} className="text-white/30 hover:text-white/60 p-1"><X className="h-4 w-4" /></button>
                    )}
                    {linkResults && (
                      <div>{getStatusBadge(linkResults.find(r => r.code === code)?.status || '')}</div>
                    )}
                  </div>
                ))}
                {codes.length < 5 && (
                  <button onClick={addCodeField} className="text-white/40 hover:text-white/60 text-xs flex items-center gap-1 transition-colors">
                    <Plus className="h-3 w-3" />
                    {isRTL ? 'إضافة كود آخر' : 'Add another code'}
                  </button>
                )}
              </div>

              <Button
                onClick={handleRegister}
                disabled={isLoading || !fullName.trim()}
                className="w-full h-12 text-base font-semibold text-white border-0 transition-all hover:opacity-90 hover:scale-[1.02] active:scale-[0.98]"
                style={{ background: 'linear-gradient(135deg, #6455F0, #61BAE2)', borderRadius: 12, boxShadow: '0 4px 20px rgba(100,85,240,0.3)' }}
              >
                {isLoading ? (
                  <span className="flex items-center gap-2"><Loader2 className="h-5 w-5 animate-spin" />{isRTL ? 'جاري التسجيل...' : 'Registering...'}</span>
                ) : (
                  codes.some(c => c.trim().length >= 8)
                    ? (isRTL ? 'تسجيل وربط الأكواد' : 'Register & Link Codes')
                    : (isRTL ? 'تسجيل بدون كود' : 'Register without Code')
                )}
              </Button>
            </div>
          )}

          {step === 'login' && (
            <div>
              <button onClick={goBack} className="flex items-center gap-1 text-white/40 hover:text-white/70 text-sm transition-colors mb-4">
                <BackArrow className="w-4 h-4" />
                {isRTL ? 'رجوع' : 'Back'}
              </button>
              <Form {...loginForm}>
                <form onSubmit={loginForm.handleSubmit(handleLogin)} className="space-y-5">
                  <FormField
                    control={loginForm.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-white/70 font-medium text-sm">{t.auth.email}</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <Mail className={`absolute top-1/2 -translate-y-1/2 h-4 w-4 text-white/30 ${isRTL ? 'right-4' : 'left-4'}`} />
                            <Input {...field} type="email" placeholder="email@example.com"
                              className={`h-12 text-base border-0 text-white placeholder:text-white/20 transition-all focus-visible:ring-1 focus-visible:ring-purple-500/50 ${isRTL ? 'pr-12 pl-4' : 'pl-12 pr-4'}`}
                              style={{ background: 'rgba(255,255,255,0.05)', borderRadius: 12 }} />
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={loginForm.control}
                    name="password"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-white/70 font-medium text-sm">{t.auth.password}</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <Lock className={`absolute top-1/2 -translate-y-1/2 h-4 w-4 text-white/30 ${isRTL ? 'right-4' : 'left-4'}`} />
                            <Input {...field} type={showPassword ? 'text' : 'password'} placeholder="••••••••"
                              className={`h-12 text-base border-0 text-white placeholder:text-white/20 transition-all focus-visible:ring-1 focus-visible:ring-purple-500/50 ${isRTL ? 'pr-12 pl-12' : 'pl-12 pr-12'}`}
                              style={{ background: 'rgba(255,255,255,0.05)', borderRadius: 12 }} />
                            <button type="button" onClick={() => setShowPassword(!showPassword)}
                              className={`absolute top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60 transition-colors p-1 ${isRTL ? 'left-3' : 'right-3'}`}>
                              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                            </button>
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <Button type="submit" disabled={isLoading}
                    className="w-full h-12 text-base font-semibold text-white border-0 transition-all hover:opacity-90 hover:scale-[1.02] active:scale-[0.98]"
                    style={{ background: 'linear-gradient(135deg, #6455F0, #61BAE2)', borderRadius: 12, boxShadow: '0 4px 20px rgba(100,85,240,0.3)' }}>
                    {isLoading ? (
                      <span className="flex items-center gap-2">
                        <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" /></svg>
                        {t.common.loading}
                      </span>
                    ) : (
                      <span className="flex items-center justify-center gap-2">{t.auth.login}<ArrowIcon className="w-4 h-4" /></span>
                    )}
                  </Button>
                </form>
              </Form>
            </div>
          )}
        </div>

        <p className="text-center text-xs text-white/25 mt-8">
          {isRTL ? `© ${new Date().getFullYear()} Kojobot. جميع الحقوق محفوظة.` : `© ${new Date().getFullYear()} Kojobot. All rights reserved.`}
        </p>
      </div>
    </div>
  );
}
