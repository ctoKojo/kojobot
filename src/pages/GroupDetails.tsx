import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  Users, Calendar, Clock, User, BookOpen, 
  FileText, ArrowLeft, CheckCircle, XCircle, AlertCircle,
  TrendingUp, Target, Video, Copy, ExternalLink, Snowflake
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { RescheduleDialog } from '@/components/group/RescheduleDialog';
import { EditSessionDialog } from '@/components/group/EditSessionDialog';
import { LevelProgressTab } from '@/components/group/LevelProgressTab';
import { formatTime12Hour, formatDate } from '@/lib/timeUtils';
import { getGroupTypeLabel, getDayName } from '@/lib/constants';
import { isSessionActiveCairo } from '@/lib/sessionTimeGuard';

interface AttendanceRecord {
  id: string;
  student_id: string;
  session_id: string;
  status: string;
}

interface StudentAttendanceStats {
  user_id: string;
  full_name: string;
  full_name_ar: string | null;
  avatar_url: string | null;
  present: number;
  absent: number;
  late: number;
  attendanceRate: number;
}

interface SessionWithAttendance {
  id: string;
  session_date: string;
  session_time: string;
  status: string;
  topic: string | null;
  topic_ar: string | null;
  session_number: number | null;
  duration_minutes: number;
  presentCount: number;
  absentCount: number;
  lateCount: number;
}

interface GroupData {
  group: any;
  instructor: any;
  students: any[];
  sessions: any[];
  assignments: any[];
  quizAssignments: any[];
  attendance: AttendanceRecord[];
}

const SESSIONS_PER_LEVEL = 12;

export default function GroupDetails() {
  const { groupId } = useParams();
  const navigate = useNavigate();
  const { isRTL, language } = useLanguage();
  const { role } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<GroupData | null>(null);

  const handleCopyLink = () => {
    if (data?.group?.session_link) {
      navigator.clipboard.writeText(data.group.session_link);
      toast({
        title: isRTL ? 'تم النسخ' : 'Copied',
        description: isRTL ? 'تم نسخ الرابط' : 'Link copied to clipboard',
      });
    }
  };

  useEffect(() => {
    if (groupId) fetchGroupData();
  }, [groupId]);

  const fetchGroupData = async () => {
    try {
      // Fetch group with related data
      const { data: group } = await supabase
        .from('groups')
        .select('*, age_groups(name, name_ar), levels(name, name_ar)')
        .eq('id', groupId)
        .single();

      // Fetch instructor
      const { data: instructor } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', group?.instructor_id)
        .maybeSingle();

      // Fetch students in group
      const { data: groupStudents } = await supabase
        .from('group_students')
        .select('student_id')
        .eq('group_id', groupId)
        .eq('is_active', true);

      const studentIds = groupStudents?.map(gs => gs.student_id) || [];
      let students: any[] = [];
      if (studentIds.length > 0) {
        const { data: studentsData } = await supabase
          .from('profiles')
          .select('*')
          .in('user_id', studentIds);
        students = studentsData || [];
      }

      // Fetch ALL sessions (not limited) for level tracking
      const { data: sessions } = await supabase
        .from('sessions')
        .select('*')
        .eq('group_id', groupId)
        .order('session_number', { ascending: true, nullsFirst: false });

      // Fetch attendance for all sessions
      const sessionIds = sessions?.map(s => s.id) || [];
      let attendance: AttendanceRecord[] = [];
      if (sessionIds.length > 0) {
        const { data: attendanceData } = await supabase
          .from('attendance')
          .select('*')
          .in('session_id', sessionIds);
        attendance = attendanceData || [];
      }

      // Fetch assignments for this group
      const { data: assignments } = await supabase
        .from('assignments')
        .select('*')
        .eq('group_id', groupId)
        .eq('is_auto_generated', false)
        .order('due_date', { ascending: false });

      // Fetch quiz assignments for this group
      const { data: quizAssignments } = await supabase
        .from('quiz_assignments')
        .select('*, quizzes(title, title_ar, duration_minutes)')
        .eq('group_id', groupId)
        .eq('is_auto_generated', false)
        .order('created_at', { ascending: false });

      setData({
        group,
        instructor,
        students,
        sessions: sessions || [],
        assignments: assignments || [],
        quizAssignments: quizAssignments || [],
        attendance,
      });
    } catch (error) {
      console.error('Error fetching group data:', error);
    } finally {
      setLoading(false);
    }
  };

  // SSOT: uses centralized formatDate from timeUtils.ts

  // SSOT: getDayName and getGroupTypeLabel imported from constants.ts

  // Level Progress calculations
  const getLevelProgress = () => {
    const sessions = data?.sessions || [];
    const completed = sessions.filter(s => s.status === 'completed').length;
    const total = SESSIONS_PER_LEVEL;
    const currentMax = Math.max(...sessions.map(s => s.session_number || 0), 0);
    const remaining = total - completed;
    const percentage = Math.round((completed / total) * 100);
    
    return {
      completed,
      total,
      currentMax,
      remaining,
      percentage,
      isComplete: completed >= total,
    };
  };

  // Calculate attendance stats for each student
  const getStudentAttendanceStats = (): StudentAttendanceStats[] => {
    if (!data) return [];
    
    const { students, sessions, attendance } = data;
    const completedSessionIds = sessions
      .filter(s => s.status === 'completed')
      .map(s => s.id);
    
    return students.map(student => {
      const studentAttendance = attendance.filter(a => 
        a.student_id === student.user_id && 
        completedSessionIds.includes(a.session_id)
      );
      
      const present = studentAttendance.filter(a => a.status === 'present').length;
      const absent = studentAttendance.filter(a => a.status === 'absent').length;
      const late = studentAttendance.filter(a => a.status === 'late').length;
      const totalRecorded = present + absent + late;
      const attendanceRate = totalRecorded > 0 ? Math.round((present / totalRecorded) * 100) : 0;
      
      return {
        user_id: student.user_id,
        full_name: student.full_name,
        full_name_ar: student.full_name_ar,
        avatar_url: student.avatar_url,
        present,
        absent,
        late,
        attendanceRate,
      };
    });
  };

  // Get sessions with attendance counts
  const getSessionsWithAttendance = (): SessionWithAttendance[] => {
    if (!data) return [];
    
    return data.sessions.map(session => {
      const sessionAttendance = data.attendance.filter(a => a.session_id === session.id);
      return {
        ...session,
        presentCount: sessionAttendance.filter(a => a.status === 'present').length,
        absentCount: sessionAttendance.filter(a => a.status === 'absent').length,
        lateCount: sessionAttendance.filter(a => a.status === 'late').length,
      };
    }).sort((a, b) => (b.session_number || 0) - (a.session_number || 0));
  };

  if (loading) {
    return (
      <DashboardLayout title={isRTL ? 'تفاصيل المجموعة' : 'Group Details'}>
        <div className="flex items-center justify-center h-64">
          <p className="text-muted-foreground">{isRTL ? 'جاري التحميل...' : 'Loading...'}</p>
        </div>
      </DashboardLayout>
    );
  }

  if (!data?.group) {
    return (
      <DashboardLayout title={isRTL ? 'تفاصيل المجموعة' : 'Group Details'}>
        <div className="text-center py-12">
          <p className="text-muted-foreground">{isRTL ? 'لم يتم العثور على المجموعة' : 'Group not found'}</p>
          <Button onClick={() => navigate(-1)} className="mt-4">
            <ArrowLeft className="h-4 w-4 mr-2" />
            {isRTL ? 'رجوع' : 'Go Back'}
          </Button>
        </div>
      </DashboardLayout>
    );
  }

  const levelProgress = getLevelProgress();
  const studentStats = getStudentAttendanceStats();
  const sessionsWithAttendance = getSessionsWithAttendance();

  return (
    <DashboardLayout title={isRTL ? 'تفاصيل المجموعة' : 'Group Details'}>
      <div className="space-y-6">
        {/* Back Button */}
        <Button variant="ghost" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          {isRTL ? 'رجوع' : 'Back'}
        </Button>

        {/* Frozen Group Alert - for non-admin users */}
        {data?.group?.status === 'frozen' && role !== 'admin' && (
          <Alert className="border-sky-300 bg-sky-50 dark:bg-sky-950/30">
            <Snowflake className="h-5 w-5 text-sky-600" />
            <AlertTitle className="text-sky-800 dark:text-sky-300">
              {isRTL ? 'هذه المجموعة مجمدة' : 'This Group is Frozen'}
            </AlertTitle>
            <AlertDescription className="text-sky-700 dark:text-sky-400">
              {isRTL 
                ? 'لا يمكن إجراء أي تعديلات على هذه المجموعة حالياً. يمكنك فقط عرض البيانات السابقة.'
                : 'No modifications can be made to this group. You can only view historical data.'}
            </AlertDescription>
          </Alert>
        )}

        {/* Group Header */}
        <Card className="relative overflow-hidden border-0 shadow-md">
          <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-secondary/5" />
          <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-primary/10 to-secondary/10 rounded-full -translate-y-10 translate-x-10" />
          <CardContent className="relative p-6">
            <div className="flex flex-col md:flex-row gap-6 items-start md:items-center">
              <div className="p-4 rounded-xl bg-gradient-to-br from-primary to-secondary shadow-lg">
                <Users className="h-12 w-12 text-white" />
              </div>
              <div className="flex-1">
                <h1 className="text-2xl font-bold">
                  {language === 'ar' ? data.group.name_ar : data.group.name}
                </h1>
                <div className="flex flex-wrap gap-2 mt-2">
                  <Badge variant="secondary">
                    {getGroupTypeLabel(data.group.group_type, isRTL)}
                  </Badge>
                  {data.group.status === 'frozen' && (
                    <Badge className="bg-sky-500 text-white">
                      <Snowflake className="h-3 w-3 mr-1" />
                      {isRTL ? 'مجمدة' : 'Frozen'}
                    </Badge>
                  )}
                  <Badge variant={data.group.attendance_mode === 'online' ? 'default' : 'outline'} className={data.group.attendance_mode === 'online' ? 'bg-green-600' : ''}>
                    {data.group.attendance_mode === 'online' 
                      ? (isRTL ? 'أونلاين' : 'Online')
                      : (isRTL ? 'حضوري' : 'Offline')}
                  </Badge>
                  {data.group.age_groups && (
                    <Badge variant="outline">
                      {language === 'ar' ? data.group.age_groups.name_ar : data.group.age_groups.name}
                    </Badge>
                  )}
                  {data.group.levels && (
                    <Badge variant="outline">
                      {language === 'ar' ? data.group.levels.name_ar : data.group.levels.name}
                    </Badge>
                  )}
                </div>
                <div className="flex flex-wrap gap-4 mt-3 text-sm text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Calendar className="h-4 w-4" />
                    {getDayName(data.group.schedule_day, isRTL)}
                  </span>
                  <span className="flex items-center gap-1">
                    <Clock className="h-4 w-4" />
                    {formatTime12Hour(data.group.schedule_time, isRTL)}
                  </span>
                  <span className="flex items-center gap-1">
                    <Clock className="h-4 w-4" />
                    {data.group.duration_minutes} {isRTL ? 'دقيقة' : 'min'}
                  </span>
                </div>
              </div>

              {/* Instructor Info */}
              {data.instructor && (
                <div 
                  className="flex items-center gap-3 p-3 rounded-lg border cursor-pointer hover:bg-muted/50"
                  onClick={() => navigate(`/instructor/${data.instructor.user_id}`)}
                >
                  <Avatar>
                    <AvatarImage src={data.instructor.avatar_url} />
                    <AvatarFallback>{data.instructor.full_name?.charAt(0)}</AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="text-sm text-muted-foreground">{isRTL ? 'المدرب' : 'Instructor'}</p>
                    <p className="font-medium">
                      {language === 'ar' ? data.instructor.full_name_ar || data.instructor.full_name : data.instructor.full_name}
                    </p>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Session Link Card - for online groups (only when a session is active) */}
        {data.group.attendance_mode === 'online' && data.group.session_link && (() => {
          const hasActiveSession = (data.sessions || []).some((s: any) => 
            isSessionActiveCairo(s.session_date, s.session_time, s.duration_minutes)
          );
          if (!hasActiveSession) return null;
          return (
            <Card className="border-green-500/20 bg-gradient-to-r from-green-500/5 to-transparent">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Video className="h-5 w-5 text-green-600" />
                  {isRTL ? 'رابط الجلسة' : 'Session Link'}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
                  <div className="flex-1 p-3 bg-muted rounded-lg font-mono text-sm break-all">
                    {data.group.session_link}
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={handleCopyLink}>
                      <Copy className="h-4 w-4 mr-2" />
                      {isRTL ? 'نسخ' : 'Copy'}
                    </Button>
                    <Button size="sm" className="bg-green-600 hover:bg-green-700" asChild>
                      <a href={data.group.session_link} target="_blank" rel="noopener noreferrer">
                        <ExternalLink className="h-4 w-4 mr-2" />
                        {isRTL ? 'انضم للجلسة' : 'Join Session'}
                      </a>
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })()}

        {/* Level Progress Card */}
        <Card className="border-primary/20 bg-gradient-to-r from-primary/5 to-transparent">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Target className="h-5 w-5 text-primary" />
              {isRTL ? 'تقدم المستوى' : 'Level Progress'}
              {data.group.levels && (
                <Badge variant="secondary" className="ml-2">
                  {language === 'ar' ? data.group.levels.name_ar : data.group.levels.name}
                </Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">
                  {isRTL ? 'الجلسات المكتملة' : 'Completed Sessions'}
                </span>
                <span className="font-bold text-lg">
                  {levelProgress.completed}/{levelProgress.total}
                </span>
              </div>
              <Progress value={levelProgress.percentage} className="h-3" />
              <div className="grid grid-cols-3 gap-4 pt-2">
                <div className="text-center p-3 rounded-lg bg-background border">
                  <p className="text-2xl font-bold text-green-600">{levelProgress.completed}</p>
                  <p className="text-xs text-muted-foreground">{isRTL ? 'مكتمل' : 'Completed'}</p>
                </div>
                <div className="text-center p-3 rounded-lg bg-background border">
                  <p className="text-2xl font-bold text-blue-600">{levelProgress.currentMax}</p>
                  <p className="text-xs text-muted-foreground">{isRTL ? 'السيشن الحالي' : 'Current'}</p>
                </div>
                <div className="text-center p-3 rounded-lg bg-background border">
                  <p className="text-2xl font-bold text-orange-600">{levelProgress.remaining}</p>
                  <p className="text-xs text-muted-foreground">{isRTL ? 'متبقي' : 'Remaining'}</p>
                </div>
              </div>
              {levelProgress.isComplete && (
                <div className="flex items-center gap-2 p-3 rounded-lg bg-green-100 text-green-800">
                  <CheckCircle className="h-5 w-5" />
                  <span className="font-medium">
                    {isRTL ? 'تم إكمال المستوى!' : 'Level Complete!'}
                  </span>
                </div>
              )}
              
              {/* Reschedule Button - Admin Only */}
              {role === 'admin' && (
                <div className="pt-2">
                  <RescheduleDialog
                    groupId={groupId!}
                    scheduleDay={data.group.schedule_day}
                    scheduleTime={data.group.schedule_time}
                    onRescheduled={fetchGroupData}
                  />
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Quick Stats */}
        <div className="grid gap-3 grid-cols-2 md:grid-cols-4">
          {[
            { label: isRTL ? 'الطلاب' : 'Students', value: data.students.length, icon: Users, gradient: 'from-blue-500 to-blue-600', bgGradient: 'from-blue-500/10 to-blue-600/5' },
            { label: isRTL ? 'الجلسات' : 'Sessions', value: data.sessions.length, icon: Calendar, gradient: 'from-emerald-500 to-emerald-600', bgGradient: 'from-emerald-500/10 to-emerald-600/5' },
            { label: isRTL ? 'الكويزات' : 'Quizzes', value: data.quizAssignments.length, icon: BookOpen, gradient: 'from-purple-500 to-purple-600', bgGradient: 'from-purple-500/10 to-purple-600/5' },
            { label: isRTL ? 'الواجبات' : 'Assignments', value: data.assignments.length, icon: FileText, gradient: 'from-amber-500 to-orange-500', bgGradient: 'from-amber-500/10 to-orange-500/5' },
          ].map((stat) => (
            <Card key={stat.label} className="relative overflow-hidden border-0 shadow-sm">
              <div className={`absolute inset-0 bg-gradient-to-br ${stat.bgGradient}`} />
              <CardContent className="relative p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-2xl font-bold tracking-tight">{stat.value}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{stat.label}</p>
                  </div>
                  <div className={`p-2 rounded-xl bg-gradient-to-br ${stat.gradient}`}>
                    <stat.icon className="h-4 w-4 text-white" />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Detailed Tabs */}
        <Tabs defaultValue="students" className="w-full">
          <TabsList className="grid w-full grid-cols-3 md:grid-cols-6 h-auto">
            <TabsTrigger value="students" className="text-xs md:text-sm py-2">{isRTL ? 'الطلاب' : 'Students'}</TabsTrigger>
            <TabsTrigger value="level-progress" className="text-xs md:text-sm py-2">{isRTL ? 'تقدم المستوى' : 'Level Progress'}</TabsTrigger>
            <TabsTrigger value="attendance" className="text-xs md:text-sm py-2">{isRTL ? 'الحضور' : 'Attendance'}</TabsTrigger>
            <TabsTrigger value="sessions" className="text-xs md:text-sm py-2 hidden md:flex">{isRTL ? 'الجلسات' : 'Sessions'}</TabsTrigger>
            <TabsTrigger value="quizzes" className="text-xs md:text-sm py-2 hidden md:flex">{isRTL ? 'الكويزات' : 'Quizzes'}</TabsTrigger>
            <TabsTrigger value="assignments" className="text-xs md:text-sm py-2 hidden md:flex">{isRTL ? 'الواجبات' : 'Assignments'}</TabsTrigger>
          </TabsList>
          {/* Mobile-only additional tabs */}
          <TabsList className="grid w-full grid-cols-3 md:hidden mt-2 h-auto">
            <TabsTrigger value="sessions" className="text-xs py-2">{isRTL ? 'الجلسات' : 'Sessions'}</TabsTrigger>
            <TabsTrigger value="quizzes" className="text-xs py-2">{isRTL ? 'الكويزات' : 'Quizzes'}</TabsTrigger>
            <TabsTrigger value="assignments" className="text-xs py-2">{isRTL ? 'الواجبات' : 'Assignments'}</TabsTrigger>
          </TabsList>

          {/* Level Progress Tab */}
          <TabsContent value="level-progress">
            <LevelProgressTab
              groupId={groupId!}
              levelId={data.group.level_id}
              levelName={language === 'ar' ? data.group.levels?.name_ar || data.group.levels?.name || '' : data.group.levels?.name || ''}
              onRefresh={fetchGroupData}
            />
          </TabsContent>

          {/* Students Tab with Attendance Stats */}
          <TabsContent value="students">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  {isRTL ? 'طلاب المجموعة وإحصائيات الحضور' : 'Group Students & Attendance Stats'}
                </CardTitle>
                <CardDescription>
                  {data.students.length} {isRTL ? 'طالب' : 'student(s)'}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {data.students.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">
                    {isRTL ? 'لا يوجد طلاب' : 'No students in this group'}
                  </p>
                ) : (
                  <>
                    {/* Mobile Cards View */}
                    <div className="block md:hidden space-y-3">
                      {studentStats.map((student) => (
                        <div 
                          key={student.user_id}
                          className="p-3 rounded-lg border cursor-pointer hover:bg-muted/50"
                          onClick={() => navigate(`/student/${student.user_id}`)}
                        >
                          <div className="flex items-center gap-3 mb-3">
                            <Avatar className="h-10 w-10">
                              <AvatarImage src={student.avatar_url || undefined} />
                              <AvatarFallback>{student.full_name?.charAt(0)}</AvatarFallback>
                            </Avatar>
                            <div className="flex-1 min-w-0">
                              <p className="font-medium truncate">
                                {language === 'ar' ? student.full_name_ar || student.full_name : student.full_name}
                              </p>
                            </div>
                            <Badge 
                              variant={student.attendanceRate >= 80 ? 'default' : student.attendanceRate >= 50 ? 'secondary' : 'destructive'}
                            >
                              {student.attendanceRate}%
                            </Badge>
                          </div>
                          <div className="grid grid-cols-3 gap-2 text-center">
                            <div className="p-2 rounded bg-green-50">
                              <p className="text-lg font-bold text-green-700">{student.present}</p>
                              <p className="text-xs text-green-600">{isRTL ? 'حضر' : 'Present'}</p>
                            </div>
                            <div className="p-2 rounded bg-red-50">
                              <p className="text-lg font-bold text-red-700">{student.absent}</p>
                              <p className="text-xs text-red-600">{isRTL ? 'غاب' : 'Absent'}</p>
                            </div>
                            <div className="p-2 rounded bg-yellow-50">
                              <p className="text-lg font-bold text-yellow-700">{student.late}</p>
                              <p className="text-xs text-yellow-600">{isRTL ? 'تأخر' : 'Late'}</p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                    {/* Desktop Table View */}
                    <Table className="hidden md:table">
                      <TableHeader>
                        <TableRow>
                          <TableHead>{isRTL ? 'الطالب' : 'Student'}</TableHead>
                          <TableHead className="text-center">{isRTL ? 'حضر' : 'Present'}</TableHead>
                          <TableHead className="text-center">{isRTL ? 'غاب' : 'Absent'}</TableHead>
                          <TableHead className="text-center">{isRTL ? 'تأخر' : 'Late'}</TableHead>
                          <TableHead className="text-center">{isRTL ? 'معدل الحضور' : 'Rate'}</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {studentStats.map((student) => (
                          <TableRow 
                            key={student.user_id}
                            className="cursor-pointer hover:bg-muted/50"
                            onClick={() => navigate(`/student/${student.user_id}`)}
                          >
                            <TableCell>
                              <div className="flex items-center gap-3">
                                <Avatar className="h-8 w-8">
                                  <AvatarImage src={student.avatar_url || undefined} />
                                  <AvatarFallback>{student.full_name?.charAt(0)}</AvatarFallback>
                                </Avatar>
                                <span className="font-medium">
                                  {language === 'ar' ? student.full_name_ar || student.full_name : student.full_name}
                                </span>
                              </div>
                            </TableCell>
                            <TableCell className="text-center">
                              <Badge variant="outline" className="bg-green-50 text-green-700">
                                {student.present}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-center">
                              <Badge variant="outline" className="bg-red-50 text-red-700">
                                {student.absent}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-center">
                              <Badge variant="outline" className="bg-yellow-50 text-yellow-700">
                                {student.late}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-center">
                              <Badge 
                                variant={student.attendanceRate >= 80 ? 'default' : student.attendanceRate >= 50 ? 'secondary' : 'destructive'}
                              >
                                {student.attendanceRate}%
                              </Badge>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Attendance Summary Tab */}
          <TabsContent value="attendance">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5" />
                  {isRTL ? 'ملخص الحضور لكل جلسة' : 'Attendance per Session'}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {sessionsWithAttendance.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">
                    {isRTL ? 'لا توجد جلسات' : 'No sessions yet'}
                  </p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>#</TableHead>
                        <TableHead>{isRTL ? 'التاريخ' : 'Date'}</TableHead>
                        <TableHead>{isRTL ? 'الحالة' : 'Status'}</TableHead>
                        <TableHead className="text-center">{isRTL ? 'حضر' : 'Present'}</TableHead>
                        <TableHead className="text-center">{isRTL ? 'غاب' : 'Absent'}</TableHead>
                        <TableHead className="text-center">{isRTL ? 'تأخر' : 'Late'}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {sessionsWithAttendance.map((session) => (
                        <TableRow key={session.id}>
                          <TableCell>
                            <Badge variant="outline" className="min-w-[80px] justify-center">
                              {isRTL ? `سيشن ${session.session_number || '-'}` : `Session ${session.session_number || '-'}`}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div>
                              <p className="font-medium">{formatDate(session.session_date)}</p>
                              <p className="text-xs text-muted-foreground">{formatTime12Hour(session.session_time, isRTL)}</p>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge className={
                              session.status === 'completed' ? 'bg-green-100 text-green-800' :
                              session.status === 'cancelled' ? 'bg-red-100 text-red-800' :
                              'bg-blue-100 text-blue-800'
                            }>
                              {session.status === 'completed' ? (isRTL ? 'مكتملة' : 'Completed') :
                               session.status === 'cancelled' ? (isRTL ? 'ملغية' : 'Cancelled') :
                               (isRTL ? 'مجدولة' : 'Scheduled')}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-center">
                            <span className="text-green-600 font-medium">{session.presentCount}</span>
                          </TableCell>
                          <TableCell className="text-center">
                            <span className="text-red-600 font-medium">{session.absentCount}</span>
                          </TableCell>
                          <TableCell className="text-center">
                            <span className="text-yellow-600 font-medium">{session.lateCount}</span>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Sessions Tab */}
          <TabsContent value="sessions">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Calendar className="h-5 w-5" />
                  {isRTL ? 'الجلسات' : 'Sessions'}
                </CardTitle>
                <CardDescription>
                  {levelProgress.completed} {isRTL ? 'مكتملة' : 'completed'} / {levelProgress.total} {isRTL ? 'جلسة' : 'sessions'}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {data.sessions.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">
                    {isRTL ? 'لا توجد جلسات' : 'No sessions'}
                  </p>
                ) : (
                  <div className="space-y-2">
                    {sessionsWithAttendance.map((session) => (
                      <div key={session.id} className="flex items-center justify-between p-3 rounded-lg border">
                        <div className="flex items-center gap-3">
                          <Badge variant="outline" className="font-mono min-w-[80px] justify-center">
                            {isRTL ? `سيشن ${session.session_number || '-'}` : `Session ${session.session_number || '-'}`}
                          </Badge>
                          <div>
                            <p className="font-medium">
                              {language === 'ar' 
                                ? session.topic_ar || session.topic || `الجلسة رقم ${session.session_number}` 
                                : session.topic || `Session ${session.session_number}`}
                            </p>
                            <p className="text-sm text-muted-foreground">
                              {formatDate(session.session_date)} - {formatTime12Hour(session.session_time, isRTL)}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {session.status === 'completed' && (
                            <div className="flex gap-1 text-xs">
                              <span className="text-green-600">{session.presentCount}✓</span>
                              <span className="text-red-600">{session.absentCount}✗</span>
                            </div>
                          )}
                          <Badge className={
                            session.status === 'completed' ? 'bg-green-100 text-green-800' :
                            session.status === 'cancelled' ? 'bg-red-100 text-red-800' :
                            'bg-blue-100 text-blue-800'
                          }>
                            {session.status === 'completed' ? (isRTL ? 'مكتملة' : 'Completed') :
                             session.status === 'cancelled' ? (isRTL ? 'ملغية' : 'Cancelled') :
                             (isRTL ? 'مجدولة' : 'Scheduled')}
                          </Badge>
                          {/* Edit Session Button - Admin only for scheduled sessions */}
                          {role === 'admin' && session.status === 'scheduled' && (
                            <EditSessionDialog
                              session={session}
                              onUpdated={fetchGroupData}
                              durationMinutes={session.duration_minutes}
                            />
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Quizzes Tab */}
          <TabsContent value="quizzes">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BookOpen className="h-5 w-5" />
                  {isRTL ? 'الكويزات المعينة' : 'Assigned Quizzes'}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {data.quizAssignments.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">
                    {isRTL ? 'لا توجد كويزات' : 'No quizzes assigned'}
                  </p>
                ) : (
                  <div className="space-y-2">
                    {data.quizAssignments.map((qa: any) => (
                      <div key={qa.id} className="flex items-center justify-between p-3 rounded-lg border">
                        <div>
                          <p className="font-medium">
                            {language === 'ar' ? qa.quizzes?.title_ar : qa.quizzes?.title}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {qa.quizzes?.duration_minutes} {isRTL ? 'دقيقة' : 'min'}
                            {qa.due_date && ` • ${isRTL ? 'موعد التسليم: ' : 'Due: '}${formatDate(qa.due_date)}`}
                          </p>
                        </div>
                        <Badge variant={qa.is_active ? 'default' : 'secondary'}>
                          {qa.is_active ? (isRTL ? 'نشط' : 'Active') : (isRTL ? 'غير نشط' : 'Inactive')}
                        </Badge>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Assignments Tab */}
          <TabsContent value="assignments">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  {isRTL ? 'الواجبات' : 'Assignments'}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {data.assignments.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">
                    {isRTL ? 'لا توجد واجبات' : 'No assignments'}
                  </p>
                ) : (
                  <div className="space-y-2">
                    {data.assignments.map((assignment: any) => (
                      <div key={assignment.id} className="flex items-center justify-between p-3 rounded-lg border">
                        <div>
                          <p className="font-medium">
                            {language === 'ar' ? assignment.title_ar : assignment.title}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {isRTL ? 'موعد التسليم: ' : 'Due: '}{formatDate(assignment.due_date)}
                          </p>
                        </div>
                        <Badge variant={assignment.is_active ? 'default' : 'secondary'}>
                          {assignment.is_active ? (isRTL ? 'نشط' : 'Active') : (isRTL ? 'غير نشط' : 'Inactive')}
                        </Badge>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
