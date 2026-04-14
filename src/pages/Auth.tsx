import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Eye, EyeOff, Mail, Lock, ArrowLeft, ArrowRight, GraduationCap, Briefcase, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { LanguageToggle } from '@/components/LanguageToggle';
import { lovable } from '@/integrations/lovable/index';
import kojobotLogo from '@/assets/kojobot-main-logo.png';

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});
type LoginFormData = z.infer<typeof loginSchema>;

type UserType = 'student' | 'staff' | 'parent' | null;

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
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user, role, signIn, loading, roleLoading } = useAuth();
  const { t, isRTL, language } = useLanguage();

  useEffect(() => {
    if (loading || roleLoading) return;
    if (user && role) {
      navigate('/dashboard', { replace: true });
    } else if (user && !role && userType === 'parent') {
      navigate('/parent-register', { replace: true });
    }
  }, [user, role, loading, roleLoading, navigate, userType]);

  const loginForm = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  });

  const handleLogin = async (data: LoginFormData) => {
    setIsLoading(true);
    try {
      const { error } = await signIn(data.email, data.password);
      if (error) {
        toast({ variant: 'destructive', title: t.common.error, description: t.auth.loginError });
      }
    } catch {
      toast({ variant: 'destructive', title: t.common.error, description: t.auth.loginError });
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setIsLoading(true);
    const result = await lovable.auth.signInWithOAuth('google', {
      redirect_uri: `${window.location.origin}/parent-register`,
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

  const ArrowIcon = isRTL ? ArrowLeft : ArrowRight;
  const BackArrow = isRTL ? ArrowRight : ArrowLeft;

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
        {/* Logo */}
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
            {userType ? t.auth.welcomeBack : (isRTL ? 'تسجيل الدخول' : 'Sign In')}
          </h1>
          <p className="text-white/50 text-sm">
            {userType
              ? (userType === 'parent'
                ? (isRTL ? 'سجل دخولك بحساب Google لمتابعة أبنائك' : "Sign in with Google to follow your children's progress")
                : t.auth.loginSubtitle)
              : (isRTL ? 'اختر نوع حسابك للمتابعة' : 'Choose your account type to continue')}
          </p>
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
          {!userType ? (
            /* Role selection cards */
            <div className="space-y-3">
              {roleCards.map((card) => {
                const Icon = card.icon;
                return (
                  <button
                    key={card.type}
                    onClick={() => setUserType(card.type)}
                    className="w-full flex items-center gap-4 p-4 rounded-xl transition-all hover:scale-[1.02] active:scale-[0.98]"
                    style={{
                      background: 'rgba(255,255,255,0.04)',
                      border: '1px solid rgba(255,255,255,0.08)',
                      cursor: 'pointer',
                    }}
                    onMouseEnter={(e) => {
                      (e.currentTarget as HTMLElement).style.background = 'rgba(100,85,240,0.12)';
                      (e.currentTarget as HTMLElement).style.borderColor = 'rgba(100,85,240,0.3)';
                    }}
                    onMouseLeave={(e) => {
                      (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.04)';
                      (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.08)';
                    }}
                  >
                    <div
                      className="flex items-center justify-center w-12 h-12 rounded-xl"
                      style={{ background: 'linear-gradient(135deg, rgba(100,85,240,0.2), rgba(97,186,226,0.2))' }}
                    >
                      <Icon className="w-6 h-6 text-purple-400" />
                    </div>
                    <div className={`flex-1 ${isRTL ? 'text-right' : 'text-left'}`}>
                      <p className="text-white font-semibold text-base">
                        {isRTL ? card.ar : card.en}
                      </p>
                      <p className="text-white/40 text-xs mt-0.5">
                        {isRTL ? card.descAr : card.descEn}
                      </p>
                    </div>
                    <ArrowIcon className="w-4 h-4 text-white/30" />
                  </button>
                );
              })}
            </div>
          ) : userType === 'parent' ? (
            /* Google sign-in for parents */
            <div className="space-y-4">
              <button
                onClick={() => setUserType(null)}
                className="flex items-center gap-1 text-white/40 hover:text-white/70 text-sm transition-colors mb-2"
              >
                <BackArrow className="w-4 h-4" />
                {isRTL ? 'رجوع' : 'Back'}
              </button>

              <Button
                onClick={handleGoogleSignIn}
                disabled={isLoading}
                className="w-full h-12 text-base font-semibold text-white border-0 transition-all hover:opacity-90 hover:scale-[1.02] active:scale-[0.98]"
                style={{
                  background: 'linear-gradient(135deg, #6455F0, #61BAE2)',
                  borderRadius: 12,
                  boxShadow: '0 4px 20px rgba(100,85,240,0.3)',
                }}
              >
                <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24">
                  <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
                  <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                  <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                  <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                </svg>
                {isLoading
                  ? (isRTL ? 'جاري التحميل...' : 'Loading...')
                  : (isRTL ? 'الدخول بحساب Google' : 'Sign in with Google')}
              </Button>

              <p className="text-white/30 text-xs text-center mt-4">
                {isRTL ? 'ستحتاج كود الربط الخاص بابنك للمتابعة' : "You will need your child's linking code to proceed"}
              </p>
            </div>
          ) : (
            /* Email/password form for student & staff */
            <div>
              <button
                onClick={() => { setUserType(null); loginForm.reset(); }}
                className="flex items-center gap-1 text-white/40 hover:text-white/70 text-sm transition-colors mb-4"
              >
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
                            <Input
                              {...field}
                              type="email"
                              placeholder="email@example.com"
                              className={`h-12 text-base border-0 text-white placeholder:text-white/20 transition-all focus-visible:ring-1 focus-visible:ring-purple-500/50 ${isRTL ? 'pr-12 pl-4' : 'pl-12 pr-4'}`}
                              style={{ background: 'rgba(255,255,255,0.05)', borderRadius: 12 }}
                            />
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
                            <Input
                              {...field}
                              type={showPassword ? 'text' : 'password'}
                              placeholder="••••••••"
                              className={`h-12 text-base border-0 text-white placeholder:text-white/20 transition-all focus-visible:ring-1 focus-visible:ring-purple-500/50 ${isRTL ? 'pr-12 pl-12' : 'pl-12 pr-12'}`}
                              style={{ background: 'rgba(255,255,255,0.05)', borderRadius: 12 }}
                            />
                            <button
                              type="button"
                              onClick={() => setShowPassword(!showPassword)}
                              aria-label={showPassword ? 'Hide password' : 'Show password'}
                              className={`absolute top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60 transition-colors p-1 ${isRTL ? 'left-3' : 'right-3'}`}
                            >
                              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                            </button>
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <Button
                    type="submit"
                    disabled={isLoading}
                    className="w-full h-12 text-base font-semibold text-white border-0 transition-all hover:opacity-90 hover:scale-[1.02] active:scale-[0.98]"
                    style={{
                      background: 'linear-gradient(135deg, #6455F0, #61BAE2)',
                      borderRadius: 12,
                      boxShadow: '0 4px 20px rgba(100,85,240,0.3)',
                    }}
                  >
                    {isLoading ? (
                      <span className="flex items-center gap-2">
                        <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                        </svg>
                        {t.common.loading}
                      </span>
                    ) : (
                      <span className="flex items-center justify-center gap-2">
                        {t.auth.login}
                        <ArrowIcon className="w-4 h-4" />
                      </span>
                    )}
                  </Button>
                </form>
              </Form>
            </div>
          )}
        </div>

        {/* Footer */}
        <p className="text-center text-xs text-white/25 mt-8">
          {isRTL
            ? `© ${new Date().getFullYear()} Kojobot. جميع الحقوق محفوظة.`
            : `© ${new Date().getFullYear()} Kojobot. All rights reserved.`}
        </p>
      </div>
    </div>
  );
}
