import { useState, useEffect } from 'react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
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
  Send,
  Trash2,
  BookOpen
} from 'lucide-react';

interface Quiz {
  id: string;
  title: string;
  title_ar: string;
  description: string | null;
  description_ar: string | null;
  duration_minutes: number;
  passing_score: number;
  level?: { name: string; name_ar: string } | null;
  age_group?: { name: string; name_ar: string } | null;
}

interface Group {
  id: string;
  name: string;
  name_ar: string;
}

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
  
  // Available quizzes tab
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [loadingQuizzes, setLoadingQuizzes] = useState(true);
  
  // Assignment dialog
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const [selectedQuiz, setSelectedQuiz] = useState<Quiz | null>(null);
  const [selectedGroupId, setSelectedGroupId] = useState('');
  const [startTime, setStartTime] = useState('');
  const [assigning, setAssigning] = useState(false);
  
  // My assignments tab
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
      fetchQuizzes();
      fetchGroups();
      fetchAssignedQuizzes();
    }
  }, [user]);

  const fetchQuizzes = async () => {
    try {
      const { data, error } = await supabase
        .from('quizzes')
        .select(`
          id, title, title_ar, description, description_ar, 
          duration_minutes, passing_score,
          levels:level_id(name, name_ar),
          age_groups:age_group_id(name, name_ar)
        `)
        .eq('is_active', true)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setQuizzes(data?.map(q => ({
        ...q,
        level: q.levels,
        age_group: q.age_groups,
      })) || []);
    } catch (error) {
      console.error('Error fetching quizzes:', error);
    } finally {
      setLoadingQuizzes(false);
    }
  };

  const fetchGroups = async () => {
    if (!user) return;
    try {
      const { data, error } = await supabase
        .from('groups')
        .select('id, name, name_ar')
        .eq('instructor_id', user.id)
        .eq('is_active', true);

      if (error) throw error;
      setGroups(data || []);
    } catch (error) {
      console.error('Error fetching groups:', error);
    }
  };

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

  const openAssignDialog = (quiz: Quiz) => {
    setSelectedQuiz(quiz);
    setSelectedGroupId('');
    setStartTime('');
    setAssignDialogOpen(true);
  };

  const getISOString = (localDateTime: string) => {
    if (!localDateTime) return null;
    const date = new Date(localDateTime);
    return date.toISOString();
  };

  const handleAssignQuiz = async () => {
    if (!selectedQuiz || !selectedGroupId || !startTime || !user) return;
    
    setAssigning(true);
    try {
      const startTimeISO = getISOString(startTime);
      
      // Calculate due_date based on quiz duration
      const startDate = new Date(startTime);
      const dueDate = new Date(startDate.getTime() + selectedQuiz.duration_minutes * 60 * 1000);

      const { error } = await supabase
        .from('quiz_assignments')
        .insert({
          quiz_id: selectedQuiz.id,
          group_id: selectedGroupId,
          assigned_by: user.id,
          start_time: startTimeISO,
          due_date: dueDate.toISOString(),
        });

      if (error) throw error;

      toast({
        title: isRTL ? 'تم الإسناد بنجاح' : 'Quiz Assigned',
        description: isRTL ? 'تم إسناد الكويز للمجموعة بنجاح' : 'The quiz has been assigned to the group',
      });

      setAssignDialogOpen(false);
      fetchAssignedQuizzes();
    } catch (error: any) {
      console.error('Error assigning quiz:', error);
      toast({
        title: isRTL ? 'خطأ' : 'Error',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setAssigning(false);
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
    <DashboardLayout title={isRTL ? 'كويزات المجموعات' : 'Group Quizzes'}>
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

        {/* Tabs */}
        <Tabs defaultValue="available" dir={isRTL ? 'rtl' : 'ltr'}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="available">
              <BookOpen className="h-4 w-4 mr-2" />
              {isRTL ? 'الكويزات المتاحة' : 'Available Quizzes'}
            </TabsTrigger>
            <TabsTrigger value="my-assignments">
              <FileQuestion className="h-4 w-4 mr-2" />
              {isRTL ? 'إسناداتي ونتائجي' : 'My Assignments & Results'}
            </TabsTrigger>
          </TabsList>

          {/* Available Quizzes Tab */}
          <TabsContent value="available" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle>{isRTL ? 'بنك الأسئلة' : 'Question Bank'}</CardTitle>
                <CardDescription>
                  {isRTL ? 'اختر كويز وأسنده لإحدى مجموعاتك' : 'Select a quiz and assign it to one of your groups'}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {loadingQuizzes ? (
                  <div className="py-8 text-center text-muted-foreground">
                    {isRTL ? 'جاري التحميل...' : 'Loading...'}
                  </div>
                ) : quizzes.length === 0 ? (
                  <div className="py-8 text-center">
                    <FileQuestion className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                    <p className="text-muted-foreground">
                      {isRTL ? 'لا توجد كويزات متاحة' : 'No quizzes available'}
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {quizzes.map((quiz) => (
                      <div
                        key={quiz.id}
                        className="flex items-center justify-between p-4 rounded-lg border hover:bg-muted/50 transition-colors"
                      >
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate">
                            {language === 'ar' ? quiz.title_ar : quiz.title}
                          </p>
                          <div className="flex flex-wrap items-center gap-2 mt-1 text-sm text-muted-foreground">
                            <span>{quiz.duration_minutes} {isRTL ? 'دقيقة' : 'min'}</span>
                            <span>•</span>
                            <span>{quiz.passing_score}% {isRTL ? 'للنجاح' : 'to pass'}</span>
                            {quiz.level && (
                              <>
                                <span>•</span>
                                <Badge variant="outline" className="text-xs">
                                  {language === 'ar' ? quiz.level.name_ar : quiz.level.name}
                                </Badge>
                              </>
                            )}
                          </div>
                        </div>
                        
                        <Button
                          onClick={() => openAssignDialog(quiz)}
                          size="sm"
                          className="gap-2"
                        >
                          <Send className="h-4 w-4" />
                          {isRTL ? 'إسناد' : 'Assign'}
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* My Assignments Tab */}
          <TabsContent value="my-assignments" className="mt-4">
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
                      {isRTL ? 'لم تقم بإسناد أي كويزات بعد' : "You haven't assigned any quizzes yet"}
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
          </TabsContent>
        </Tabs>

        {/* Assign Quiz Dialog */}
        <Dialog open={assignDialogOpen} onOpenChange={setAssignDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {isRTL ? 'إسناد كويز' : 'Assign Quiz'}
              </DialogTitle>
              <DialogDescription>
                {selectedQuiz && (language === 'ar' ? selectedQuiz.title_ar : selectedQuiz.title)}
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>{isRTL ? 'المجموعة' : 'Group'}</Label>
                <Select value={selectedGroupId} onValueChange={setSelectedGroupId}>
                  <SelectTrigger>
                    <SelectValue placeholder={isRTL ? 'اختر مجموعة' : 'Select a group'} />
                  </SelectTrigger>
                  <SelectContent>
                    {groups.map((group) => (
                      <SelectItem key={group.id} value={group.id}>
                        {language === 'ar' ? group.name_ar : group.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>{isRTL ? 'وقت البداية' : 'Start Time'}</Label>
                <Input
                  type="datetime-local"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                />
              </div>

              {selectedQuiz && (
                <div className="p-3 bg-muted rounded-lg text-sm">
                  <p className="text-muted-foreground">
                    {isRTL ? 'مدة الكويز:' : 'Quiz duration:'} {selectedQuiz.duration_minutes} {isRTL ? 'دقيقة' : 'minutes'}
                  </p>
                  <p className="text-muted-foreground">
                    {isRTL ? 'سينتهي تلقائياً بعد المدة المحددة من وقت البداية' : 'Will end automatically after the specified duration from start time'}
                  </p>
                </div>
              )}
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setAssignDialogOpen(false)}>
                {isRTL ? 'إلغاء' : 'Cancel'}
              </Button>
              <Button 
                onClick={handleAssignQuiz} 
                disabled={!selectedGroupId || !startTime || assigning}
              >
                {assigning ? (isRTL ? 'جاري الإسناد...' : 'Assigning...') : (isRTL ? 'إسناد' : 'Assign')}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

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
                      {getStatusBadge(selectedStudent.status, selectedStudent.percentage, selectedAssignment?.passing_score || 60)}
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
