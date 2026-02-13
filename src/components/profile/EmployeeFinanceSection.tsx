import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { DollarSign, TrendingUp, TrendingDown, ArrowUpRight, ArrowDownRight, RotateCcw, Wallet, Clock, CheckCircle2, Lock } from 'lucide-react';

interface EmployeeFinanceSectionProps {
  profile: any;
}

export function EmployeeFinanceSection({ profile }: EmployeeFinanceSectionProps) {
  const { isRTL, language } = useLanguage();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [snapshot, setSnapshot] = useState<any>(null);
  const [events, setEvents] = useState<any[]>([]);
  const [paidMonths, setPaidMonths] = useState<any[]>([]);

  const currentMonth = (() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
  })();

  useEffect(() => {
    if (!user) return;
    const fetch = async () => {
      setLoading(true);
      const [snapRes, eventsRes, paidRes] = await Promise.all([
        supabase.from('salary_month_snapshots').select('*').eq('employee_id', user.id).eq('month', currentMonth).maybeSingle(),
        supabase.from('salary_events').select('*').eq('employee_id', user.id).eq('month', currentMonth).order('created_at', { ascending: false }),
        supabase.from('salary_month_snapshots').select('*').eq('employee_id', user.id).eq('status', 'paid').order('month', { ascending: false }).limit(6),
      ]);
      setSnapshot(snapRes.data);
      setEvents(eventsRes.data || []);
      setPaidMonths(paidRes.data || []);
      setLoading(false);
    };
    fetch();
  }, [user, currentMonth]);

  const getStatusConfig = (status: string) => {
    switch (status) {
      case 'paid': return { icon: CheckCircle2, label: isRTL ? 'مصروف' : 'Paid', className: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' };
      case 'locked': return { icon: Lock, label: isRTL ? 'مقفول' : 'Locked', className: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400' };
      default: return { icon: Clock, label: isRTL ? 'مفتوح' : 'Open', className: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400' };
    }
  };

  const getEventIcon = (event: any) => {
    if (event.is_reversal) return <RotateCcw className="h-4 w-4 text-muted-foreground" />;
    if (['bonus', 'base_salary', 'hourly_earning'].includes(event.event_type)) return <ArrowUpRight className="h-4 w-4 text-green-600" />;
    return <ArrowDownRight className="h-4 w-4 text-destructive" />;
  };

  const getEventColor = (event: any) => {
    if (event.is_reversal) return 'text-muted-foreground';
    if (['bonus', 'base_salary', 'hourly_earning'].includes(event.event_type)) return 'text-green-600';
    return 'text-destructive';
  };

  const getEventSign = (event: any) => {
    if (event.is_reversal) {
      if (['bonus', 'base_salary', 'hourly_earning'].includes(event.event_type)) return '-';
      return '+';
    }
    if (['bonus', 'base_salary', 'hourly_earning'].includes(event.event_type)) return '+';
    return '-';
  };

  const formatMonth = (month: string) => {
    return new Date(month).toLocaleDateString(language === 'ar' ? 'ar-EG' : 'en-US', { year: 'numeric', month: 'long' });
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="py-8">
          <p className="text-center text-muted-foreground">{isRTL ? 'جاري التحميل...' : 'Loading...'}</p>
        </CardContent>
      </Card>
    );
  }

  const status = snapshot?.status || 'open';
  const statusConfig = getStatusConfig(status);
  const StatusIcon = statusConfig.icon;

  return (
    <div className="space-y-4">
      {/* Balance Card */}
      <Card className="overflow-hidden">
        <div className="bg-gradient-to-br from-primary/10 via-primary/5 to-transparent p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Wallet className="h-5 w-5 text-primary" />
              <h3 className="font-semibold text-lg">
                {isRTL ? 'محفظتك المالية' : 'Your Wallet'}
              </h3>
            </div>
            <Badge className={statusConfig.className}>
              <StatusIcon className="h-3 w-3 me-1" />
              {statusConfig.label}
            </Badge>
          </div>

          <p className="text-sm text-muted-foreground mb-1">{formatMonth(currentMonth)}</p>
          <p className="text-4xl font-bold tracking-tight">
            {snapshot?.net_amount ?? 0} <span className="text-lg font-normal text-muted-foreground">{isRTL ? 'ج.م' : 'EGP'}</span>
          </p>

          {snapshot && (
            <div className="grid grid-cols-3 gap-3 mt-4 pt-4 border-t border-border/50">
              <div>
                <p className="text-xs text-muted-foreground">{isRTL ? 'الأساسي' : 'Base'}</p>
                <p className="font-semibold text-sm">{snapshot.base_amount}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <TrendingUp className="h-3 w-3 text-green-600" />
                  {isRTL ? 'إضافات' : 'Additions'}
                </p>
                <p className="font-semibold text-sm text-green-600">+{Number(snapshot.total_bonuses) + Number(snapshot.total_earnings)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <TrendingDown className="h-3 w-3 text-destructive" />
                  {isRTL ? 'خصومات' : 'Deductions'}
                </p>
                <p className="font-semibold text-sm text-destructive">-{snapshot.total_deductions}</p>
              </div>
            </div>
          )}
        </div>
      </Card>

      {/* Events Timeline */}
      {events.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <DollarSign className="h-4 w-4" />
              {isRTL ? 'سجل الحركات' : 'Transaction History'}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {events.map((event) => (
              <div key={event.id} className="flex items-start gap-3 p-3 rounded-lg border hover:bg-muted/50 transition-colors">
                <div className="mt-0.5">{getEventIcon(event)}</div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">
                    {isRTL ? (event.description_ar || event.description || event.event_type) : (event.description || event.event_type)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(event.created_at).toLocaleDateString(language === 'ar' ? 'ar-EG' : 'en-US', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                    {event.is_reversal && (
                      <span className="ms-2 text-amber-600">({isRTL ? 'عكس' : 'Reversal'})</span>
                    )}
                  </p>
                </div>
                <span className={`font-bold text-sm whitespace-nowrap ${getEventColor(event)}`}>
                  {getEventSign(event)}{event.amount} {isRTL ? 'ج.م' : 'EGP'}
                </span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Paid Months History */}
      {paidMonths.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4" />
              {isRTL ? 'الرواتب المصروفة' : 'Paid Salaries'}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {paidMonths.map((m) => (
              <div key={m.id} className="flex items-center justify-between p-3 rounded-lg border">
                <div>
                  <p className="font-medium text-sm">{formatMonth(m.month)}</p>
                  <div className="flex gap-3 mt-1 text-xs text-muted-foreground">
                    <span>{isRTL ? 'أساسي:' : 'Base:'} {m.base_amount}</span>
                    {Number(m.total_bonuses) + Number(m.total_earnings) > 0 && (
                      <span className="text-green-600">+{Number(m.total_bonuses) + Number(m.total_earnings)}</span>
                    )}
                    {Number(m.total_deductions) > 0 && (
                      <span className="text-destructive">-{m.total_deductions}</span>
                    )}
                  </div>
                </div>
                <div className="text-end">
                  <p className="font-bold text-sm">{m.net_amount} {isRTL ? 'ج.م' : 'EGP'}</p>
                  <Badge className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">
                    {isRTL ? 'مصروف' : 'Paid'}
                  </Badge>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Empty state */}
      {!snapshot && events.length === 0 && paidMonths.length === 0 && (
        <Card>
          <CardContent className="py-8">
            <p className="text-center text-muted-foreground">{isRTL ? 'لا توجد بيانات مالية بعد' : 'No financial data yet'}</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
