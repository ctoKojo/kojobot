import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import { LanguageToggle } from '@/components/LanguageToggle';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Monitor, BookOpen, BarChart3, Award, Star, Code, Cpu, Rocket,
  GraduationCap, Zap, Trophy, ArrowRight, ArrowLeft, Check,
  Smartphone, Globe, Gamepad2, Brain, Shield, Glasses,
  CircuitBoard, Wifi, Home, Timer, PcCase,
  GitFork, MapPin, Phone, Mail, Sparkles,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { LandingHero } from '@/components/landing/LandingHero';
import { LandingFeatures } from '@/components/landing/LandingFeatures';
import { LandingTracks } from '@/components/landing/LandingTracks';
import { LandingPlans } from '@/components/landing/LandingPlans';
import { LandingFooter } from '@/components/landing/LandingFooter';

export default function Index() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const { language, isRTL } = useLanguage();

  useEffect(() => {
    if (!loading && user) navigate('/dashboard', { replace: true });
  }, [user, loading, navigate]);

  const { data: content, isLoading } = useQuery({
    queryKey: ['landing-content'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_landing_content');
      if (error) throw error;
      return data as any;
    },
    staleTime: 5 * 60 * 1000,
  });

  const s = content?.settings || {};
  const features = content?.features || [];
  const plans = content?.plans || [];
  const tracks = content?.tracks || [];

  const t = (ar: string, en: string) => language === 'ar' ? ar : en;

  if (loading || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center kojo-gradient">
        <div className="w-12 h-12 border-4 border-white/30 border-t-white rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className={cn("min-h-screen bg-background text-foreground overflow-x-hidden", isRTL && "rtl")}>
      {/* Navbar */}
      <nav className="fixed top-0 inset-x-0 z-50 backdrop-blur-xl bg-background/70 border-b border-border/40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src="/kojobot-logo-white.png" alt="Kojobot" className="h-8 invert dark:invert-0" />
          </div>
          <div className="flex items-center gap-2 sm:gap-3">
            <LanguageToggle />
            <Button
              onClick={() => navigate('/auth')}
              className="kojo-gradient text-white border-0 hover:opacity-90 transition-all duration-300 shadow-lg shadow-primary/25 hover:shadow-xl hover:shadow-primary/30 hover:-translate-y-0.5"
            >
              {s.cta_text_ar && s.cta_text_en ? t(s.cta_text_ar, s.cta_text_en) : t('تسجيل الدخول', 'Login')}
            </Button>
          </div>
        </div>
      </nav>

      <LandingHero settings={s} t={t} isRTL={isRTL} onNavigate={navigate} />
      <LandingFeatures features={features} t={t} />
      <LandingTracks tracks={tracks} t={t} isRTL={isRTL} />
      <LandingPlans plans={plans} t={t} />
      <LandingFooter settings={s} t={t} />
    </div>
  );
}
