import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import { formatDateTime } from '@/lib/timeUtils';
import { BookOpen, CalendarClock, Sparkles, Play, Clock } from 'lucide-react';

interface ExamInfo {
  exam_scheduled_at: string;
  level_name: string;
  level_name_ar: string;
  quiz_assignment_id: string | null;
  start_time: string | null;
  due_date: string | null;
  duration_minutes: number | null;
}

export function FinalExamBanner({ studentId }: { studentId: string }) {
  const { isRTL, language } = useLanguage();
  const navigate = useNavigate();
  const [exam, setExam] = useState<ExamInfo | null>(null);
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    if (!studentId) return;

    const fetchExam = async () => {
      // Get progress with exam scheduled
      const { data: progress } = await supabase
        .from('group_student_progress')
        .select('exam_scheduled_at, current_level_id, group_id, levels:current_level_id(name, name_ar, final_exam_quiz_id)')
        .eq('student_id', studentId)
        .not('exam_scheduled_at', 'is', null)
        .is('exam_submitted_at', null)
        .eq('status', 'exam_scheduled')
        .limit(1)
        .maybeSingle();

      if (!progress?.exam_scheduled_at) return;

      const level = progress.levels as any;
      const finalQuizId = level?.final_exam_quiz_id;

      let quizAssignmentId: string | null = null;
      let startTime: string | null = null;
      let dueDate: string | null = null;
      let durationMinutes: number | null = null;

      if (finalQuizId) {
        // Get quiz assignment for this student
        const { data: qa } = await supabase
          .from('quiz_assignments')
          .select('id, start_time, due_date')
          .eq('quiz_id', finalQuizId)
          .eq('student_id', studentId)
          .eq('is_active', true)
          .maybeSingle();

        if (qa) {
          quizAssignmentId = qa.id;
          startTime = qa.start_time;
          dueDate = qa.due_date;
          // Calculate duration from the scheduled window (what admin set), not quiz default
          if (qa.start_time && qa.due_date) {
            durationMinutes = Math.round((new Date(qa.due_date).getTime() - new Date(qa.start_time).getTime()) / 60000);
          }
        }
      }

      setExam({
        exam_scheduled_at: progress.exam_scheduled_at,
        level_name: level?.name || '',
        level_name_ar: level?.name_ar || '',
        quiz_assignment_id: quizAssignmentId,
        start_time: startTime,
        due_date: dueDate,
        duration_minutes: durationMinutes,
      });
    };

    fetchExam();
  }, [studentId]);

  // Update "now" every 30 seconds to check if exam time has arrived
  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(interval);
  }, []);

  if (!exam) return null;

  const levelName = language === 'ar' ? exam.level_name_ar : exam.level_name;
  const examTime = exam.start_time ? new Date(exam.start_time) : new Date(exam.exam_scheduled_at);
  const examEnd = exam.due_date ? new Date(exam.due_date) : null;
  const canStart = now >= examTime && (!examEnd || now <= examEnd);
  const isUpcoming = now < examTime;
  const isExpired = examEnd ? now > examEnd : false;

  return (
    <Card className="relative overflow-hidden border-2 border-amber-400 dark:border-amber-500 shadow-lg shadow-amber-500/10">
      {/* Background */}
      <div className="absolute inset-0 bg-gradient-to-br from-amber-50 via-orange-50 to-yellow-50 dark:from-amber-950/40 dark:via-orange-950/30 dark:to-yellow-950/20" />
      <div className="absolute top-0 right-0 w-40 h-40 bg-gradient-to-br from-amber-400/20 to-orange-400/10 rounded-full -translate-y-12 translate-x-12" />
      <div className="absolute bottom-0 left-0 w-32 h-32 bg-gradient-to-tr from-yellow-400/15 to-amber-400/10 rounded-full translate-y-10 -translate-x-10" />

      {/* Sparkles */}
      <Sparkles className="absolute top-4 right-4 w-5 h-5 text-amber-400/60 animate-pulse" />
      <Sparkles className="absolute bottom-4 left-6 w-4 h-4 text-yellow-400/50 animate-pulse delay-700" />

      <CardContent className="relative py-6 sm:py-8">
        <div className="flex flex-col items-center text-center gap-4">
          {/* Icon */}
          <div className={`w-16 h-16 sm:w-20 sm:h-20 rounded-2xl shadow-lg flex items-center justify-center ${
            canStart
              ? 'bg-gradient-to-br from-green-500 to-emerald-600 shadow-green-500/30 animate-pulse'
              : 'bg-gradient-to-br from-amber-500 to-orange-600 shadow-amber-500/30'
          }`}>
            {canStart ? (
              <Play className="w-8 h-8 sm:w-10 sm:h-10 text-white" />
            ) : (
              <BookOpen className="w-8 h-8 sm:w-10 sm:h-10 text-white" />
            )}
          </div>

          {/* Title */}
          <div>
            <h2 className="text-xl sm:text-2xl font-extrabold text-amber-900 dark:text-amber-200">
              {canStart
                ? (isRTL ? '🚀 الامتحان النهائي متاح الآن!' : '🚀 Final Exam Available Now!')
                : (isRTL ? '📋 امتحان نهائي مُجدول!' : '📋 Final Exam Scheduled!')}
            </h2>
            <p className="text-sm sm:text-base text-amber-700 dark:text-amber-400 mt-1 font-medium">
              {isRTL
                ? `الامتحان النهائي لمستوى ${levelName}`
                : `Final exam for ${levelName}`}
            </p>
          </div>

          {/* Date/Time + Duration */}
          <div className="flex flex-col sm:flex-row items-center gap-2">
            <div className="flex items-center gap-2 px-5 py-3 rounded-xl bg-white/70 dark:bg-black/20 border border-amber-200 dark:border-amber-700">
              <CalendarClock className="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0" />
              <span className="text-base sm:text-lg font-bold text-amber-800 dark:text-amber-300">
                {formatDateTime(exam.start_time || exam.exam_scheduled_at)}
              </span>
            </div>
            {exam.duration_minutes && (
              <div className="flex items-center gap-1.5 px-4 py-3 rounded-xl bg-white/70 dark:bg-black/20 border border-amber-200 dark:border-amber-700">
                <Clock className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                <span className="text-sm font-semibold text-amber-800 dark:text-amber-300">
                  {isRTL ? `${exam.duration_minutes} دقيقة` : `${exam.duration_minutes} min`}
                </span>
              </div>
            )}
          </div>

          {/* Start Exam Button - only when time has arrived */}
          {canStart && exam.quiz_assignment_id && (
            <Button
              size="lg"
              onClick={() => navigate(`/quiz/${exam.quiz_assignment_id}`)}
              className="gap-2 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white font-bold text-lg px-8 py-6 rounded-xl shadow-lg shadow-green-500/30 hover:shadow-xl hover:shadow-green-500/40 transition-all"
            >
              <Play className="w-5 h-5" />
              {isRTL ? 'ابدأ الامتحان الآن' : 'Start Exam Now'}
            </Button>
          )}

          {/* Motivational text */}
          <p className="text-sm text-amber-600/80 dark:text-amber-400/70 max-w-sm">
            {canStart
              ? (isRTL ? 'بالتوفيق! ركز وخد وقتك 💪' : 'Good luck! Stay focused and take your time 💪')
              : isUpcoming
              ? (isRTL ? 'استعد كويس وراجع كل اللي اتعلمته — بالتوفيق! 💪' : 'Prepare well and review everything you learned — good luck! 💪')
              : (isRTL ? 'استعد كويس وراجع كل اللي اتعلمته — بالتوفيق! 💪' : 'Prepare well and review everything you learned — good luck! 💪')}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
