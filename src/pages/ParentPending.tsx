import { useEffect } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { Clock, LogOut, ArrowLeft, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Link, useNavigate } from 'react-router-dom';
import { LanguageToggle } from '@/components/LanguageToggle';
import { supabase } from '@/integrations/supabase/client';
import { resetStatusCache } from '@/components/ProtectedRoute';
import kojobotLogo from '@/assets/kojobot-main-logo.png';

export default function ParentPending() {
  const { isRTL, language } = useLanguage();
  const { signOut, user } = useAuth();
  const navigate = useNavigate();

  // Poll for approval status every 10s and refresh when approved
  useEffect(() => {
    if (!user) return;

    const checkApproval = async () => {
      const { data } = await supabase
        .from('profiles')
        .select('is_approved')
        .eq('user_id', user.id)
        .maybeSingle();

      if (data?.is_approved === true) {
        resetStatusCache();
        navigate('/dashboard', { replace: true });
      }
    };

    // Check immediately on mount
    checkApproval();

    const interval = setInterval(checkApproval, 10_000);
    return () => clearInterval(interval);
  }, [user, navigate]);

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
            {isRTL ? 'حسابك قيد المراجعة' : 'Account Under Review'}
          </h1>
          <p className="text-white/50 text-sm">
            {isRTL ? 'شكراً لتسجيلك، سيتم إخطارك فور التفعيل' : 'Thank you for registering, you will be notified once activated'}
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
          <div className="flex flex-col items-center text-center space-y-6">
            <div
              className="w-16 h-16 rounded-xl flex items-center justify-center"
              style={{ background: 'linear-gradient(135deg, rgba(251,191,36,0.2), rgba(245,158,11,0.2))' }}
            >
              <Clock className="h-8 w-8 text-amber-400" />
            </div>

            <p className="text-white/60 text-sm leading-relaxed">
              {isRTL
                ? 'تم استلام طلب تسجيلك بنجاح. سيتم مراجعة حسابك من قبل الإدارة وإخطارك فور التفعيل.'
                : 'Your registration request has been received. Your account will be reviewed by the administration and you will be notified once activated.'}
            </p>

            <Button
              onClick={() => signOut()}
              className="w-full h-12 text-base font-semibold text-white border-0 transition-all hover:opacity-90 hover:scale-[1.02] active:scale-[0.98]"
              style={{ background: 'linear-gradient(135deg, #6455F0, #61BAE2)', borderRadius: 12, boxShadow: '0 4px 20px rgba(100,85,240,0.3)' }}
            >
              <LogOut className="h-5 w-5" />
              {isRTL ? 'تسجيل الخروج' : 'Sign Out'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
