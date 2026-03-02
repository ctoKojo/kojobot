import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import { ThemeToggle } from '@/components/ThemeToggle';
import { LanguageToggle } from '@/components/LanguageToggle';
import kojobotLogo from '@/assets/kojobot-main-logo.png';
import {
  Monitor, BookOpen, BarChart3, Award, ArrowRight, ArrowLeft,
  Check, Cpu, Code, Puzzle, Bot, Palette, ChevronRight,
  Mail, Phone, MapPin, MessageCircle, X, Instagram, Facebook } from
'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Accordion, AccordionContent, AccordionItem, AccordionTrigger } from
'@/components/ui/accordion';

const iconMap: Record<string, React.ElementType> = {
  Monitor, BookOpen, BarChart3, Award, Cpu, Code, Puzzle, Bot, Palette
};

interface SocialLink {
  platform: string;
  url: string;
}

interface LandingContent {
  settings: {
    hero_title_en: string;hero_title_ar: string;
    hero_subtitle_en: string;hero_subtitle_ar: string;
    cta_text_en: string;cta_text_ar: string;cta_url: string;
    footer_text_en: string;footer_text_ar: string;
    logo_url?: string;email?: string;phone?: string;
    whatsapp?: string;address_en?: string;address_ar?: string;
    social_links?: SocialLink[];
  };
  features: {
    id: string;icon_name: string;sort_order: number;
    title_en: string;title_ar: string;
    desc_en: string;desc_ar: string;
  }[];
  plans: {
    id: string;name_en: string;name_ar: string;
    price_number: number;price_online: number;price_currency: string;price_before_discount: number;price_online_before_discount: number;
    billing_period_en: string;billing_period_ar: string;
    mode: string;is_featured: boolean;sort_order: number;
    sessions_per_month?: number;session_duration_minutes?: number;
    description_en?: string;description_ar?: string;
    benefits: {id: string;text_en: string;text_ar: string;sort_order: number;}[];
  }[];
  tracks: {
    id: string;age_group: string;sort_order: number;
    title_en: string;title_ar: string;
    intro_en: string;intro_ar: string;
    steps: {
      id: string;step_number: number;path_type: string;
      title_en: string;title_ar: string;
      desc_en: string;desc_ar: string;
      specializations?: string[];
    }[];
  }[];
}

const faqData = [
{
  q_en: 'What is Kojobot?',
  q_ar: 'ما هو كوجوبوت؟',
  a_en: 'Kojobot is an integrated platform for teaching coding and technology to children and teenagers, offering structured learning tracks tailored for different age groups.',
  a_ar: 'كوجوبوت هو منصة متكاملة لتعليم البرمجة والتكنولوجيا للأطفال والمراهقين، تقدم مسارات تعليمية منظمة مصممة لمختلف الفئات العمرية.'
},
{
  q_en: 'What age groups do you accept?',
  q_ar: 'ما الأعمار المناسبة؟',
  a_en: 'We accept students from ages 6 to 18, with specialized tracks for each age group: 6-9 years, 10-13 years, and 14-18 years.',
  a_ar: 'نقبل الطلاب من سن 6 إلى 18 سنة، مع مسارات متخصصة لكل فئة عمرية: 6-9 سنوات، 10-13 سنة، و14-18 سنة.'
},
{
  q_en: 'How are the sessions conducted?',
  q_ar: 'كيف تتم الحصص؟',
  a_en: 'Sessions are conducted online or offline with qualified instructors. Each session is 120 minutes with 4 sessions per month. Students learn through interactive projects and hands-on coding exercises.',
  a_ar: 'تتم الحصص أونلاين أو أوفلاين مع مدربين مؤهلين. مدة كل حصة 120 دقيقة بواقع 4 حصص في الشهر. يتعلم الطلاب من خلال مشاريع تفاعلية وتمارين برمجية عملية.'
},
{
  q_en: 'Is there a free trial?',
  q_ar: 'هل يوجد تجربة مجانية؟',
  a_en: 'Yes! We offer a free trial session so your child can experience our teaching method before committing to a plan.',
  a_ar: 'نعم! نقدم حصة تجريبية مجانية حتى يتمكن طفلك من تجربة طريقة التعليم قبل الاشتراك في أي باقة.'
},
{
  q_en: 'What is the difference between plans?',
  q_ar: 'ما الفرق بين الباقات؟',
  a_en: 'KOJO SQUAD offers small group sessions. KOJO CORE adds summary videos, homework support, direct instructor communication, and learning materials. KOJO X provides private 1-on-1 sessions with full recordings, daily WhatsApp support, weekly reports, and more.',
  a_ar: 'كوجو سكواد تقدم حصص في جروب صغير. كوجو كور تضيف فيديو ملخص، دعم في الواجبات، تواصل مباشر مع المدرب، ومواد تعليمية. كوجو إكس تقدم حصص فردية مع تسجيل كامل، دعم يومي على واتساب، تقارير أسبوعية، والمزيد.'
},
{
  q_en: 'What programming languages do you teach?',
  q_ar: 'ما لغات البرمجة التي تعلمونها؟',
  a_en: 'We teach Scratch for younger students, then progress to Python, web development (HTML/CSS/JavaScript), and advanced topics like robotics and AI for older students.',
  a_ar: 'نعلم سكراتش للطلاب الأصغر سناً، ثم ننتقل إلى بايثون، تطوير الويب (HTML/CSS/JavaScript)، ومواضيع متقدمة مثل الروبوتيكس والذكاء الاصطناعي للطلاب الأكبر.'
},
{
  q_en: 'Do I need to buy a computer for my child?',
  q_ar: 'هل أحتاج لشراء كمبيوتر لطفلي؟',
  a_en: 'Yes, a laptop or desktop computer is required for the sessions. A tablet is not sufficient for coding exercises. We can recommend suitable options based on your budget.',
  a_ar: 'نعم، يحتاج الطالب لابتوب أو كمبيوتر للحصص. التابلت غير كافي لتمارين البرمجة. نقدر نرشحلك أجهزة مناسبة حسب ميزانيتك.'
},
{
  q_en: 'Can I change or upgrade my plan later?',
  q_ar: 'هل يمكنني تغيير أو ترقية الباقة لاحقاً؟',
  a_en: 'Absolutely! You can upgrade or change your plan at any time. The change will take effect from the next billing cycle.',
  a_ar: 'طبعاً! تقدر تغير أو ترقي باقتك في أي وقت. التغيير هيبدأ من دورة الدفع الجاية.'
},
{
  q_en: 'How do I track my child\'s progress?',
  q_ar: 'كيف أتابع تقدم طفلي؟',
  a_en: 'Depending on your plan, you receive monthly or weekly progress reports. KOJO CORE includes monthly reports, while KOJO X provides detailed weekly performance reports and direct communication with the instructor.',
  a_ar: 'حسب باقتك، بتستلم تقارير شهرية أو أسبوعية. كوجو كور بيشمل تقارير شهرية، وكوجو إكس بيقدم تقارير أداء أسبوعية مفصلة وتواصل مباشر مع المدرب.'
},
{
  q_en: 'What happens if my child misses a session?',
  q_ar: 'ماذا يحدث إذا فات طفلي حصة؟',
  a_en: 'We offer makeup sessions for missed classes. KOJO X subscribers have full schedule flexibility. For other plans, makeup sessions can be arranged based on availability.',
  a_ar: 'بنقدم حصص تعويضية للحصص اللي فاتت. مشتركين كوجو إكس عندهم مرونة كاملة في المواعيد. للباقات التانية، الحصص التعويضية بتتحدد حسب المتاح.'
}];


const TikTokIcon = () =>
<svg viewBox="0 0 24 24" fill="currentColor" className="w-7 h-7">
    <path d="M16.6 5.82s.51.5 0 0A4.278 4.278 0 0 1 15.54 3h-3.09v12.4a2.592 2.592 0 0 1-2.59 2.5c-1.42 0-2.6-1.16-2.6-2.6 0-1.72 1.66-3.01 3.37-2.48V9.66c-3.45-.46-6.47 2.22-6.47 5.64 0 3.33 2.76 5.7 5.69 5.7 3.14 0 5.69-2.55 5.69-5.7V9.01a7.35 7.35 0 0 0 4.3 1.38V7.3s-1.88.09-3.24-1.48z" />
  </svg>;


const socialIconMap: Record<string, React.ElementType | (() => JSX.Element)> = {
  instagram: Instagram,
  facebook: Facebook,
  tiktok: TikTokIcon,
  whatsapp: MessageCircle
};

const socialLabelMap: Record<string, {en: string;ar: string;}> = {
  instagram: { en: 'Instagram', ar: 'انستجرام' },
  facebook: { en: 'Facebook', ar: 'فيسبوك' },
  tiktok: { en: 'TikTok', ar: 'تيك توك' },
  whatsapp: { en: 'WhatsApp', ar: 'واتساب' }
};

const navSections = [
{ id: 'features', en: 'Features', ar: 'المميزات' },
{ id: 'tracks', en: 'Tracks', ar: 'المسارات' },
{ id: 'plans', en: 'Plans', ar: 'الباقات' },
{ id: 'faq', en: 'FAQ', ar: 'الأسئلة' },
{ id: 'contact', en: 'Contact', ar: 'تواصل' }];


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
  language === 'ar' ? ar || en || '' : en || ar || '';

  const Arrow = isRTL ? ArrowLeft : ArrowRight;

  const scrollTo = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="w-12 h-12 rounded-full border-4 border-primary border-t-transparent animate-spin" />
      </div>);

  }

  const s = content?.settings;
  const features = content?.features || [];
  const plans = content?.plans || [];
  const tracks = content?.tracks || [];
  const socialLinks: SocialLink[] = Array.isArray(s?.social_links) ? s.social_links : [];

  return (
    <div className={`min-h-screen bg-background text-foreground ${isRTL ? 'font-cairo' : 'font-poppins'}`} dir={isRTL ? 'rtl' : 'ltr'}>
      {/* ======== Navbar ======== */}
      <nav className="fixed top-0 inset-x-0 z-50 bg-background/80 backdrop-blur-lg border-b border-border/50">
        <div className="w-full px-4 sm:px-6 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2.5">
            
            <span className="font-bold kojo-gradient-text text-3xl">Kojobot</span>
          </Link>

          {/* Section shortcuts - hidden on small screens */}
          <div className="hidden md:flex flex-1 items-center justify-center gap-1">
            {navSections.map((sec) =>
            <button
              key={sec.id}
              onClick={() => scrollTo(sec.id)}
              className="px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors rounded-lg hover:bg-muted/50">
              
                {language === 'ar' ? sec.ar : sec.en}
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <LanguageToggle />
            <ThemeToggle />
            <Button asChild size="sm" className="kojo-gradient text-white border-0 hover:opacity-90 rounded-xl px-5">
              <Link to={s?.cta_url || '/auth'}>
                {l(s?.cta_text_en, s?.cta_text_ar)}
              </Link>
            </Button>
          </div>
        </div>
      </nav>

      {/* ======== Hero ======== */}
      <section className="relative pt-32 pb-20 sm:pt-40 sm:pb-28 overflow-hidden">
        <div className="absolute inset-0 -z-10 overflow-hidden">
          <div className="absolute top-20 -left-32 w-96 h-96 rounded-full bg-primary/20 blur-3xl animate-blob-move" />
          <div className="absolute bottom-10 -right-32 w-80 h-80 rounded-full bg-secondary/20 blur-3xl animate-blob-move" style={{ animationDelay: '-7s' }} />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] rounded-full bg-gradient-to-br from-primary/10 to-secondary/10 blur-3xl animate-blob-move" style={{ animationDelay: '-14s' }} />
        </div>

        <div className="max-w-4xl mx-auto px-4 sm:px-6 text-center">
          <div className="animate-fade-up">
            <img src={kojobotLogo} alt="Kojobot" className="w-48 sm:w-64 mx-auto mb-8 animate-float shadow-none" />
          </div>
          <h1 className="text-4xl sm:text-5xl md:text-6xl font-extrabold leading-tight mb-6 animate-fade-up" style={{ animationDelay: '0.1s' }}>
            <span className="kojo-gradient-text">{l(s?.hero_title_en, s?.hero_title_ar)}</span>
          </h1>
          <p className="text-lg sm:text-xl text-muted-foreground max-w-2xl mx-auto mb-10 animate-fade-up leading-relaxed" style={{ animationDelay: '0.2s' }}>
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
      {features.length > 0 &&
      <section id="features" className="py-20 sm:py-28 bg-muted/30">
          <div className="max-w-6xl mx-auto px-4 sm:px-6">
            <h2 className="text-3xl sm:text-4xl font-bold text-center mb-4 kojo-gradient-text">
              {language === 'ar' ? 'لماذا كوجوبوت؟' : 'Why Kojobot?'}
            </h2>
            <p className="text-muted-foreground text-center mb-14 max-w-xl mx-auto text-base sm:text-lg leading-relaxed">
              {language === 'ar' ? 'منصة متكاملة لتعليم البرمجة والتكنولوجيا' : 'A complete platform for coding & technology education'}
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {features.map((f, i) => {
              const Icon = iconMap[f.icon_name] || Monitor;
              return (
                <div
                  key={f.id}
                  className="group relative p-6 rounded-2xl bg-card border border-border/50 hover:border-primary/50 transition-all duration-300 hover:shadow-xl hover:shadow-primary/10 hover:-translate-y-1 animate-fade-up"
                  style={{ animationDelay: `${i * 0.1}s` }}>
                  
                    <div className="w-12 h-12 rounded-xl kojo-gradient flex items-center justify-center mb-4 shadow-lg shadow-primary/20 group-hover:scale-110 transition-transform">
                      <Icon className="w-6 h-6 text-white" />
                    </div>
                    <h3 className="text-lg font-semibold mb-2">{l(f.title_en, f.title_ar)}</h3>
                    <p className="text-sm text-muted-foreground leading-relaxed">{l(f.desc_en, f.desc_ar)}</p>
                  </div>);

            })}
            </div>
          </div>
        </section>
      }

      {/* ======== Tracks ======== */}
      {tracks.length > 0 &&
      <section id="tracks" className="py-20 sm:py-28">
          <div className="max-w-5xl mx-auto px-4 sm:px-6">
            <h2 className="text-3xl sm:text-4xl font-bold text-center mb-4 kojo-gradient-text">
              {language === 'ar' ? 'المسارات التعليمية' : 'Learning Tracks'}
            </h2>
            <p className="text-muted-foreground text-center mb-14 max-w-xl mx-auto text-base sm:text-lg leading-relaxed">
              {language === 'ar' ? 'مسارات مصممة لكل فئة عمرية' : 'Tracks designed for every age group'}
            </p>

            <Tabs defaultValue={tracks[0]?.age_group} className="w-full">
              <TabsList className="grid w-full max-w-2xl mx-auto mb-10" style={{ gridTemplateColumns: `repeat(${tracks.length}, 1fr)` }}>
                {tracks.map((tr) =>
              <TabsTrigger key={tr.age_group} value={tr.age_group} className="text-sm">
                    {l(tr.title_en, tr.title_ar)}
                  </TabsTrigger>
              )}
              </TabsList>

              {tracks.map((tr) => {
              const generalSteps = tr.steps.filter((s) => s.path_type === 'general');
              const softwareSteps = tr.steps.filter((s) => s.path_type === 'software');
              const hardwareSteps = tr.steps.filter((s) => s.path_type === 'hardware');
              const hasBranches = softwareSteps.length > 0 || hardwareSteps.length > 0;

              return (
                <TabsContent key={tr.age_group} value={tr.age_group}>
                    <p className="text-center text-muted-foreground mb-10 leading-relaxed">{l(tr.intro_en, tr.intro_ar)}</p>

                    <div className="relative">
                      <div className={`absolute top-0 bottom-0 w-0.5 kojo-gradient ${isRTL ? 'right-6' : 'left-6'} sm:left-1/2 sm:right-auto sm:-translate-x-1/2`} />
                      {generalSteps.map((step, i) =>
                    <div key={step.id} className={`relative flex items-start gap-4 mb-8 sm:mb-10 ${i % 2 === 0 ? 'sm:flex-row' : 'sm:flex-row-reverse'}`}>
                          <div className={`hidden sm:block sm:w-1/2 ${i % 2 === 0 ? 'sm:text-end sm:pe-10' : 'sm:text-start sm:ps-10'}`}>
                            <h4 className="font-semibold text-lg">{l(step.title_en, step.title_ar)}</h4>
                            <p className="text-sm text-muted-foreground mt-1 leading-relaxed">{l(step.desc_en, step.desc_ar)}</p>
                          </div>
                          <div className="flex-shrink-0 w-12 h-12 rounded-full kojo-gradient flex items-center justify-center text-white font-bold text-sm z-10 shadow-lg shadow-primary/20">
                            {step.step_number}
                          </div>
                          <div className="sm:w-1/2 sm:hidden">
                            <h4 className="font-semibold text-lg">{l(step.title_en, step.title_ar)}</h4>
                            <p className="text-sm text-muted-foreground mt-1 leading-relaxed">{l(step.desc_en, step.desc_ar)}</p>
                          </div>
                        </div>
                    )}
                    </div>

                    {hasBranches &&
                  <div className="mt-10">
                        <h4 className="text-center font-semibold text-lg mb-6 kojo-gradient-text">
                          {language === 'ar' ? 'اختر مسارك' : 'Choose Your Path'}
                        </h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          {[
                      { label: language === 'ar' ? '💻 مسار Software' : '💻 Software Path', steps: softwareSteps },
                      { label: language === 'ar' ? '🔧 مسار Hardware' : '🔧 Hardware Path', steps: hardwareSteps }].
                      map(({ label, steps: branchSteps }) => branchSteps.length > 0 &&
                      <div key={label} className="p-6 rounded-2xl bg-card border border-border/50">
                              <h5 className="font-semibold text-base mb-4">{label}</h5>
                              <div className="space-y-4">
                                {branchSteps.map((step) =>
                          <div key={step.id} className="flex items-start gap-3">
                                    <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center text-sm font-bold">
                                      {step.step_number}
                                    </div>
                                    <div>
                                      <h6 className="font-medium text-sm">{l(step.title_en, step.title_ar)}</h6>
                                      <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{l(step.desc_en, step.desc_ar)}</p>
                                      {step.specializations && step.specializations.length > 0 &&
                              <div className="flex flex-wrap gap-1.5 mt-2">
                                          {step.specializations.map((sp: string) =>
                                <span key={sp} className="text-xs px-2 py-0.5 rounded-full bg-secondary/10 text-secondary font-medium">{sp}</span>
                                )}
                                        </div>
                              }
                                    </div>
                                  </div>
                          )}
                              </div>
                            </div>
                      )}
                        </div>
                      </div>
                  }
                  </TabsContent>);

            })}
            </Tabs>
          </div>
        </section>
      }

      {/* ======== Plans ======== */}
      {plans.length > 0 &&
      <section id="plans" className="py-20 sm:py-28 bg-muted/30">
          <div className="max-w-6xl mx-auto px-4 sm:px-6">
            <h2 className="text-3xl sm:text-4xl font-bold text-center mb-4 kojo-gradient-text">
              {language === 'ar' ? 'الباقات والأسعار' : 'Plans & Pricing'}
            </h2>
            <p className="text-muted-foreground text-center mb-14 max-w-xl mx-auto text-base sm:text-lg leading-relaxed">
              {language === 'ar' ? 'اختر الباقة المناسبة لطفلك' : 'Choose the right plan for your child'}
            </p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8">
              {plans.map((plan) =>
            <div
              key={plan.id}
              className={`relative p-6 sm:p-8 rounded-2xl bg-card border transition-all duration-300 hover:shadow-xl hover:-translate-y-1 ${
              plan.is_featured ?
              'border-primary shadow-lg shadow-primary/10 ring-2 ring-primary/20 scale-[1.02]' :
              'border-border/50 hover:border-primary/30'}`
              }>
              
                  {plan.is_featured &&
              <div className="absolute -top-3 inset-x-0 flex justify-center">
                      <span className="px-4 py-1 text-xs font-semibold kojo-gradient text-white rounded-full shadow-md">
                        {language === 'ar' ? 'الأكثر طلباً' : 'Most Popular'}
                      </span>
                    </div>
              }
                  <div className="text-center mb-6">
                    <h3 className="text-xl font-bold mb-3">{l(plan.name_en, plan.name_ar)}</h3>
                    <div className="space-y-3">
                      {/* Offline price */}
                      {plan.price_number > 0 &&
                  <div className="flex items-center justify-center gap-2 flex-wrap">
                          <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground font-medium">
                            {language === 'ar' ? 'أوفلاين' : 'Offline'}
                          </span>
                          {plan.price_before_discount > 0 && plan.price_before_discount > plan.price_number &&
                    <span className="text-lg text-muted-foreground line-through">{plan.price_before_discount}</span>
                    }
                          <span className="text-3xl font-extrabold kojo-gradient-text">{plan.price_number}</span>
                          <span className="text-xs text-muted-foreground">{plan.price_currency}/{l(plan.billing_period_en, plan.billing_period_ar)}</span>
                        </div>
                  }
                      {/* Online price */}
                      {plan.price_online > 0 &&
                  <div className="flex items-center justify-center gap-2 flex-wrap">
                          <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary font-medium">
                            {language === 'ar' ? 'أونلاين' : 'Online'}
                          </span>
                          {plan.price_online_before_discount > 0 && plan.price_online_before_discount > plan.price_online &&
                    <span className="text-lg text-muted-foreground line-through">{plan.price_online_before_discount}</span>
                    }
                          <span className="text-3xl font-extrabold kojo-gradient-text">{plan.price_online}</span>
                          <span className="text-xs text-muted-foreground">{plan.price_currency}/{l(plan.billing_period_en, plan.billing_period_ar)}</span>
                        </div>
                  }
                      {/* No prices */}
                      {plan.price_number <= 0 && plan.price_online <= 0 &&
                  <span className="text-2xl font-bold kojo-gradient-text">
                          {language === 'ar' ? 'تواصل معنا' : 'Contact Us'}
                        </span>
                  }
                    </div>
                  </div>

                  {/* Session info */}
                  <div className="space-y-2.5 mb-5 pb-5 border-b border-border/50">
                    {plan.sessions_per_month &&
                <div className="flex items-center gap-2.5 text-sm">
                        <Check className="w-4 h-4 text-primary flex-shrink-0" />
                        <span>{plan.sessions_per_month} {language === 'ar' ? 'حصص/شهر' : 'sessions/month'}</span>
                      </div>
                }
                    {plan.session_duration_minutes &&
                <div className="flex items-center gap-2.5 text-sm">
                        <Check className="w-4 h-4 text-primary flex-shrink-0" />
                        <span>{plan.session_duration_minutes} {language === 'ar' ? 'دقيقة/حصة' : 'min/session'}</span>
                      </div>
                }
                  </div>

                  {/* Benefits */}
                  <div className="space-y-2.5 mb-8">
                    {plan.benefits.map((b) =>
                <div key={b.id} className="flex items-center gap-2.5 text-sm">
                        <Check className="w-4 h-4 text-primary flex-shrink-0" />
                        <span>{l(b.text_en, b.text_ar)}</span>
                      </div>
                )}
                  </div>

                  <Button asChild className={`w-full rounded-xl py-5 text-base ${plan.is_featured ? 'kojo-gradient text-white border-0 hover:opacity-90' : ''}`} variant={plan.is_featured ? 'default' : 'outline'}>
                    <Link to={s?.cta_url || '/auth'}>
                      {l(s?.cta_text_en, s?.cta_text_ar)}
                    </Link>
                  </Button>
                </div>
            )}
            </div>
          </div>
        </section>
      }

      {/* ======== FAQ ======== */}
      <section id="faq" className="py-20 sm:py-28">
        <div className="max-w-3xl mx-auto px-4 sm:px-6">
          <h2 className="text-3xl sm:text-4xl font-bold text-center mb-4 kojo-gradient-text">
            {language === 'ar' ? 'الأسئلة الشائعة' : 'Frequently Asked Questions'}
          </h2>
          <p className="text-muted-foreground text-center mb-12 max-w-xl mx-auto text-base sm:text-lg leading-relaxed">
            {language === 'ar' ? 'إجابات على أكثر الأسئلة شيوعاً' : 'Answers to the most common questions'}
          </p>
          <Accordion type="single" collapsible className="space-y-3">
            {faqData.map((faq, i) =>
            <AccordionItem key={i} value={`faq-${i}`} className="border border-border/50 rounded-xl px-5 data-[state=open]:border-primary/40 transition-colors">
                <AccordionTrigger className="text-base font-medium hover:no-underline py-5">
                  {l(faq.q_en, faq.q_ar)}
                </AccordionTrigger>
                <AccordionContent className="text-muted-foreground leading-relaxed pb-5">
                  {l(faq.a_en, faq.a_ar)}
                </AccordionContent>
              </AccordionItem>
            )}
          </Accordion>
        </div>
      </section>

      {/* ======== Contact Us ======== */}
      <section id="contact" className="py-20 sm:py-28 bg-muted/30">
        <div className="max-w-4xl mx-auto px-4 sm:px-6">
          <h2 className="text-3xl sm:text-4xl font-bold text-center mb-4 kojo-gradient-text">
            {language === 'ar' ? 'تواصل معنا' : 'Contact Us'}
          </h2>
          <p className="text-muted-foreground text-center mb-12 max-w-xl mx-auto text-base sm:text-lg leading-relaxed">
            {language === 'ar' ? 'نحن هنا لمساعدتك! تواصل معنا بأي طريقة تناسبك' : "We're here to help! Reach out through any channel that suits you"}
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6">
            {/* Social links from CMS */}
            {socialLinks.map((link) => {
              const Icon = socialIconMap[link.platform] || MessageCircle;
              const label = socialLabelMap[link.platform] || { en: link.platform, ar: link.platform };
              return (
                <a
                  key={link.platform}
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group flex flex-col items-center gap-3 p-6 rounded-2xl bg-card border border-border/50 hover:border-primary/50 hover:shadow-xl hover:shadow-primary/10 transition-all duration-300 hover:-translate-y-1">
                  
                  <div className="w-14 h-14 rounded-xl kojo-gradient flex items-center justify-center shadow-lg shadow-primary/20 group-hover:scale-110 transition-transform">
                    <Icon className="w-7 h-7 text-white" />
                  </div>
                  <h4 className="font-semibold text-sm">{language === 'ar' ? label.ar : label.en}</h4>
                </a>);

            })}

            {/* Email */}
            {s?.email &&
            <a href={`mailto:${s.email}`} className="group flex flex-col items-center gap-3 p-6 rounded-2xl bg-card border border-border/50 hover:border-primary/50 hover:shadow-xl hover:shadow-primary/10 transition-all duration-300 hover:-translate-y-1">
                <div className="w-14 h-14 rounded-xl kojo-gradient flex items-center justify-center shadow-lg shadow-primary/20 group-hover:scale-110 transition-transform">
                  <Mail className="w-7 h-7 text-white" />
                </div>
                <div className="text-center">
                  <h4 className="font-semibold text-sm mb-0.5">{language === 'ar' ? 'البريد الإلكتروني' : 'Email'}</h4>
                  <p className="text-xs text-muted-foreground">{s.email}</p>
                </div>
              </a>
            }

            {/* Phone */}
            {s?.phone &&
            <a href={`tel:${s.phone}`} className="group flex flex-col items-center gap-3 p-6 rounded-2xl bg-card border border-border/50 hover:border-primary/50 hover:shadow-xl hover:shadow-primary/10 transition-all duration-300 hover:-translate-y-1">
                <div className="w-14 h-14 rounded-xl kojo-gradient flex items-center justify-center shadow-lg shadow-primary/20 group-hover:scale-110 transition-transform">
                  <Phone className="w-7 h-7 text-white" />
                </div>
                <div className="text-center">
                  <h4 className="font-semibold text-sm mb-0.5">{language === 'ar' ? 'الهاتف' : 'Phone'}</h4>
                  <p className="text-xs text-muted-foreground">{s.phone}</p>
                </div>
              </a>
            }
          </div>

          {(s?.address_en || s?.address_ar) &&
          <div className="mt-8 text-center">
              <div className="inline-flex items-center gap-2 text-muted-foreground">
                <MapPin className="w-5 h-5 text-primary" />
                <span>{l(s?.address_en, s?.address_ar)}</span>
              </div>
            </div>
          }
        </div>
      </section>

      {/* ======== Footer ======== */}
      <footer className="py-10 border-t border-border/50">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2.5">
              
              <span className="font-bold kojo-gradient-text">Kojobot</span>
            </div>
            {/* Social links in footer */}
            {socialLinks.length > 0 &&
            <div className="flex items-center gap-3">
                {socialLinks.map((link) => {
                const Icon = socialIconMap[link.platform] || MessageCircle;
                return (
                  <a
                    key={link.platform}
                    href={link.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-9 h-9 rounded-lg bg-muted/50 hover:bg-primary/10 flex items-center justify-center text-muted-foreground hover:text-primary transition-colors">
                    
                      <Icon className="w-4 h-4" />
                    </a>);

              })}
              </div>
            }
            <div className="text-sm text-muted-foreground">
              {l(s?.footer_text_en, s?.footer_text_ar)}
            </div>
          </div>
        </div>
      </footer>
    </div>);

};

export default Index;