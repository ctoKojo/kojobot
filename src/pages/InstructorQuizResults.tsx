import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { 
  FileQuestion, 
  Users, 
  Trophy, 
  Clock, 
  Eye, 
  CheckCircle, 
  XCircle,
  AlertTriangle,
  ChevronRight
} from 'lucide-react';

interface AssignedQuiz {
  id: string;
  quiz_id: string;
  quiz_title: string;
  quiz_title_ar: string;
  group_id: string;
  group_name: string;
  group_name_ar: string;
  start_time: string | null;
  due_date: string | null;
  created_at: string;
  duration_minutes: number;
  passing_score: number;
  total_students: number;
  completed_count: number;
  passed_count: number;
  average_score: number;
}

interface StudentResult {
  student_id: string;
  student_name: string;
  student_name_ar: string;
  score: number | null;
  max_score: number | null;
  percentage: number | null;
  status: string;
  submitted_at: string | null;
  answers: any;
}

interface QuestionDetail {
  question_text: string;
  question_text_ar: string;
  options: string[] | { en: string[]; ar: string[] };
  correct_answer: string;
  student_answer: string | null;
  is_correct: boolean;
  points: number;
}

export default function InstructorQuizResultsPage() {
  const { isRTL, language } = useLanguage();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [assignedQuizzes, setAssignedQuizzes] = useState<AssignedQuiz[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedQuiz, setSelectedQuiz] = useState<AssignedQuiz | null>(null);
  const [studentResults, setStudentResults] = useState<StudentResult[]>([]);
  const [allGroupStudents, setAllGroupStudents] = useState<{ id: string; name: string; name_ar: string }[]>([]);
  const [loadingResults, setLoadingResults] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<StudentResult | null>(null);
  const [questionDetails, setQuestionDetails] = useState<QuestionDetail[]>([]);
  const [loadingDetails, setLoadingDetails] = useState(false);

  useEffect(() => {
    if (user) fetchAssignedQuizzes();
  }, [user]);

  const fetchAssignedQuizzes = async () => {
    if (!user) return;
    
    try {
      // Get quizzes assigned by this instructor
      const { data: assignments, error } = await supabase
        .from('quiz_assignments')
        .select(`
          id,
          quiz_id,
          group_id,
          start_time,
          due_date,
          created_at,
          quizzes(id, title, title_ar, duration_minutes, passing_score),
          groups(id, name, name_ar)
        `)
        .eq('assigned_by', user.id)
        .eq('is_active', true)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // For each assignment, get stats
      const enrichedQuizzes: AssignedQuiz[] = [];

      for (const assignment of assignments || []) {
        if (!assignment.quizzes || !assignment.groups) continue;

        const quiz = assignment.quizzes as any;
        const group = assignment.groups as any;

        // Get total students in group
        const { count: totalStudents } = await supabase
          .from('group_students')
          .select('id', { count: 'exact' })
          .eq('group_id', assignment.group_id)
          .eq('is_active', true);

        // Get submissions for this assignment
        const { data: submissions } = await supabase
          .from('quiz_submissions')
          .select('id, score, max_score, percentage, status')
          .eq('quiz_assignment_id', assignment.id);

        const completedSubmissions = submissions?.filter(s => s.status === 'graded') || [];
        const passedSubmissions = completedSubmissions.filter(s => 
          (s.percentage || 0) >= (quiz.passing_score || 60)
        );
        
        const avgScore = completedSubmissions.length > 0
          ? Math.round(completedSubmissions.reduce((sum, s) => sum + (s.percentage || 0), 0) / completedSubmissions.length)
          : 0;

        enrichedQuizzes.push({
          id: assignment.id,
          quiz_id: assignment.quiz_id,
          quiz_title: quiz.title,
          quiz_title_ar: quiz.title_ar,
          group_id: assignment.group_id,
          group_name: group.name,
          group_name_ar: group.name_ar,
          start_time: assignment.start_time,
          due_date: assignment.due_date,
          created_at: assignment.created_at,
          duration_minutes: quiz.duration_minutes,
          passing_score: quiz.passing_score,
          total_students: totalStudents || 0,
          completed_count: completedSubmissions.length,
          passed_count: passedSubmissions.length,
          average_score: avgScore,
        });
      }

      setAssignedQuizzes(enrichedQuizzes);
    } catch (error) {
      console.error('Error fetching assigned quizzes:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleViewDetails = async (quiz: AssignedQuiz) => {
    setSelectedQuiz(quiz);
    setLoadingResults(true);

    try {
      // Get all students in the group
      const { data: groupStudents } = await supabase
        .from('group_students')
        .select('student_id')
        .eq('group_id', quiz.group_id)
        .eq('is_active', true);

      const studentIds = groupStudents?.map(gs => gs.student_id) || [];

      // Get student profiles
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, full_name, full_name_ar')
        .in('user_id', studentIds);

      setAllGroupStudents(profiles?.map(p => ({
        id: p.user_id,
        name: p.full_name,
        name_ar: p.full_name_ar || p.full_name,
      })) || []);

      // Get submissions for this quiz assignment
      const { data: submissions } = await supabase
        .from('quiz_submissions')
        .select('*')
        .eq('quiz_assignment_id', quiz.id);

      // Build student results
      const results: StudentResult[] = studentIds.map(studentId => {
        const profile = profiles?.find(p => p.user_id === studentId);
        const submission = submissions?.find(s => s.student_id === studentId);

        return {
          student_id: studentId,
          student_name: profile?.full_name || 'Unknown',
          student_name_ar: profile?.full_name_ar || profile?.full_name || 'غير معروف',
          score: submission?.score || null,
          max_score: submission?.max_score || null,
          percentage: submission?.percentage || null,
          status: submission?.status || 'not_started',
          submitted_at: submission?.submitted_at || null,
          answers: submission?.answers || null,
        };
      });

      // Sort: completed first, then by score descending
      results.sort((a, b) => {
        if (a.status === 'graded' && b.status !== 'graded') return -1;
        if (b.status === 'graded' && a.status !== 'graded') return 1;
        return (b.percentage || 0) - (a.percentage || 0);
      });

      setStudentResults(results);
    } catch (error) {
      console.error('Error fetching student results:', error);
    } finally {
      setLoadingResults(false);
    }
  };

  const handleViewStudentAnswers = async (student: StudentResult) => {
    if (!selectedQuiz || !student.answers) return;
    
    setSelectedStudent(student);
    setLoadingDetails(true);

    try {
      // Get quiz questions
      const { data: questions } = await supabase
        .from('quiz_questions')
        .select('*')
        .eq('quiz_id', selectedQuiz.quiz_id)
        .order('order_index');

      const answers = student.answers as Record<string, string>;
      
      const details: QuestionDetail[] = (questions || []).map(q => {
        const studentAnswer = answers[q.id] || null;
        const options = q.options as any;
        
        // Handle both old and new option formats
        let optionsArray: string[] = [];
        if (Array.isArray(options)) {
          optionsArray = options;
        } else if (options?.en) {
          optionsArray = language === 'ar' ? options.ar : options.en;
        }

        return {
          question_text: q.question_text,
          question_text_ar: q.question_text_ar,
          options: optionsArray,
          correct_answer: q.correct_answer,
          student_answer: studentAnswer,
          is_correct: studentAnswer === q.correct_answer,
          points: q.points,
        };
      });

      setQuestionDetails(details);
    } catch (error) {
      console.error('Error fetching question details:', error);
    } finally {
      setLoadingDetails(false);
    }
  };

  const getStatusBadge = (status: string, percentage: number | null, passingScore: number) => {
    if (status === 'not_started') {
      return <Badge variant="outline" className="text-muted-foreground">{isRTL ? 'لم يبدأ' : 'Not Started'}</Badge>;
    }
    if (status === 'in_progress') {
      return <Badge variant="outline" className="bg-yellow-100 text-yellow-800">{isRTL ? 'جاري' : 'In Progress'}</Badge>;
    }
    if (status === 'submitted' || status === 'graded') {
      const passed = (percentage || 0) >= passingScore;
      return (
        <Badge className={passed ? 'bg-green-500 hover:bg-green-600' : 'bg-red-500 hover:bg-red-600'}>
          {passed ? (isRTL ? 'ناجح' : 'Passed') : (isRTL ? 'راسب' : 'Failed')}
        </Badge>
      );
    }
    return <Badge variant="secondary">{status}</Badge>;
  };

  const formatDateTime = (dateStr: string | null) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleString(language === 'ar' ? 'ar-EG' : 'en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
      timeZone: 'Africa/Cairo', // Use Egypt timezone for consistency
    });
  };

  return (
    <DashboardLayout title={isRTL ? 'نتائج الكويزات' : 'Quiz Results'}>
      <div className="space-y-6">
        {/* Header Stats */}
        <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {isRTL ? 'الكويزات المسندة' : 'Assigned Quizzes'}
              </CardTitle>
              <FileQuestion className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{assignedQuizzes.length}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {isRTL ? 'إجمالي الطلاب' : 'Total Students'}
              </CardTitle>
              <Users className="h-4 w-4 text-blue-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {assignedQuizzes.reduce((sum, q) => sum + q.total_students, 0)}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {isRTL ? 'الناجحون' : 'Passed'}
              </CardTitle>
              <Trophy className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">
                {assignedQuizzes.reduce((sum, q) => sum + q.passed_count, 0)}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {isRTL ? 'متوسط الدرجات' : 'Average Score'}
              </CardTitle>
              <Clock className="h-4 w-4 text-orange-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {assignedQuizzes.length > 0
                  ? Math.round(assignedQuizzes.reduce((sum, q) => sum + q.average_score, 0) / assignedQuizzes.length)
                  : 0}%
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Assigned Quizzes List */}
        <Card>
          <CardHeader>
            <CardTitle>{isRTL ? 'الكويزات المسندة' : 'Assigned Quizzes'}</CardTitle>
            <CardDescription>
              {isRTL ? 'اضغط على أي كويز لعرض نتائج الطلاب' : 'Click on any quiz to view student results'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="py-8 text-center text-muted-foreground">
                {isRTL ? 'جاري التحميل...' : 'Loading...'}
              </div>
            ) : assignedQuizzes.length === 0 ? (
              <div className="py-8 text-center">
                <FileQuestion className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">
                  {isRTL ? 'لم تقم بإسناد أي كويزات بعد' : "You haven't assigned any quizzes yet"}
                </p>
                <Button 
                  variant="outline" 
                  className="mt-4"
                  onClick={() => navigate('/quizzes')}
                >
                  {isRTL ? 'إسناد كويز' : 'Assign a Quiz'}
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                {assignedQuizzes.map((quiz) => (
                  <div
                    key={quiz.id}
                    className="flex items-center justify-between p-4 rounded-lg border hover:bg-muted/50 cursor-pointer transition-colors"
                    onClick={() => handleViewDetails(quiz)}
                  >
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">
                        {language === 'ar' ? quiz.quiz_title_ar : quiz.quiz_title}
                      </p>
                      <div className="flex items-center gap-2 mt-1 text-sm text-muted-foreground">
                        <Badge variant="outline" className="text-xs">
                          {language === 'ar' ? quiz.group_name_ar : quiz.group_name}
                        </Badge>
                        <span>•</span>
                        <span>{quiz.duration_minutes} {isRTL ? 'دقيقة' : 'min'}</span>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-4">
                      <div className="text-right hidden sm:block">
                        <div className="flex items-center gap-2 text-sm">
                          <span className="text-green-600 font-medium">{quiz.passed_count}</span>
                          <span className="text-muted-foreground">/</span>
                          <span>{quiz.completed_count}</span>
                          <span className="text-muted-foreground">/</span>
                          <span className="text-muted-foreground">{quiz.total_students}</span>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {isRTL ? 'ناجح / أكمل / إجمالي' : 'passed / completed / total'}
                        </p>
                      </div>
                      <div className="w-16 hidden md:block">
                        <Progress value={quiz.total_students > 0 ? (quiz.completed_count / quiz.total_students) * 100 : 0} />
                      </div>
                      <ChevronRight className="h-5 w-5 text-muted-foreground" />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Student Results Dialog */}
        <Dialog open={!!selectedQuiz} onOpenChange={() => { setSelectedQuiz(null); setSelectedStudent(null); }}>
          <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <FileQuestion className="h-5 w-5" />
                {selectedQuiz && (language === 'ar' ? selectedQuiz.quiz_title_ar : selectedQuiz.quiz_title)}
              </DialogTitle>
            </DialogHeader>

            {loadingResults ? (
              <div className="py-8 text-center text-muted-foreground">
                {isRTL ? 'جاري التحميل...' : 'Loading...'}
              </div>
            ) : (
              <div className="space-y-4">
                {/* Quiz Info */}
                {selectedQuiz && (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-4 bg-muted/50 rounded-lg">
                    <div>
                      <p className="text-sm text-muted-foreground">{isRTL ? 'المجموعة' : 'Group'}</p>
                      <p className="font-medium">{language === 'ar' ? selectedQuiz.group_name_ar : selectedQuiz.group_name}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">{isRTL ? 'البداية' : 'Start'}</p>
                      <p className="font-medium">{formatDateTime(selectedQuiz.start_time)}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">{isRTL ? 'متوسط الدرجات' : 'Avg. Score'}</p>
                      <p className="font-medium">{selectedQuiz.average_score}%</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">{isRTL ? 'نسبة الإكمال' : 'Completion'}</p>
                      <p className="font-medium">
                        {selectedQuiz.completed_count}/{selectedQuiz.total_students} ({Math.round((selectedQuiz.completed_count / selectedQuiz.total_students) * 100) || 0}%)
                      </p>
                    </div>
                  </div>
                )}

                {/* Results Table */}
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{isRTL ? 'الطالب' : 'Student'}</TableHead>
                      <TableHead>{isRTL ? 'الحالة' : 'Status'}</TableHead>
                      <TableHead>{isRTL ? 'الدرجة' : 'Score'}</TableHead>
                      <TableHead>{isRTL ? 'النسبة' : 'Percentage'}</TableHead>
                      <TableHead>{isRTL ? 'وقت التسليم' : 'Submitted At'}</TableHead>
                      <TableHead className="w-[80px]">{isRTL ? 'التفاصيل' : 'Details'}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {studentResults.map((result) => (
                      <TableRow key={result.student_id}>
                        <TableCell className="font-medium">
                          {language === 'ar' ? result.student_name_ar : result.student_name}
                        </TableCell>
                        <TableCell>
                          {getStatusBadge(result.status, result.percentage, selectedQuiz?.passing_score || 60)}
                        </TableCell>
                        <TableCell>
                          {result.score !== null ? `${result.score}/${result.max_score}` : '-'}
                        </TableCell>
                        <TableCell>
                          {result.percentage !== null ? (
                            <div className="flex items-center gap-2">
                              <span>{result.percentage}%</span>
                              {result.percentage >= (selectedQuiz?.passing_score || 60) ? (
                                <CheckCircle className="h-4 w-4 text-green-500" />
                              ) : (
                                <XCircle className="h-4 w-4 text-red-500" />
                              )}
                            </div>
                          ) : '-'}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {formatDateTime(result.submitted_at)}
                        </TableCell>
                        <TableCell>
                          {result.answers && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleViewStudentAnswers(result)}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Student Answers Dialog */}
        <Dialog open={!!selectedStudent} onOpenChange={() => setSelectedStudent(null)}>
          <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Eye className="h-5 w-5" />
                {isRTL ? 'إجابات الطالب' : 'Student Answers'}: {selectedStudent && (language === 'ar' ? selectedStudent.student_name_ar : selectedStudent.student_name)}
              </DialogTitle>
            </DialogHeader>

            {loadingDetails ? (
              <div className="py-8 text-center text-muted-foreground">
                {isRTL ? 'جاري التحميل...' : 'Loading...'}
              </div>
            ) : (
              <div className="space-y-4">
                {/* Summary */}
                {selectedStudent && (
                  <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
                    <div>
                      <p className="text-sm text-muted-foreground">{isRTL ? 'الدرجة' : 'Score'}</p>
                      <p className="text-xl font-bold">{selectedStudent.score}/{selectedStudent.max_score}</p>
                    </div>
                    <div className="text-center">
                      <p className="text-sm text-muted-foreground">{isRTL ? 'النسبة' : 'Percentage'}</p>
                      <p className="text-xl font-bold">{selectedStudent.percentage}%</p>
                    </div>
                    <div>
                      {getStatusBadge(selectedStudent.status, selectedStudent.percentage, selectedQuiz?.passing_score || 60)}
                    </div>
                  </div>
                )}

                {/* Questions */}
                <div className="space-y-4">
                  {questionDetails.map((q, idx) => (
                    <Card key={idx} className={q.is_correct ? 'border-green-200 bg-green-50/50' : 'border-red-200 bg-red-50/50'}>
                      <CardContent className="pt-4">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1">
                            <p className="font-medium mb-2">
                              {idx + 1}. {language === 'ar' ? q.question_text_ar : q.question_text}
                            </p>
                            <div className="space-y-2">
                              {Array.isArray(q.options) && q.options.map((opt, optIdx) => {
                                const isCorrect = opt === q.correct_answer;
                                const isSelected = opt === q.student_answer;
                                
                                return (
                                  <div
                                    key={optIdx}
                                    className={`p-2 rounded-lg border ${
                                      isCorrect
                                        ? 'bg-green-100 border-green-300'
                                        : isSelected
                                        ? 'bg-red-100 border-red-300'
                                        : 'bg-background'
                                    }`}
                                  >
                                    <div className="flex items-center gap-2">
                                      {isCorrect && <CheckCircle className="h-4 w-4 text-green-600" />}
                                      {isSelected && !isCorrect && <XCircle className="h-4 w-4 text-red-600" />}
                                      <span>{opt}</span>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                          <Badge variant={q.is_correct ? 'default' : 'destructive'} className={q.is_correct ? 'bg-green-500' : ''}>
                            {q.is_correct ? q.points : 0}/{q.points}
                          </Badge>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
