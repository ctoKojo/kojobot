import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { DashboardLayout } from '@/components/DashboardLayout';
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
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { formatTime12Hour } from '@/lib/timeUtils';
import { QuizResultsDialog } from '@/components/session/QuizResultsDialog';
import { AssignmentSubmissionsDialog } from '@/components/session/AssignmentSubmissionsDialog';
import {
  ArrowLeft,
  ArrowRight,
  Calendar,
  Clock,
  Users,
  FileQuestion,
  ClipboardList,
  AlertCircle,
  Plus,
  Import,
  UserCheck,
  Video,
  Pencil,
  Trash2,
  ExternalLink,
  Upload,
  X,
  FileIcon,
  Eye,
} from 'lucide-react';

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
}

interface Group {
  id: string;
  name: string;
  name_ar: string;
  instructor_id?: string | null;
  attendance_mode?: string;
  session_link?: string | null;
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
  
  // Create/Edit assignment dialog
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

  // Auto-confirm instructor attendance when they perform any activity on the session
  const autoConfirmInstructorAttendance = async () => {
    if (!user || !group || !session) return;
    // Only for instructors who own this group
    if (user.id !== group.instructor_id) return;
    // Don't auto-confirm cancelled sessions
    if (session.status === 'cancelled') return;

    try {
      // Check if a staff attendance record already exists (don't override manual decisions)
      const { data: existing } = await supabase
        .from('session_staff_attendance')
        .select('id')
        .eq('session_id', session.id)
        .eq('staff_id', user.id)
        .maybeSingle();

      if (existing) return; // Record exists, don't override

      // Insert auto-confirmed attendance
      const actualHours = session.duration_minutes / 60;
      await supabase
        .from('session_staff_attendance')
        .insert({
          session_id: session.id,
          staff_id: user.id,
          status: 'confirmed',
          actual_hours: actualHours,
        });

      // Auto-complete session if time has passed
      if (session.status === 'scheduled') {
        const sessionDateTime = new Date(`${session.session_date}T${session.session_time}`);
        const sessionEndTime = new Date(sessionDateTime.getTime() + session.duration_minutes * 60 * 1000);
        if (new Date() >= sessionEndTime) {
          await supabase
            .from('sessions')
            .update({ status: 'completed' })
            .eq('id', session.id);
        }
      }

      // Refresh data to reflect changes
      fetchSessionData();
    } catch (error) {
      console.error('Auto-confirm instructor attendance error:', error);
    }
  };

  // Check and update session status based on time
  const checkAndUpdateSessionStatus = useCallback(async () => {
    if (!session || session.status === 'completed') return;
    
    const sessionDateTime = new Date(`${session.session_date}T${session.session_time}`);
    const sessionEndTime = new Date(sessionDateTime.getTime() + session.duration_minutes * 60 * 1000);
    const now = new Date();
    
    if (now >= sessionEndTime) {
      // Session should be completed
      const { error } = await supabase
        .from('sessions')
        .update({ status: 'completed' })
        .eq('id', session.id);
      
      if (!error) {
        setSession(prev => prev ? { ...prev, status: 'completed' } : null);
        toast({
          title: isRTL ? 'تم تحديث الحالة' : 'Status Updated',
          description: isRTL ? 'تم تحديث حالة السيشن تلقائياً' : 'Session status updated automatically',
        });
      }
    }
  }, [session, isRTL]);

  useEffect(() => {
    if (sessionId) {
      fetchSessionData();
    }
  }, [sessionId]);

  // Real-time status sync
  useEffect(() => {
    checkAndUpdateSessionStatus();
    
    // Check every minute
    const interval = setInterval(checkAndUpdateSessionStatus, 60000);
    
    return () => clearInterval(interval);
  }, [checkAndUpdateSessionStatus]);

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
      
      // Fetch group with attendance mode and session link
      const { data: groupData } = await supabase
        .from('groups')
        .select('id, name, name_ar, instructor_id, attendance_mode, session_link')
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
        .select('id, title, title_ar, description, description_ar, max_score, due_date')
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
      // Auto-confirm instructor attendance
      autoConfirmInstructorAttendance();
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
        
        const { error: uploadError, data: uploadData } = await supabase.storage
          .from('assignments')
          .upload(fileName, assignmentFile);
        
        if (uploadError) throw uploadError;
        
        const { data: publicUrl } = supabase.storage
          .from('assignments')
          .getPublicUrl(fileName);
        
        attachmentUrl = publicUrl.publicUrl;
        // Map MIME type to allowed database values: 'text', 'image', 'pdf', 'video'
        const mimeType = assignmentFile.type;
        if (mimeType.startsWith('image/')) {
          attachmentType = 'image';
        } else if (mimeType === 'application/pdf') {
          attachmentType = 'pdf';
        } else if (mimeType.startsWith('video/')) {
          attachmentType = 'video';
        } else {
          attachmentType = 'text'; // Default for documents, audio, etc.
        }
        setUploadingFile(false);
      }
      
      if (editingAssignment && assignment) {
        // Update existing assignment
        const updateData: any = {
          title: assignmentForm.title,
          title_ar: assignmentForm.title,
          description: assignmentForm.description || null,
          description_ar: assignmentForm.description || null,
          max_score: assignmentForm.max_score,
          due_date: new Date(assignmentForm.due_date).toISOString(),
        };
        
        // Only update attachment if new file was uploaded
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
      } else {
        // Create new assignment
        const { error } = await supabase
          .from('assignments')
          .insert({
            title: assignmentForm.title,
            title_ar: assignmentForm.title,
            description: assignmentForm.description || null,
            description_ar: assignmentForm.description || null,
            max_score: assignmentForm.max_score,
            due_date: new Date(assignmentForm.due_date).toISOString(),
            session_id: session.id,
            group_id: session.group_id,
            assigned_by: user.id,
            attachment_url: attachmentUrl,
            attachment_type: attachmentType,
          });
        
        if (error) throw error;
        
        toast({
          title: isRTL ? 'تم الإنشاء' : 'Assignment Created',
          description: isRTL ? 'تم إنشاء الواجب بنجاح' : 'Assignment created successfully',
        });
      }
      
      setAssignmentDialogOpen(false);
      setEditingAssignment(false);
      setAssignmentForm({ title: '', description: '', max_score: 100, due_date: '' });
      setAssignmentFile(null);
      fetchSessionData();
      // Auto-confirm instructor attendance
      autoConfirmInstructorAttendance();
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

  const openAttendanceDialog = () => {
    // Initialize attendance records from current student data
    const records: Record<string, string> = {};
    students.forEach(s => {
      records[s.student_id] = s.attendance_status || 'absent';
    });
    setAttendanceRecords(records);
    setAttendanceDialogOpen(true);
  };

  const handleSaveAttendance = async () => {
    if (!session || !user) return;
    
    setSavingAttendance(true);
    try {
      // First, delete existing attendance for this session
      await supabase
        .from('attendance')
        .delete()
        .eq('session_id', session.id);
      
      // Insert new attendance records
      const attendanceToInsert = Object.entries(attendanceRecords).map(([studentId, status]) => ({
        session_id: session.id,
        student_id: studentId,
        status,
        recorded_by: user.id,
      }));
      
      const { error } = await supabase
        .from('attendance')
        .insert(attendanceToInsert);
      
      if (error) throw error;
      
      toast({
        title: isRTL ? 'تم الحفظ' : 'Attendance Saved',
        description: isRTL ? 'تم حفظ سجل الحضور بنجاح' : 'Attendance records saved successfully',
      });
      
      setAttendanceDialogOpen(false);
      fetchSessionData();
      // Auto-confirm instructor attendance
      autoConfirmInstructorAttendance();
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
    students.forEach(s => {
      newRecords[s.student_id] = status;
    });
    setAttendanceRecords(newRecords);
  };

  const handleSaveStaffAttendance = async () => {
    if (!session || !group?.instructor_id || !user) return;
    setSavingStaffAttendance(true);
    try {
      const record = {
        session_id: session.id,
        staff_id: group.instructor_id,
        status: staffAttendanceForm.status,
        actual_hours: staffAttendanceForm.actual_hours,
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
  const isOnline = group?.attendance_mode === 'online';

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
              <div className="flex items-center gap-2">
                {isOnline && group?.session_link && (
                  <Button variant="outline" size="sm" asChild>
                    <a href={group.session_link} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2">
                      <Video className="h-4 w-4" />
                      {isRTL ? 'رابط السيشن' : 'Join Session'}
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  </Button>
                )}
                <Badge className={session.status === 'completed' ? 'bg-green-500' : 'bg-blue-500'}>
                  {session.status === 'completed' ? (isRTL ? 'مكتمل' : 'Completed') : (isRTL ? 'مجدول' : 'Scheduled')}
                </Badge>
              </div>
            </div>
          </CardHeader>
        </Card>

        {/* Quick Actions for Admin/Instructor */}
        {canManage && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">{isRTL ? 'إجراءات سريعة' : 'Quick Actions'}</CardTitle>
            </CardHeader>
            <CardContent className="flex gap-4 flex-wrap">
              <Button
                variant="outline"
                onClick={openAttendanceDialog}
                className="flex items-center gap-2"
              >
                <UserCheck className="h-4 w-4" />
                {isRTL ? 'تسجيل الحضور' : 'Record Attendance'}
              </Button>
              {isOnline && group?.session_link && (
                <Button variant="outline" asChild>
                  <a href={group.session_link} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2">
                    <Video className="h-4 w-4" />
                    {isRTL ? 'انضم للسيشن' : 'Join Session'}
                    <ExternalLink className="h-3 w-3" />
                  </a>
                </Button>
              )}
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
                  onClick={() => {
                    setEditingAssignment(false);
                    setAssignmentForm({ title: '', description: '', max_score: 100, due_date: '' });
                    setAssignmentDialogOpen(true);
                  }}
                  className="flex items-center gap-2"
                >
                  <Plus className="h-4 w-4" />
                  {isRTL ? 'إنشاء واجب' : 'Create Assignment'}
                </Button>
              )}
            </CardContent>
          </Card>
        )}

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
                    <Input
                      type="number"
                      step="0.25"
                      min="0"
                      className="w-20"
                      value={staffAttendanceForm.actual_hours}
                      onChange={(e) => setStaffAttendanceForm(prev => ({ ...prev, actual_hours: parseFloat(e.target.value) || 0 }))}
                    />
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

        {/* Create/Edit Assignment Dialog */}
        <Dialog open={assignmentDialogOpen} onOpenChange={setAssignmentDialogOpen}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>
                {editingAssignment 
                  ? (isRTL ? 'تعديل الواجب' : 'Edit Assignment')
                  : (isRTL ? 'إنشاء واجب جديد' : 'Create New Assignment')
                }
              </DialogTitle>
              <DialogDescription>
                {editingAssignment
                  ? (isRTL ? 'عدّل تفاصيل الواجب' : 'Edit assignment details')
                  : (isRTL ? 'أنشئ واجب جديد لهذه السيشن' : 'Create a new assignment for this session')
                }
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
              <DialogTitle>{isRTL ? 'تسجيل الحضور' : 'Record Attendance'}</DialogTitle>
              <DialogDescription>
                {isRTL 
                  ? `سيشن ${session.session_number} - ${session.session_date}`
                  : `Session ${session.session_number} - ${session.session_date}`
                }
              </DialogDescription>
            </DialogHeader>
            
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
              {students.map((student) => (
                <div key={student.student_id} className="flex items-center justify-between p-3 rounded-lg border bg-muted/30">
                  <span className="font-medium">
                    {language === 'ar' ? student.student_name_ar : student.student_name}
                  </span>
                  <Select 
                    value={attendanceRecords[student.student_id] || 'absent'} 
                    onValueChange={(value) => setAttendanceRecords(prev => ({ ...prev, [student.student_id]: value }))}
                  >
                    <SelectTrigger className="w-32">
                      <SelectValue />
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
            
            <DialogFooter>
              <Button variant="outline" onClick={() => setAttendanceDialogOpen(false)}>
                {isRTL ? 'إلغاء' : 'Cancel'}
              </Button>
              <Button onClick={handleSaveAttendance} disabled={savingAttendance}>
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
