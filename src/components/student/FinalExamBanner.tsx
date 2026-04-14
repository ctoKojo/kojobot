import { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import { formatDateTime } from '@/lib/timeUtils';
import { BookOpen, CalendarClock, Sparkles } from 'lucide-react';

interface ExamInfo {
  exam_scheduled_at: string;
  level_name: string;
  level_name_ar: string;
}

export function FinalExamBanner({ studentId }: { studentId: string }) {
  const { isRTL, language } = useLanguage();
  const [exam, setExam] = useState<ExamInfo | null>(null);

  useEffect(() => {
    if (!studentId) return;

    const fetch = async () => {
      const { data } = await supabase
        .from('group_student_progress')
        .select('exam_scheduled_at, current_level_id, levels:current_level_id(name, name_ar)')
        .eq('student_id', studentId)
        .not('exam_scheduled_at', 'is', null)
        .is('exam_submitted_at', null)
        .eq('status', 'exam_scheduled')
        .limit(1)
        .maybeSingle();

      if (data?.exam_scheduled_at) {
        const level = data.levels as any;
        setExam({
          exam_scheduled_at: data.exam_scheduled_at,
          level_name: level?.name || '',
          level_name_ar: level?.name_ar || '',
        });
      }
    };

    fetch();
  }, [studentId]);

  if (!exam) return null;

  const levelName = language === 'ar' ? exam.level_name_ar : exam.level_name;

  return (
    <Card className="relative overflow-hidden border-2 border-amber-400 dark:border-amber-500 shadow-lg shadow-amber-500/10">
      {/* Animated background */}
      <div className="absolute inset-0 bg-gradient-to-br from-amber-50 via-orange-50 to-yellow-50 dark:from-amber-950/40 dark:via-orange-950/30 dark:to-yellow-950/20" />
      <div className="absolute top-0 right-0 w-40 h-40 bg-gradient-to-br from-amber-400/20 to-orange-400/10 rounded-full -translate-y-12 translate-x-12" />
      <div className="absolute bottom-0 left-0 w-32 h-32 bg-gradient-to-tr from-yellow-400/15 to-amber-400/10 rounded-full translate-y-10 -translate-x-10" />

      {/* Sparkle decorations */}
      <Sparkles className="absolute top-4 right-4 w-5 h-5 text-amber-400/60 animate-pulse" />
      <Sparkles className="absolute bottom-4 left-6 w-4 h-4 text-yellow-400/50 animate-pulse delay-700" />

      <CardContent className="relative py-6 sm:py-8">
        <div className="flex flex-col items-center text-center gap-4">
          {/* Icon */}
          <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-gradient-to-br from-amber-500 to-orange-600 shadow-lg shadow-amber-500/30 flex items-center justify-center">
            <BookOpen className="w-8 h-8 sm:w-10 sm:h-10 text-white" />
          </div>

          {/* Title */}
          <div>
            <h2 className="text-xl sm:text-2xl font-extrabold text-amber-900 dark:text-amber-200">
              {isRTL ? '📋 امتحان نهائي مُجدول!' : '📋 Final Exam Scheduled!'}
            </h2>
            <p className="text-sm sm:text-base text-amber-700 dark:text-amber-400 mt-1 font-medium">
              {isRTL
                ? `تم تحديد موعد الامتحان النهائي لمستوى ${levelName}`
                : `Your final exam for ${levelName} has been scheduled`}
            </p>
          </div>

          {/* Date/Time */}
          <div className="flex items-center gap-2 px-5 py-3 rounded-xl bg-white/70 dark:bg-black/20 border border-amber-200 dark:border-amber-700">
            <CalendarClock className="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0" />
            <span className="text-base sm:text-lg font-bold text-amber-800 dark:text-amber-300">
              {formatDateTime(exam.exam_scheduled_at)}
            </span>
          </div>

          {/* Motivational text */}
          <p className="text-sm text-amber-600/80 dark:text-amber-400/70 max-w-sm">
            {isRTL
              ? 'استعد كويس وراجع كل اللي اتعلمته — بالتوفيق! 💪'
              : 'Prepare well and review everything you learned — good luck! 💪'}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
