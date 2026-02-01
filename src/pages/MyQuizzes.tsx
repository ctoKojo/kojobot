import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { FileQuestion, Play, CheckCircle, Clock, Calendar } from 'lucide-react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';

interface QuizAssignment {
  id: string;
  quiz_id: string;
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

  useEffect(() => {
    if (user) fetchQuizzes();
  }, [user]);

  const fetchQuizzes = async () => {
    try {
      // Get student's groups
      const { data: groupData } = await supabase
        .from('group_students')
        .select('group_id')
        .eq('student_id', user?.id)
        .eq('is_active', true);

      const groupIds = groupData?.map(g => g.group_id) || [];

      // Build filter for quiz assignments
      let query = supabase
        .from('quiz_assignments')
        .select('*, quizzes(id, title, title_ar, description, description_ar, duration_minutes)')
        .eq('is_active', true)
        .order('created_at', { ascending: false });

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

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString(language === 'ar' ? 'ar-EG' : 'en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
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
        {/* Pending Quizzes */}
        <div>
          <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
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
              {pendingQuizzes.map((quiz) => (
                <Card key={quiz.id} className="hover:shadow-md transition-shadow">
                  <CardHeader>
                    <CardTitle className="text-lg">
                      {language === 'ar' ? quiz.quizzes?.title_ar : quiz.quizzes?.title}
                    </CardTitle>
                    <CardDescription>
                      {language === 'ar' ? quiz.quizzes?.description_ar : quiz.quizzes?.description}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Clock className="w-4 h-4" />
                        {quiz.quizzes?.duration_minutes} {isRTL ? 'دقيقة' : 'min'}
                      </span>
                      {quiz.due_date && (
                        <span className="flex items-center gap-1">
                          <Calendar className="w-4 h-4" />
                          {formatDate(quiz.due_date)}
                        </span>
                      )}
                    </div>
                    <Button
                      className="w-full kojo-gradient"
                      onClick={() => navigate(`/quiz/${quiz.id}`)}
                    >
                      <Play className="w-4 h-4 mr-2" />
                      {isRTL ? 'ابدأ الكويز' : 'Start Quiz'}
                    </Button>
                  </CardContent>
                </Card>
              ))}
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
                <Card key={quiz.id} className="border-green-200 bg-green-50/50">
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div>
                        <CardTitle className="text-lg">
                          {language === 'ar' ? quiz.quizzes?.title_ar : quiz.quizzes?.title}
                        </CardTitle>
                        <CardDescription>
                          {isRTL ? 'تم التسليم: ' : 'Submitted: '}
                          {quiz.submission && formatDate(quiz.submission.submitted_at)}
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
                  <CardContent>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">
                        {isRTL ? 'الدرجة: ' : 'Score: '}
                      </span>
                      <span className="font-semibold">
                        {quiz.submission?.score} / {quiz.submission?.max_score}
                      </span>
                    </div>
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
