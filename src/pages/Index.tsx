import { useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import { LanguageToggle } from '@/components/LanguageToggle';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import {
  Monitor, BookOpen, BarChart3, Award, Star, Code, Cpu, Rocket,
  GraduationCap, Zap, Trophy, ArrowRight, ArrowLeft, Check,
  Smartphone, Globe, Gamepad2, Brain, Shield, Glasses,
  CircuitBoard, Wifi, Home, Timer, PcCase,
  GitFork, ChevronRight, MapPin, Phone, Mail,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  Monitor, BookOpen, BarChart3, Award, Star, Code, Cpu, Rocket,
  GraduationCap, Zap, Trophy, Check, Smartphone, Globe,
  Gamepad2, Brain, Shield, Glasses, CircuitBoard, Wifi,
  Home, Timer, PcCase, GitFork,
};

const SOCIAL_ICON_MAP: Record<string, string> = {
  facebook: '📘', instagram: '📸', twitter: '🐦', youtube: '📺',
  linkedin: '💼', tiktok: '🎵', whatsapp: '💬',
};

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
  const Arrow = isRTL ? ArrowLeft : ArrowRight;

  if (loading || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center kojo-gradient">
        <div className="w-12 h-12 border-4 border-white/30 border-t-white rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className={cn("min-h-screen bg-background text-foreground", isRTL && "rtl")}>
      {/* Navbar */}
      <nav className="fixed top-0 inset-x-0 z-50 backdrop-blur-xl bg-background/80 border-b border-border/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src="/kojobot-logo-white.png" alt="Kojobot" className="h-8 invert dark:invert-0" />
          </div>
          <div className="flex items-center gap-3">
            <LanguageToggle />
            <Button
              onClick={() => navigate('/auth')}
              className="kojo-gradient text-white border-0 hover:opacity-90 transition-opacity"
            >
              {s.cta_text_ar && s.cta_text_en ? t(s.cta_text_ar, s.cta_text_en) : t('تسجيل الدخول', 'Login')}
            </Button>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative min-h-[90vh] flex items-center justify-center overflow-hidden pt-16">
        {/* Gradient background */}
        <div className="absolute inset-0 kojo-gradient opacity-95" />
        {/* Animated shapes */}
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute -top-20 -right-20 w-80 h-80 rounded-full bg-white/10 blur-3xl animate-pulse" />
          <div className="absolute -bottom-32 -left-20 w-96 h-96 rounded-full bg-white/5 blur-3xl" style={{ animationDelay: '1s' }} />
          <div className="absolute top-1/3 right-1/4 w-4 h-4 rounded-full bg-white/30 animate-ping" style={{ animationDuration: '3s' }} />
          <div className="absolute top-2/3 left-1/3 w-3 h-3 rounded-full bg-white/20 animate-ping" style={{ animationDuration: '4s' }} />
          {/* Floating code symbols */}
          <div className="absolute top-1/4 left-[10%] text-white/10 text-6xl font-mono select-none">&lt;/&gt;</div>
          <div className="absolute bottom-1/4 right-[15%] text-white/10 text-5xl font-mono select-none">{'{}'}</div>
          <div className="absolute top-[60%] left-[70%] text-white/10 text-4xl font-mono select-none">01</div>
        </div>

        <div className="relative z-10 max-w-4xl mx-auto px-4 text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/15 backdrop-blur-sm border border-white/20 mb-8">
            <Rocket className="h-4 w-4 text-white" />
            <span className="text-white/90 text-sm font-medium">
              {t('تعلم. ابتكر. تميّز.', 'Learn. Create. Excel.')}
            </span>
          </div>
          <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold text-white mb-6 leading-tight">
            {t(s.hero_title_ar || 'ابدأ رحلتك في عالم البرمجة', s.hero_title_en || 'Start Your Coding Journey')}
          </h1>
          <p className="text-lg sm:text-xl text-white/80 max-w-2xl mx-auto mb-10 leading-relaxed">
            {t(s.hero_subtitle_ar || '', s.hero_subtitle_en || '')}
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button
              size="lg"
              onClick={() => navigate(s.cta_url || '/auth')}
              className="bg-white text-foreground hover:bg-white/90 text-lg px-8 py-6 rounded-xl font-semibold shadow-2xl"
            >
              {t(s.cta_text_ar || 'تسجيل الدخول', s.cta_text_en || 'Login')}
              <Arrow className="h-5 w-5 ms-2" />
            </Button>
            <Button
              size="lg"
              variant="outline"
              onClick={() => document.getElementById('tracks')?.scrollIntoView({ behavior: 'smooth' })}
              className="border-2 border-white/40 text-white bg-white/10 hover:bg-white/20 text-lg px-8 py-6 rounded-xl backdrop-blur-sm"
            >
              {t('اكتشف المسارات', 'Explore Tracks')}
            </Button>
          </div>
        </div>

        {/* Bottom wave */}
        <div className="absolute bottom-0 left-0 right-0">
          <svg viewBox="0 0 1440 120" fill="none" className="w-full">
            <path d="M0,80 C360,120 720,40 1080,80 C1260,100 1380,60 1440,80 L1440,120 L0,120 Z" fill="hsl(var(--background))" />
          </svg>
        </div>
      </section>

      {/* Features */}
      {features.length > 0 && (
        <section className="py-20 sm:py-28 px-4">
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-16">
              <Badge variant="secondary" className="mb-4 text-sm px-4 py-1">
                {t('لماذا كوجوبوت؟', 'Why Kojobot?')}
              </Badge>
              <h2 className="text-3xl sm:text-4xl font-bold text-foreground">
                {t('تجربة تعليمية متكاملة', 'A Complete Learning Experience')}
              </h2>
            </div>
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {features.map((f: any) => {
                const Icon = ICON_MAP[f.icon_name] || Star;
                return (
                  <Card key={f.id} className="group hover:shadow-xl transition-all duration-300 border-border/50 hover:border-primary/30 bg-card">
                    <CardContent className="p-6 text-center">
                      <div className="w-14 h-14 mx-auto mb-4 rounded-2xl kojo-gradient flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
                        <Icon className="h-7 w-7 text-white" />
                      </div>
                      <h3 className="font-semibold text-lg mb-2 text-foreground">{t(f.title_ar, f.title_en)}</h3>
                      <p className="text-sm text-muted-foreground leading-relaxed">{t(f.desc_ar, f.desc_en)}</p>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        </section>
      )}

      {/* Tracks / Curriculum Roadmap */}
      {tracks.length > 0 && (
        <section id="tracks" className="py-20 sm:py-28 px-4 bg-muted/30">
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-16">
              <Badge variant="secondary" className="mb-4 text-sm px-4 py-1">
                {t('خارطة المسار', 'Learning Roadmap')}
              </Badge>
              <h2 className="text-3xl sm:text-4xl font-bold text-foreground">
                {t('مسارات تعليمية لكل الأعمار', 'Learning Tracks for All Ages')}
              </h2>
            </div>

            <Tabs defaultValue={tracks[0]?.age_group || '6_9'} className="w-full">
              <TabsList className="grid w-full max-w-lg mx-auto grid-cols-3 mb-10 h-12">
                {tracks.map((g: any) => (
                  <TabsTrigger key={g.age_group} value={g.age_group} className="text-sm font-medium">
                    {g.age_group.replace('_', '-')} {t('سنة', 'yrs')}
                  </TabsTrigger>
                ))}
              </TabsList>

              {tracks.map((g: any) => {
                const steps = g.steps || [];
                const generalSteps = steps.filter((s: any) => s.path_type === 'general');
                const softwareSteps = steps.filter((s: any) => s.path_type === 'software');
                const hardwareSteps = steps.filter((s: any) => s.path_type === 'hardware');
                const hasBranch = softwareSteps.length > 0 || hardwareSteps.length > 0;

                return (
                  <TabsContent key={g.age_group} value={g.age_group}>
                    <div className="max-w-4xl mx-auto">
                      <p className="text-center text-muted-foreground mb-10 text-lg">
                        {t(g.intro_ar, g.intro_en)}
                      </p>

                      {/* General steps timeline */}
                      <div className="space-y-0 mb-8">
                        {generalSteps.map((step: any, i: number) => (
                          <TimelineStep key={step.id} step={step} index={i} isLast={!hasBranch && i === generalSteps.length - 1} t={t} />
                        ))}
                      </div>

                      {/* Branch fork */}
                      {hasBranch && (
                        <>
                          <div className="flex items-center justify-center gap-3 my-8">
                            <div className="h-px flex-1 bg-gradient-to-r from-transparent via-primary/30 to-transparent" />
                            <div className="flex items-center gap-2 px-4 py-2 rounded-full kojo-gradient text-white text-sm font-medium">
                              <GitFork className="h-4 w-4" />
                              {t('اختر مسارك', 'Choose Your Path')}
                            </div>
                            <div className="h-px flex-1 bg-gradient-to-r from-transparent via-primary/30 to-transparent" />
                          </div>

                          <div className="grid md:grid-cols-2 gap-6">
                            {/* Software Path */}
                            <Card className="border-primary/20 bg-card overflow-hidden">
                              <div className="kojo-gradient p-4 flex items-center gap-3">
                                <Code className="h-6 w-6 text-white" />
                                <h4 className="font-bold text-white text-lg">{t('مسار البرمجيات', 'Software Track')}</h4>
                              </div>
                              <CardContent className="p-4 space-y-0">
                                {softwareSteps.map((step: any, i: number) => (
                                  <BranchStep key={step.id} step={step} index={i} isLast={i === softwareSteps.length - 1} t={t} />
                                ))}
                              </CardContent>
                            </Card>

                            {/* Hardware Path */}
                            <Card className="border-secondary/20 bg-card overflow-hidden">
                              <div className="bg-secondary p-4 flex items-center gap-3">
                                <Cpu className="h-6 w-6 text-white" />
                                <h4 className="font-bold text-white text-lg">{t('مسار الهاردوير', 'Hardware Track')}</h4>
                              </div>
                              <CardContent className="p-4 space-y-0">
                                {hardwareSteps.map((step: any, i: number) => (
                                  <BranchStep key={step.id} step={step} index={i} isLast={i === hardwareSteps.length - 1} t={t} variant="secondary" />
                                ))}
                              </CardContent>
                            </Card>
                          </div>
                        </>
                      )}
                    </div>
                  </TabsContent>
                );
              })}
            </Tabs>
          </div>
        </section>
      )}

      {/* Plans / Pricing */}
      {plans.length > 0 && (
        <section className="py-20 sm:py-28 px-4">
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-16">
              <Badge variant="secondary" className="mb-4 text-sm px-4 py-1">
                {t('الباقات', 'Plans')}
              </Badge>
              <h2 className="text-3xl sm:text-4xl font-bold text-foreground">
                {t('اختر الباقة المناسبة', 'Choose the Right Plan')}
              </h2>
            </div>
            <PlanCards plans={plans} t={t} />
          </div>
        </section>
      )}

      {/* Footer */}
      <footer className="border-t border-border bg-muted/30 py-12 px-4">
        <div className="max-w-6xl mx-auto">
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-8 mb-8">
            <div>
              <img src="/kojobot-logo-white.png" alt="Kojobot" className="h-8 mb-4 invert dark:invert-0" />
              <p className="text-sm text-muted-foreground leading-relaxed">
                {t(s.hero_subtitle_ar || '', s.hero_subtitle_en || '')}
              </p>
            </div>
            <div>
              <h4 className="font-semibold mb-3 text-foreground">{t('تواصل معنا', 'Contact Us')}</h4>
              <div className="space-y-2 text-sm text-muted-foreground">
                {s.whatsapp && (
                  <a href={`https://wa.me/${s.whatsapp.replace(/\D/g, '')}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 hover:text-primary transition-colors">
                    <Phone className="h-4 w-4" /> {s.whatsapp}
                  </a>
                )}
                {s.email && (
                  <a href={`mailto:${encodeURIComponent(s.email)}`} className="flex items-center gap-2 hover:text-primary transition-colors">
                    <Mail className="h-4 w-4" /> {s.email}
                  </a>
                )}
                {(s.address_ar || s.address_en) && (
                  <p className="flex items-center gap-2">
                    <MapPin className="h-4 w-4 shrink-0" /> {t(s.address_ar || '', s.address_en || '')}
                  </p>
                )}
              </div>
            </div>
            <div>
              <h4 className="font-semibold mb-3 text-foreground">{t('تابعنا', 'Follow Us')}</h4>
              <div className="flex gap-3">
                {Array.isArray(s.social_links) && s.social_links.map((link: any, i: number) => {
                  const platform = String(link?.platform || '').toLowerCase();
                  const url = String(link?.url || '');
                  if (!url || !['facebook','instagram','twitter','youtube','linkedin','tiktok','whatsapp'].includes(platform)) return null;
                  return (
                    <a key={i} href={url} target="_blank" rel="noopener noreferrer" className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center hover:bg-primary hover:text-primary-foreground transition-colors text-lg" title={platform}>
                      {SOCIAL_ICON_MAP[platform] || '🔗'}
                    </a>
                  );
                })}
              </div>
            </div>
          </div>
          <div className="border-t border-border pt-6 text-center text-sm text-muted-foreground">
            {t(s.footer_text_ar || '© 2025 Kojobot. جميع الحقوق محفوظة.', s.footer_text_en || '© 2025 Kojobot. All rights reserved.')}
          </div>
        </div>
      </footer>
    </div>
  );
}

/* ============= Timeline Components ============= */

function TimelineStep({ step, index, isLast, t }: { step: any; index: number; isLast: boolean; t: (ar: string, en: string) => string }) {
  return (
    <div className="flex gap-4">
      <div className="flex flex-col items-center">
        <div className="w-10 h-10 rounded-full kojo-gradient flex items-center justify-center text-white font-bold text-sm shadow-lg shrink-0">
          {step.step_number}
        </div>
        {!isLast && <div className="w-0.5 flex-1 min-h-[2rem] bg-gradient-to-b from-primary/40 to-primary/10" />}
      </div>
      <div className={cn("pb-8", isLast && "pb-0")}>
        <h4 className="font-semibold text-foreground text-lg">{t(step.title_ar, step.title_en)}</h4>
        <p className="text-sm text-muted-foreground mt-1 leading-relaxed">{t(step.desc_ar, step.desc_en)}</p>
      </div>
    </div>
  );
}

function BranchStep({ step, index, isLast, t, variant = 'primary' }: { step: any; index: number; isLast: boolean; t: (ar: string, en: string) => string; variant?: 'primary' | 'secondary' }) {
  const specs: string[] = step.specializations || [];
  return (
    <div className="flex gap-3 py-3">
      <div className="flex flex-col items-center">
        <div className={cn(
          "w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-xs shrink-0",
          variant === 'primary' ? 'bg-primary' : 'bg-secondary'
        )}>
          {step.step_number}
        </div>
        {!isLast && <div className={cn("w-0.5 flex-1 min-h-[1rem]", variant === 'primary' ? 'bg-primary/20' : 'bg-secondary/20')} />}
      </div>
      <div className="flex-1 min-w-0">
        <h5 className="font-medium text-foreground text-sm">{t(step.title_ar, step.title_en)}</h5>
        <p className="text-xs text-muted-foreground mt-0.5">{t(step.desc_ar, step.desc_en)}</p>
        {specs.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-2">
            {specs.map((sp: string) => (
              <Badge key={sp} variant="outline" className="text-xs">
                {sp}
              </Badge>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function PlanCards({ plans, t }: { plans: any[]; t: (ar: string, en: string) => string }) {
  const onlinePlans = plans.filter((p: any) => p.mode === 'online');
  const offlinePlans = plans.filter((p: any) => p.mode === 'offline');

  const renderPlan = (plan: any) => {
    const benefits: any[] = plan.benefits || [];
    return (
      <Card key={plan.id} className={cn(
        "relative overflow-hidden transition-all duration-300 hover:shadow-xl border-border/50",
        plan.is_featured && "border-primary/50 shadow-lg ring-2 ring-primary/20"
      )}>
        {plan.is_featured && (
          <div className="absolute top-0 inset-x-0 h-1 kojo-gradient" />
        )}
        <CardContent className="p-6">
          <h3 className="font-bold text-xl text-foreground mb-2">{t(plan.name_ar, plan.name_en)}</h3>
          {plan.price_number > 0 && (
            <div className="mb-4">
              <span className="text-3xl font-bold kojo-gradient-text">{plan.price_number}</span>
              <span className="text-sm text-muted-foreground ms-1">{plan.price_currency} / {t(plan.billing_period_ar, plan.billing_period_en)}</span>
            </div>
          )}
          {(plan.description_ar || plan.description_en) && (
            <p className="text-sm text-muted-foreground mb-4">{t(plan.description_ar || '', plan.description_en || '')}</p>
          )}
          <div className="space-y-2 text-sm mb-6">
            {plan.sessions_per_month && (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Check className="h-4 w-4 text-primary shrink-0" />
                {plan.sessions_per_month} {t('حصة/شهر', 'sessions/month')}
              </div>
            )}
            {plan.session_duration_minutes && (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Check className="h-4 w-4 text-primary shrink-0" />
                {plan.session_duration_minutes} {t('دقيقة/حصة', 'min/session')}
              </div>
            )}
            {benefits.map((b: any) => (
              <div key={b.id} className="flex items-center gap-2 text-muted-foreground">
                <Check className="h-4 w-4 text-primary shrink-0" />
                {t(b.text_ar, b.text_en)}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="space-y-10">
      {offlinePlans.length > 0 && (
        <div>
          <h3 className="text-xl font-semibold text-foreground mb-6 flex items-center gap-2">
            <MapPin className="h-5 w-5 text-primary" />
            {t('الحضور المباشر', 'In-Person')}
          </h3>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {offlinePlans.map(renderPlan)}
          </div>
        </div>
      )}
      {onlinePlans.length > 0 && (
        <div>
          <h3 className="text-xl font-semibold text-foreground mb-6 flex items-center gap-2">
            <Globe className="h-5 w-5 text-primary" />
            {t('أونلاين', 'Online')}
          </h3>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {onlinePlans.map(renderPlan)}
          </div>
        </div>
      )}
    </div>
  );
}
