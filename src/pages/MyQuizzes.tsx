import { useState, useEffect } from 'react';
import { formatDate, formatDateTime } from '@/lib/timeUtils';
import { useNavigate } from 'react-router-dom';
import { FileQuestion, Play, CheckCircle, Clock, Calendar, Snowflake } from 'lucide-react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { StudentQuizPreviewDialog } from '@/components/quiz/StudentQuizPreviewDialog';

interface QuizAssignment {
  id: string;
  quiz_id: string;
  start_time: string | null;
  due_date: string | null;
  created_at: string;
  quizzes: {
    id: string;
    title: string;
    title_ar: string;
    description: string | null;
    description_ar: string | null;
    duration_minutes: number;
  };
  submission?: {
    id: string;
    score: number;
    max_score: number;
    percentage: number;
    submitted_at: string;
  };
}

export default function MyQuizzes() {
  const { t, isRTL, language } = useLanguage();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [quizzes, setQuizzes] = useState<QuizAssignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [, setRefreshTrigger] = useState(0);
  const [isFrozen, setIsFrozen] = useState(false);

  useEffect(() => {
    if (user) fetchQuizzes();
  }, [user]);

  // Auto-refresh every minute to update remaining time display
  useEffect(() => {
    const interval = setInterval(() => {
      setRefreshTrigger(prev => prev + 1);
    }, 60000); // Update every minute

    return () => clearInterval(interval);
  }, []);

  const fetchQuizzes = async () => {
    try {
      // Get student's groups and check frozen status
      const { data: groupData } = await supabase
        .from('group_students')
        .select('group_id, groups(status)')
        .eq('student_id', user?.id)
        .eq('is_active', true);

      const groupIds = groupData?.map(g => g.group_id) || [];
      const frozen = groupData?.some(g => (g.groups as any)?.status === 'frozen') || false;
      setIsFrozen(frozen);

      // Build filter for quiz assignments
      let query = supabase
        .from('quiz_assignments')
        .select('*, quizzes(id, title, title_ar, description, description_ar, duration_minutes)')
        .eq('is_active', true)
        .eq('is_auto_generated', false)
        .order('start_time', { ascending: true });

      if (groupIds.length > 0) {
        query = query.or(`student_id.eq.${user?.id},group_id.in.(${groupIds.join(',')})`);
      } else {
        query = query.eq('student_id', user?.id);
      }

      const { data: assignments, error } = await query;

      if (error) throw error;

      // Get submissions for these assignments
      const { data: submissions } = await supabase
        .from('quiz_submissions')
        .select('id, quiz_assignment_id, score, max_score, percentage, submitted_at')
        .eq('student_id', user?.id);

      const submissionsMap = new Map(submissions?.map(s => [s.quiz_assignment_id, s]));

      const quizzesWithSubmissions = (assignments || []).map(assignment => ({
        ...assignment,
        submission: submissionsMap.get(assignment.id),
      }));

      setQuizzes(quizzesWithSubmissions);
    } catch (error) {
      console.error('Error fetching quizzes:', error);
    } finally {
      setLoading(false);
    }
  };

  // SSOT: using centralized formatDate from timeUtils.ts with Cairo timezone

  const getQuizStatus = (quiz: QuizAssignment) => {
    const now = new Date().getTime();
    const startTime = quiz.start_time ? new Date(quiz.start_time).getTime() : null;
    const dueDate = quiz.due_date ? new Date(quiz.due_date).getTime() : null;
    const duration = quiz.quizzes?.duration_minutes || 30;
    
    // If no start_time is set, quiz is available immediately
    if (!startTime) {
      if (dueDate && now > dueDate) {
        return 'expired';
      }
      return 'available';
    }
    
    // Quiz hasn't started yet
    if (now < startTime) {
      return 'not_started';
    }
    
    // SSOT: due_date is the authoritative end (already includes extra_minutes / extensions).
    // Fall back to start_time + duration only if due_date is missing.
    const quizEndTime = dueDate ?? (startTime + duration * 60 * 1000);

    // Quiz time window has passed
    if (now > quizEndTime) {
      return 'expired';
    }

    // Quiz is available
    return 'available';
  };

  const getRemainingTime = (quiz: QuizAssignment) => {
    const now = new Date().getTime();
    const startTime = quiz.start_time ? new Date(quiz.start_time).getTime() : now;
    const dueDate = quiz.due_date ? new Date(quiz.due_date).getTime() : null;
    const duration = quiz.quizzes?.duration_minutes || 30;

    // Prefer due_date (which already accounts for extensions/extra_minutes).
    const endTime = dueDate ?? startTime + duration * 60 * 1000;
    const remaining = endTime - now;

    if (remaining <= 0) return 0;
    return Math.floor(remaining / 60000); // Return in minutes
  };

  const pendingQuizzes = quizzes.filter(q => !q.submission);
  const completedQuizzes = quizzes.filter(q => q.submission);

  if (loading) {
    return (
      <DashboardLayout title={isRTL ? 'كويزاتي' : 'My Quizzes'}>
        <div className="flex items-center justify-center h-64">
          <p className="text-muted-foreground">{t.common.loading}</p>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout title={isRTL ? 'كويزاتي' : 'My Quizzes'}>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2.5 rounded-xl bg-gradient-to-br from-indigo-500 to-indigo-600 shadow-lg shadow-indigo-500/20">
            <FileQuestion className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold">{isRTL ? 'كويزاتي' : 'My Quizzes'}</h1>
            <p className="text-sm text-muted-foreground">{isRTL ? 'كويزات بانتظارك ونتائجك' : 'Your pending and completed quizzes'}</p>
          </div>
        </div>

        {/* Frozen Group Alert */}
        {isFrozen && (
          <Card className="border-sky-300 bg-sky-50 dark:bg-sky-950/30 dark:border-sky-800">
            <CardContent className="py-4">
              <div className="flex items-center gap-3">
                <Snowflake className="w-5 h-5 text-sky-600 flex-shrink-0" />
                <p className="text-sm text-sky-700 dark:text-sky-400">
                  {isRTL 
                    ? 'مجموعتك مجمدة حالياً — لن تستلم كويزات جديدة. الكويزات السابقة متاحة للمراجعة.'
                    : 'Your group is frozen — no new quizzes will be assigned. Previous quizzes are available for review.'}
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Pending Quizzes */}
        <div>
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Clock className="h-5 w-5 text-primary" />
            {isRTL ? 'كويزات بانتظارك' : 'Pending Quizzes'}
            {pendingQuizzes.length > 0 && (
              <Badge variant="secondary">{pendingQuizzes.length}</Badge>
            )}
          </h2>

          {pendingQuizzes.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                <FileQuestion className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>{isRTL ? 'لا توجد كويزات حالياً' : 'No pending quizzes'}</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {pendingQuizzes.map((quiz) => {
                const status = getQuizStatus(quiz);
                const remainingMinutes = getRemainingTime(quiz);
                const isExpired = status === 'expired';
                const isNotStarted = status === 'not_started';
                const isAvailable = status === 'available';
                
                return (
                  <Card key={quiz.id} className={`hover:shadow-md transition-shadow ${isExpired ? 'opacity-60' : ''}`}>
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div>
                          <CardTitle className="text-lg">
                            {language === 'ar' ? quiz.quizzes?.title_ar : quiz.quizzes?.title}
                          </CardTitle>
                          <CardDescription>
                            {language === 'ar' ? quiz.quizzes?.description_ar : quiz.quizzes?.description}
                          </CardDescription>
                        </div>
                        {isNotStarted && (
                          <Badge variant="secondary" className="shrink-0">
                            {isRTL ? 'لم يبدأ' : 'Not Started'}
                          </Badge>
                        )}
                        {isExpired && (
                          <Badge variant="destructive" className="shrink-0">
                            {isRTL ? 'انتهى الوقت' : 'Expired'}
                          </Badge>
                        )}
                        {isAvailable && remainingMinutes < quiz.quizzes?.duration_minutes && (
                          <Badge variant="outline" className="shrink-0 text-orange-600 border-orange-300">
                            {isRTL ? `متبقي ${remainingMinutes} د` : `${remainingMinutes}m left`}
                          </Badge>
                        )}
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="flex flex-col gap-2 text-sm text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Clock className="w-4 h-4" />
                          {quiz.quizzes?.duration_minutes} {isRTL ? 'دقيقة' : 'min'}
                        </span>
                        {quiz.start_time && (
                          <span className="flex items-center gap-1">
                            <Play className="w-4 h-4" />
                            {isRTL ? 'يبدأ: ' : 'Starts: '}{formatDateTime(quiz.start_time)}
                          </span>
                        )}
                        {quiz.due_date && (
                          <span className="flex items-center gap-1">
                            <Calendar className="w-4 h-4" />
                            {isRTL ? 'ينتهي: ' : 'Due: '}{formatDateTime(quiz.due_date)}
                          </span>
                        )}
                      </div>
                      
                      {isNotStarted && quiz.start_time && (
                        <div className="p-3 rounded-lg bg-muted text-center">
                          <p className="text-sm font-medium">
                            {isRTL ? 'الكويز يبدأ في:' : 'Quiz starts at:'}
                          </p>
                          <p className="text-lg font-bold text-primary">
                            {formatDateTime(quiz.start_time)}
                          </p>
                        </div>
                      )}
                      
                      {isExpired ? (
                        <Button className="w-full" variant="secondary" disabled>
                          {isRTL ? 'انتهى وقت الكويز' : 'Quiz Time Expired'}
                        </Button>
                      ) : isNotStarted ? (
                        <Button className="w-full" variant="secondary" disabled>
                          {isRTL ? 'الكويز لم يبدأ بعد' : 'Quiz Not Started Yet'}
                        </Button>
                      ) : (
                        <Button
                          className="w-full kojo-gradient"
                          onClick={() => navigate(`/quiz/${quiz.id}`)}
                        >
                          <Play className="w-4 h-4 mr-2" />
                          {isRTL ? 'ابدأ الكويز' : 'Start Quiz'}
                        </Button>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>

        {/* Completed Quizzes */}
        {completedQuizzes.length > 0 && (
          <div>
            <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-green-600" />
              {isRTL ? 'كويزات مكتملة' : 'Completed Quizzes'}
              <Badge variant="outline">{completedQuizzes.length}</Badge>
            </h2>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {completedQuizzes.map((quiz) => (
                <Card key={quiz.id} className="border-green-200 bg-green-50/50 dark:border-green-800 dark:bg-green-950/30">
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div>
                        <CardTitle className="text-lg">
                          {language === 'ar' ? quiz.quizzes?.title_ar : quiz.quizzes?.title}
                        </CardTitle>
                        <CardDescription>
                          {isRTL ? 'تم التسليم: ' : 'Submitted: '}
                          {quiz.submission && formatDate(quiz.submission.submitted_at, language)}
                        </CardDescription>
                      </div>
                      <Badge 
                        variant={quiz.submission && quiz.submission.percentage >= 60 ? 'default' : 'destructive'}
                        className={quiz.submission && quiz.submission.percentage >= 60 ? 'bg-green-600' : ''}
                      >
                        {quiz.submission?.percentage}%
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">
                        {isRTL ? 'الدرجة: ' : 'Score: '}
                      </span>
                      <span className="font-semibold">
                        {quiz.submission?.score} / {quiz.submission?.max_score}
                      </span>
                    </div>
                    {quiz.submission && (
                      <StudentQuizPreviewDialog
                        submissionId={quiz.submission.id}
                        quizTitle={quiz.quizzes?.title || ''}
                        quizTitleAr={quiz.quizzes?.title_ar || ''}
                        score={quiz.submission.score}
                        maxScore={quiz.submission.max_score}
                        percentage={quiz.submission.percentage}
                        submittedAt={quiz.submission.submitted_at}
                      />
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
