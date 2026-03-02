import { Check, Globe, MapPin, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';

interface LandingPlansProps {
  plans: any[];
  t: (ar: string, en: string) => string;
}

export function LandingPlans({ plans, t }: LandingPlansProps) {
  if (plans.length === 0) return null;

  const onlinePlans = plans.filter((p: any) => p.mode === 'online');
  const offlinePlans = plans.filter((p: any) => p.mode === 'offline');

  const renderPlan = (plan: any) => {
    const benefits: any[] = plan.benefits || [];
    return (
      <div
        key={plan.id}
        className={cn(
          "relative rounded-2xl p-7 sm:p-8 bg-card border transition-all duration-500 hover:shadow-xl hover:-translate-y-1 group",
          plan.is_featured
            ? "border-primary/40 shadow-lg shadow-primary/[0.08] ring-1 ring-primary/20"
            : "border-border/60 hover:border-primary/20"
        )}
      >
        {plan.is_featured && (
          <div className="absolute -top-3 inset-x-0 flex justify-center">
            <span className="inline-flex items-center gap-1.5 px-4 py-1 rounded-full kojo-gradient text-white text-xs font-semibold shadow-lg">
              <Sparkles className="h-3 w-3" />
              {t('الأكثر شعبية', 'Most Popular')}
            </span>
          </div>
        )}

        <h3 className="font-bold text-xl text-foreground mb-1">{t(plan.name_ar, plan.name_en)}</h3>

        {(plan.description_ar || plan.description_en) && (
          <p className="text-sm text-muted-foreground mb-5">{t(plan.description_ar || '', plan.description_en || '')}</p>
        )}

        {plan.price_number > 0 && (
          <div className="mb-6">
            <span className="text-4xl font-extrabold kojo-gradient-text">{plan.price_number}</span>
            <span className="text-sm text-muted-foreground ms-1.5">{plan.price_currency} / {t(plan.billing_period_ar, plan.billing_period_en)}</span>
          </div>
        )}

        <div className="space-y-3 text-sm">
          {plan.sessions_per_month && (
            <div className="flex items-center gap-3 text-muted-foreground">
              <div className="w-5 h-5 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                <Check className="h-3 w-3 text-primary" />
              </div>
              {plan.sessions_per_month} {t('حصة/شهر', 'sessions/month')}
            </div>
          )}
          {plan.session_duration_minutes && (
            <div className="flex items-center gap-3 text-muted-foreground">
              <div className="w-5 h-5 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                <Check className="h-3 w-3 text-primary" />
              </div>
              {plan.session_duration_minutes} {t('دقيقة/حصة', 'min/session')}
            </div>
          )}
          {benefits.map((b: any) => (
            <div key={b.id} className="flex items-center gap-3 text-muted-foreground">
              <div className="w-5 h-5 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                <Check className="h-3 w-3 text-primary" />
              </div>
              {t(b.text_ar, b.text_en)}
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <section className="py-24 sm:py-32 px-4 relative">
      <div className="absolute bottom-0 right-1/4 w-[500px] h-[500px] rounded-full bg-secondary/[0.03] blur-3xl pointer-events-none" />

      <div className="max-w-6xl mx-auto relative">
        <div className="text-center mb-16 sm:mb-20">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary/10 text-primary text-sm font-medium mb-5">
            <Sparkles className="h-3.5 w-3.5" />
            {t('الباقات', 'Plans')}
          </div>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-foreground tracking-tight">
            {t('اختر الباقة المناسبة', 'Choose the Right Plan')}
          </h2>
        </div>

        <div className="space-y-14">
          {offlinePlans.length > 0 && (
            <div>
              <h3 className="text-lg font-semibold text-foreground mb-7 flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                  <MapPin className="h-4 w-4 text-primary" />
                </div>
                {t('الحضور المباشر', 'In-Person')}
              </h3>
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {offlinePlans.map(renderPlan)}
              </div>
            </div>
          )}
          {onlinePlans.length > 0 && (
            <div>
              <h3 className="text-lg font-semibold text-foreground mb-7 flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Globe className="h-4 w-4 text-primary" />
                </div>
                {t('أونلاين', 'Online')}
              </h3>
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {onlinePlans.map(renderPlan)}
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
