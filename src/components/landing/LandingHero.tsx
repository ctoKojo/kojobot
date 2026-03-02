import { Rocket, ArrowRight, ArrowLeft, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface LandingHeroProps {
  settings: any;
  t: (ar: string, en: string) => string;
  isRTL: boolean;
  onNavigate: (path: string) => void;
}

export function LandingHero({ settings: s, t, isRTL, onNavigate }: LandingHeroProps) {
  const Arrow = isRTL ? ArrowLeft : ArrowRight;

  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden pt-16">
      {/* Layered gradient background */}
      <div className="absolute inset-0 kojo-gradient" />
      <div className="absolute inset-0 bg-gradient-to-b from-black/10 via-transparent to-black/20" />

      {/* Animated mesh */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -right-40 w-[500px] h-[500px] rounded-full bg-white/[0.07] blur-3xl animate-float" />
        <div className="absolute top-1/2 -left-32 w-[400px] h-[400px] rounded-full bg-white/[0.05] blur-3xl animate-float-delayed" />
        <div className="absolute bottom-20 right-1/4 w-[300px] h-[300px] rounded-full bg-white/[0.04] blur-3xl animate-float" style={{ animationDelay: '3s' }} />

        {/* Grid pattern overlay */}
        <div className="absolute inset-0 opacity-[0.03]" style={{
          backgroundImage: 'linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)',
          backgroundSize: '60px 60px'
        }} />

        {/* Floating code symbols */}
        <div className="absolute top-[18%] left-[8%] text-white/[0.06] text-7xl font-mono select-none animate-float">&lt;/&gt;</div>
        <div className="absolute bottom-[22%] right-[12%] text-white/[0.06] text-6xl font-mono select-none animate-float-delayed">{'{}'}</div>
        <div className="absolute top-[55%] left-[65%] text-white/[0.05] text-5xl font-mono select-none animate-float" style={{ animationDelay: '1s' }}>01</div>
        <div className="absolute top-[30%] right-[25%] text-white/[0.04] text-4xl font-mono select-none animate-float-delayed">fn()</div>
      </div>

      <div className="relative z-10 max-w-5xl mx-auto px-4 sm:px-6 text-center">
        {/* Pill badge */}
        <div className="animate-fade-in-up inline-flex items-center gap-2 px-5 py-2.5 rounded-full glass mb-10">
          <Sparkles className="h-4 w-4 text-yellow-300" />
          <span className="text-white/90 text-sm font-medium tracking-wide">
            {t('تعلم. ابتكر. تميّز.', 'Learn. Create. Excel.')}
          </span>
        </div>

        {/* Main heading */}
        <h1 className="animate-fade-in-up animation-delay-100 text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-extrabold text-white mb-8 leading-[1.1] tracking-tight">
          {t(s.hero_title_ar || 'ابدأ رحلتك في عالم البرمجة', s.hero_title_en || 'Start Your Coding Journey')}
        </h1>

        {/* Subtitle */}
        <p className="animate-fade-in-up animation-delay-200 text-lg sm:text-xl text-white/70 max-w-2xl mx-auto mb-12 leading-relaxed font-light">
          {t(s.hero_subtitle_ar || '', s.hero_subtitle_en || '')}
        </p>

        {/* CTA Buttons */}
        <div className="animate-fade-in-up animation-delay-300 flex flex-col sm:flex-row gap-4 justify-center">
          <Button
            size="lg"
            onClick={() => onNavigate(s.cta_url || '/auth')}
            className="bg-white text-foreground hover:bg-white/95 text-base sm:text-lg px-8 sm:px-10 py-6 sm:py-7 rounded-2xl font-bold shadow-2xl shadow-black/20 hover:shadow-3xl hover:-translate-y-1 transition-all duration-300 group"
          >
            {t(s.cta_text_ar || 'تسجيل الدخول', s.cta_text_en || 'Login')}
            <Arrow className="h-5 w-5 ms-2 group-hover:translate-x-1 transition-transform" />
          </Button>
          <Button
            size="lg"
            variant="ghost"
            onClick={() => document.getElementById('tracks')?.scrollIntoView({ behavior: 'smooth' })}
            className="border-2 border-white/25 text-white hover:bg-white/10 hover:border-white/40 text-base sm:text-lg px-8 sm:px-10 py-6 sm:py-7 rounded-2xl backdrop-blur-sm transition-all duration-300"
          >
            {t('اكتشف المسارات', 'Explore Tracks')}
          </Button>
        </div>

        {/* Stats row */}
        <div className="animate-fade-in-up animation-delay-500 mt-16 sm:mt-20 flex items-center justify-center gap-8 sm:gap-16">
          {[
            { num: '500+', label: t('طالب نشط', 'Active Students') },
            { num: '50+', label: t('مسار تعليمي', 'Learning Paths') },
            { num: '98%', label: t('رضا الطلاب', 'Satisfaction') },
          ].map((stat) => (
            <div key={stat.num} className="text-center">
              <div className="text-2xl sm:text-3xl font-bold text-white">{stat.num}</div>
              <div className="text-xs sm:text-sm text-white/50 mt-1">{stat.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Bottom curve */}
      <div className="absolute bottom-0 left-0 right-0">
        <svg viewBox="0 0 1440 80" fill="none" className="w-full" preserveAspectRatio="none">
          <path d="M0,40 C480,80 960,0 1440,40 L1440,80 L0,80 Z" fill="hsl(var(--background))" />
        </svg>
      </div>
    </section>
  );
}
