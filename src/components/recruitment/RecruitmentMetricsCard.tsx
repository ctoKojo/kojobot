import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/contexts/LanguageContext";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Briefcase, UserCheck, Clock, Calendar } from "lucide-react";

interface Metrics {
  total_applicants: number;
  hired_count: number;
  conversion_rate: number;
  avg_time_to_hire_days: number;
  total_interviews: number;
  no_show_count: number;
  no_show_rate: number;
}

export function RecruitmentMetricsCard() {
  const { isRTL } = useLanguage();
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void (async () => {
      const { data, error } = await supabase.rpc("get_recruitment_metrics", {
        p_date_from: null,
        p_date_to: null,
      });
      if (!error && data) setMetrics(data as unknown as Metrics);
      setLoading(false);
    })();
  }, []);

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {[1, 2, 3].map((i) => <Skeleton key={i} className="h-24" />)}
      </div>
    );
  }
  if (!metrics) return null;

  const items = [
    {
      icon: Clock,
      label: isRTL ? "متوسط وقت التوظيف" : "Time to Hire",
      value: `${metrics.avg_time_to_hire_days} ${isRTL ? "يوم" : "days"}`,
      sub: isRTL ? `${metrics.hired_count} موظف خلال آخر 90 يوم` : `${metrics.hired_count} hired in last 90 days`,
      color: "text-primary",
    },
    {
      icon: UserCheck,
      label: isRTL ? "نسبة التحويل" : "Conversion Rate",
      value: `${metrics.conversion_rate}%`,
      sub: isRTL ? `${metrics.hired_count} من ${metrics.total_applicants} متقدم` : `${metrics.hired_count} of ${metrics.total_applicants} applicants`,
      color: "text-green-600 dark:text-green-400",
    },
    {
      icon: Calendar,
      label: isRTL ? "نسبة عدم الحضور" : "Interview No-Show Rate",
      value: `${metrics.no_show_rate}%`,
      sub: isRTL ? `${metrics.no_show_count} من ${metrics.total_interviews} مقابلة` : `${metrics.no_show_count} of ${metrics.total_interviews} interviews`,
      color: metrics.no_show_rate > 20 ? "text-destructive" : "text-amber-600 dark:text-amber-400",
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
      {items.map((it) => (
        <Card key={it.label}>
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <div className="rounded-lg bg-muted p-2"><it.icon className={`w-5 h-5 ${it.color}`} /></div>
              <div className="flex-1 min-w-0">
                <div className="text-xs text-muted-foreground">{it.label}</div>
                <div className={`text-2xl font-bold ${it.color}`}>{it.value}</div>
                <div className="text-xs text-muted-foreground truncate">{it.sub}</div>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
