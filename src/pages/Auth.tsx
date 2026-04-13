import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Eye, EyeOff, Mail, Lock, ArrowLeft, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { LanguageToggle } from '@/components/LanguageToggle';
import kojobotLogo from '@/assets/kojobot-main-logo.png';

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});
type LoginFormData = z.infer<typeof loginSchema>;

export default function Auth() {
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user, signIn, loading, roleLoading } = useAuth();
  const { t, isRTL, language } = useLanguage();

  useEffect(() => {
    if (!loading && !roleLoading && user) {
      navigate('/dashboard');
    }
  }, [user, loading, roleLoading, navigate]);

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

  const ArrowIcon = isRTL ? ArrowLeft : ArrowRight;

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center relative overflow-hidden"
      dir={isRTL ? 'rtl' : 'ltr'}
      style={{
        background: 'linear-gradient(160deg, #0a0a1a 0%, #0d0d2b 40%, #111133 70%, #0a0a1a 100%)',
        fontFamily: isRTL ? "'Cairo', sans-serif" : "'Poppins', sans-serif",
      }}
    >
      {/* Background glows - matching landing */}
      <div
        style={{
          position: 'absolute',
          width: 500,
          height: 500,
          top: -150,
          left: -100,
          background: 'rgba(100,85,240,.18)',
          borderRadius: '50%',
          filter: 'blur(100px)',
          pointerEvents: 'none',
        }}
      />
      <div
        style={{
          position: 'absolute',
          width: 400,
          height: 400,
          bottom: -100,
          right: -80,
          background: 'rgba(97,186,226,.12)',
          borderRadius: '50%',
          filter: 'blur(100px)',
          pointerEvents: 'none',
        }}
      />
      <div
        style={{
          position: 'absolute',
          width: 300,
          height: 300,
          top: '50%',
          left: '60%',
          background: 'rgba(97,186,226,.08)',
          borderRadius: '50%',
          filter: 'blur(80px)',
          pointerEvents: 'none',
        }}
      />

      {/* Dot grid overlay */}
      <div
        className="absolute inset-0 opacity-[0.04]"
        style={{
          backgroundImage: 'radial-gradient(circle at 1px 1px, rgba(255,255,255,0.5) 1px, transparent 0)',
          backgroundSize: '40px 40px',
        }}
      />

      {/* Top bar - Language toggle + back to home */}
      <div className="absolute top-0 left-0 right-0 flex items-center justify-between px-6 py-4 z-20">
        <Link
          to={`/${language}`}
          className="flex items-center gap-2 text-white/60 hover:text-white transition-colors"
        >
          {isRTL ? <ArrowRight className="w-4 h-4" /> : <ArrowLeft className="w-4 h-4" />}
          <img src={kojobotLogo} alt="Kojobot" className="h-8 object-contain" />
        </Link>
        <LanguageToggle />
      </div>

      {/* Login card */}
      <div className="relative z-10 w-full max-w-md px-6">
        {/* Logo */}
        <div className="text-center mb-8">
          <img
            src={kojobotLogo}
            alt="Kojobot"
            className="h-16 mx-auto mb-6 object-contain drop-shadow-lg"
          />
          <h1
            className="text-3xl font-bold mb-2"
            style={{
              background: 'linear-gradient(135deg, #a78bfa 0%, #818cf8 30%, #60a5fa 70%, #67e8f9 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
            }}
          >
            {t.auth.welcomeBack}
          </h1>
          <p className="text-white/50 text-sm">
            {t.auth.loginSubtitle}
          </p>
        </div>

        {/* Form card with glass effect */}
        <div
          className="rounded-2xl p-8"
          style={{
            background: 'rgba(255,255,255,0.03)',
            border: '1px solid rgba(255,255,255,0.06)',
            backdropFilter: 'blur(20px)',
          }}
        >
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
                        <Mail
                          className={`absolute top-1/2 -translate-y-1/2 h-4 w-4 text-white/30 ${isRTL ? 'right-4' : 'left-4'}`}
                        />
                        <Input
                          {...field}
                          type="email"
                          placeholder="email@example.com"
                          className={`h-12 text-base border-0 text-white placeholder:text-white/20 transition-all focus-visible:ring-1 focus-visible:ring-purple-500/50 ${isRTL ? 'pr-12 pl-4' : 'pl-12 pr-4'}`}
                          style={{
                            background: 'rgba(255,255,255,0.05)',
                            borderRadius: 12,
                          }}
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
                        <Lock
                          className={`absolute top-1/2 -translate-y-1/2 h-4 w-4 text-white/30 ${isRTL ? 'right-4' : 'left-4'}`}
                        />
                        <Input
                          {...field}
                          type={showPassword ? 'text' : 'password'}
                          placeholder="••••••••"
                          className={`h-12 text-base border-0 text-white placeholder:text-white/20 transition-all focus-visible:ring-1 focus-visible:ring-purple-500/50 ${isRTL ? 'pr-12 pl-12' : 'pl-12 pr-12'}`}
                          style={{
                            background: 'rgba(255,255,255,0.05)',
                            borderRadius: 12,
                          }}
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
