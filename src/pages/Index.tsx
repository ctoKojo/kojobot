import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import { ThemeToggle } from '@/components/ThemeToggle';
import { LanguageToggle } from '@/components/LanguageToggle';
import kojobotLogo from '@/assets/kojobot-icon-128.webp';
import {
  Monitor, BookOpen, BarChart3, Award, ArrowRight, ArrowLeft,
  Check, Cpu, Code, Puzzle, Bot, Palette, ChevronRight,
  Mail, Phone, MapPin, MessageCircle
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

const iconMap: Record<string, React.ElementType> = {
  Monitor, BookOpen, BarChart3, Award, Cpu, Code, Puzzle, Bot, Palette,
};

interface LandingContent {
  settings: {
    hero_title_en: string; hero_title_ar: string;
    hero_subtitle_en: string; hero_subtitle_ar: string;
    cta_text_en: string; cta_text_ar: string; cta_url: string;
    footer_text_en: string; footer_text_ar: string;
    logo_url?: string; email?: string; phone?: string;
    whatsapp?: string; address_en?: string; address_ar?: string;
    social_links?: any[];
  };
  features: {
    id: string; icon_name: string; sort_order: number;
    title_en: string; title_ar: string;
    desc_en: string; desc_ar: string;
  }[];
  plans: {
    id: string; name_en: string; name_ar: string;
    price_number: number; price_currency: string;
    billing_period_en: string; billing_period_ar: string;
    mode: string; is_featured: boolean; sort_order: number;
    sessions_per_month?: number; session_duration_minutes?: number;
    description_en?: string; description_ar?: string;
    benefits: { id: string; text_en: string; text_ar: string; sort_order: number }[];
  }[];
  tracks: {
    id: string; age_group: string; sort_order: number;
    title_en: string; title_ar: string;
    intro_en: string; intro_ar: string;
    steps: {
      id: string; step_number: number; path_type: string;
      title_en: string; title_ar: string;
      desc_en: string; desc_ar: string;
      specializations?: string[];
    }[];
  }[];
}

const Index = () => {
  const { language, t, isRTL } = useLanguage();
  const [content, setContent] = useState<LandingContent | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.rpc('get_landing_content').then(({ data }) => {
      if (data) setContent(data as unknown as LandingContent);
      setLoading(false);
    });
  }, []);

  const l = (en: string | undefined, ar: string | undefined) =>
    language === 'ar' ? (ar || en || '') : (en || ar || '');

  const Arrow = isRTL ? ArrowLeft : ArrowRight;

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="w-12 h-12 rounded-full border-4 border-primary border-t-transparent animate-spin" />
      </div>
    );
  }

  const s = content?.settings;
  const features = content?.features || [];
  const plans = content?.plans || [];
  const tracks = content?.tracks || [];

  return (
    <div className={`min-h-screen bg-background text-foreground ${isRTL ? 'font-cairo' : ''}`} dir={isRTL ? 'rtl' : 'ltr'}>
      {/* ======== Navbar ======== */}
      <nav className="fixed top-0 inset-x-0 z-50 bg-background/80 backdrop-blur-lg border-b border-border/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2.5">
            <img src={kojobotLogo} alt="Kojobot" className="w-9 h-9 rounded-xl" />
            <span className="text-xl font-bold kojo-gradient-text">Kojobot</span>
          </Link>
          <div className="flex items-center gap-2">
            <LanguageToggle />
            <ThemeToggle />
            <Button asChild size="sm" className="kojo-gradient text-white border-0 hover:opacity-90">
              <Link to={s?.cta_url || '/auth'}>
                {l(s?.cta_text_en, s?.cta_text_ar)}
              </Link>
            </Button>
          </div>
        </div>
      </nav>

      {/* ======== Hero ======== */}
      <section className="relative pt-32 pb-20 sm:pt-40 sm:pb-28 overflow-hidden">
        {/* Animated blobs */}
        <div className="absolute inset-0 -z-10 overflow-hidden">
          <div className="absolute top-20 -left-32 w-96 h-96 rounded-full bg-primary/20 blur-3xl animate-blob-move" />
          <div className="absolute bottom-10 -right-32 w-80 h-80 rounded-full bg-secondary/20 blur-3xl animate-blob-move" style={{ animationDelay: '-7s' }} />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] rounded-full bg-gradient-to-br from-primary/10 to-secondary/10 blur-3xl animate-blob-move" style={{ animationDelay: '-14s' }} />
        </div>

        <div className="max-w-4xl mx-auto px-4 sm:px-6 text-center">
          <div className="animate-fade-up">
            <img src={kojobotLogo} alt="Kojobot" className="w-20 h-20 sm:w-24 sm:h-24 mx-auto rounded-3xl shadow-2xl mb-8 animate-float" />
          </div>
          <h1 className="text-4xl sm:text-5xl md:text-6xl font-extrabold leading-tight mb-6 animate-fade-up" style={{ animationDelay: '0.1s' }}>
            <span className="kojo-gradient-text">{l(s?.hero_title_en, s?.hero_title_ar)}</span>
          </h1>
          <p className="text-lg sm:text-xl text-muted-foreground max-w-2xl mx-auto mb-10 animate-fade-up" style={{ animationDelay: '0.2s' }}>
            {l(s?.hero_subtitle_en, s?.hero_subtitle_ar)}
          </p>
          <div className="animate-fade-up" style={{ animationDelay: '0.3s' }}>
            <Button asChild size="lg" className="kojo-gradient text-white border-0 hover:opacity-90 px-8 py-6 text-lg rounded-2xl shadow-xl shadow-primary/25">
              <Link to={s?.cta_url || '/auth'} className="flex items-center gap-2">
                {l(s?.cta_text_en, s?.cta_text_ar)}
                <Arrow className="w-5 h-5" />
              </Link>
            </Button>
          </div>
        </div>
      </section>

      {/* ======== Features ======== */}
      {features.length > 0 && (
        <section className="py-20 sm:py-28 bg-muted/30">
          <div className="max-w-6xl mx-auto px-4 sm:px-6">
            <h2 className="text-3xl sm:text-4xl font-bold text-center mb-4 kojo-gradient-text">
              {language === 'ar' ? 'لماذا كوجوبوت؟' : 'Why Kojobot?'}
            </h2>
            <p className="text-muted-foreground text-center mb-14 max-w-xl mx-auto">
              {language === 'ar' ? 'منصة متكاملة لتعليم البرمجة والتكنولوجيا' : 'A complete platform for coding & technology education'}
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {features.map((f, i) => {
                const Icon = iconMap[f.icon_name] || Monitor;
                return (
                  <div
                    key={f.id}
                    className="group relative p-6 rounded-2xl bg-card border border-border/50 hover:border-primary/50 transition-all duration-300 hover:shadow-xl hover:shadow-primary/10 hover:-translate-y-1 animate-fade-up"
                    style={{ animationDelay: `${i * 0.1}s` }}
                  >
                    <div className="w-12 h-12 rounded-xl kojo-gradient flex items-center justify-center mb-4 shadow-lg shadow-primary/20 group-hover:scale-110 transition-transform">
                      <Icon className="w-6 h-6 text-white" />
                    </div>
                    <h3 className="text-lg font-semibold mb-2">{l(f.title_en, f.title_ar)}</h3>
                    <p className="text-sm text-muted-foreground leading-relaxed">{l(f.desc_en, f.desc_ar)}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      )}

      {/* ======== Tracks ======== */}
      {tracks.length > 0 && (
        <section className="py-20 sm:py-28">
          <div className="max-w-5xl mx-auto px-4 sm:px-6">
            <h2 className="text-3xl sm:text-4xl font-bold text-center mb-4 kojo-gradient-text">
              {language === 'ar' ? 'المسارات التعليمية' : 'Learning Tracks'}
            </h2>
            <p className="text-muted-foreground text-center mb-14 max-w-xl mx-auto">
              {language === 'ar' ? 'مسارات مصممة لكل فئة عمرية' : 'Tracks designed for every age group'}
            </p>

            <Tabs defaultValue={tracks[0]?.age_group} className="w-full">
              <TabsList className="grid w-full max-w-md mx-auto mb-10" style={{ gridTemplateColumns: `repeat(${tracks.length}, 1fr)` }}>
                {tracks.map((tr) => (
                  <TabsTrigger key={tr.age_group} value={tr.age_group} className="text-sm">
                    {l(tr.title_en, tr.title_ar)}
                  </TabsTrigger>
                ))}
              </TabsList>

              {tracks.map((tr) => {
                const generalSteps = tr.steps.filter(s => s.path_type === 'general');
                const softwareSteps = tr.steps.filter(s => s.path_type === 'software');
                const hardwareSteps = tr.steps.filter(s => s.path_type === 'hardware');
                const hasBranches = softwareSteps.length > 0 || hardwareSteps.length > 0;

                return (
                  <TabsContent key={tr.age_group} value={tr.age_group}>
                    <p className="text-center text-muted-foreground mb-10">{l(tr.intro_en, tr.intro_ar)}</p>

                    {/* General steps timeline */}
                    <div className="relative">
                      <div className={`absolute top-0 bottom-0 w-0.5 kojo-gradient ${isRTL ? 'right-6' : 'left-6'} sm:left-1/2 sm:right-auto sm:-translate-x-1/2`} />
                      {generalSteps.map((step, i) => (
                        <div key={step.id} className={`relative flex items-start gap-4 mb-8 sm:mb-10 ${i % 2 === 0 ? 'sm:flex-row' : 'sm:flex-row-reverse'}`}>
                          <div className={`hidden sm:block sm:w-1/2 ${i % 2 === 0 ? 'sm:text-end sm:pe-10' : 'sm:text-start sm:ps-10'}`}>
                            <h4 className="font-semibold text-lg">{l(step.title_en, step.title_ar)}</h4>
                            <p className="text-sm text-muted-foreground mt-1">{l(step.desc_en, step.desc_ar)}</p>
                          </div>
                          <div className="flex-shrink-0 w-12 h-12 rounded-full kojo-gradient flex items-center justify-center text-white font-bold text-sm z-10 shadow-lg shadow-primary/20">
                            {step.step_number}
                          </div>
                          <div className="sm:w-1/2 sm:hidden">
                            <h4 className="font-semibold text-lg">{l(step.title_en, step.title_ar)}</h4>
                            <p className="text-sm text-muted-foreground mt-1">{l(step.desc_en, step.desc_ar)}</p>
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Branches */}
                    {hasBranches && (
                      <div className="mt-10">
                        <h4 className="text-center font-semibold text-lg mb-6 kojo-gradient-text">
                          {language === 'ar' ? 'اختر مسارك' : 'Choose Your Path'}
                        </h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          {[
                            { label: language === 'ar' ? '💻 مسار Software' : '💻 Software Path', steps: softwareSteps },
                            { label: language === 'ar' ? '🔧 مسار Hardware' : '🔧 Hardware Path', steps: hardwareSteps },
                          ].map(({ label, steps: branchSteps }) => branchSteps.length > 0 && (
                            <div key={label} className="p-6 rounded-2xl bg-card border border-border/50">
                              <h5 className="font-semibold text-base mb-4">{label}</h5>
                              <div className="space-y-4">
                                {branchSteps.map((step) => (
                                  <div key={step.id} className="flex items-start gap-3">
                                    <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center text-sm font-bold">
                                      {step.step_number}
                                    </div>
                                    <div>
                                      <h6 className="font-medium text-sm">{l(step.title_en, step.title_ar)}</h6>
                                      <p className="text-xs text-muted-foreground mt-0.5">{l(step.desc_en, step.desc_ar)}</p>
                                      {step.specializations && step.specializations.length > 0 && (
                                        <div className="flex flex-wrap gap-1.5 mt-2">
                                          {step.specializations.map((sp: string) => (
                                            <span key={sp} className="text-xs px-2 py-0.5 rounded-full bg-secondary/10 text-secondary font-medium">{sp}</span>
                                          ))}
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </TabsContent>
                );
              })}
            </Tabs>
          </div>
        </section>
      )}

      {/* ======== Plans ======== */}
      {plans.length > 0 && (
        <section className="py-20 sm:py-28 bg-muted/30">
          <div className="max-w-6xl mx-auto px-4 sm:px-6">
            <h2 className="text-3xl sm:text-4xl font-bold text-center mb-4 kojo-gradient-text">
              {language === 'ar' ? 'الباقات والأسعار' : 'Plans & Pricing'}
            </h2>
            <p className="text-muted-foreground text-center mb-14 max-w-xl mx-auto">
              {language === 'ar' ? 'اختر الباقة المناسبة لطفلك' : 'Choose the right plan for your child'}
            </p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {plans.map((plan) => (
                <div
                  key={plan.id}
                  className={`relative p-6 sm:p-8 rounded-2xl bg-card border transition-all duration-300 hover:shadow-xl hover:-translate-y-1 ${
                    plan.is_featured
                      ? 'border-primary shadow-lg shadow-primary/10 ring-2 ring-primary/20'
                      : 'border-border/50 hover:border-primary/30'
                  }`}
                >
                  {plan.is_featured && (
                    <div className="absolute -top-3 inset-x-0 flex justify-center">
                      <span className="px-4 py-1 text-xs font-semibold kojo-gradient text-white rounded-full">
                        {language === 'ar' ? 'الأكثر طلباً' : 'Most Popular'}
                      </span>
                    </div>
                  )}
                  <div className="text-center mb-6">
                    <span className="inline-block px-3 py-1 text-xs font-medium rounded-full bg-secondary/10 text-secondary mb-3">
                      {plan.mode === 'online' ? (language === 'ar' ? 'أونلاين' : 'Online') : (language === 'ar' ? 'أوفلاين' : 'Offline')}
                    </span>
                    <h3 className="text-xl font-bold">{l(plan.name_en, plan.name_ar)}</h3>
                    {plan.price_number > 0 && (
                      <div className="mt-3">
                        <span className="text-4xl font-extrabold kojo-gradient-text">{plan.price_number}</span>
                        <span className="text-sm text-muted-foreground ms-1">{plan.price_currency} / {l(plan.billing_period_en, plan.billing_period_ar)}</span>
                      </div>
                    )}
                  </div>
                  <div className="space-y-3 mb-6">
                    {plan.sessions_per_month && (
                      <div className="flex items-center gap-2 text-sm">
                        <Check className="w-4 h-4 text-primary flex-shrink-0" />
                        <span>{plan.sessions_per_month} {language === 'ar' ? 'حصص/شهر' : 'sessions/month'}</span>
                      </div>
                    )}
                    {plan.session_duration_minutes && (
                      <div className="flex items-center gap-2 text-sm">
                        <Check className="w-4 h-4 text-primary flex-shrink-0" />
                        <span>{plan.session_duration_minutes} {language === 'ar' ? 'دقيقة/حصة' : 'min/session'}</span>
                      </div>
                    )}
                    {plan.benefits.map((b) => (
                      <div key={b.id} className="flex items-center gap-2 text-sm">
                        <Check className="w-4 h-4 text-primary flex-shrink-0" />
                        <span>{l(b.text_en, b.text_ar)}</span>
                      </div>
                    ))}
                  </div>
                  <Button asChild className={`w-full rounded-xl ${plan.is_featured ? 'kojo-gradient text-white border-0 hover:opacity-90' : ''}`} variant={plan.is_featured ? 'default' : 'outline'}>
                    <Link to={s?.cta_url || '/auth'}>
                      {l(s?.cta_text_en, s?.cta_text_ar)}
                    </Link>
                  </Button>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ======== Footer ======== */}
      <footer className="py-12 border-t border-border/50">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-2.5">
              <img src={kojobotLogo} alt="Kojobot" className="w-8 h-8 rounded-lg" />
              <span className="font-bold kojo-gradient-text">Kojobot</span>
            </div>
            <div className="flex items-center gap-4 text-sm text-muted-foreground">
              {s?.email && (
                <a href={`mailto:${s.email}`} className="flex items-center gap-1.5 hover:text-primary transition-colors">
                  <Mail className="w-4 h-4" /> {s.email}
                </a>
              )}
              {s?.phone && (
                <a href={`tel:${s.phone}`} className="flex items-center gap-1.5 hover:text-primary transition-colors">
                  <Phone className="w-4 h-4" /> {s.phone}
                </a>
              )}
              {s?.whatsapp && (
                <a href={`https://wa.me/${s.whatsapp}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 hover:text-primary transition-colors">
                  <MessageCircle className="w-4 h-4" /> WhatsApp
                </a>
              )}
            </div>
          </div>
          <div className="mt-6 text-center text-sm text-muted-foreground">
            {l(s?.footer_text_en, s?.footer_text_ar)}
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Index;
