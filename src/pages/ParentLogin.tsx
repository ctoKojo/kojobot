import { useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { LanguageToggle } from '@/components/LanguageToggle';
import { lovable } from '@/integrations/lovable/index';
import { useToast } from '@/hooks/use-toast';
import kojobotLogo from '@/assets/kojobot-main-logo.png';

export default function ParentLogin() {
  const navigate = useNavigate();
  const { user, role, loading, roleLoading } = useAuth();
  const { isRTL, language } = useLanguage();
  const { toast } = useToast();

  useEffect(() => {
    if (loading || roleLoading) return;

    if (user && role === 'parent') {
      navigate('/dashboard', { replace: true });
    } else if (user && role && role !== 'parent') {
      navigate('/dashboard', { replace: true });
    } else if (user && !role) {
      navigate('/parent-register', { replace: true });
    }
  }, [user, role, loading, roleLoading, navigate]);

  const handleGoogleSignIn = async () => {
    const result = await lovable.auth.signInWithOAuth('google', {
      redirect_uri: `${window.location.origin}/parent-register`,
    });

    if (result.error) {
      toast({
        variant: 'destructive',
        title: isRTL ? 'خطأ' : 'Error',
        description: isRTL ? 'فشل تسجيل الدخول بـ Google' : 'Google sign-in failed',
      });
    }
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
        className="absolute inset-0 opacity-[0.04]"
        style={{
          backgroundImage: 'radial-gradient(circle at 1px 1px, rgba(255,255,255,0.5) 1px, transparent 0)',
          backgroundSize: '40px 40px',
        }}
      />

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
            {isRTL ? 'بوابة أولياء الأمور' : 'Parents Portal'}
          </h1>
          <p className="text-white/50 text-sm">
            {isRTL ? 'سجل دخولك بحساب Google لمتابعة أبنائك' : "Sign in with Google to follow your children's progress"}
          </p>
        </div>

        <div
          className="rounded-2xl p-8"
          style={{
            background: 'rgba(255,255,255,0.03)',
            border: '1px solid rgba(255,255,255,0.06)',
            backdropFilter: 'blur(20px)',
          }}
        >
          <Button
            onClick={handleGoogleSignIn}
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
            {isRTL ? 'الدخول بحساب Google' : 'Sign in with Google'}
          </Button>

          <div className="mt-6 text-center">
            <p className="text-white/30 text-xs">
              {isRTL ? 'ستحتاج كود الربط الخاص بابنك للمتابعة' : "You will need your child's linking code to proceed"}
            </p>
          </div>
        </div>

        <p className="text-center text-xs text-white/25 mt-8">
          {isRTL
            ? `© ${new Date().getFullYear()} Kojobot. جميع الحقوق محفوظة.`
            : `© ${new Date().getFullYear()} Kojobot. All rights reserved.`}
        </p>
      </div>
    </div>
  );
}
