import { useState, useEffect } from 'react';
import { formatDateTime } from '@/lib/timeUtils';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { toast } from '@/hooks/use-toast';
import { 
  FileQuestion, 
  Users, 
  Trophy, 
  Clock, 
  Eye, 
  CheckCircle, 
  XCircle,
  ChevronRight,
  Trash2,
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
  options: string[];
  correct_answer: string;
  student_answer: string | null;
  is_correct: boolean;
  points: number;
}

export default function MyInstructorQuizzes() {
  const { isRTL, language } = useLanguage();
  const { user } = useAuth();
  
  // My assignments
  const [assignedQuizzes, setAssignedQuizzes] = useState<AssignedQuiz[]>([]);
  const [loadingAssignments, setLoadingAssignments] = useState(true);
  
  // Results dialog
  const [selectedAssignment, setSelectedAssignment] = useState<AssignedQuiz | null>(null);
  const [studentResults, setStudentResults] = useState<StudentResult[]>([]);
  const [loadingResults, setLoadingResults] = useState(false);
  
  // Student answers dialog
  const [selectedStudent, setSelectedStudent] = useState<StudentResult | null>(null);
  const [questionDetails, setQuestionDetails] = useState<QuestionDetail[]>([]);
  const [loadingDetails, setLoadingDetails] = useState(false);

  useEffect(() => {
    if (user) {
      fetchAssignedQuizzes();
    }
  }, [user]);

  const fetchAssignedQuizzes = async () => {
    if (!user) return;
    
    try {
      const { data: assignments, error } = await supabase
        .from('quiz_assignments')
        .select(`
          id, quiz_id, group_id, start_time, due_date, created_at,
          quizzes(id, title, title_ar, duration_minutes, passing_score),
          groups(id, name, name_ar)
        `)
        .eq('assigned_by', user.id)
        .eq('is_active', true)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const enrichedQuizzes: AssignedQuiz[] = [];

      for (const assignment of assignments || []) {
        if (!assignment.quizzes || !assignment.groups) continue;

        const quiz = assignment.quizzes as any;
        const group = assignment.groups as any;

        const { count: totalStudents } = await supabase
          .from('group_students')
          .select('id', { count: 'exact' })
          .eq('group_id', assignment.group_id)
          .eq('is_active', true);

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
      setLoadingAssignments(false);
    }
  };

  const handleDeleteAssignment = async (assignmentId: string) => {
    if (!confirm(isRTL ? 'هل أنت متأكد من حذف هذا الإسناد؟' : 'Are you sure you want to delete this assignment?')) {
      return;
    }

    try {
      const { error } = await supabase
        .from('quiz_assignments')
        .update({ is_active: false })
        .eq('id', assignmentId);

      if (error) throw error;

      toast({
        title: isRTL ? 'تم الحذف' : 'Deleted',
        description: isRTL ? 'تم حذف الإسناد بنجاح' : 'Assignment deleted successfully',
      });

      fetchAssignedQuizzes();
    } catch (error: any) {
      toast({
        title: isRTL ? 'خطأ' : 'Error',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  const handleViewDetails = async (quiz: AssignedQuiz) => {
    setSelectedAssignment(quiz);
    setLoadingResults(true);

    try {
      const { data: groupStudents } = await supabase
        .from('group_students')
        .select('student_id')
        .eq('group_id', quiz.group_id)
        .eq('is_active', true);

      const studentIds = groupStudents?.map(gs => gs.student_id) || [];

      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, full_name, full_name_ar')
        .in('user_id', studentIds);

      const { data: submissions } = await supabase
        .from('quiz_submissions')
        .select('*')
        .eq('quiz_assignment_id', quiz.id);

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
    if (!selectedAssignment || !student.answers) return;
    
    setSelectedStudent(student);
    setLoadingDetails(true);

    try {
      const { data: questions } = await supabase
        .from('quiz_questions')
        .select('*')
        .eq('quiz_id', selectedAssignment.quiz_id)
        .order('order_index');

      const answers = student.answers as Record<string, string>;
      
      const details: QuestionDetail[] = (questions || []).map(q => {
        const studentAnswer = answers[q.id] || null;
        const options = q.options as any;
        
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
      timeZone: 'Africa/Cairo',
    });
  };

  // Stats
  const totalAssigned = assignedQuizzes.length;
  const totalStudents = assignedQuizzes.reduce((sum, q) => sum + q.total_students, 0);
  const totalPassed = assignedQuizzes.reduce((sum, q) => sum + q.passed_count, 0);
  const avgScore = assignedQuizzes.length > 0
    ? Math.round(assignedQuizzes.reduce((sum, q) => sum + q.average_score, 0) / assignedQuizzes.length)
    : 0;

  return (
    <DashboardLayout title={isRTL ? 'نتائج الكويزات' : 'Quiz Results'}>
      <div className="space-y-6">
        {/* Stats */}
        <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {isRTL ? 'الكويزات المسندة' : 'Assigned Quizzes'}
              </CardTitle>
              <FileQuestion className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalAssigned}</div>
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
              <div className="text-2xl font-bold">{totalStudents}</div>
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
              <div className="text-2xl font-bold text-green-600">{totalPassed}</div>
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
              <div className="text-2xl font-bold">{avgScore}%</div>
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
            {loadingAssignments ? (
              <div className="py-8 text-center text-muted-foreground">
                {isRTL ? 'جاري التحميل...' : 'Loading...'}
              </div>
            ) : assignedQuizzes.length === 0 ? (
              <div className="py-8 text-center">
                <FileQuestion className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">
                  {isRTL ? 'لا توجد كويزات مسندة بعد' : "No quizzes assigned yet"}
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {assignedQuizzes.map((quiz) => (
                  <div
                    key={quiz.id}
                    className="flex items-center justify-between p-4 rounded-lg border hover:bg-muted/50 transition-colors"
                  >
                    <div 
                      className="flex-1 min-w-0 cursor-pointer"
                      onClick={() => handleViewDetails(quiz)}
                    >
                      <p className="font-medium truncate">
                        {language === 'ar' ? quiz.quiz_title_ar : quiz.quiz_title}
                      </p>
                      <div className="flex items-center gap-2 mt-1 text-sm text-muted-foreground">
                        <Badge variant="outline" className="text-xs">
                          {language === 'ar' ? quiz.group_name_ar : quiz.group_name}
                        </Badge>
                        <span>•</span>
                        <span>{formatDateTime(quiz.start_time)}</span>
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
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteAssignment(quiz.id);
                        }}
                        className="text-destructive hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                      <ChevronRight 
                        className="h-5 w-5 text-muted-foreground cursor-pointer" 
                        onClick={() => handleViewDetails(quiz)}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Student Results Dialog */}
        <Dialog open={!!selectedAssignment} onOpenChange={() => { setSelectedAssignment(null); setSelectedStudent(null); }}>
          <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <FileQuestion className="h-5 w-5" />
                {selectedAssignment && (language === 'ar' ? selectedAssignment.quiz_title_ar : selectedAssignment.quiz_title)}
              </DialogTitle>
            </DialogHeader>

            {loadingResults ? (
              <div className="py-8 text-center text-muted-foreground">
                {isRTL ? 'جاري التحميل...' : 'Loading...'}
              </div>
            ) : (
              <div className="space-y-4">
                {/* Quiz Info */}
                {selectedAssignment && (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-4 bg-muted/50 rounded-lg">
                    <div>
                      <p className="text-sm text-muted-foreground">{isRTL ? 'المجموعة' : 'Group'}</p>
                      <p className="font-medium">{language === 'ar' ? selectedAssignment.group_name_ar : selectedAssignment.group_name}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">{isRTL ? 'البداية' : 'Start'}</p>
                      <p className="font-medium">{formatDateTime(selectedAssignment.start_time)}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">{isRTL ? 'متوسط الدرجات' : 'Avg. Score'}</p>
                      <p className="font-medium">{selectedAssignment.average_score}%</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">{isRTL ? 'نسبة الإكمال' : 'Completion'}</p>
                      <p className="font-medium">
                        {selectedAssignment.completed_count}/{selectedAssignment.total_students} ({selectedAssignment.total_students > 0 ? Math.round((selectedAssignment.completed_count / selectedAssignment.total_students) * 100) : 0}%)
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
                          {getStatusBadge(result.status, result.percentage, selectedAssignment?.passing_score || 60)}
                        </TableCell>
                        <TableCell>
                          {result.score !== null ? `${result.score}/${result.max_score}` : '-'}
                        </TableCell>
                        <TableCell>
                          {result.percentage !== null ? (
                            <div className="flex items-center gap-2">
                              <span>{result.percentage}%</span>
                              {result.percentage >= (selectedAssignment?.passing_score || 60) ? (
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
              <DialogTitle>
                {selectedStudent && (language === 'ar' ? selectedStudent.student_name_ar : selectedStudent.student_name)}
                {selectedStudent?.percentage !== null && (
                  <Badge className={`ml-2 ${(selectedStudent?.percentage || 0) >= (selectedAssignment?.passing_score || 60) ? 'bg-green-500' : 'bg-red-500'}`}>
                    {selectedStudent?.percentage}%
                  </Badge>
                )}
              </DialogTitle>
            </DialogHeader>

            {loadingDetails ? (
              <div className="py-8 text-center text-muted-foreground">
                {isRTL ? 'جاري التحميل...' : 'Loading...'}
              </div>
            ) : (
              <div className="space-y-4">
                {questionDetails.map((q, index) => (
                  <div
                    key={index}
                    className={`p-4 rounded-lg border ${q.is_correct ? 'border-green-200 bg-green-50 dark:bg-green-950/20' : 'border-red-200 bg-red-50 dark:bg-red-950/20'}`}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <p className="font-medium">
                        {index + 1}. {language === 'ar' ? q.question_text_ar : q.question_text}
                      </p>
                      <Badge variant="outline" className="shrink-0 ml-2">
                        {q.points} {isRTL ? 'نقطة' : 'pts'}
                      </Badge>
                    </div>
                    
                    <div className="space-y-1 ml-4">
                      {q.options.map((option, optIndex) => {
                        const isCorrect = option === q.correct_answer;
                        const isStudentAnswer = option === q.student_answer;
                        
                        return (
                          <div
                            key={optIndex}
                            className={`flex items-center gap-2 p-2 rounded text-sm ${
                              isCorrect ? 'bg-green-100 dark:bg-green-900/30 font-medium' :
                              isStudentAnswer && !isCorrect ? 'bg-red-100 dark:bg-red-900/30' : ''
                            }`}
                          >
                            {isCorrect && <CheckCircle className="h-4 w-4 text-green-600 shrink-0" />}
                            {isStudentAnswer && !isCorrect && <XCircle className="h-4 w-4 text-red-600 shrink-0" />}
                            {!isCorrect && !isStudentAnswer && <span className="w-4 h-4 shrink-0" />}
                            <span>{option}</span>
                          </div>
                        );
                      })}
                    </div>
                    
                    {!q.student_answer && (
                      <p className="text-sm text-muted-foreground mt-2 ml-4">
                        {isRTL ? 'لم يُجب' : 'Not answered'}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
