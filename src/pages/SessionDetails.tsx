import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { formatTime12Hour } from '@/lib/timeUtils';
import {
  ArrowLeft,
  ArrowRight,
  Calendar,
  Clock,
  Users,
  FileQuestion,
  ClipboardList,
  CheckCircle,
  XCircle,
  AlertCircle,
  Plus,
  Import,
  Eye,
} from 'lucide-react';

interface Session {
  id: string;
  session_number: number | null;
  session_date: string;
  session_time: string;
  duration_minutes: number;
  status: string;
  topic: string | null;
  topic_ar: string | null;
  group_id: string;
}

interface Group {
  id: string;
  name: string;
  name_ar: string;
}

interface StudentData {
  student_id: string;
  student_name: string;
  student_name_ar: string;
  attendance_status: string | null;
  quiz_score: number | null;
  quiz_max_score: number | null;
  quiz_percentage: number | null;
  quiz_status: string | null;
  assignment_score: number | null;
  assignment_max_score: number | null;
  assignment_status: string | null;
}

interface Quiz {
  id: string;
  title: string;
  title_ar: string;
}

export default function SessionDetails() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();
  const { isRTL, language } = useLanguage();
  const { user, role } = useAuth();
  
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<Session | null>(null);
  const [group, setGroup] = useState<Group | null>(null);
  const [students, setStudents] = useState<StudentData[]>([]);
  const [quizAssignment, setQuizAssignment] = useState<any>(null);
  const [assignment, setAssignment] = useState<any>(null);
  
  // Import quiz dialog
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [availableQuizzes, setAvailableQuizzes] = useState<Quiz[]>([]);
  const [selectedQuizId, setSelectedQuizId] = useState('');
  const [quizStartTime, setQuizStartTime] = useState('');
  const [importing, setImporting] = useState(false);
  
  // Create assignment dialog
  const [assignmentDialogOpen, setAssignmentDialogOpen] = useState(false);
  const [assignmentForm, setAssignmentForm] = useState({
    title: '',
    title_ar: '',
    description: '',
    description_ar: '',
    max_score: 100,
    due_date: '',
  });
  const [creatingAssignment, setCreatingAssignment] = useState(false);

  useEffect(() => {
    if (sessionId) {
      fetchSessionData();
    }
  }, [sessionId]);

  const fetchSessionData = async () => {
    if (!sessionId) return;
    
    try {
      // Fetch session
      const { data: sessionData, error: sessionError } = await supabase
        .from('sessions')
        .select('*')
        .eq('id', sessionId)
        .single();
      
      if (sessionError) throw sessionError;
      setSession(sessionData);
      
      // Fetch group
      const { data: groupData } = await supabase
        .from('groups')
        .select('id, name, name_ar')
        .eq('id', sessionData.group_id)
        .single();
      setGroup(groupData);
      
      // Fetch students in group
      const { data: groupStudents } = await supabase
        .from('group_students')
        .select('student_id')
        .eq('group_id', sessionData.group_id)
        .eq('is_active', true);
      
      const studentIds = groupStudents?.map(gs => gs.student_id) || [];
      
      // Fetch student profiles
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, full_name, full_name_ar')
        .in('user_id', studentIds);
      
      // Fetch attendance for this session
      const { data: attendanceData } = await supabase
        .from('attendance')
        .select('student_id, status')
        .eq('session_id', sessionId);
      
      // Fetch quiz assignment for this session
      const { data: quizAssignmentData } = await supabase
        .from('quiz_assignments')
        .select(`
          id, quiz_id, start_time, due_date,
          quizzes(id, title, title_ar, passing_score)
        `)
        .eq('session_id', sessionId)
        .eq('is_active', true)
        .maybeSingle();
      
      setQuizAssignment(quizAssignmentData);
      
      // Fetch quiz submissions if quiz exists
      let quizSubmissions: any[] = [];
      if (quizAssignmentData) {
        const { data: submissions } = await supabase
          .from('quiz_submissions')
          .select('student_id, score, max_score, percentage, status')
          .eq('quiz_assignment_id', quizAssignmentData.id);
        quizSubmissions = submissions || [];
      }
      
      // Fetch assignment for this session
      const { data: assignmentData } = await supabase
        .from('assignments')
        .select('id, title, title_ar, max_score')
        .eq('session_id', sessionId)
        .eq('is_active', true)
        .maybeSingle();
      
      setAssignment(assignmentData);
      
      // Fetch assignment submissions if assignment exists
      let assignmentSubmissions: any[] = [];
      if (assignmentData) {
        const { data: submissions } = await supabase
          .from('assignment_submissions')
          .select('student_id, score, status')
          .eq('assignment_id', assignmentData.id);
        assignmentSubmissions = submissions || [];
      }
      
      // Combine all data
      const combinedStudents: StudentData[] = studentIds.map(studentId => {
        const profile = profiles?.find(p => p.user_id === studentId);
        const attendance = attendanceData?.find(a => a.student_id === studentId);
        const quizSubmission = quizSubmissions.find(qs => qs.student_id === studentId);
        const assignmentSubmission = assignmentSubmissions.find(as => as.student_id === studentId);
        
        return {
          student_id: studentId,
          student_name: profile?.full_name || 'Unknown',
          student_name_ar: profile?.full_name_ar || profile?.full_name || 'غير معروف',
          attendance_status: attendance?.status || null,
          quiz_score: quizSubmission?.score || null,
          quiz_max_score: quizSubmission?.max_score || null,
          quiz_percentage: quizSubmission?.percentage || null,
          quiz_status: quizSubmission?.status || null,
          assignment_score: assignmentSubmission?.score || null,
          assignment_max_score: assignmentData?.max_score || null,
          assignment_status: assignmentSubmission?.status || null,
        };
      });
      
      setStudents(combinedStudents);
    } catch (error) {
      console.error('Error fetching session data:', error);
      toast({
        title: isRTL ? 'خطأ' : 'Error',
        description: isRTL ? 'فشل في تحميل بيانات السيشن' : 'Failed to load session data',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchAvailableQuizzes = async () => {
    const { data } = await supabase
      .from('quizzes')
      .select('id, title, title_ar')
      .eq('is_active', true)
      .order('created_at', { ascending: false });
    setAvailableQuizzes(data || []);
  };

  const handleImportQuiz = async () => {
    if (!selectedQuizId || !quizStartTime || !session || !user) return;
    
    setImporting(true);
    try {
      // Get quiz duration
      const { data: quiz } = await supabase
        .from('quizzes')
        .select('duration_minutes')
        .eq('id', selectedQuizId)
        .single();
      
      const startDate = new Date(quizStartTime);
      const dueDate = new Date(startDate.getTime() + (quiz?.duration_minutes || 30) * 60 * 1000);
      
      const { error } = await supabase
        .from('quiz_assignments')
        .insert({
          quiz_id: selectedQuizId,
          session_id: session.id,
          group_id: session.group_id,
          assigned_by: user.id,
          start_time: startDate.toISOString(),
          due_date: dueDate.toISOString(),
        });
      
      if (error) throw error;
      
      toast({
        title: isRTL ? 'تم الإضافة' : 'Quiz Added',
        description: isRTL ? 'تم إضافة الكويز للسيشن بنجاح' : 'Quiz added to session successfully',
      });
      
      setImportDialogOpen(false);
      setSelectedQuizId('');
      setQuizStartTime('');
      fetchSessionData();
    } catch (error: any) {
      toast({
        title: isRTL ? 'خطأ' : 'Error',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setImporting(false);
    }
  };

  const handleCreateAssignment = async () => {
    if (!assignmentForm.title || !assignmentForm.title_ar || !assignmentForm.due_date || !session || !user) return;
    
    setCreatingAssignment(true);
    try {
      const { error } = await supabase
        .from('assignments')
        .insert({
          title: assignmentForm.title,
          title_ar: assignmentForm.title_ar,
          description: assignmentForm.description || null,
          description_ar: assignmentForm.description_ar || null,
          max_score: assignmentForm.max_score,
          due_date: new Date(assignmentForm.due_date).toISOString(),
          session_id: session.id,
          group_id: session.group_id,
          assigned_by: user.id,
        });
      
      if (error) throw error;
      
      toast({
        title: isRTL ? 'تم الإنشاء' : 'Assignment Created',
        description: isRTL ? 'تم إنشاء الواجب بنجاح' : 'Assignment created successfully',
      });
      
      setAssignmentDialogOpen(false);
      setAssignmentForm({ title: '', title_ar: '', description: '', description_ar: '', max_score: 100, due_date: '' });
      fetchSessionData();
    } catch (error: any) {
      toast({
        title: isRTL ? 'خطأ' : 'Error',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setCreatingAssignment(false);
    }
  };

  const getAttendanceBadge = (status: string | null) => {
    if (!status) return <Badge variant="outline" className="text-muted-foreground">{isRTL ? 'غير مسجل' : 'Not recorded'}</Badge>;
    
    const badges: Record<string, JSX.Element> = {
      present: <Badge className="bg-green-500">{isRTL ? 'حاضر' : 'Present'}</Badge>,
      absent: <Badge className="bg-red-500">{isRTL ? 'غائب' : 'Absent'}</Badge>,
      late: <Badge className="bg-yellow-500">{isRTL ? 'متأخر' : 'Late'}</Badge>,
      excused: <Badge className="bg-blue-500">{isRTL ? 'معتذر' : 'Excused'}</Badge>,
    };
    
    return badges[status] || <Badge variant="outline">{status}</Badge>;
  };

  const getQuizBadge = (student: StudentData) => {
    if (!quizAssignment) return <span className="text-muted-foreground">-</span>;
    if (!student.quiz_status || student.quiz_status === 'not_started') {
      return <Badge variant="outline" className="text-muted-foreground">{isRTL ? 'لم يبدأ' : 'Not started'}</Badge>;
    }
    if (student.quiz_status === 'in_progress') {
      return <Badge className="bg-yellow-500">{isRTL ? 'جاري' : 'In progress'}</Badge>;
    }
    
    const passed = (student.quiz_percentage || 0) >= (quizAssignment.quizzes?.passing_score || 60);
    return (
      <div className="flex items-center gap-2">
        <Badge className={passed ? 'bg-green-500' : 'bg-red-500'}>
          {student.quiz_percentage?.toFixed(0)}%
        </Badge>
      </div>
    );
  };

  const getAssignmentBadge = (student: StudentData) => {
    if (!assignment) return <span className="text-muted-foreground">-</span>;
    if (!student.assignment_status) {
      return <Badge variant="outline" className="text-muted-foreground">{isRTL ? 'لم يسلم' : 'Not submitted'}</Badge>;
    }
    if (student.assignment_status === 'submitted') {
      return <Badge className="bg-yellow-500">{isRTL ? 'بانتظار التقييم' : 'Pending'}</Badge>;
    }
    if (student.assignment_status === 'graded') {
      return (
        <Badge className="bg-green-500">
          {student.assignment_score}/{student.assignment_max_score}
        </Badge>
      );
    }
    return <Badge variant="outline">{student.assignment_status}</Badge>;
  };

  // Stats
  const presentCount = students.filter(s => s.attendance_status === 'present' || s.attendance_status === 'late').length;
  const quizCompletedCount = students.filter(s => s.quiz_status === 'graded' || s.quiz_status === 'submitted').length;
  const assignmentSubmittedCount = students.filter(s => s.assignment_status).length;

  if (loading) {
    return (
      <DashboardLayout title={isRTL ? 'تفاصيل السيشن' : 'Session Details'}>
        <div className="flex items-center justify-center h-64">
          <div className="text-muted-foreground">{isRTL ? 'جاري التحميل...' : 'Loading...'}</div>
        </div>
      </DashboardLayout>
    );
  }

  if (!session) {
    return (
      <DashboardLayout title={isRTL ? 'تفاصيل السيشن' : 'Session Details'}>
        <div className="flex items-center justify-center h-64">
          <div className="text-muted-foreground">{isRTL ? 'السيشن غير موجود' : 'Session not found'}</div>
        </div>
      </DashboardLayout>
    );
  }

  const canManage = role === 'admin' || role === 'instructor';

  return (
    <DashboardLayout title={isRTL ? `سيشن ${session.session_number}` : `Session ${session.session_number}`}>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <Button variant="ghost" onClick={() => navigate(-1)}>
            {isRTL ? <ArrowRight className="h-4 w-4 ml-2" /> : <ArrowLeft className="h-4 w-4 mr-2" />}
            {isRTL ? 'رجوع' : 'Back'}
          </Button>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-base">
              {language === 'ar' ? group?.name_ar : group?.name}
            </Badge>
          </div>
        </div>

        {/* Session Info Card */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-xl">
                  {isRTL ? `سيشن ${session.session_number}` : `Session ${session.session_number}`}
                  {session.topic && (
                    <span className="text-muted-foreground font-normal ml-2">
                      - {language === 'ar' ? (session.topic_ar || session.topic) : session.topic}
                    </span>
                  )}
                </CardTitle>
                <CardDescription className="flex items-center gap-4 mt-2">
                  <span className="flex items-center gap-1">
                    <Calendar className="h-4 w-4" />
                    {session.session_date}
                  </span>
                  <span className="flex items-center gap-1">
                    <Clock className="h-4 w-4" />
                    {formatTime12Hour(session.session_time, isRTL)}
                  </span>
                </CardDescription>
              </div>
              <Badge className={session.status === 'completed' ? 'bg-green-500' : 'bg-blue-500'}>
                {session.status === 'completed' ? (isRTL ? 'مكتمل' : 'Completed') : (isRTL ? 'مجدول' : 'Scheduled')}
              </Badge>
            </div>
          </CardHeader>
        </Card>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Users className="h-4 w-4 text-green-500" />
                {isRTL ? 'الحضور' : 'Attendance'}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{presentCount}/{students.length}</div>
              <Progress value={(presentCount / students.length) * 100} className="mt-2" />
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <FileQuestion className="h-4 w-4 text-blue-500" />
                {isRTL ? 'الكويز' : 'Quiz'}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {quizAssignment ? (
                <>
                  <div className="text-2xl font-bold">{quizCompletedCount}/{students.length}</div>
                  <Progress value={(quizCompletedCount / students.length) * 100} className="mt-2" />
                </>
              ) : (
                <div className="flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 text-muted-foreground" />
                  <span className="text-muted-foreground text-sm">{isRTL ? 'لم يُضف بعد' : 'Not added yet'}</span>
                </div>
              )}
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <ClipboardList className="h-4 w-4 text-purple-500" />
                {isRTL ? 'الواجب' : 'Assignment'}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {assignment ? (
                <>
                  <div className="text-2xl font-bold">{assignmentSubmittedCount}/{students.length}</div>
                  <Progress value={(assignmentSubmittedCount / students.length) * 100} className="mt-2" />
                </>
              ) : (
                <div className="flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 text-muted-foreground" />
                  <span className="text-muted-foreground text-sm">{isRTL ? 'لم يُضف بعد' : 'Not added yet'}</span>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Actions for adding quiz/assignment */}
        {canManage && (!quizAssignment || !assignment) && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">{isRTL ? 'إضافة محتوى السيشن' : 'Add Session Content'}</CardTitle>
            </CardHeader>
            <CardContent className="flex gap-4 flex-wrap">
              {!quizAssignment && (
                <Button
                  onClick={() => {
                    fetchAvailableQuizzes();
                    setImportDialogOpen(true);
                  }}
                  className="flex items-center gap-2"
                >
                  <Import className="h-4 w-4" />
                  {isRTL ? 'استيراد كويز من البنك' : 'Import Quiz from Bank'}
                </Button>
              )}
              {!assignment && (
                <Button
                  variant="outline"
                  onClick={() => setAssignmentDialogOpen(true)}
                  className="flex items-center gap-2"
                >
                  <Plus className="h-4 w-4" />
                  {isRTL ? 'إنشاء واجب' : 'Create Assignment'}
                </Button>
              )}
            </CardContent>
          </Card>
        )}

        {/* Students Table */}
        <Card>
          <CardHeader>
            <CardTitle>{isRTL ? 'أداء الطلاب' : 'Student Performance'}</CardTitle>
            <CardDescription>
              {isRTL ? 'عرض الحضور والدرجات لكل طالب' : 'View attendance and scores for each student'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{isRTL ? 'الطالب' : 'Student'}</TableHead>
                  <TableHead className="text-center">{isRTL ? 'الحضور' : 'Attendance'}</TableHead>
                  <TableHead className="text-center">{isRTL ? 'الكويز' : 'Quiz'}</TableHead>
                  <TableHead className="text-center">{isRTL ? 'الواجب' : 'Assignment'}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {students.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                      {isRTL ? 'لا يوجد طلاب في هذه المجموعة' : 'No students in this group'}
                    </TableCell>
                  </TableRow>
                ) : (
                  students.map((student) => (
                    <TableRow key={student.student_id}>
                      <TableCell className="font-medium">
                        {language === 'ar' ? student.student_name_ar : student.student_name}
                      </TableCell>
                      <TableCell className="text-center">
                        {getAttendanceBadge(student.attendance_status)}
                      </TableCell>
                      <TableCell className="text-center">
                        {getQuizBadge(student)}
                      </TableCell>
                      <TableCell className="text-center">
                        {getAssignmentBadge(student)}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Import Quiz Dialog */}
        <Dialog open={importDialogOpen} onOpenChange={setImportDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{isRTL ? 'استيراد كويز من البنك' : 'Import Quiz from Bank'}</DialogTitle>
              <DialogDescription>
                {isRTL ? 'اختر كويز من بنك الأسئلة لإضافته لهذه السيشن' : 'Select a quiz from the question bank to add to this session'}
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label>{isRTL ? 'الكويز' : 'Quiz'}</Label>
                <Select value={selectedQuizId} onValueChange={setSelectedQuizId}>
                  <SelectTrigger>
                    <SelectValue placeholder={isRTL ? 'اختر كويز...' : 'Select quiz...'} />
                  </SelectTrigger>
                  <SelectContent>
                    {availableQuizzes.map(quiz => (
                      <SelectItem key={quiz.id} value={quiz.id}>
                        {language === 'ar' ? quiz.title_ar : quiz.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>{isRTL ? 'وقت البدء' : 'Start Time'}</Label>
                <Input
                  type="datetime-local"
                  value={quizStartTime}
                  onChange={(e) => setQuizStartTime(e.target.value)}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setImportDialogOpen(false)}>
                {isRTL ? 'إلغاء' : 'Cancel'}
              </Button>
              <Button onClick={handleImportQuiz} disabled={importing || !selectedQuizId || !quizStartTime}>
                {importing ? (isRTL ? 'جاري الاستيراد...' : 'Importing...') : (isRTL ? 'استيراد' : 'Import')}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Create Assignment Dialog */}
        <Dialog open={assignmentDialogOpen} onOpenChange={setAssignmentDialogOpen}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>{isRTL ? 'إنشاء واجب جديد' : 'Create New Assignment'}</DialogTitle>
              <DialogDescription>
                {isRTL ? 'أنشئ واجب جديد لهذه السيشن' : 'Create a new assignment for this session'}
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label>{isRTL ? 'العنوان' : 'Title'} (English)</Label>
                <Input
                  value={assignmentForm.title}
                  onChange={(e) => setAssignmentForm({ ...assignmentForm, title: e.target.value })}
                  placeholder="e.g., Session 1 Practice"
                />
              </div>
              <div className="grid gap-2">
                <Label>{isRTL ? 'العنوان' : 'Title'} (عربي)</Label>
                <Input
                  value={assignmentForm.title_ar}
                  onChange={(e) => setAssignmentForm({ ...assignmentForm, title_ar: e.target.value })}
                  placeholder="مثال: تمارين السيشن الأول"
                  dir="rtl"
                />
              </div>
              <div className="grid gap-2">
                <Label>{isRTL ? 'الوصف' : 'Description'} (English)</Label>
                <Textarea
                  value={assignmentForm.description}
                  onChange={(e) => setAssignmentForm({ ...assignmentForm, description: e.target.value })}
                  placeholder="Assignment instructions..."
                />
              </div>
              <div className="grid gap-2">
                <Label>{isRTL ? 'الوصف' : 'Description'} (عربي)</Label>
                <Textarea
                  value={assignmentForm.description_ar}
                  onChange={(e) => setAssignmentForm({ ...assignmentForm, description_ar: e.target.value })}
                  placeholder="تعليمات الواجب..."
                  dir="rtl"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label>{isRTL ? 'الدرجة الكلية' : 'Max Score'}</Label>
                  <Input
                    type="number"
                    value={assignmentForm.max_score}
                    onChange={(e) => setAssignmentForm({ ...assignmentForm, max_score: Number(e.target.value) })}
                  />
                </div>
                <div className="grid gap-2">
                  <Label>{isRTL ? 'تاريخ التسليم' : 'Due Date'}</Label>
                  <Input
                    type="datetime-local"
                    value={assignmentForm.due_date}
                    onChange={(e) => setAssignmentForm({ ...assignmentForm, due_date: e.target.value })}
                  />
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setAssignmentDialogOpen(false)}>
                {isRTL ? 'إلغاء' : 'Cancel'}
              </Button>
              <Button 
                onClick={handleCreateAssignment} 
                disabled={creatingAssignment || !assignmentForm.title || !assignmentForm.title_ar || !assignmentForm.due_date}
              >
                {creatingAssignment ? (isRTL ? 'جاري الإنشاء...' : 'Creating...') : (isRTL ? 'إنشاء' : 'Create')}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
