import { Code, Cpu, GitFork } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';

interface LandingTracksProps {
  tracks: any[];
  t: (ar: string, en: string) => string;
  isRTL: boolean;
}

export function LandingTracks({ tracks, t, isRTL }: LandingTracksProps) {
  if (tracks.length === 0) return null;

  return (
    <section id="tracks" className="py-24 sm:py-32 px-4 bg-muted/30 relative overflow-hidden">
      {/* Background decoration */}
      <div className="absolute top-20 right-0 w-[400px] h-[400px] rounded-full bg-primary/[0.03] blur-3xl pointer-events-none" />
      <div className="absolute bottom-20 left-0 w-[300px] h-[300px] rounded-full bg-secondary/[0.03] blur-3xl pointer-events-none" />

      <div className="max-w-6xl mx-auto relative">
        <div className="text-center mb-16 sm:mb-20">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary/10 text-primary text-sm font-medium mb-5">
            <Code className="h-3.5 w-3.5" />
            {t('خارطة المسار', 'Learning Roadmap')}
          </div>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-foreground tracking-tight">
            {t('مسارات تعليمية لكل الأعمار', 'Learning Tracks for All Ages')}
          </h2>
        </div>

        <Tabs defaultValue={tracks[0]?.age_group || '6_9'} className="w-full">
          <TabsList className="grid w-full max-w-md mx-auto grid-cols-3 mb-12 h-14 bg-muted/60 backdrop-blur-sm p-1 rounded-2xl">
            {tracks.map((g: any) => (
              <TabsTrigger
                key={g.age_group}
                value={g.age_group}
                className="text-sm font-semibold rounded-xl data-[state=active]:kojo-gradient data-[state=active]:text-white data-[state=active]:shadow-lg transition-all"
              >
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
                  <p className="text-center text-muted-foreground mb-12 text-lg max-w-2xl mx-auto leading-relaxed">
                    {t(g.intro_ar, g.intro_en)}
                  </p>

                  {/* General steps */}
                  <div className="space-y-0 mb-8">
                    {generalSteps.map((step: any, i: number) => (
                      <TimelineStep key={step.id} step={step} index={i} isLast={!hasBranch && i === generalSteps.length - 1} t={t} />
                    ))}
                  </div>

                  {/* Branch fork */}
                  {hasBranch && (
                    <>
                      <div className="flex items-center justify-center gap-4 my-10">
                        <div className="h-px flex-1 bg-gradient-to-r from-transparent via-primary/20 to-transparent" />
                        <div className="flex items-center gap-2 px-5 py-2.5 rounded-full kojo-gradient text-white text-sm font-semibold shadow-lg shadow-primary/20">
                          <GitFork className="h-4 w-4" />
                          {t('اختر مسارك', 'Choose Your Path')}
                        </div>
                        <div className="h-px flex-1 bg-gradient-to-r from-transparent via-primary/20 to-transparent" />
                      </div>

                      <div className="grid md:grid-cols-2 gap-6">
                        {/* Software Path */}
                        <div className="rounded-2xl overflow-hidden border border-primary/20 bg-card shadow-sm hover:shadow-lg transition-shadow duration-300">
                          <div className="kojo-gradient p-5 flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center">
                              <Code className="h-5 w-5 text-white" />
                            </div>
                            <h4 className="font-bold text-white text-lg">{t('مسار البرمجيات', 'Software Track')}</h4>
                          </div>
                          <div className="p-5 space-y-0">
                            {softwareSteps.map((step: any, i: number) => (
                              <BranchStep key={step.id} step={step} index={i} isLast={i === softwareSteps.length - 1} t={t} />
                            ))}
                          </div>
                        </div>

                        {/* Hardware Path */}
                        <div className="rounded-2xl overflow-hidden border border-secondary/20 bg-card shadow-sm hover:shadow-lg transition-shadow duration-300">
                          <div className="bg-secondary p-5 flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center">
                              <Cpu className="h-5 w-5 text-white" />
                            </div>
                            <h4 className="font-bold text-white text-lg">{t('مسار الهاردوير', 'Hardware Track')}</h4>
                          </div>
                          <div className="p-5 space-y-0">
                            {hardwareSteps.map((step: any, i: number) => (
                              <BranchStep key={step.id} step={step} index={i} isLast={i === hardwareSteps.length - 1} t={t} variant="secondary" />
                            ))}
                          </div>
                        </div>
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
  );
}

function TimelineStep({ step, index, isLast, t }: { step: any; index: number; isLast: boolean; t: (ar: string, en: string) => string }) {
  return (
    <div className="flex gap-5">
      <div className="flex flex-col items-center">
        <div className="w-11 h-11 rounded-xl kojo-gradient flex items-center justify-center text-white font-bold text-sm shadow-lg shadow-primary/20 shrink-0">
          {step.step_number}
        </div>
        {!isLast && <div className="w-0.5 flex-1 min-h-[2.5rem] bg-gradient-to-b from-primary/30 to-primary/5" />}
      </div>
      <div className={cn("pb-10", isLast && "pb-0")}>
        <h4 className="font-bold text-foreground text-lg">{t(step.title_ar, step.title_en)}</h4>
        <p className="text-sm text-muted-foreground mt-1.5 leading-relaxed max-w-lg">{t(step.desc_ar, step.desc_en)}</p>
      </div>
    </div>
  );
}

function BranchStep({ step, index, isLast, t, variant = 'primary' }: { step: any; index: number; isLast: boolean; t: (ar: string, en: string) => string; variant?: 'primary' | 'secondary' }) {
  const specs: string[] = step.specializations || [];
  return (
    <div className="flex gap-3.5 py-3.5">
      <div className="flex flex-col items-center">
        <div className={cn(
          "w-8 h-8 rounded-lg flex items-center justify-center text-white font-bold text-xs shrink-0 shadow-sm",
          variant === 'primary' ? 'bg-primary' : 'bg-secondary'
        )}>
          {step.step_number}
        </div>
        {!isLast && <div className={cn("w-0.5 flex-1 min-h-[1rem]", variant === 'primary' ? 'bg-primary/15' : 'bg-secondary/15')} />}
      </div>
      <div className="flex-1 min-w-0">
        <h5 className="font-semibold text-foreground text-sm">{t(step.title_ar, step.title_en)}</h5>
        <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{t(step.desc_ar, step.desc_en)}</p>
        {specs.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-2.5">
            {specs.map((sp: string) => (
              <span key={sp} className="inline-flex text-[11px] px-2.5 py-1 rounded-full bg-muted text-muted-foreground font-medium">
                {sp}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
