import {
  Monitor, BookOpen, BarChart3, Award, Star, Code, Cpu, Rocket,
  GraduationCap, Zap, Trophy, Check, Smartphone, Globe,
  Gamepad2, Brain, Shield, Glasses, CircuitBoard, Wifi,
  Home, Timer, PcCase, GitFork,
} from 'lucide-react';

const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  Monitor, BookOpen, BarChart3, Award, Star, Code, Cpu, Rocket,
  GraduationCap, Zap, Trophy, Check, Smartphone, Globe,
  Gamepad2, Brain, Shield, Glasses, CircuitBoard, Wifi,
  Home, Timer, PcCase, GitFork,
};

interface LandingFeaturesProps {
  features: any[];
  t: (ar: string, en: string) => string;
}

export function LandingFeatures({ features, t }: LandingFeaturesProps) {
  if (features.length === 0) return null;

  return (
    <section className="py-24 sm:py-32 px-4 relative">
      {/* Subtle background accent */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[600px] rounded-full bg-primary/[0.03] blur-3xl pointer-events-none" />

      <div className="max-w-6xl mx-auto relative">
        <div className="text-center mb-16 sm:mb-20">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary/10 text-primary text-sm font-medium mb-5">
            <Zap className="h-3.5 w-3.5" />
            {t('لماذا كوجوبوت؟', 'Why Kojobot?')}
          </div>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-foreground tracking-tight">
            {t('تجربة تعليمية متكاملة', 'A Complete Learning Experience')}
          </h2>
          <p className="mt-4 text-muted-foreground max-w-xl mx-auto text-base sm:text-lg">
            {t('نوفر بيئة تعليمية تفاعلية وممتعة لتعلم البرمجة', 'We provide an interactive and fun environment to learn coding')}
          </p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5 sm:gap-6">
          {features.map((f: any, i: number) => {
            const Icon = ICON_MAP[f.icon_name] || Star;
            return (
              <div
                key={f.id}
                className="group relative rounded-2xl p-6 sm:p-7 bg-card border border-border/60 hover:border-primary/30 transition-all duration-500 hover:shadow-xl hover:shadow-primary/[0.08] hover:-translate-y-1"
              >
                {/* Gradient hover glow */}
                <div className="absolute inset-0 rounded-2xl kojo-gradient opacity-0 group-hover:opacity-[0.04] transition-opacity duration-500" />

                <div className="relative">
                  <div className="w-12 h-12 rounded-xl kojo-gradient flex items-center justify-center shadow-lg shadow-primary/20 mb-5 group-hover:scale-110 group-hover:rotate-3 transition-all duration-300">
                    <Icon className="h-6 w-6 text-white" />
                  </div>
                  <h3 className="font-bold text-foreground text-lg mb-2">{t(f.title_ar, f.title_en)}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{t(f.desc_ar, f.desc_en)}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
