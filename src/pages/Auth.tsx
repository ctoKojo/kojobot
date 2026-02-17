import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Eye, EyeOff, Mail, Lock, Sparkles, BookOpen, Award } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { LanguageToggle } from '@/components/LanguageToggle';
// Use public path for LCP image (discoverable from initial HTML)
const kojobotLogoWhite = '/kojobot-logo-white.png';
// Use the original icon - displayed at 64x64, so dimensions are set correctly
import kojobotIcon from '@/assets/kojobot-icon.png';
const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6)
});
type LoginFormData = z.infer<typeof loginSchema>;
export default function Auth() {
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();
  const {
    toast
  } = useToast();
  const {
    user,
    signIn
  } = useAuth();
  const {
    t,
    isRTL
  } = useLanguage();
  const loginForm = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: '',
      password: ''
    }
  });
  useEffect(() => {
    if (user) {
      navigate('/dashboard');
    }
  }, [user, navigate]);
  const handleLogin = async (data: LoginFormData) => {
    setIsLoading(true);
    try {
      const {
        error
      } = await signIn(data.email, data.password);
      if (error) {
        toast({
          variant: 'destructive',
          title: t.common.error,
          description: t.auth.loginError
        });
      }
    } catch (error) {
      toast({
        variant: 'destructive',
        title: t.common.error,
        description: t.auth.loginError
      });
    } finally {
      setIsLoading(false);
    }
  };
  return <div className="min-h-screen flex" dir={isRTL ? 'rtl' : 'ltr'}>
      {/* Left Side - Brand Panel (Desktop Only) */}
      <div className="hidden lg:flex lg:w-1/2 xl:w-[55%] relative overflow-hidden">
        {/* Gradient Background - matching brand gradient */}
        <div className="absolute inset-0" style={{
        background: 'linear-gradient(135deg, #4EDDEA 0%, #6878F0 25%, #6455F0 50%, #5B8DEE 75%, #4EDDEA 100%)'
      }} />
        
        {/* Animated Background Shapes */}
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute -top-20 -right-20 w-96 h-96 rounded-full bg-white/10 blur-3xl animate-pulse" />
          <div className="absolute -bottom-32 -left-32 w-80 h-80 rounded-full bg-white/10 blur-3xl animate-pulse" style={{
          animationDelay: '1s'
        }} />
          <div className="absolute top-1/4 left-1/4 w-24 h-24 rounded-full bg-white/5 animate-bounce" style={{
          animationDuration: '3s'
        }} />
          <div className="absolute top-2/3 right-1/4 w-16 h-16 rounded-full bg-white/5 animate-bounce" style={{
          animationDuration: '4s',
          animationDelay: '0.5s'
        }} />
          <div className="absolute top-1/2 left-1/3 w-12 h-12 rounded-full bg-white/5 animate-bounce" style={{
          animationDuration: '5s',
          animationDelay: '1s'
        }} />
        </div>

        {/* Grid Pattern Overlay */}
        <div className="absolute inset-0 opacity-10" style={{
        backgroundImage: 'radial-gradient(circle at 1px 1px, white 1px, transparent 0)',
        backgroundSize: '40px 40px'
      }} />
        
        {/* Content */}
        <div className="relative z-10 flex flex-col items-center justify-center w-full p-12">
          <img src={kojobotLogoWhite} alt="Kojobot" width={320} height={110} fetchPriority="high" decoding="async" className="w-72 xl:w-80 mb-12 drop-shadow-2xl animate-fade-in" />
          
          <div className="text-center text-white space-y-4 max-w-md animate-fade-in" style={{
          animationDelay: '0.2s'
        }}>
            <h2 className="text-3xl xl:text-4xl font-bold leading-tight">
              {isRTL ? 'ابدأ رحلتك في البرمجة' : 'Start Your Coding Journey'}
            </h2>
            <p className="text-lg xl:text-xl text-white/80 leading-relaxed">
              {isRTL ? 'منصة تعليمية متكاملة لتعليم البرمجة للأطفال والناشئين' : 'A complete platform for teaching programming to kids and teens'}
            </p>
          </div>

          <div className="mt-12 grid grid-cols-3 gap-6 text-white/90 animate-fade-in" style={{
          animationDelay: '0.4s'
        }}>
            <div className="text-center">
              <div className="w-14 h-14 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center mx-auto mb-3 shadow-lg">
                <Sparkles className="w-7 h-7" />
              </div>
              <p className="text-sm font-medium">{isRTL ? 'تعلم تفاعلي' : 'Interactive Learning'}</p>
            </div>
            <div className="text-center">
              <div className="w-14 h-14 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center mx-auto mb-3 shadow-lg">
                <BookOpen className="w-7 h-7" />
              </div>
              <p className="text-sm font-medium">{isRTL ? 'مناهج متنوعة' : 'Rich Curriculum'}</p>
            </div>
            <div className="text-center">
              <div className="w-14 h-14 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center mx-auto mb-3 shadow-lg">
                <Award className="w-7 h-7" />
              </div>
              <p className="text-sm font-medium">{isRTL ? 'شهادات معتمدة' : 'Certificates'}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Right Side - Login Form (Desktop) / Full Screen (Mobile) */}
      <div className="w-full lg:w-1/2 xl:w-[45%] flex flex-col bg-background relative overflow-hidden">
        
        {/* Mobile: Full gradient background with decorations */}
        <div className="lg:hidden absolute inset-0">
          <div className="absolute inset-0" style={{
          background: 'linear-gradient(160deg, #4EDDEA 0%, #6878F0 30%, #6455F0 60%, #5B8DEE 100%)'
        }} />
          {/* Decorative shapes */}
          <div className="absolute -top-24 -right-24 w-48 h-48 rounded-full bg-white/10 blur-2xl" />
          <div className="absolute top-1/3 -left-16 w-32 h-32 rounded-full bg-white/10 blur-2xl" />
          <div className="absolute -bottom-20 right-1/4 w-40 h-40 rounded-full bg-white/10 blur-2xl" />
        </div>

        {/* Mobile Header - Logo and tagline */}
        <div className="lg:hidden relative z-10 pt-12 pb-6 px-6 text-center">
          <img src={kojobotLogoWhite} alt="Kojobot" width={232} height={80} fetchPriority="high" decoding="async" className="h-20 mx-auto mb-4 drop-shadow-lg animate-fade-in object-contain" />
          
        </div>

        {/* Language Toggle - positioned in top corner */}
        <div className="absolute top-4 right-4 z-20 lg:top-6 lg:right-6">
          <div className="lg:block">
            <LanguageToggle />
          </div>
          {/* Mobile: White background pill for visibility */}
          <div className="lg:hidden absolute inset-0 -z-10 bg-white/20 backdrop-blur-sm rounded-full scale-110" />
        </div>

        {/* Mobile: Card container for the form */}
        <div className="lg:hidden relative z-10 flex-1 flex flex-col px-5 pb-6 animate-fade-in" style={{
        animationDelay: '0.2s'
      }}>
          <div className="flex-1 flex items-start pt-2">
            <div className="w-full bg-background rounded-3xl shadow-2xl p-6 space-y-6">
              {/* Welcome text */}
              <div className="text-center space-y-1">
                <img src={kojobotIcon} alt="Kojobot" width={64} height={64} loading="lazy" decoding="async" className="w-16 h-16 mx-auto mb-4 rounded-2xl shadow-lg" />
                <h1 className="text-xl font-bold text-foreground">
                  {t.auth.welcomeBack}
                </h1>
                <p className="text-sm text-muted-foreground">
                  {t.auth.loginSubtitle}
                </p>
              </div>

              {/* Login Form - Mobile */}
              <Form {...loginForm}>
                <form onSubmit={loginForm.handleSubmit(handleLogin)} className="space-y-4">
                  <FormField control={loginForm.control} name="email" render={({
                  field
                }) => <FormItem>
                        <FormLabel className="text-foreground font-medium text-sm">{t.auth.email}</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <Mail className={`absolute top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground ${isRTL ? 'right-3' : 'left-3'}`} />
                            <Input {...field} type="email" placeholder="email@example.com" className={`h-11 text-base rounded-xl border-2 bg-muted/50 transition-all focus:border-primary/50 focus:bg-background ${isRTL ? 'pr-10 pl-3' : 'pl-10 pr-3'}`} />
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>} />

                  <FormField control={loginForm.control} name="password" render={({
                  field
                }) => <FormItem>
                        <FormLabel className="text-foreground font-medium text-sm">{t.auth.password}</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <Lock className={`absolute top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground ${isRTL ? 'right-3' : 'left-3'}`} />
                            <Input {...field} type={showPassword ? 'text' : 'password'} placeholder="••••••••" className={`h-11 text-base rounded-xl border-2 bg-muted/50 transition-all focus:border-primary/50 focus:bg-background ${isRTL ? 'pr-10 pl-10' : 'pl-10 pr-10'}`} />
                            <button type="button" onClick={() => setShowPassword(!showPassword)} aria-label={showPassword ? 'Hide password' : 'Show password'} className={`absolute top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors p-1.5 min-w-6 min-h-6 flex items-center justify-center ${isRTL ? 'left-2' : 'right-2'}`}>
                              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                            </button>
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>} />

                  <Button type="submit" className="w-full h-12 text-base font-semibold rounded-xl bg-gradient-to-r from-[#61BAE2] to-[#6455F0] hover:opacity-90 transition-all shadow-lg active:scale-[0.98]" disabled={isLoading}>
                    {isLoading ? <span className="flex items-center gap-2">
                        <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                        </svg>
                        {t.common.loading}
                      </span> : t.auth.login}
                  </Button>
                </form>
              </Form>

              {/* Footer */}
              <p className="text-center text-xs text-muted-foreground pt-2">
                {isRTL ? `© ${new Date().getFullYear()} Kojobot. جميع الحقوق محفوظة.` : `© ${new Date().getFullYear()} Kojobot. All rights reserved.`}
              </p>
            </div>
          </div>

          {/* Mobile: Feature badges at bottom */}
          <div className="flex justify-center gap-4 pt-4">
            <div className="flex items-center gap-1.5 bg-white/20 backdrop-blur-sm rounded-full px-3 py-1.5">
              <Sparkles className="w-3.5 h-3.5 text-white" />
              <span className="text-xs text-white font-medium">{isRTL ? 'تفاعلي' : 'Interactive'}</span>
            </div>
            <div className="flex items-center gap-1.5 bg-white/20 backdrop-blur-sm rounded-full px-3 py-1.5">
              <BookOpen className="w-3.5 h-3.5 text-white" />
              <span className="text-xs text-white font-medium">{isRTL ? 'ممتع' : 'Fun'}</span>
            </div>
            <div className="flex items-center gap-1.5 bg-white/20 backdrop-blur-sm rounded-full px-3 py-1.5">
              <Award className="w-3.5 h-3.5 text-white" />
              <span className="text-xs text-white font-medium">{isRTL ? 'معتمد' : 'Certified'}</span>
            </div>
          </div>
        </div>

        {/* Desktop Form Container */}
        <div className="hidden lg:flex flex-1 items-center justify-center p-6 sm:p-8 lg:p-12">
          <div className="w-full max-w-md space-y-8">
            {/* Header */}
            <div className="text-center lg:text-start space-y-2">
              <div className="hidden lg:block mb-6">
                <img src={kojobotIcon} alt="Kojobot" width={64} height={64} loading="lazy" decoding="async" className="w-16 h-16 rounded-2xl shadow-lg" />
              </div>
              <h1 className="text-2xl sm:text-3xl font-bold text-foreground">
                {t.auth.welcomeBack}
              </h1>
              <p className="text-muted-foreground">
                {t.auth.loginSubtitle}
              </p>
            </div>

            {/* Login Form - Desktop */}
            <Form {...loginForm}>
              <form onSubmit={loginForm.handleSubmit(handleLogin)} className="space-y-5">
                <FormField control={loginForm.control} name="email" render={({
                field
              }) => <FormItem>
                      <FormLabel className="text-foreground font-medium">{t.auth.email}</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Mail className={`absolute top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground ${isRTL ? 'right-4' : 'left-4'}`} />
                          <Input {...field} type="email" placeholder="email@example.com" className={`h-12 text-base border-2 transition-all focus:border-primary/50 ${isRTL ? 'pr-12 pl-4' : 'pl-12 pr-4'}`} />
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>} />

                <FormField control={loginForm.control} name="password" render={({
                field
              }) => <FormItem>
                      <FormLabel className="text-foreground font-medium">{t.auth.password}</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Lock className={`absolute top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground ${isRTL ? 'right-4' : 'left-4'}`} />
                          <Input {...field} type={showPassword ? 'text' : 'password'} placeholder="••••••••" className={`h-12 text-base border-2 transition-all focus:border-primary/50 ${isRTL ? 'pr-12 pl-12' : 'pl-12 pr-12'}`} />
                          <button type="button" onClick={() => setShowPassword(!showPassword)} aria-label={showPassword ? 'Hide password' : 'Show password'} className={`absolute top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors p-1 min-w-6 min-h-6 flex items-center justify-center ${isRTL ? 'left-4' : 'right-4'}`}>
                            {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                          </button>
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>} />

                <Button type="submit" className="w-full h-12 text-base font-semibold bg-gradient-to-r from-[#61BAE2] to-[#6455F0] hover:opacity-90 transition-all shadow-lg hover:shadow-xl hover:scale-[1.02] active:scale-[0.98]" disabled={isLoading}>
                  {isLoading ? <span className="flex items-center gap-2">
                      <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      {t.common.loading}
                    </span> : t.auth.login}
                </Button>
              </form>
            </Form>

            {/* Footer */}
            <div className="pt-6 text-center">
              <p className="text-sm text-muted-foreground">
                {isRTL ? `© ${new Date().getFullYear()} Kojobot. جميع الحقوق محفوظة.` : `© ${new Date().getFullYear()} Kojobot. All rights reserved.`}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>;
}