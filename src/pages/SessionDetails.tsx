import { useState, useEffect, useCallback, useMemo } from 'react';
import { isSessionEndedCairo, isSessionActiveCairo, isGracePeriodEndedCairo, getGracePeriodRemainingSeconds, getMinutesUntilSessionStartCairo } from '@/lib/sessionTimeGuard';
import { useParams, useNavigate } from 'react-router-dom';
import { DashboardLayout } from '@/components/DashboardLayout';
import { PdfDownloadButton } from '@/components/PdfDownloadButton';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
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
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { notificationService } from '@/lib/notificationService';
import { toast } from '@/hooks/use-toast';
import { SessionTimeDisplay } from '@/components/shared/SessionTimeDisplay';
import { QuizResultsDialog } from '@/components/session/QuizResultsDialog';
import { AssignmentSubmissionsDialog } from '@/components/session/AssignmentSubmissionsDialog';
import { SessionEvaluationGrid } from '@/components/session/SessionEvaluationGrid';
import {
  ArrowLeft,
  ArrowRight,
  Calendar,
  Clock,
  Users,
  FileQuestion,
  ClipboardList,
  AlertCircle,
  UserCheck,
  Video,
  Pencil,
  Trash2,
  ExternalLink,
  Upload,
  X,
  FileIcon,
  Eye,
  BookOpen,
  Presentation,
  PlayCircle,
  Film,
  CheckCircle,
  Loader2,
  RefreshCw,
  Lock,
} from 'lucide-react';

interface CurriculumContent {
  id: string;
  title: string;
  title_ar: string;
  description: string | null;
  description_ar: string | null;
  slides_url: string | null;
  summary_video_url: string | null;
  full_video_url: string | null;
  quiz_id: string | null;
  assignment_title: string | null;
  assignment_title_ar: string | null;
  assignment_description: string | null;
  assignment_description_ar: string | null;
  assignment_attachment_url: string | null;
  assignment_attachment_type: string | null;
  assignment_max_score: number | null;
  version: number;
  is_published: boolean;
  can_view_slides: boolean;
  can_view_summary_video: boolean;
  can_view_full_video: boolean;
  can_view_assignment: boolean;
  can_view_quiz: boolean;
  student_pdf_available?: boolean;
  student_pdf_filename?: string;
}

interface StaffAttendance {
  id: string;
  session_id: string;
  staff_id: string;
  status: string;
  actual_hours: number;
  created_at: string;
}

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
  is_makeup: boolean;
  makeup_session_id: string | null;
  content_number: number | null;
}

interface Group {
  id: string;
  name: string;
  name_ar: string;
  instructor_id?: string | null;
  attendance_mode?: string;
  session_link?: string | null;
  age_group_id?: string | null;
  level_id?: string | null;
  group_type?: string;
}

interface StudentData {
  student_id: string;
  student_name: string;
  student_name_ar: string;
  attendance_status: string | null;
  compensation_status: string | null;
  makeup_session_id: string | null;
  quiz_score: number | null;
  quiz_max_score: number | null;
  quiz_percentage: number | null;
  quiz_status: string | null;
  assignment_score: number | null;
  assignment_max_score: number | null;
  assignment_status: string | null;
}


export default function SessionDetails() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();
  const { isRTL, language } = useLanguage();
  const { user, role } = useAuth();
  
  const [loading, setLoading] = useState(true);
  const [studentCanViewContent, setStudentCanViewContent] = useState(true);
  const [session, setSession] = useState<Session | null>(null);
  const [group, setGroup] = useState<Group | null>(null);
  const [students, setStudents] = useState<StudentData[]>([]);
  const [quizAssignment, setQuizAssignment] = useState<any>(null);
  const [assignment, setAssignment] = useState<any>(null);
  
  // Curriculum content
  const [curriculumContent, setCurriculumContent] = useState<CurriculumContent | null>(null);
  const [curriculumLoading, setCurriculumLoading] = useState(false);
  const [assigningCurriculumQuiz, setAssigningCurriculumQuiz] = useState(false);
  const [assigningCurriculumAssignment, setAssigningCurriculumAssignment] = useState(false);
  const [quizMeta, setQuizMeta] = useState<{ questionCount: number; passingScore: number; duration: number } | null>(null);
  
  // Edit assignment dialog (for editing existing assignments only)
  const [assignmentDialogOpen, setAssignmentDialogOpen] = useState(false);
  const [editingAssignment, setEditingAssignment] = useState(false);
  const [assignmentForm, setAssignmentForm] = useState({
    title: '',
    description: '',
    max_score: 100,
    due_date: '',
  });
  const [assignmentFile, setAssignmentFile] = useState<File | null>(null);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [savingAssignment, setSavingAssignment] = useState(false);
  
  // Edit quiz dialog
  const [editQuizDialogOpen, setEditQuizDialogOpen] = useState(false);
  const [editQuizStartTime, setEditQuizStartTime] = useState('');
  const [savingQuiz, setSavingQuiz] = useState(false);
  
  // Delete dialogs
  const [deleteQuizDialogOpen, setDeleteQuizDialogOpen] = useState(false);
  const [deleteAssignmentDialogOpen, setDeleteAssignmentDialogOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  
  // Attendance dialog
  const [attendanceDialogOpen, setAttendanceDialogOpen] = useState(false);
  const [attendanceRecords, setAttendanceRecords] = useState<Record<string, string>>({});
  
  // Staff attendance
  const [staffAttendance, setStaffAttendance] = useState<StaffAttendance | null>(null);
  const [staffAttendanceForm, setStaffAttendanceForm] = useState({ status: 'confirmed', actual_hours: 0 });
  const [savingStaffAttendance, setSavingStaffAttendance] = useState(false);
  const [instructorProfile, setInstructorProfile] = useState<any>(null);

  // Quiz results dialog
  const [quizResultsDialogOpen, setQuizResultsDialogOpen] = useState(false);
  
  // Assignment submissions dialog
  const [assignmentSubmissionsDialogOpen, setAssignmentSubmissionsDialogOpen] = useState(false);
  const [savingAttendance, setSavingAttendance] = useState(false);
  const [makeupStudentId, setMakeupStudentId] = useState<string | null>(null);

  // Live session status
  const [liveStatus, setLiveStatus] = useState<'not_started' | 'active' | 'ended'>('not_started');
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  useEffect(() => {
    if (!session) return;
    const compute = () => {
      const active = isSessionActiveCairo(session.session_date, session.session_time, session.duration_minutes);
      const ended = isSessionEndedCairo(session.session_date, session.session_time, session.duration_minutes);
      if (active) {
        setLiveStatus('active');
        // Compute elapsed seconds from session start
        const [h, m] = session.session_time.split(':').map(Number);
        const startTs = new Date(`${session.session_date}T${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:00`).getTime();
        const nowTs = Date.now();
        setElapsedSeconds(Math.max(0, Math.floor((nowTs - startTs) / 1000)));
      } else if (ended) {
        setLiveStatus('ended');
      } else {
        setLiveStatus('not_started');
      }
    };
    compute();
    const id = setInterval(compute, 1_000);
    return () => clearInterval(id);
  }, [session]);

  // Grace period state
  const [gracePeriodRemaining, setGracePeriodRemaining] = useState(-1);

  useEffect(() => {
    if (!session || session.status === 'completed' || session.status === 'cancelled') return;
    const compute = () => {
      const remaining = getGracePeriodRemainingSeconds(session.session_date, session.session_time, session.duration_minutes);
      setGracePeriodRemaining(remaining);
    };
    compute();
    const id = setInterval(compute, 1000);
    return () => clearInterval(id);
  }, [session]);

  // Grace period ended = instructor can't act
  const graceEnded = isGracePeriodEndedCairo(session?.session_date, session?.session_time, session?.duration_minutes);
  const sessionEnded = isSessionEndedCairo(session?.session_date, session?.session_time, session?.duration_minutes);
  const sessionNotStarted = liveStatus === 'not_started' && !sessionEnded;
  const instructorActionsDisabled = role === 'instructor' && (graceEnded || sessionNotStarted) && session?.status !== 'completed';

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

      // Fetch makeup student if this is a makeup session
      if (sessionData.is_makeup && sessionData.makeup_session_id) {
        const { data: makeupData } = await supabase
          .from('makeup_sessions')
          .select('student_id')
          .eq('id', sessionData.makeup_session_id)
          .single();
        setMakeupStudentId(makeupData?.student_id || null);
      } else {
        setMakeupStudentId(null);
      }
      
      // Fetch group with attendance mode and session link
      const { data: groupData } = await supabase
        .from('groups')
        .select('id, name, name_ar, instructor_id, attendance_mode, session_link, age_group_id, level_id, group_type')
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
        .select('student_id, status, compensation_status, makeup_session_id')
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
        .eq('is_auto_generated', false)
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
        .select('id, title, title_ar, description, description_ar, max_score, due_date')
        .eq('session_id', sessionId)
        .eq('is_active', true)
        .eq('is_auto_generated', false)
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
      
      // Combine all data - for students, filter to show only their own data
      let filteredStudentIds = studentIds;
      if (role === 'student' && user) {
        filteredStudentIds = studentIds.filter(id => id === user.id);
      }
      
      const combinedStudents: StudentData[] = filteredStudentIds.map(studentId => {
        const profile = profiles?.find(p => p.user_id === studentId);
        const attendance = attendanceData?.find(a => a.student_id === studentId);
        const quizSubmission = quizSubmissions.find(qs => qs.student_id === studentId);
        const assignmentSubmission = assignmentSubmissions.find(as => as.student_id === studentId);
        
        return {
          student_id: studentId,
          student_name: profile?.full_name || 'Unknown',
          student_name_ar: profile?.full_name_ar || profile?.full_name || 'غير معروف',
          attendance_status: attendance?.status || null,
          compensation_status: attendance?.compensation_status || null,
          makeup_session_id: attendance?.makeup_session_id || null,
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

      // Check if student can view content based on attendance
      if (role === 'student' && user) {
        const myAttendance = attendanceData?.find(a => a.student_id === user.id);
        if (myAttendance) {
          const isPresent = myAttendance.status === 'present' || myAttendance.status === 'late';
          const isCompensated = myAttendance.compensation_status === 'compensated';
          setStudentCanViewContent(isPresent || isCompensated);
        } else {
          setStudentCanViewContent(true); // attendance not recorded yet
        }
      } else {
        setStudentCanViewContent(true);
      }
      // Fetch staff attendance for this session
      if (groupData?.instructor_id) {
        const { data: staffAtt } = await supabase
          .from('session_staff_attendance')
          .select('*')
          .eq('session_id', sessionId)
          .eq('staff_id', groupData.instructor_id)
          .maybeSingle();
        
        setStaffAttendance(staffAtt as StaffAttendance | null);
        setStaffAttendanceForm({
          status: staffAtt?.status || 'confirmed',
          actual_hours: staffAtt?.actual_hours ?? (sessionData.duration_minutes / 60),
        });

        // Fetch instructor profile for display
        const { data: instrProfile } = await supabase
          .from('profiles')
          .select('full_name, full_name_ar')
          .eq('user_id', groupData.instructor_id)
          .maybeSingle();
        setInstructorProfile(instrProfile);
      }

      // Fetch curriculum content — use content_number (real content ref), fallback to session_number
      const curriculumNumber = sessionData.content_number ?? sessionData.session_number;
      if (groupData?.age_group_id && groupData?.level_id && curriculumNumber) {
        setCurriculumLoading(true);
        try {
          let subType: string | null = null;
          let attMode: string | null = null;
          if (role === 'student' && user) {
            const { data: profile } = await supabase
              .from('profiles')
              .select('subscription_type, attendance_mode')
              .eq('user_id', user.id)
              .maybeSingle();
            subType = profile?.subscription_type || null;
            attMode = profile?.attendance_mode || null;
          }

          const { data: currData } = await supabase.rpc('get_curriculum_with_access', {
            p_age_group_id: groupData.age_group_id,
            p_level_id: groupData.level_id,
            p_session_number: curriculumNumber,
            p_subscription_type: subType,
            p_attendance_mode: attMode,
          });

          if (currData && currData.length > 0) {
            const curr = currData[0] as unknown as CurriculumContent;
            setCurriculumContent(curr);
            
            // Fetch quiz metadata if quiz is linked
            if (curr.quiz_id) {
              const [quizRes, questionsRes] = await Promise.all([
                supabase.from('quizzes').select('passing_score, duration_minutes').eq('id', curr.quiz_id).single(),
                supabase.from('quiz_questions').select('id', { count: 'exact', head: true }).eq('quiz_id', curr.quiz_id),
              ]);
              setQuizMeta({
                questionCount: questionsRes.count || 0,
                passingScore: quizRes.data?.passing_score || 0,
                duration: quizRes.data?.duration_minutes || 0,
              });
            } else {
              setQuizMeta(null);
            }
          } else {
            setCurriculumContent(null);
            setQuizMeta(null);
          }
        } catch (err) {
          console.error('Error fetching curriculum:', err);
          setCurriculumContent(null);
        } finally {
          setCurriculumLoading(false);
        }
      }

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


  // One-click assign curriculum quiz
  const handleAssignCurriculumQuiz = async () => {
    if (!curriculumContent?.quiz_id || !session || !user) return;

    // Guard: prevent assignment if all students are absent
    const hasAttendance = students.some(s => s.attendance_status !== null);
    if (hasAttendance) {
      const presentStudents = students.filter(s => 
        s.attendance_status === 'present' || s.attendance_status === 'late'
      );
      if (presentStudents.length === 0) {
        toast({
          title: isRTL ? 'لا يمكن الاسناد' : 'Cannot Assign',
          description: isRTL 
            ? 'لا يوجد طلاب حاضرون لاسناد المهمة لهم' 
            : 'No present students to assign to',
          variant: 'destructive',
        });
        return;
      }
    }

    // Guard: only allow assignment during active session time (Cairo)
    if (!isSessionActiveCairo(session.session_date, session.session_time, session.duration_minutes)) {
      toast({
        title: isRTL ? 'غير متاح' : 'Not Available',
        description: isRTL
          ? 'لا يمكن إسناد الكويز إلا أثناء وقت السيشن'
          : 'Quiz can only be assigned during session time',
        variant: 'destructive',
      });
      return;
    }

    setAssigningCurriculumQuiz(true);
    try {
      const { data: quiz } = await supabase
        .from('quizzes')
        .select('duration_minutes')
        .eq('id', curriculumContent.quiz_id)
        .single();

      const now = new Date();
      const durationMs = (quiz?.duration_minutes || 30) * 60 * 1000;
      const dueDate = new Date(now.getTime() + durationMs);

      const snapshot = {
        curriculum_session_id: curriculumContent.id,
        title: curriculumContent.title,
        title_ar: curriculumContent.title_ar,
        version: curriculumContent.version,
        assigned_at: new Date().toISOString(),
      };

      // Check if attendance is recorded - assign individually to present students only
      const hasAttendanceForQuiz = students.some(s => s.attendance_status !== null);
      let quizInsertError: any = null;

      if (hasAttendanceForQuiz) {
        const presentForQuiz = students.filter(s => 
          s.attendance_status === 'present' || s.attendance_status === 'late'
        );
        const quizRecords = presentForQuiz.map(s => ({
          quiz_id: curriculumContent.quiz_id,
          session_id: session.id,
          student_id: s.student_id,
          assigned_by: user.id,
          start_time: now.toISOString(),
          due_date: dueDate.toISOString(),
          curriculum_snapshot: snapshot,
        }));
        const { error } = await supabase.from('quiz_assignments').insert(quizRecords);
        quizInsertError = error;
      } else {
        // Attendance not recorded yet - fallback to group-level assignment
        const { error } = await supabase.from('quiz_assignments').insert({
          quiz_id: curriculumContent.quiz_id,
          session_id: session.id,
          group_id: session.group_id,
          assigned_by: user.id,
          start_time: now.toISOString(),
          due_date: dueDate.toISOString(),
          curriculum_snapshot: snapshot,
        });
        quizInsertError = error;
      }

      if (quizInsertError) throw quizInsertError;

      toast({
        title: isRTL ? 'تم اسناد الكويز' : 'Quiz Assigned',
        description: isRTL ? 'تم اسناد كويز المنهج بنجاح' : 'Curriculum quiz assigned successfully',
      });
      fetchSessionData();
    } catch (error: any) {
      toast({ title: isRTL ? 'خطأ' : 'Error', description: error.message, variant: 'destructive' });
    } finally {
      setAssigningCurriculumQuiz(false);
    }
  };

  // One-click assign curriculum assignment
  const handleAssignCurriculumAssignment = async () => {
    if (!curriculumContent?.assignment_title || !session || !user) return;

    // Guard: prevent assignment if all students are absent
    const hasAttendance = students.some(s => s.attendance_status !== null);
    if (hasAttendance) {
      const presentStudents = students.filter(s => 
        s.attendance_status === 'present' || s.attendance_status === 'late'
      );
      if (presentStudents.length === 0) {
        toast({
          title: isRTL ? 'لا يمكن الاسناد' : 'Cannot Assign',
          description: isRTL 
            ? 'لا يوجد طلاب حاضرون لاسناد المهمة لهم' 
            : 'No present students to assign to',
          variant: 'destructive',
        });
        return;
      }
    }

    setAssigningCurriculumAssignment(true);
    try {
      const dueDate = new Date(`${session.session_date}T${session.session_time.slice(0, 5)}`);
      dueDate.setDate(dueDate.getDate() + 7);

      const snapshot = {
        curriculum_session_id: curriculumContent.id,
        title: curriculumContent.title,
        title_ar: curriculumContent.title_ar,
        version: curriculumContent.version,
        assigned_at: new Date().toISOString(),
      };

      // Check if attendance is recorded - assign individually to present students only
      const hasAttendanceForAssignment = students.some(s => s.attendance_status !== null);
      let assignmentInsertError: any = null;

      if (hasAttendanceForAssignment) {
        const presentForAssignment = students.filter(s => 
          s.attendance_status === 'present' || s.attendance_status === 'late'
        );
        const assignmentRecords = presentForAssignment.map(s => ({
          title: curriculumContent.assignment_title,
          title_ar: curriculumContent.assignment_title_ar || curriculumContent.assignment_title,
          description: curriculumContent.assignment_description,
          description_ar: curriculumContent.assignment_description_ar,
          max_score: curriculumContent.assignment_max_score || 100,
          due_date: dueDate.toISOString(),
          session_id: session.id,
          student_id: s.student_id,
          assigned_by: user.id,
          attachment_url: curriculumContent.assignment_attachment_url,
          attachment_type: curriculumContent.assignment_attachment_type,
          curriculum_snapshot: snapshot,
        }));
        const { error } = await supabase.from('assignments').insert(assignmentRecords);
        assignmentInsertError = error;
      } else {
        // Attendance not recorded yet - fallback to group-level assignment
        const { error } = await supabase.from('assignments').insert({
          title: curriculumContent.assignment_title,
          title_ar: curriculumContent.assignment_title_ar || curriculumContent.assignment_title,
          description: curriculumContent.assignment_description,
          description_ar: curriculumContent.assignment_description_ar,
          max_score: curriculumContent.assignment_max_score || 100,
          due_date: dueDate.toISOString(),
          session_id: session.id,
          group_id: session.group_id,
          assigned_by: user.id,
          attachment_url: curriculumContent.assignment_attachment_url,
          attachment_type: curriculumContent.assignment_attachment_type,
          curriculum_snapshot: snapshot,
        });
        assignmentInsertError = error;
      }

      if (assignmentInsertError) throw assignmentInsertError;

      toast({
        title: isRTL ? 'تم اسناد الواجب' : 'Assignment Assigned',
        description: isRTL ? 'تم اسناد واجب المنهج بنجاح' : 'Curriculum assignment assigned successfully',
      });
      fetchSessionData();
    } catch (error: any) {
      toast({ title: isRTL ? 'خطأ' : 'Error', description: error.message, variant: 'destructive' });
    } finally {
      setAssigningCurriculumAssignment(false);
    }
  };


  const handleSaveAssignment = async () => {
    if (!assignmentForm.title || !assignmentForm.due_date || !session || !user) return;
    
    setSavingAssignment(true);
    try {
      let attachmentUrl: string | null = null;
      let attachmentType: string | null = null;
      
      // Upload file if exists
      if (assignmentFile) {
        setUploadingFile(true);
        const fileExt = assignmentFile.name.split('.').pop();
        const fileName = `${session.id}-${Date.now()}.${fileExt}`;
        
        const { error: uploadError } = await supabase.storage
          .from('assignments')
          .upload(fileName, assignmentFile);
        
        if (uploadError) throw uploadError;
        
        const { data: publicUrl } = supabase.storage
          .from('assignments')
          .getPublicUrl(fileName);
        
        attachmentUrl = publicUrl.publicUrl;
        const mimeType = assignmentFile.type;
        if (mimeType.startsWith('image/')) {
          attachmentType = 'image';
        } else if (mimeType === 'application/pdf') {
          attachmentType = 'pdf';
        } else if (mimeType.startsWith('video/')) {
          attachmentType = 'video';
        } else {
          attachmentType = 'text';
        }
        setUploadingFile(false);
      }
      
      if (editingAssignment && assignment) {
        // Update existing assignment only
        const updateData: any = {
          title: assignmentForm.title,
          title_ar: assignmentForm.title,
          description: assignmentForm.description || null,
          description_ar: assignmentForm.description || null,
          max_score: assignmentForm.max_score,
          due_date: new Date(assignmentForm.due_date).toISOString(),
        };
        
        if (attachmentUrl) {
          updateData.attachment_url = attachmentUrl;
          updateData.attachment_type = attachmentType;
        }
        
        const { error } = await supabase
          .from('assignments')
          .update(updateData)
          .eq('id', assignment.id);
        
        if (error) throw error;
        
        toast({
          title: isRTL ? 'تم التحديث' : 'Assignment Updated',
          description: isRTL ? 'تم تحديث الواجب بنجاح' : 'Assignment updated successfully',
        });
      }
      
      setAssignmentDialogOpen(false);
      setEditingAssignment(false);
      setAssignmentForm({ title: '', description: '', max_score: 100, due_date: '' });
      setAssignmentFile(null);
      fetchSessionData();
    } catch (error: any) {
      toast({
        title: isRTL ? 'خطأ' : 'Error',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setSavingAssignment(false);
      setUploadingFile(false);
    }
  };

  const handleEditAssignment = () => {
    if (!assignment) return;
    
    setEditingAssignment(true);
    setAssignmentForm({
      title: assignment.title,
      description: assignment.description || '',
      max_score: assignment.max_score,
      due_date: new Date(assignment.due_date).toISOString().slice(0, 16),
    });
    setAssignmentDialogOpen(true);
  };

  const handleEditQuiz = () => {
    if (!quizAssignment) return;
    
    setEditQuizStartTime(new Date(quizAssignment.start_time).toISOString().slice(0, 16));
    setEditQuizDialogOpen(true);
  };

  const handleSaveQuizEdit = async () => {
    if (!quizAssignment || !editQuizStartTime) return;
    
    setSavingQuiz(true);
    try {
      const { data: quiz } = await supabase
        .from('quizzes')
        .select('duration_minutes')
        .eq('id', quizAssignment.quiz_id)
        .single();
      
      const startDate = new Date(editQuizStartTime);
      const dueDate = new Date(startDate.getTime() + (quiz?.duration_minutes || 30) * 60 * 1000);
      
      const { error } = await supabase
        .from('quiz_assignments')
        .update({
          start_time: startDate.toISOString(),
          due_date: dueDate.toISOString(),
        })
        .eq('id', quizAssignment.id);
      
      if (error) throw error;
      
      toast({
        title: isRTL ? 'تم التحديث' : 'Quiz Updated',
        description: isRTL ? 'تم تحديث موعد الكويز بنجاح' : 'Quiz schedule updated successfully',
      });
      
      setEditQuizDialogOpen(false);
      fetchSessionData();
    } catch (error: any) {
      toast({
        title: isRTL ? 'خطأ' : 'Error',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setSavingQuiz(false);
    }
  };

  const handleDeleteQuiz = async () => {
    if (!quizAssignment) return;
    
    setDeleting(true);
    try {
      const { error } = await supabase
        .from('quiz_assignments')
        .update({ is_active: false })
        .eq('id', quizAssignment.id);
      
      if (error) throw error;
      
      toast({
        title: isRTL ? 'تم الحذف' : 'Quiz Removed',
        description: isRTL ? 'تم إزالة الكويز من السيشن' : 'Quiz removed from session',
      });
      
      setDeleteQuizDialogOpen(false);
      fetchSessionData();
    } catch (error: any) {
      toast({
        title: isRTL ? 'خطأ' : 'Error',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setDeleting(false);
    }
  };

  const handleDeleteAssignment = async () => {
    if (!assignment) return;
    
    setDeleting(true);
    try {
      const { error } = await supabase
        .from('assignments')
        .update({ is_active: false })
        .eq('id', assignment.id);
      
      if (error) throw error;
      
      toast({
        title: isRTL ? 'تم الحذف' : 'Assignment Removed',
        description: isRTL ? 'تم إزالة الواجب من السيشن' : 'Assignment removed from session',
      });
      
      setDeleteAssignmentDialogOpen(false);
      fetchSessionData();
    } catch (error: any) {
      toast({
        title: isRTL ? 'خطأ' : 'Error',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setDeleting(false);
    }
  };

  // For makeup sessions, only show the assigned student
  // For makeup sessions, only show the assigned student
  const attendanceStudents = session?.is_makeup && makeupStudentId
    ? students.filter(s => s.student_id === makeupStudentId)
    : students;

  // Attendance state calculations
  const studentsWithAttendance = attendanceStudents.filter(s => s.attendance_status !== null).length;
  const totalSessionStudents = attendanceStudents.length;
  const attendanceComplete = totalSessionStudents > 0 && studentsWithAttendance === totalSessionStudents;
  const attendancePartial = studentsWithAttendance > 0 && studentsWithAttendance < totalSessionStudents;

  // Filter to only students WITHOUT attendance records for the dialog
  const unrecordedStudents = attendanceStudents.filter(s => s.attendance_status === null);

  const openAttendanceDialog = () => {
    // Initialize with empty values (no default) for unrecorded students only
    const records: Record<string, string> = {};
    unrecordedStudents.forEach(s => {
      records[s.student_id] = '';
    });
    setAttendanceRecords(records);
    setAttendanceDialogOpen(true);
  };

  const handleSaveAttendance = async () => {
    if (!session || !user) return;
    
    setSavingAttendance(true);
    try {
      const records = Object.entries(attendanceRecords).map(([studentId, status]) => ({
        student_id: studentId,
        status,
        notes: null,
      }));

      const { data, error } = await supabase.rpc('save_attendance', {
        p_session_id: session.id,
        p_group_id: session.group_id,
        p_records: records,
      });
      
      if (error) throw error;

      const result = data as any;
      const parts: string[] = [];
      if (result?.inserted_count) parts.push(isRTL ? `${result.inserted_count} سجل جديد` : `${result.inserted_count} records inserted`);
      if (result?.makeups_created > 0) parts.push(isRTL ? `${result.makeups_created} تعويضية جديدة` : `${result.makeups_created} makeups created`);
      if (result?.makeups_cancelled > 0) parts.push(isRTL ? `${result.makeups_cancelled} تعويضية ملغية` : `${result.makeups_cancelled} makeups cancelled`);
      if (result?.instructor_confirmed) parts.push(isRTL ? 'تم تأكيد حضور المدرب' : 'Instructor confirmed');
      if (result?.session_completed) parts.push(isRTL ? 'تم اكتمال السيشن' : 'Session completed');
      
      toast({
        title: isRTL ? 'تم الحفظ' : 'Attendance Saved',
        description: parts.join(' • ') || (isRTL ? 'تم حفظ سجل الحضور بنجاح' : 'Attendance records saved successfully'),
      });

      // Show warning if some students were rejected (duplicates)
      if (result?.rejected_count > 0) {
        toast({
          title: isRTL ? 'تنبيه' : 'Warning',
          description: isRTL 
            ? `${result.rejected_count} طالب تم تخطيهم لأن حضورهم مسجل بالفعل`
            : `${result.rejected_count} student(s) skipped - attendance already recorded`,
          variant: 'destructive',
        });
      }
      
      // Notify parents of absent students
      const absentStudentIds = Object.entries(attendanceRecords)
        .filter(([_, status]) => status === 'absent')
        .map(([studentId]) => studentId);

      if (absentStudentIds.length > 0) {
        try {
          const { data: parentLinks } = await supabase
            .from('parent_students')
            .select('parent_id, student_id')
            .in('student_id', absentStudentIds);

          if (parentLinks && parentLinks.length > 0) {
            const studentIds = [...new Set(parentLinks.map(l => l.student_id))];
            const { data: studentProfiles } = await supabase
              .from('profiles')
              .select('user_id, full_name, full_name_ar')
              .in('user_id', studentIds);

            const profileMap = new Map(studentProfiles?.map(p => [p.user_id, p]) || []);
            const groupName = isRTL ? (group?.name_ar || group?.name) : group?.name;

            for (const link of parentLinks) {
              const sp = profileMap.get(link.student_id);
              const sName = isRTL ? (sp?.full_name_ar || sp?.full_name) : sp?.full_name;
              await notificationService.create({
                user_id: link.parent_id,
                title: 'Absence Recorded',
                title_ar: 'تسجيل غياب',
                message: `${sName} was marked absent in "${groupName}" on ${session?.session_date}`,
                message_ar: `تم تسجيل غياب ${sName} في مجموعة "${groupName}" بتاريخ ${session?.session_date}`,
                type: 'warning',
                category: 'attendance',
                action_url: `/parent/student/${link.student_id}`,
              });
            }
          }
        } catch (notifErr) {
          console.error('Error notifying parents:', notifErr);
        }
      }

      setAttendanceDialogOpen(false);
      fetchSessionData();
    } catch (error: any) {
      toast({
        title: isRTL ? 'خطأ' : 'Error',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setSavingAttendance(false);
    }
  };

  const markAllAs = (status: string) => {
    const newRecords: Record<string, string> = {};
    unrecordedStudents.forEach(s => {
      newRecords[s.student_id] = status;
    });
    setAttendanceRecords(newRecords);
  };

  // Check if all displayed students have a selection
  const allStudentsSelected = unrecordedStudents.length > 0 && unrecordedStudents.every(s => attendanceRecords[s.student_id] && attendanceRecords[s.student_id] !== '');

  const handleSaveStaffAttendance = async () => {
    if (!session || !group?.instructor_id || !user) return;
    setSavingStaffAttendance(true);
    try {
      const record = {
        session_id: session.id,
        staff_id: group.instructor_id,
        status: staffAttendanceForm.status,
        actual_hours: session!.duration_minutes / 60,
      };

      if (staffAttendance) {
        const { error } = await supabase
          .from('session_staff_attendance')
          .update({ status: record.status, actual_hours: record.actual_hours } as any)
          .eq('id', staffAttendance.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('session_staff_attendance')
          .insert(record as any);
        if (error) throw error;
      }

      toast({
        title: isRTL ? 'تم الحفظ' : 'Saved',
        description: isRTL ? 'تم حفظ حضور المدرب' : 'Instructor attendance saved',
      });
      fetchSessionData();
    } catch (error: any) {
      toast({ title: isRTL ? 'خطأ' : 'Error', description: error.message, variant: 'destructive' });
    } finally {
      setSavingStaffAttendance(false);
    }
  };

  const getStaffAttendanceBadge = (status: string) => {
    switch (status) {
      case 'confirmed':
        return <Badge className="bg-green-500">{isRTL ? 'مؤكد' : 'Confirmed'}</Badge>;
      case 'absent':
        return <Badge variant="destructive">{isRTL ? 'غائب' : 'Absent'}</Badge>;
      case 'inferred':
        return <Badge variant="secondary">{isRTL ? 'تقديري' : 'Inferred'}</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
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

  const canManage = role === 'admin' || role === 'instructor';
  // Session-level attendance_mode/session_link take priority over group-level
  const sessionAttendanceMode = (session as any)?.attendance_mode;
  const sessionSessionLink = (session as any)?.session_link;
  const isOnline = sessionAttendanceMode ? sessionAttendanceMode === 'online' : group?.attendance_mode === 'online';
  const activeSessionLink = sessionSessionLink || group?.session_link;

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

  return (
    <DashboardLayout title={isRTL ? `محتوى ${session.content_number ?? session.session_number}` : `Content ${session.content_number ?? session.session_number}`}>
      <div className="space-y-6">
        {/* Cancelled Session Banner */}
        {session.status === 'cancelled' && (
          <Card className="border-destructive/50 bg-destructive/5">
            <CardContent className="flex items-center gap-3 py-4">
              <AlertCircle className="h-5 w-5 text-destructive shrink-0" />
              <div>
                <p className="font-medium text-destructive">
                  {isRTL ? 'هذه السيشن ملغية' : 'This Session is Cancelled'}
                </p>
                <p className="text-sm text-muted-foreground">
                  {isRTL ? 'لا يمكن تنفيذ أي إجراءات على سيشن ملغية' : 'No actions can be performed on a cancelled session'}
                </p>
              </div>
            </CardContent>
          </Card>
        )}
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

        {/* Makeup Session Banner */}
        {session.is_makeup && (
          <Card className="border-purple-300 bg-purple-50 dark:bg-purple-900/10 dark:border-purple-800">
            <CardContent className="flex items-center gap-3 py-3">
              <RefreshCw className="h-5 w-5 text-purple-600 dark:text-purple-400" />
              <div>
                <p className="font-medium text-purple-800 dark:text-purple-300">
                  {isRTL ? 'سيشن تعويضية' : 'Makeup Session'}
                </p>
                <p className="text-sm text-purple-600 dark:text-purple-400">
                  {isRTL ? 'هذه السيشن بديلة عن سيشن سابقة' : 'This session replaces a previous one'}
                </p>
              </div>
            </CardContent>
          </Card>
        )}

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
                    <SessionTimeDisplay sessionDate={session.session_date} sessionTime={session.session_time} isRTL={isRTL} />
                  </span>
                </CardDescription>
              </div>
              <div className="flex items-center gap-2">
                {isOnline && activeSessionLink && session.status !== 'completed' && session.status !== 'cancelled' && (
                  <Button variant="outline" size="sm" asChild>
                    <a href={activeSessionLink} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2">
                      <Video className="h-4 w-4" />
                      {isRTL ? 'رابط السيشن' : 'Join Session'}
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  </Button>
                )}
                <Badge className={session.status === 'completed' ? 'bg-green-500' : 'bg-blue-500'}>
                  {session.status === 'completed' ? (isRTL ? 'مكتمل' : 'Completed') : (isRTL ? 'مجدول' : 'Scheduled')}
                </Badge>
                {liveStatus === 'active' && (
                  <Badge className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300 flex items-center gap-1.5">
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
                    </span>
                    {(() => {
                      const mins = Math.floor(elapsedSeconds / 60);
                      const secs = elapsedSeconds % 60;
                      const timeStr = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
                      return isRTL ? `شغالة - ${timeStr}` : `Live - ${timeStr}`;
                    })()}
                  </Badge>
                )}
                {liveStatus === 'not_started' && session.status !== 'completed' && (
                  <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300">
                    {isRTL ? 'لسه مبدأتش' : 'Not Started Yet'}
                  </Badge>
                )}
                {liveStatus === 'ended' && session.status !== 'completed' && (
                  <Badge className="bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-300">
                    {isRTL ? 'انتهت' : 'Session Ended'}
                  </Badge>
                )}
              </div>
            </div>
          </CardHeader>
        </Card>

        {/* Grace Period Countdown for Instructor */}
        {role === 'instructor' && sessionEnded && !graceEnded && session?.status !== 'completed' && session?.status !== 'cancelled' && gracePeriodRemaining > 0 && (
          <Card className="border-orange-300 bg-orange-50 dark:bg-orange-900/10 dark:border-orange-800">
            <CardContent className="flex items-center gap-3 py-4">
              <Clock className="h-5 w-5 text-orange-600 dark:text-orange-400 shrink-0" />
              <div>
                <p className="font-medium text-orange-800 dark:text-orange-300">
                  {isRTL ? 'فترة السماح' : 'Grace Period'}
                </p>
                <p className="text-sm text-orange-600 dark:text-orange-400">
                  {isRTL 
                    ? `متبقي ${Math.floor(gracePeriodRemaining / 60)} دقيقة و ${gracePeriodRemaining % 60} ثانية لإكمال الإجراءات`
                    : `${Math.floor(gracePeriodRemaining / 60)}m ${gracePeriodRemaining % 60}s remaining to complete actions`}
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Grace Period Expired Warning */}
        {instructorActionsDisabled && session?.status !== 'cancelled' && (
          <Card className="border-destructive/50 bg-destructive/5">
            <CardContent className="flex items-center gap-3 py-4">
              <AlertCircle className="h-5 w-5 text-destructive shrink-0" />
              <div>
                <p className="font-medium text-destructive">
                  {sessionNotStarted
                    ? (isRTL ? 'السيشن لم تبدأ بعد' : 'Session Not Started Yet')
                    : (isRTL ? 'انتهت فترة السماح' : 'Grace Period Expired')
                  }
                </p>
                <p className="text-sm text-muted-foreground">
                  {sessionNotStarted
                    ? (isRTL ? 'لا يمكنك تنفيذ إجراءات قبل بداية معاد السيشن.' : 'You cannot perform actions before the session starts.')
                    : (isRTL ? 'لا يمكنك تنفيذ إجراءات على هذه السيشن. تواصل مع الإدارة.' : 'You can no longer perform actions on this session. Contact admin.')
                  }
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Quick Actions for Admin/Instructor */}
        {canManage && session?.status !== 'cancelled' && !instructorActionsDisabled && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">{isRTL ? 'إجراءات سريعة' : 'Quick Actions'}</CardTitle>
            </CardHeader>
            <CardContent className="flex gap-4 flex-wrap">
              {attendanceComplete ? (
                <Badge className="bg-green-500 text-white flex items-center gap-2 py-2 px-4">
                  <CheckCircle className="h-4 w-4" />
                  {isRTL ? 'تم تسجيل الحضور' : 'Attendance Recorded'}
                </Badge>
              ) : attendancePartial ? (
                <Button
                  variant="outline"
                  onClick={openAttendanceDialog}
                  className="flex items-center gap-2 border-orange-300 text-orange-600 hover:bg-orange-50"
                >
                  <UserCheck className="h-4 w-4" />
                  {isRTL ? 'إكمال تسجيل الحضور' : 'Complete Attendance'}
                  <Badge variant="secondary" className="text-xs">{studentsWithAttendance}/{totalSessionStudents}</Badge>
                </Button>
              ) : (
                <Button
                  variant="outline"
                  onClick={openAttendanceDialog}
                  className="flex items-center gap-2"
                >
                  <UserCheck className="h-4 w-4" />
                  {isRTL ? 'تسجيل الحضور' : 'Record Attendance'}
                </Button>
              )}
              {isOnline && activeSessionLink && liveStatus === 'active' && (
                <Button variant="outline" asChild>
                  <a href={activeSessionLink} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2">
                    <Video className="h-4 w-4" />
                    {isRTL ? 'انضم للسيشن' : 'Join Session'}
                    <ExternalLink className="h-3 w-3" />
                  </a>
                </Button>
              )}
            </CardContent>
          </Card>
        )}

        {/* Curriculum Content Section */}
        {!studentCanViewContent ? (
          <Card className="border-amber-300 bg-amber-50 dark:bg-amber-900/10 dark:border-amber-800">
            <CardContent className="flex items-center gap-3 py-4">
              <AlertCircle className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0" />
              <div>
                <p className="font-medium text-amber-800 dark:text-amber-300">
                  {isRTL ? 'المحتوى غير متاح' : 'Content Not Available'}
                </p>
                <p className="text-sm text-amber-600 dark:text-amber-400">
                  {isRTL 
                    ? 'ستتمكن من مشاهدة محتوى هذه السيشن بعد حضور السيشن التعويضية'
                    : 'You can view this content after attending your makeup session'}
                </p>
              </div>
            </CardContent>
          </Card>
        ) : curriculumLoading ? (
          <Card>
            <CardContent className="flex items-center justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              <span className="ml-2 text-muted-foreground">{isRTL ? 'جاري تحميل المنهج...' : 'Loading curriculum...'}</span>
            </CardContent>
          </Card>
        ) : curriculumContent ? (
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg flex items-center gap-2">
                  <BookOpen className="h-5 w-5 text-primary" />
                  {isRTL ? 'محتوى المنهج' : 'Curriculum Content'}
                  <Badge variant="secondary" className="text-xs">v{curriculumContent.version}</Badge>
                  {curriculumContent.is_published && (
                    <Badge className="bg-primary text-primary-foreground text-xs">
                      {isRTL ? 'منشور' : 'Published'}
                    </Badge>
                  )}
                </CardTitle>
              </div>
              <CardDescription>
                {language === 'ar' ? curriculumContent.title_ar : curriculumContent.title}
                {curriculumContent.description && (
                  <span className="block mt-1">{language === 'ar' ? curriculumContent.description_ar : curriculumContent.description}</span>
                )}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Content Links - Role-based display */}
              <div className="flex flex-wrap gap-3">
                {/* Students: Show PDF download button instead of slides */}
                {role === 'student' && curriculumContent.student_pdf_available && session && (
                  <PdfDownloadButton sessionId={session.id} sessionNumber={session.session_number} isRTL={isRTL} size="sm" />
                )}

                {/* Admin & Instructor: Show slides link */}
                {role !== 'student' && curriculumContent.slides_url && (
                  <Button variant="outline" size="sm" asChild>
                    <a href={curriculumContent.slides_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2">
                      <Presentation className="h-4 w-4" />
                      {isRTL ? 'السلايدات' : 'Slides'}
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  </Button>
                )}

                {/* Videos: Only for admin and students (NOT instructors) */}
                {role !== 'instructor' && (
                  <>
                    {/* Summary Video */}
                    {curriculumContent.summary_video_url && (
                      curriculumContent.can_view_summary_video ? (
                        <Button variant="outline" size="sm" asChild>
                          <a href={curriculumContent.summary_video_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2">
                            <PlayCircle className="h-4 w-4" />
                            {isRTL ? 'فيديو ملخص' : 'Summary Video'}
                            <ExternalLink className="h-3 w-3" />
                          </a>
                        </Button>
                      ) : (
                        <Button variant="outline" size="sm" disabled className="flex items-center gap-2 opacity-60">
                          <Lock className="h-4 w-4" />
                          {isRTL ? 'فيديو ملخص' : 'Summary Video'}
                        </Button>
                      )
                    )}
                    {/* Full Video */}
                    {curriculumContent.full_video_url && (
                      curriculumContent.can_view_full_video ? (
                        <Button variant="outline" size="sm" asChild>
                          <a href={curriculumContent.full_video_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2">
                            <Film className="h-4 w-4" />
                            {isRTL ? 'فيديو كامل' : 'Full Video'}
                            <ExternalLink className="h-3 w-3" />
                          </a>
                        </Button>
                      ) : (
                        <Button variant="outline" size="sm" disabled className="flex items-center gap-2 opacity-60">
                          <Lock className="h-4 w-4" />
                          {isRTL ? 'فيديو كامل' : 'Full Video'}
                        </Button>
                      )
                    )}
                  </>
                )}
              </div>

              {/* One-click assign buttons (admin/instructor only) */}
              {canManage && (
                <div className="space-y-2 pt-2 border-t">
                  {curriculumContent.quiz_id && quizMeta && (
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="outline" className="text-xs">
                        {quizMeta.questionCount} {isRTL ? 'سؤال' : 'Q'}
                      </Badge>
                      <Badge variant="outline" className="text-xs">
                        {quizMeta.passingScore}% {isRTL ? 'للنجاح' : 'pass'}
                      </Badge>
                      <Badge variant="outline" className="text-xs">
                        {quizMeta.duration} {isRTL ? 'دقيقة' : 'min'}
                      </Badge>
                    </div>
                  )}
                  <div className="flex flex-wrap gap-3">
                    {curriculumContent.quiz_id && !quizAssignment && (() => {
                      const sessionActive = isSessionActiveCairo(session?.session_date, session?.session_time, session?.duration_minutes);
                      const minutesUntil = getMinutesUntilSessionStartCairo(session?.session_date, session?.session_time, session?.duration_minutes);
                      const sessionEnded = isSessionEndedCairo(session?.session_date, session?.session_time, session?.duration_minutes);
                      const formatStartTime = () => {
                        if (!session?.session_time) return '';
                        const [h, m] = session.session_time.split(':');
                        return `${h}:${m}`;
                      };
                      const tooltipMsg = sessionEnded
                        ? (isRTL ? 'انتهت السيشن — لا يمكن إسناد الكويز' : 'Session ended — quiz can no longer be assigned')
                        : minutesUntil > 0
                          ? (isRTL
                              ? `متاح بعد ${minutesUntil} دقيقة (${formatStartTime()} توقيت القاهرة)`
                              : `Available in ${minutesUntil} min (${formatStartTime()} Cairo time)`)
                          : (isRTL ? 'متاح أثناء وقت السيشن فقط' : 'Available during session time only');
                      return (
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className="inline-flex">
                                <Button
                                  size="sm"
                                  onClick={handleAssignCurriculumQuiz}
                                  disabled={!sessionActive || assigningCurriculumQuiz}
                                  className="flex items-center gap-2"
                                >
                                  {assigningCurriculumQuiz ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileQuestion className="h-4 w-4" />}
                                  {isRTL ? 'اسناد كويز المنهج' : 'Assign Curriculum Quiz'}
                                </Button>
                              </span>
                            </TooltipTrigger>
                            {!sessionActive && (
                              <TooltipContent>
                                {tooltipMsg}
                              </TooltipContent>
                            )}
                          </Tooltip>
                        </TooltipProvider>
                      );
                    })()}
                    {curriculumContent.quiz_id && quizAssignment && (
                      <Button size="sm" variant="outline" disabled className="flex items-center gap-2">
                        <CheckCircle className="h-4 w-4 text-primary" />
                        {isRTL ? 'تم اسناد الكويز' : 'Quiz Assigned'}
                      </Button>
                    )}
                    {curriculumContent.assignment_title && !assignment && (
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={handleAssignCurriculumAssignment}
                        disabled={assigningCurriculumAssignment}
                        className="flex items-center gap-2"
                      >
                        {assigningCurriculumAssignment ? <Loader2 className="h-4 w-4 animate-spin" /> : <ClipboardList className="h-4 w-4" />}
                        {isRTL ? 'اسناد واجب المنهج' : 'Assign Curriculum Assignment'}
                      </Button>
                    )}
                    {curriculumContent.assignment_title && assignment && (
                      <Button size="sm" variant="outline" disabled className="flex items-center gap-2">
                        <CheckCircle className="h-4 w-4 text-primary" />
                        {isRTL ? 'تم اسناد الواجب' : 'Assignment Assigned'}
                      </Button>
                    )}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        ) : canManage ? (
          <Card className="border-warning/50 bg-warning/5">
            <CardContent className="flex items-center gap-3 py-4">
              <AlertCircle className="h-5 w-5 text-warning shrink-0" />
              <div>
                <p className="text-sm font-medium">{isRTL ? 'لا يوجد محتوى منهج لهذه السيشن' : 'No curriculum content for this session'}</p>
                <p className="text-xs text-muted-foreground">{isRTL ? 'يمكنك إضافة المحتوى من صفحة إدارة المنهج' : 'You can add content from the Curriculum Management page'}</p>
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card className="border-muted">
            <CardContent className="flex items-center gap-3 py-4">
              <BookOpen className="h-5 w-5 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                {isRTL ? 'لا يوجد محتوى متاح لهذه السيشن' : 'No content available for this session'}
              </p>
            </CardContent>
          </Card>
        )}

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
              <div className="text-sm text-muted-foreground mb-1">
                {isRTL ? 'نسبة الحضور' : 'Attendance Rate'}
              </div>
              <div className="text-2xl font-bold">{presentCount}/{students.length}</div>
              <Progress value={students.length > 0 ? (presentCount / students.length) * 100 : 0} className="mt-2" />
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <FileQuestion className="h-4 w-4 text-blue-500" />
                  {isRTL ? 'الكويز' : 'Quiz'}
                </CardTitle>
                {canManage && quizAssignment && (
                  <div className="flex items-center gap-1">
                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={handleEditQuiz}>
                      <Pencil className="h-3 w-3" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={() => setDeleteQuizDialogOpen(true)}>
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {quizAssignment ? (
                <>
                  <div className="text-sm text-muted-foreground mb-1">
                    {language === 'ar' ? quizAssignment.quizzes?.title_ar : quizAssignment.quizzes?.title}
                  </div>
                  <div className="text-2xl font-bold">{quizCompletedCount}/{students.length}</div>
                  <Progress value={students.length > 0 ? (quizCompletedCount / students.length) * 100 : 0} className="mt-2" />
                  {canManage && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full mt-3"
                      onClick={() => setQuizResultsDialogOpen(true)}
                    >
                      <Eye className="h-4 w-4 mr-1" />
                      {isRTL ? 'عرض النتائج التفصيلية' : 'View Detailed Results'}
                    </Button>
                  )}
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
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <ClipboardList className="h-4 w-4 text-purple-500" />
                  {isRTL ? 'الواجب' : 'Assignment'}
                </CardTitle>
                {canManage && assignment && (
                  <div className="flex items-center gap-1">
                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={handleEditAssignment}>
                      <Pencil className="h-3 w-3" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={() => setDeleteAssignmentDialogOpen(true)}>
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {assignment ? (
                <>
                  <div className="text-sm text-muted-foreground mb-1">
                    {language === 'ar' ? assignment.title_ar : assignment.title}
                  </div>
                  <div className="text-2xl font-bold">{assignmentSubmittedCount}/{students.length}</div>
                  <Progress value={students.length > 0 ? (assignmentSubmittedCount / students.length) * 100 : 0} className="mt-2" />
                  {canManage && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full mt-3"
                      onClick={() => setAssignmentSubmissionsDialogOpen(true)}
                    >
                      <Eye className="h-4 w-4 mr-1" />
                      {isRTL ? 'عرض التسليمات والتصحيح' : 'View Submissions & Grade'}
                    </Button>
                  )}
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


        {/* Instructor Attendance Card */}
        {group?.instructor_id && (role === 'admin' || role === 'reception' || (role === 'instructor' && user?.id === group.instructor_id)) && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <UserCheck className="h-5 w-5" />
                {isRTL ? 'حضور المدرب' : 'Instructor Attendance'}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-4 flex-wrap">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">{isRTL ? 'المدرب:' : 'Instructor:'}</span>
                  <span className="font-medium">
                    {language === 'ar' ? (instructorProfile?.full_name_ar || instructorProfile?.full_name) : instructorProfile?.full_name}
                  </span>
                  {staffAttendance && getStaffAttendanceBadge(staffAttendance.status)}
                  {staffAttendance?.status === 'inferred' && (
                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                      <AlertCircle className="h-3 w-3" />
                      {isRTL ? 'تقديري' : 'Estimated'}
                    </span>
                  )}
                </div>
                {staffAttendance && (
                  <div className="text-sm text-muted-foreground">
                    {staffAttendance.actual_hours} {isRTL ? 'ساعة' : 'hrs'}
                  </div>
                )}
              </div>

              {(role === 'admin' || role === 'reception') && (
                <div className="flex items-center gap-3 mt-4 pt-4 border-t flex-wrap">
                  <Select 
                    value={staffAttendanceForm.status} 
                    onValueChange={(v) => setStaffAttendanceForm(prev => ({ ...prev, status: v }))}
                  >
                    <SelectTrigger className="w-36">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="confirmed">{isRTL ? 'مؤكد' : 'Confirmed'}</SelectItem>
                      <SelectItem value="absent">{isRTL ? 'غائب' : 'Absent'}</SelectItem>
                    </SelectContent>
                  </Select>
                  <div className="flex items-center gap-2">
                    <Label className="text-sm whitespace-nowrap">{isRTL ? 'ساعات فعلية:' : 'Actual hrs:'}</Label>
                    <span className="text-sm font-medium">{session ? (session.duration_minutes / 60).toFixed(2) : 0}</span>
                  </div>
                  <Button size="sm" onClick={handleSaveStaffAttendance} disabled={savingStaffAttendance}>
                    {savingStaffAttendance ? '...' : (isRTL ? 'حفظ' : 'Save')}
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Students Table */}
        <Card>
          <CardHeader>
            <CardTitle>{role === 'student' ? (isRTL ? 'أدائي' : 'My Performance') : (isRTL ? 'أداء الطلاب' : 'Student Performance')}</CardTitle>
            <CardDescription>
              {role === 'student' 
                ? (isRTL ? 'عرض حضورك ودرجاتك' : 'View your attendance and scores')
                : (isRTL ? 'عرض الحضور والدرجات لكل طالب' : 'View attendance and scores for each student')
              }
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/30 hover:bg-muted/30">
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
                      {role === 'student' 
                        ? (isRTL ? 'لا توجد بيانات بعد' : 'No data yet')
                        : (isRTL ? 'لا يوجد طلاب في هذه المجموعة' : 'No students in this group')
                      }
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

        {/* Evaluation Grid (Admin/Instructor only) */}
        {canManage && group?.age_group_id && (
          <SessionEvaluationGrid
            sessionId={session.id}
            groupId={session.group_id}
            ageGroupId={group.age_group_id}
            students={students
              .filter(s => s.attendance_status === 'present' || s.attendance_status === 'late' || s.attendance_status === null)
              .map(s => ({
                student_id: s.student_id,
                student_name: s.student_name,
                student_name_ar: s.student_name_ar,
                quiz_score: s.quiz_score,
                quiz_max_score: s.quiz_max_score,
                assignment_score: s.assignment_score,
                assignment_max_score: s.assignment_max_score,
              }))}
            attendanceComplete={students.length > 0 && students.every(s => s.attendance_status !== null)}
          />
        )}
        {/* Edit Quiz Time Dialog */}
        <Dialog open={editQuizDialogOpen} onOpenChange={setEditQuizDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{isRTL ? 'تعديل موعد الكويز' : 'Edit Quiz Schedule'}</DialogTitle>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label>{isRTL ? 'وقت البدء الجديد' : 'New Start Time'}</Label>
                <Input
                  type="datetime-local"
                  value={editQuizStartTime}
                  onChange={(e) => setEditQuizStartTime(e.target.value)}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditQuizDialogOpen(false)}>
                {isRTL ? 'إلغاء' : 'Cancel'}
              </Button>
              <Button onClick={handleSaveQuizEdit} disabled={savingQuiz || !editQuizStartTime}>
                {savingQuiz ? (isRTL ? 'جاري الحفظ...' : 'Saving...') : (isRTL ? 'حفظ' : 'Save')}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Edit Assignment Dialog */}
        <Dialog open={assignmentDialogOpen} onOpenChange={setAssignmentDialogOpen}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>
                {isRTL ? 'تعديل الواجب' : 'Edit Assignment'}
              </DialogTitle>
              <DialogDescription>
                {isRTL ? 'عدّل تفاصيل الواجب' : 'Edit assignment details'}
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label>{isRTL ? 'العنوان' : 'Title'}</Label>
                <Input
                  value={assignmentForm.title}
                  onChange={(e) => setAssignmentForm({ ...assignmentForm, title: e.target.value })}
                  placeholder={isRTL ? 'مثال: تمارين السيشن الأول' : 'e.g., Session 1 Practice'}
                />
              </div>
              <div className="grid gap-2">
                <Label>{isRTL ? 'الوصف' : 'Description'}</Label>
                <Textarea
                  value={assignmentForm.description}
                  onChange={(e) => setAssignmentForm({ ...assignmentForm, description: e.target.value })}
                  placeholder={isRTL ? 'تعليمات الواجب...' : 'Assignment instructions...'}
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
              
              {/* File Upload */}
              <div className="grid gap-2">
                <Label>{isRTL ? 'ملف مرفق (اختياري)' : 'Attachment (optional)'}</Label>
                {assignmentFile ? (
                  <div className="flex items-center gap-2 p-3 rounded-lg border bg-muted/30">
                    <FileIcon className="h-5 w-5 text-muted-foreground" />
                    <span className="flex-1 text-sm truncate">{assignmentFile.name}</span>
                    <Button 
                      type="button"
                      variant="ghost" 
                      size="icon" 
                      className="h-6 w-6"
                      onClick={() => setAssignmentFile(null)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ) : (
                  <div className="relative">
                    <input
                      type="file"
                      id="assignment-file"
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                      accept=".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.jpg,.jpeg,.png,.gif,.mp4,.mp3,.zip"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          if (file.size > 50 * 1024 * 1024) {
                            toast({
                              title: isRTL ? 'حجم الملف كبير جداً' : 'File too large',
                              description: isRTL ? 'الحد الأقصى 50 ميجابايت' : 'Maximum file size is 50MB',
                              variant: 'destructive',
                            });
                            return;
                          }
                          setAssignmentFile(file);
                        }
                      }}
                    />
                    <div className="flex items-center justify-center gap-2 p-4 rounded-lg border-2 border-dashed border-muted-foreground/30 hover:border-primary/50 transition-colors cursor-pointer">
                      <Upload className="h-5 w-5 text-muted-foreground" />
                      <span className="text-sm text-muted-foreground">
                        {isRTL ? 'اضغط لرفع ملف أو اسحب وأفلت' : 'Click to upload or drag and drop'}
                      </span>
                    </div>
                  </div>
                )}
                <p className="text-xs text-muted-foreground">
                  {isRTL ? 'PDF, Word, PowerPoint, Excel, صور, فيديو, صوت (حتى 50MB)' : 'PDF, Word, PowerPoint, Excel, Images, Video, Audio (up to 50MB)'}
                </p>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setAssignmentDialogOpen(false)}>
                {isRTL ? 'إلغاء' : 'Cancel'}
              </Button>
              <Button 
                onClick={handleSaveAssignment} 
                disabled={savingAssignment || uploadingFile || !assignmentForm.title || !assignmentForm.due_date}
              >
                {uploadingFile 
                  ? (isRTL ? 'جاري رفع الملف...' : 'Uploading...')
                  : savingAssignment 
                    ? (isRTL ? 'جاري الحفظ...' : 'Saving...') 
                    : (editingAssignment ? (isRTL ? 'تحديث' : 'Update') : (isRTL ? 'إنشاء' : 'Create'))
                }
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Delete Quiz Confirmation */}
        <AlertDialog open={deleteQuizDialogOpen} onOpenChange={setDeleteQuizDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{isRTL ? 'إزالة الكويز' : 'Remove Quiz'}</AlertDialogTitle>
              <AlertDialogDescription>
                {isRTL 
                  ? 'هل أنت متأكد من إزالة الكويز من هذه السيشن؟ سيتم حذف جميع النتائج المرتبطة.'
                  : 'Are you sure you want to remove the quiz from this session? All related submissions will be deleted.'
                }
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>{isRTL ? 'إلغاء' : 'Cancel'}</AlertDialogCancel>
              <AlertDialogAction onClick={handleDeleteQuiz} disabled={deleting} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                {deleting ? (isRTL ? 'جاري الحذف...' : 'Removing...') : (isRTL ? 'إزالة' : 'Remove')}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Delete Assignment Confirmation */}
        <AlertDialog open={deleteAssignmentDialogOpen} onOpenChange={setDeleteAssignmentDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{isRTL ? 'إزالة الواجب' : 'Remove Assignment'}</AlertDialogTitle>
              <AlertDialogDescription>
                {isRTL 
                  ? 'هل أنت متأكد من إزالة الواجب من هذه السيشن؟ سيتم حذف جميع التسليمات المرتبطة.'
                  : 'Are you sure you want to remove the assignment from this session? All related submissions will be deleted.'
                }
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>{isRTL ? 'إلغاء' : 'Cancel'}</AlertDialogCancel>
              <AlertDialogAction onClick={handleDeleteAssignment} disabled={deleting} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                {deleting ? (isRTL ? 'جاري الحذف...' : 'Removing...') : (isRTL ? 'إزالة' : 'Remove')}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Attendance Dialog */}
        <Dialog open={attendanceDialogOpen} onOpenChange={setAttendanceDialogOpen}>
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {attendancePartial 
                  ? (isRTL ? 'إكمال تسجيل الحضور' : 'Complete Attendance')
                  : (isRTL ? 'تسجيل الحضور' : 'Record Attendance')
                }
              </DialogTitle>
              <DialogDescription>
                {isRTL 
                  ? `سيشن ${session.session_number} - ${session.session_date}`
                  : `Session ${session.session_number} - ${session.session_date}`
                }
                {attendancePartial && (
                  <span className="block mt-1 text-orange-600">
                    {isRTL 
                      ? `${studentsWithAttendance} من ${totalSessionStudents} مسجلين بالفعل - يظهر فقط الطلاب الغير مسجلين`
                      : `${studentsWithAttendance} of ${totalSessionStudents} already recorded - showing only unrecorded students`
                    }
                  </span>
                )}
              </DialogDescription>
            </DialogHeader>
            
            {unrecordedStudents.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <CheckCircle className="h-12 w-12 mx-auto text-green-500 mb-2" />
                <p>{isRTL ? 'تم تسجيل حضور جميع الطلاب' : 'All students have been recorded'}</p>
              </div>
            ) : (
              <>
                {/* Quick Actions */}
                <div className="flex gap-2 flex-wrap py-2 border-b">
                  <Button size="sm" variant="outline" onClick={() => markAllAs('present')} className="text-green-600 border-green-200 hover:bg-green-50">
                    {isRTL ? 'الكل حاضر' : 'Mark All Present'}
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => markAllAs('absent')} className="text-red-600 border-red-200 hover:bg-red-50">
                    {isRTL ? 'الكل غائب' : 'Mark All Absent'}
                  </Button>
                </div>
                
                <div className="space-y-3 py-4">
                  {unrecordedStudents.map((student) => (
                    <div key={student.student_id} className="flex items-center justify-between p-3 rounded-lg border bg-muted/30">
                      <span className="font-medium">
                        {language === 'ar' ? student.student_name_ar : student.student_name}
                      </span>
                      <Select 
                        value={attendanceRecords[student.student_id] || ''} 
                        onValueChange={(value) => setAttendanceRecords(prev => ({ ...prev, [student.student_id]: value }))}
                      >
                        <SelectTrigger className={`w-36 ${!attendanceRecords[student.student_id] ? 'border-orange-300' : ''}`}>
                          <SelectValue placeholder={isRTL ? 'اختر الحالة' : 'Select status'} />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="present">
                            <span className="flex items-center gap-2">
                              <span className="w-2 h-2 rounded-full bg-green-500" />
                              {isRTL ? 'حاضر' : 'Present'}
                            </span>
                          </SelectItem>
                          <SelectItem value="absent">
                            <span className="flex items-center gap-2">
                              <span className="w-2 h-2 rounded-full bg-red-500" />
                              {isRTL ? 'غائب' : 'Absent'}
                            </span>
                          </SelectItem>
                          <SelectItem value="late">
                            <span className="flex items-center gap-2">
                              <span className="w-2 h-2 rounded-full bg-yellow-500" />
                              {isRTL ? 'متأخر' : 'Late'}
                            </span>
                          </SelectItem>
                          <SelectItem value="excused">
                            <span className="flex items-center gap-2">
                              <span className="w-2 h-2 rounded-full bg-blue-500" />
                              {isRTL ? 'معتذر' : 'Excused'}
                            </span>
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  ))}
                </div>

                {!allStudentsSelected && (
                  <p className="text-sm text-orange-600 flex items-center gap-1">
                    <AlertCircle className="h-4 w-4" />
                    {isRTL ? 'لازم تحدد حضور أو غياب لكل الطلاب' : 'You must select attendance status for all students'}
                  </p>
                )}
              </>
            )}
            
            <DialogFooter>
              <Button variant="outline" onClick={() => setAttendanceDialogOpen(false)}>
                {isRTL ? 'إلغاء' : 'Cancel'}
              </Button>
              <Button 
                onClick={handleSaveAttendance} 
                disabled={savingAttendance || !allStudentsSelected || unrecordedStudents.length === 0}
              >
                {savingAttendance ? (isRTL ? 'جاري الحفظ...' : 'Saving...') : (isRTL ? 'حفظ الحضور' : 'Save Attendance')}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Quiz Results Dialog */}
        {quizAssignment && (
          <QuizResultsDialog
            open={quizResultsDialogOpen}
            onOpenChange={setQuizResultsDialogOpen}
            quizAssignmentId={quizAssignment.id}
            quizId={quizAssignment.quiz_id}
            quizTitle={quizAssignment.quizzes?.title || ''}
            quizTitleAr={quizAssignment.quizzes?.title_ar || ''}
            groupId={session.group_id}
            passingScore={quizAssignment.quizzes?.passing_score || 60}
          />
        )}

        {/* Assignment Submissions Dialog */}
        {assignment && (
          <AssignmentSubmissionsDialog
            open={assignmentSubmissionsDialogOpen}
            onOpenChange={setAssignmentSubmissionsDialogOpen}
            assignmentId={assignment.id}
            assignmentTitle={assignment.title}
            assignmentTitleAr={assignment.title_ar}
            maxScore={assignment.max_score}
            groupId={session.group_id}
            onGraded={fetchSessionData}
          />
        )}
      </div>
    </DashboardLayout>
  );
}
