import { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CalendarDays, ArrowRight } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { getCairoToday, getCairoDateOffset, formatDate } from '@/lib/timeUtils';
import { useNavigate } from 'react-router-dom';

interface ClosureBannerProps {
  role: 'admin' | 'instructor' | 'student' | 'reception';
  userId: string;
  isRTL: boolean;
  language: string;
}

interface ClosureData {
  id: string;
  start_date: string;
  end_date: string;
  reason: string | null;
  reason_ar: string | null;
  affects_all_groups: boolean;
}

export function ClosureBanner({ role, userId, isRTL, language }: ClosureBannerProps) {
  const [closure, setClosure] = useState<ClosureData | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    fetchUpcomingClosure();
  }, [userId, role]);

  const fetchUpcomingClosure = async () => {
    const today = getCairoToday();
    const weekAhead = getCairoDateOffset(7);

    // Get closures within the next 7 days that haven't ended yet
    const { data: closures } = await supabase
      .from('academy_closures' as any)
      .select('id, start_date, end_date, reason, reason_ar, affects_all_groups')
      .lte('start_date', weekAhead)
      .gte('end_date', today)
      .order('start_date', { ascending: true })
      .limit(10);

    if (!closures || closures.length === 0) {
      setClosure(null);
      return;
    }

    // Admin sees any closure
    if (role === 'admin' || role === 'reception') {
      setClosure(closures[0] as any);
      return;
    }

    // For instructor/student, filter by group membership
    let userGroupIds: string[] = [];

    if (role === 'instructor') {
      const { data: groups } = await supabase
        .from('groups')
        .select('id')
        .eq('instructor_id', userId)
        .eq('is_active', true);
      userGroupIds = (groups || []).map(g => g.id);
    } else if (role === 'student') {
      const { data: gs } = await supabase
        .from('group_students')
        .select('group_id')
        .eq('student_id', userId)
        .eq('is_active', true);
      userGroupIds = (gs || []).map(g => g.group_id);
    }

    // Find matching closure
    for (const c of closures as any[]) {
      if (c.affects_all_groups) {
        setClosure(c);
        return;
      }

      // Check if any of user's groups are in the closure's targeted groups
      if (userGroupIds.length > 0) {
        const { count } = await supabase
          .from('academy_closure_groups' as any)
          .select('id', { count: 'exact', head: true })
          .eq('closure_id', c.id)
          .in('group_id', userGroupIds);

        if (count && count > 0) {
          setClosure(c);
          return;
        }
      }
    }

    setClosure(null);
  };

  if (!closure) return null;

  const reasonText = isRTL
    ? (closure.reason_ar || closure.reason || '')
    : (closure.reason || closure.reason_ar || '');

  const dateDisplay = closure.start_date === closure.end_date
    ? formatDate(closure.start_date, language)
    : `${formatDate(closure.start_date, language)} → ${formatDate(closure.end_date, language)}`;

  return (
    <Card className="border-amber-300 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-800">
      <CardContent className="py-4 sm:py-5">
        <div className="flex items-start gap-3 sm:gap-4">
          <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-amber-100 dark:bg-amber-900/50 flex items-center justify-center flex-shrink-0">
            <CalendarDays className="w-5 h-5 sm:w-6 sm:h-6 text-amber-600" />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="font-bold text-amber-800 dark:text-amber-300 text-sm sm:text-base">
              {isRTL ? 'إجازة الأكاديمية' : 'Academy Closure'} — {dateDisplay}
            </h3>
            {reasonText && (
              <p className="text-sm text-amber-700 dark:text-amber-400 mt-0.5">
                {isRTL ? 'السبب: ' : 'Reason: '}{reasonText}
              </p>
            )}
            <p className="text-xs text-amber-600 dark:text-amber-500 mt-1">
              {isRTL ? 'لن تُعقد أي سيشنات خلال هذه الفترة' : 'No sessions will be held during this period'}
            </p>
          </div>
          {role === 'admin' && (
            <Button
              variant="ghost"
              size="sm"
              className="text-amber-700 hover:text-amber-900 hover:bg-amber-100 flex-shrink-0"
              onClick={() => navigate('/settings')}
            >
              {isRTL ? 'إدارة' : 'Manage'}
              <ArrowRight className={`h-3.5 w-3.5 ms-1 ${isRTL ? 'rotate-180' : ''}`} />
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
